const API_URL = "https://script.google.com/macros/s/AKfycbwoEqusw52NrIIbNe14XqFs5GXgs_QH6jSTmELemtRqXa6z5-stcsHImVIrm2iIg2bn/exec";
const STORE = {
  profile: "liftcoach_profile_v2",
  gyms: "liftcoach_gyms_v2",
  machines: "liftcoach_machines_v2",
  sets: "liftcoach_sets_v2",
  queue: "liftcoach_offline_queue_v2"
};

const BODY_PARTS = ["胸上部", "胸中部", "胸下部", "肩前", "肩中", "肩後", "広背筋", "僧帽筋", "2頭", "3頭", "4頭", "ハム", "お尻", "カーフ"];
const EXERCISES = [
  ["bench-press", "ベンチプレス", "胸中部", "Press", "Mid", "BB", 2.5],
  ["incline-db-press", "インクラインDBプレス", "胸上部", "Press", "Stretch", "DB", 2],
  ["chest-press-machine", "チェストプレス", "胸中部", "Press", "Mid", "Machine", 5],
  ["pec-fly-machine", "ペックフライ", "胸中部", "Fly", "Contract", "Machine", 5],
  ["cable-fly-low", "ロープーリーケーブルフライ", "胸上部", "Fly", "Contract", "Cable", 2.5],
  ["dips", "ディップス", "胸下部", "Press", "Stretch", "BW", 1],
  ["shoulder-press-machine", "ショルダープレス", "肩前", "Press", "Mid", "Machine", 5],
  ["db-lateral-raise", "DBサイドレイズ", "肩中", "Side raise", "Mid", "DB", 2],
  ["cable-lateral-raise", "ケーブルサイドレイズ", "肩中", "Side raise", "Contract", "Cable", 2.5],
  ["reverse-pec-deck", "リバースペックデック", "肩後", "Rear fly", "Contract", "Machine", 5],
  ["lat-pulldown", "ラットプルダウン", "広背筋", "Vertical pull", "Stretch", "Machine", 5],
  ["seated-row", "シーテッドロー", "広背筋", "Horizontal pull", "Mid", "Machine", 5],
  ["db-shrug", "DBシュラッグ", "僧帽筋", "Shrug", "Contract", "DB", 2],
  ["barbell-curl", "バーベルカール", "2頭", "Curl", "Mid", "BB", 2.5],
  ["preacher-curl-machine", "プリーチャーカール", "2頭", "Curl", "Stretch", "Machine", 5],
  ["cable-pushdown", "ケーブルプレスダウン", "3頭", "Extension", "Contract", "Cable", 2.5],
  ["leg-press", "レッグプレス", "4頭", "Squat", "Mid", "Machine", 10],
  ["leg-extension", "レッグエクステンション", "4頭", "Extension", "Contract", "Machine", 5],
  ["rdl", "ルーマニアンデッドリフト", "ハム", "Hinge", "Stretch", "BB", 2.5],
  ["leg-curl", "レッグカール", "ハム", "Curl", "Contract", "Machine", 5],
  ["hip-thrust", "ヒップスラスト", "お尻", "Hinge", "Contract", "Machine", 5],
  ["calf-raise", "カーフレイズ", "カーフ", "Calf raise", "Stretch", "Machine", 5]
].map(([exercise_id, exercise_name, bodypart_ui, pattern, range_type, equipment_cat, step_kg]) => ({
  exercise_id, exercise_name, bodypart_ui, pattern, range_type, equipment_cat, step_kg,
  anatomical_target: bodypart_ui
}));

const $ = (id) => document.getElementById(id);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

let state = {
  profile: read(STORE.profile, null),
  gyms: read(STORE.gyms, []),
  machines: read(STORE.machines, []),
  sets: read(STORE.sets, []),
  bodypart: "",
  exercise: null,
  machine: null,
  editingSetId: null,
  lastSaved: null
};

function persist() {
  write(STORE.profile, state.profile);
  write(STORE.gyms, state.gyms);
  write(STORE.machines, state.machines);
  write(STORE.sets, state.sets);
}

function goalLabel(goal) {
  return { hypertrophy: "筋肥大", strength: "筋力向上", balanced: "バランス" }[goal] || "筋肥大";
}

function formatDate(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function weekStart(date = new Date()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
  return d;
}

function currentGym() {
  return state.gyms.find((gym) => gym.id === state.profile?.currentGymId) || null;
}

function currentWorkoutId() {
  return `W-${new Date().toISOString().slice(0, 10)}`;
}

function comparisonKey(exercise, machineId = "") {
  return `${exercise.exercise_id}|${machineId || exercise.equipment_cat}`;
}

function comparableSets(exercise, machineId = "") {
  const key = comparisonKey(exercise, machineId);
  return state.sets.filter((set) => set.comparison_key === key).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function currentWorkoutSets(exercise, machineId = "") {
  return comparableSets(exercise, machineId)
    .filter((set) => set.workout_id === currentWorkoutId())
    .sort((a, b) => Number(a.set_no || 0) - Number(b.set_no || 0));
}

function currentExerciseOrder(exercise, machineId = "") {
  const existing = currentWorkoutSets(exercise, machineId);
  if (existing.length && existing[0].exercise_order) return Number(existing[0].exercise_order);
  const today = state.sets.filter((set) => set.workout_id === currentWorkoutId());
  return Math.max(0, ...today.map((set) => Number(set.exercise_order || 0))) + 1;
}

function previousWorkoutSets(exercise, machineId = "", preferredOrder = null) {
  const previous = comparableSets(exercise, machineId).filter((set) => set.workout_id !== currentWorkoutId());
  if (!previous.length) return [];
  const sameOrder = preferredOrder ? previous.filter((set) => Number(set.exercise_order || 0) === Number(preferredOrder)) : [];
  const source = sameOrder.length ? sameOrder : previous;
  const previousWorkoutId = source[0].workout_id;
  return source.filter((set) => set.workout_id === previousWorkoutId).sort((a, b) => Number(a.set_no || 0) - Number(b.set_no || 0));
}

function bestRecentSet(items) {
  if (!items.length) return null;
  return [...items].sort((a, b) => {
    const aScore = a.weight * a.reps * (1 + Math.min(Number(a.rir || 0), 3) * 0.02);
    const bScore = b.weight * b.reps * (1 + Math.min(Number(b.rir || 0), 3) * 0.02);
    return bScore - aScore;
  })[0];
}

function recommendation(previous, exercise) {
  const goal = state.profile?.goal || "hypertrophy";
  const range = goal === "strength" ? [4, 8] : goal === "balanced" ? [6, 10] : [8, 12];
  if (!previous) return { weight: "", reps: range[0], text: `初回です。${range[0]}〜${range[1]}回できる軽めの重量から始めましょう。` };
  const rir = previous.rir === "" || previous.rir == null ? null : Number(previous.rir);
  if (previous.reps >= range[1] && rir !== null && rir >= 1) {
    const nextWeight = Number(previous.weight) + Number(exercise.step_kg || 2.5);
    return { weight: nextWeight, reps: range[0], text: `上限を余裕ありで達成。${nextWeight}kgへのアップ候補です。` };
  }
  if (previous.reps >= range[1]) return { weight: previous.weight, reps: previous.reps, text: "上限を達成。同じ重量でもう一度安定して達成を狙いましょう。" };
  if (previous.reps < range[0] && rir !== null && rir <= 1) {
    const nextWeight = Math.max(0, Number(previous.weight) - Number(exercise.step_kg || 2.5));
    return { weight: nextWeight, reps: range[0], text: `下限未達で余裕も少なめ。${nextWeight}kgへの調整候補です。` };
  }
  return { weight: previous.weight, reps: Math.min(previous.reps + 1, range[1]), text: `同じ重量で前回より1回多く、${Math.min(previous.reps + 1, range[1])}回を狙いましょう。` };
}

function nextSetRecommendation(lastSet) {
  const goal = state.profile?.goal || "hypertrophy";
  const range = goal === "strength" ? [4, 8] : goal === "balanced" ? [6, 10] : [8, 12];
  return {
    weight: lastSet.weight,
    reps: lastSet.reps,
    text: `同じ${lastSet.weight}kgで${range[0]}〜${range[1]}回。疲労による回数低下もそのまま記録しましょう。`
  };
}

function showView(name) {
  ["train", "history", "settings"].forEach((view) => $(`${view}View`).hidden = view !== name);
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  if (name === "history") renderHistory();
  if (name === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfile() {
  const firstName = state.profile?.name?.trim();
  $("greeting").textContent = firstName ? `${firstName}さん、今日は何を鍛える？` : "今日は何を鍛える？";
  $("currentGymName").textContent = currentGym()?.name || "未設定（マシン利用時に登録）";
}

function renderBodyparts() {
  $("bodypartGrid").innerHTML = BODY_PARTS.map((part) => `<button class="body-chip${state.bodypart === part ? " selected" : ""}" data-part="${part}">${part}</button>`).join("");
}

function weeklyCounts() {
  const start = weekStart();
  return state.sets.filter((set) => new Date(set.timestamp) >= start).reduce((counts, set) => {
    counts[set.bodypart_ui] = (counts[set.bodypart_ui] || 0) + 1; return counts;
  }, {});
}

function renderExercises() {
  const query = $("exerciseSearch").value.trim().toLowerCase();
  const items = EXERCISES.filter((ex) => ex.bodypart_ui === state.bodypart && `${ex.exercise_name} ${ex.equipment_cat}`.toLowerCase().includes(query));
  $("exerciseList").innerHTML = items.map((ex) => {
    const histories = state.sets.filter((set) => set.exercise_id === ex.exercise_id);
    const last = histories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const todayCount = histories.filter((set) => set.workout_id === currentWorkoutId()).length;
    return `<button class="exercise-card" data-exercise="${ex.exercise_id}"><div><span class="equipment-tag">${ex.equipment_cat}</span><strong>${ex.exercise_name}</strong><small>${ex.range_type} ・ ${ex.pattern}</small></div><div class="exercise-last">${todayCount ? `<small>今日</small><strong>${todayCount}セット</strong>` : last ? `<small>直近</small><strong>${last.weight}kg × ${last.reps}</strong>` : "初回"}<span>›</span></div></button>`;
  }).join("") || `<div class="empty-state">該当する種目がありません。</div>`;
  const counts = weeklyCounts();
  const count = counts[state.bodypart] || 0;
  $("balanceHint").hidden = false;
  $("balanceHint").innerHTML = `<strong>今週の${state.bodypart}：${count}セット</strong><span>${count === 0 ? "今週はまだ記録がありません。" : "自由に選んでOK。週全体の偏りは進捗画面で確認できます。"}</span>`;
}

function selectExercise(exercise) {
  state.exercise = exercise;
  state.machine = null;
  if (exercise.equipment_cat === "Machine") {
    openMachineDialog(exercise);
  } else {
    openSetDialog();
  }
}

function renderGyms() {
  $("gymList").innerHTML = state.gyms.length ? state.gyms.map((gym) => `<button type="button" class="select-row${gym.id === state.profile?.currentGymId ? " selected" : ""}" data-gym="${gym.id}"><span><strong>${gym.name}</strong><small>${state.machines.filter((machine) => machine.gym_id === gym.id).length}台登録</small></span><span>${gym.id === state.profile?.currentGymId ? "✓" : ""}</span></button>`).join("") : `<div class="empty-state">まだジムが登録されていません。</div>`;
}

function openGymDialog() {
  renderGyms(); $("newGymFields").hidden = true; $("gymDialog").showModal();
}

function openMachineDialog(exercise) {
  const gym = currentGym();
  $("machineDialogHelp").textContent = gym ? `${gym.name}で使う「${exercise.exercise_name}」を選択` : "先にジムを登録してください。";
  const machines = gym ? state.machines.filter((machine) => machine.gym_id === gym.id && machine.exercise_id === exercise.exercise_id) : [];
  $("machineList").innerHTML = machines.length ? machines.map((machine) => {
    const last = comparableSets(exercise, machine.id)[0];
    return `<button type="button" class="select-row" data-machine="${machine.id}"><span><strong>${machine.name}</strong><small>${[machine.maker, machine.note].filter(Boolean).join(" ・ ") || "登録済み"}</small></span><span>${last ? `${last.weight}kg × ${last.reps}` : "初回"}</span></button>`;
  }).join("") : `<div class="empty-state">この種目のマシンは未登録です。</div>`;
  $("showNewMachineBtn").textContent = gym ? "＋ このマシンを初回登録" : "＋ ジムを先に登録";
  $("newMachineFields").hidden = true;
  $("machineDialog").showModal();
}

function openSetDialog() {
  renderSetSession();
  $("setDialog").showModal();
}

function setRows(items) {
  return items.map((set, index) => `<div class="set-row"><span>SET ${index + 1}</span><strong>${set.weight}kg × ${set.reps}回</strong><small>${set.rir !== "" ? `RIR ${set.rir}` : ""}</small></div>`).join("");
}

function renderSetSession() {
  const exercise = state.exercise;
  const current = currentWorkoutSets(exercise, state.machine?.id);
  const exerciseOrder = currentExerciseOrder(exercise, state.machine?.id);
  const previous = previousWorkoutSets(exercise, state.machine?.id, exerciseOrder);
  const previousBest = bestRecentSet(previous);
  const rec = current.length ? nextSetRecommendation(current[current.length - 1]) : recommendation(previousBest, exercise);
  $("setBodypart").textContent = `${exercise.bodypart_ui} ・ 今日${exerciseOrder}種目目`;
  $("setExerciseName").textContent = exercise.exercise_name;
  $("setMachineName").textContent = state.machine ? `${currentGym()?.name} ・ ${state.machine.name}` : exercise.equipment_cat;
  const previousTotal = previous.reduce((sum, set) => sum + Number(set.reps), 0);
  const previousOrder = previous.length ? Number(previous[0].exercise_order || 0) : 0;
  const orderNote = previous.length && previousOrder && previousOrder !== exerciseOrder ? `<div class="condition-warning">前回は${previousOrder}種目目、今回は${exerciseOrder}種目目です。疲労条件が異なるため参考値として表示しています。</div>` : "";
  $("previousCard").innerHTML = previous.length ? `<div class="session-title"><span>前回の全セット ・ ${previousOrder || "順番未記録"}${previousOrder ? "種目目" : ""}</span><small>${formatDate(previous[0].timestamp)} ・ 合計${previousTotal}回</small></div>${setRows(previous)}${orderNote}` : `<span>同じ条件の前回記録</span><strong>なし</strong><small>今日の記録が、このマシン・種目順の基準になります。</small>`;
  const currentTotal = current.reduce((sum, set) => sum + Number(set.reps), 0);
  $("currentSessionCard").innerHTML = `<div class="session-title"><span>今日のセット</span><strong>${current.length}セット ・ 合計${currentTotal}回</strong></div>${current.length ? setRows(current) : `<small>まだセットを保存していません。</small>`}`;
  $("recommendationCard").innerHTML = `<span>${current.length ? "次セットの目安" : "1セット目の目安"}</span><strong>${rec.weight !== "" ? `${rec.weight}kg × ` : ""}${current.length ? `${(state.profile?.goal || "hypertrophy") === "strength" ? "4〜8" : (state.profile?.goal || "hypertrophy") === "balanced" ? "6〜10" : "8〜12"}回` : `${rec.reps}回から`}</strong><small>${rec.text}</small>`;
  $("weightInput").value = rec.weight;
  $("repsInput").value = rec.reps;
  $("saveSetBtn").textContent = `セット${current.length + 1}を保存`;
  document.querySelectorAll("input[name='rir']").forEach((input) => input.checked = false);
  $("painFields").hidden = true; $("painArea").value = ""; $("painScore").value = 1; $("painOutput").value = 1; $("setError").textContent = "";
}

function describeProgress(saved, previous) {
  if (!previous) return "この条件の基準記録になりました。";
  if (saved.weight > previous.weight && saved.reps >= previous.reps) return `前回より${saved.weight - previous.weight}kgアップ。`;
  if (saved.weight === previous.weight && saved.reps > previous.reps) return `前回より${saved.reps - previous.reps}回アップ。`;
  if (saved.weight === previous.weight && saved.reps === previous.reps && saved.rir !== "" && previous.rir !== "" && Number(saved.rir) > Number(previous.rir)) return "同じ内容でRIRに余裕が増えました。";
  if (saved.weight * saved.reps > previous.weight * previous.reps) return "重量×回数が前回を上回りました。";
  return "記録しました。次回も同じ条件で比較できます。";
}

function saveSet(event) {
  event.preventDefault();
  const weight = Number($("weightInput").value);
  const reps = Number($("repsInput").value);
  if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1) {
    $("setError").textContent = "重量と回数を確認してください。"; return;
  }
  const setNumber = currentWorkoutSets(state.exercise, state.machine?.id).length + 1;
  const exerciseOrder = currentExerciseOrder(state.exercise, state.machine?.id);
  const previousSession = previousWorkoutSets(state.exercise, state.machine?.id, exerciseOrder);
  const previous = previousSession[setNumber - 1] || null;
  const selectedRir = document.querySelector("input[name='rir']:checked");
  const set = {
    set_id: uid("S"), timestamp: new Date().toISOString(), user_id: "local-user",
    workout_id: currentWorkoutId(), exercise_order: exerciseOrder, set_no: setNumber,
    exercise_id: state.exercise.exercise_id, exercise_name: state.exercise.exercise_name,
    bodypart_ui: state.exercise.bodypart_ui, anatomical_target: state.exercise.anatomical_target,
    pattern: state.exercise.pattern, range_type: state.exercise.range_type, equipment_cat: state.exercise.equipment_cat,
    gym_id: currentGym()?.id || "", gym_name: currentGym()?.name || "",
    equipment_variant_id: state.machine?.id || "", equipment_variant: state.machine?.name || "",
    comparison_key: comparisonKey(state.exercise, state.machine?.id),
    weight, reps, rir: selectedRir ? Number(selectedRir.value) : "",
    pain_area: $("painFields").hidden ? "" : $("painArea").value.trim(),
    pain_score: $("painFields").hidden ? "" : Number($("painScore").value),
    goal: state.profile?.goal || "hypertrophy", set_style: "Normal"
  };
  state.sets.unshift(set); state.lastSaved = set; persist();
  queueRemote(set);
  renderSetSession();
  showToast("セットを保存しました", describeProgress(set, previous), true);
  renderExercises(); updateQueueUI();
}

async function postToGAS(payload) {
  const response = await fetch(`${API_URL}?origin=${encodeURIComponent(location.origin)}`, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), redirect: "follow" });
  const text = await response.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  if (!response.ok || json.ok === false) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}

function queueRemote(set) {
  const queue = read(STORE.queue, []);
  queue.push({ action: "append_set_log", data: set }); write(STORE.queue, queue);
  if (navigator.onLine) flushQueue();
}

async function flushQueue() {
  if (!navigator.onLine) return;
  const queue = read(STORE.queue, []); if (!queue.length) return;
  const failed = [];
  for (const item of queue) { try { await postToGAS(item); } catch { failed.push(item); } }
  write(STORE.queue, failed); updateQueueUI();
}

function updateQueueUI() {
  const count = read(STORE.queue, []).length;
  $("queueBadge").hidden = count === 0;
  $("queueBadge").textContent = `未送信 ${count}`;
  $("netBadge").textContent = navigator.onLine ? "オンライン" : "オフライン";
  $("netBadge").className = `status-pill ${navigator.onLine ? "online" : "offline"}`;
}

function showToast(title, message, canUndo = false) {
  $("toastTitle").textContent = title; $("toastMessage").textContent = message; $("undoBtn").hidden = !canUndo; $("toast").hidden = false;
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => $("toast").hidden = true, 6500);
}

function undoLast() {
  if (!state.lastSaved) return;
  state.sets = state.sets.filter((set) => set.set_id !== state.lastSaved.set_id);
  const queue = read(STORE.queue, []).filter((item) => item.data?.set_id !== state.lastSaved.set_id);
  write(STORE.queue, queue); state.lastSaved = null; persist(); updateQueueUI();
  if ($("setDialog").open && state.exercise) renderSetSession();
  showToast("取り消しました", "最後のセットを記録から削除しました。", false);
}

function renderHistory() {
  const start = weekStart();
  const weekSets = state.sets.filter((set) => new Date(set.timestamp) >= start);
  const volume = weekSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const activeParts = new Set(weekSets.map((set) => set.bodypart_ui)).size;
  $("progressSummary").innerHTML = `<div class="metric"><small>今週のセット</small><strong>${weekSets.length}</strong></div><div class="metric"><small>総負荷量</small><strong>${Math.round(volume).toLocaleString()}kg</strong></div><div class="metric"><small>実施部位</small><strong>${activeParts}</strong></div>`;
  const groups = [];
  state.sets.forEach((set) => {
    const key = `${set.workout_id}|${set.comparison_key}`;
    let group = groups.find((item) => item.key === key);
    if (!group) { group = { key, sets: [] }; groups.push(group); }
    group.sets.push(set);
  });
  $("historyList").innerHTML = groups.length ? groups.slice(0, 40).map((group) => {
    const sets = group.sets.sort((a, b) => Number(a.set_no || 0) - Number(b.set_no || 0));
    const first = sets[0]; const totalReps = sets.reduce((sum, set) => sum + Number(set.reps), 0);
    return `<article class="history-session"><div class="history-session-head"><div><span class="equipment-tag">${first.bodypart_ui} ・ ${first.exercise_order || "?"}種目目</span><strong>${first.exercise_name}</strong><small>${first.equipment_variant ? `${first.gym_name} ・ ${first.equipment_variant}` : first.equipment_cat} ・ ${formatDate(first.timestamp)}</small></div><div><strong>${sets.length}セット</strong><small>合計${totalReps}回</small></div></div>${setRows(sets)}</article>`;
  }).join("") : `<div class="empty-state">まだ記録がありません。最初のセットを保存してみましょう。</div>`;
}

function renderSettings() {
  $("settingsName").value = state.profile?.name || ""; $("settingsGoal").value = state.profile?.goal || "hypertrophy";
  $("machineLibrary").innerHTML = state.gyms.length ? state.gyms.map((gym) => `<div class="library-group"><strong>${gym.name}</strong>${state.machines.filter((machine) => machine.gym_id === gym.id).map((machine) => `<div><span>${machine.name}</span><small>${EXERCISES.find((ex) => ex.exercise_id === machine.exercise_id)?.exercise_name || ""}${machine.maker ? ` ・ ${machine.maker}` : ""}</small></div>`).join("") || `<small>マシン未登録</small>`}</div>`).join("") : `<div class="empty-state">ジムとマシンは、トレーニング画面から登録できます。</div>`;
}

function bindEvents() {
  $("onboardingForm").addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    state.profile = { name: $("displayName").value.trim(), goal: data.get("goal"), currentGymId: "" }; persist();
    $("onboardingView").hidden = true; $("trainView").hidden = false; document.querySelector(".bottom-nav").hidden = false; $("greeting").textContent = "今日は何を鍛える？"; renderProfile();
  });
  document.querySelectorAll("input[name='goal']").forEach((radio) => radio.addEventListener("change", () => document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("selected", card.querySelector("input").checked))));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $("bodypartGrid").addEventListener("click", (event) => { const button = event.target.closest("[data-part]"); if (!button) return; state.bodypart = button.dataset.part; renderBodyparts(); $("exerciseSection").hidden = false; renderExercises(); $("exerciseSection").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("exerciseSearch").addEventListener("input", renderExercises);
  $("exerciseList").addEventListener("click", (event) => { const button = event.target.closest("[data-exercise]"); if (button) selectExercise(EXERCISES.find((ex) => ex.exercise_id === button.dataset.exercise)); });
  [$("openGymBtn"), $("changeGymBtn")].forEach((button) => button.addEventListener("click", openGymDialog));
  $("closeGymBtn").addEventListener("click", () => $("gymDialog").close());
  $("closeMachineBtn").addEventListener("click", () => $("machineDialog").close());
  $("closeSetBtn").addEventListener("click", () => $("setDialog").close());
  $("finishExerciseBtn").addEventListener("click", () => { $("setDialog").close(); showToast("種目を終了しました", "今日のセットは進捗画面から確認できます。", false); });
  $("showNewGymBtn").addEventListener("click", () => $("newGymFields").hidden = false);
  $("saveGymBtn").addEventListener("click", () => { const name = $("newGymName").value.trim(); if (!name) return; const gym = { id: uid("GYM"), name }; state.gyms.push(gym); state.profile.currentGymId = gym.id; $("newGymName").value = ""; persist(); renderGyms(); renderProfile(); showToast("ジムを登録しました", name); if (state.exercise?.equipment_cat === "Machine") { $("gymDialog").close(); openMachineDialog(state.exercise); } });
  $("gymList").addEventListener("click", (event) => { const button = event.target.closest("[data-gym]"); if (!button) return; state.profile.currentGymId = button.dataset.gym; persist(); renderProfile(); $("gymDialog").close(); });
  $("showNewMachineBtn").addEventListener("click", () => { if (!currentGym()) { $("machineDialog").close(); openGymDialog(); return; } $("newMachineFields").hidden = false; });
  $("saveMachineBtn").addEventListener("click", () => { const name = $("newMachineName").value.trim(); if (!name || !currentGym()) return; const machine = { id: uid("MACHINE"), gym_id: currentGym().id, exercise_id: state.exercise.exercise_id, name, maker: $("newMachineMaker").value.trim(), note: $("newMachineNote").value.trim() }; state.machines.push(machine); state.machine = machine; ["newMachineName", "newMachineMaker", "newMachineNote"].forEach((id) => $(id).value = ""); persist(); $("machineDialog").close(); openSetDialog(); });
  $("machineList").addEventListener("click", (event) => { const button = event.target.closest("[data-machine]"); if (!button) return; state.machine = state.machines.find((machine) => machine.id === button.dataset.machine); $("machineDialog").close(); openSetDialog(); });
  document.querySelectorAll("[data-adjust]").forEach((button) => button.addEventListener("click", () => { const input = button.dataset.adjust === "weight" ? $("weightInput") : $("repsInput"); const value = Number(input.value || 0) + Number(button.dataset.delta); input.value = Math.max(button.dataset.adjust === "reps" ? 1 : 0, value); }));
  $("togglePainBtn").addEventListener("click", () => $("painFields").hidden = !$("painFields").hidden);
  $("painScore").addEventListener("input", () => $("painOutput").value = $("painScore").value);
  $("setForm").addEventListener("submit", saveSet); $("undoBtn").addEventListener("click", undoLast);
  $("saveSettingsBtn").addEventListener("click", () => { state.profile.name = $("settingsName").value.trim(); state.profile.goal = $("settingsGoal").value; persist(); renderProfile(); showToast("設定を保存しました", `目標：${goalLabel(state.profile.goal)}`); });
  $("addMachineFromSettings").addEventListener("click", () => { showView("train"); openGymDialog(); });
  window.addEventListener("online", () => { updateQueueUI(); flushQueue(); }); window.addEventListener("offline", updateQueueUI);
}

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  renderBodyparts(); renderProfile(); updateQueueUI(); bindEvents();
  if (!state.profile) { $("onboardingView").hidden = false; $("trainView").hidden = true; document.querySelector(".bottom-nav").hidden = true; }
  else { document.querySelector(".bottom-nav").hidden = false; flushQueue(); }
});
