const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbwNtRY7ESule5SZg44O4pM6PX5AosyAjQxSQarrQsBGHGhuWhAoFIYuTE9HPEU2dF6jzQ/exec";
const STORE = {
  profile: "liftcoach_profile_v2",
  gyms: "liftcoach_gyms_v2",
  machines: "liftcoach_machines_v2",
  customExercises: "liftcoach_custom_exercises_v2",
  activeWorkout: "liftcoach_active_workout_v2",
  completedWorkouts: "liftcoach_completed_workouts_v2",
  sets: "liftcoach_sets_v2",
  queue: "liftcoach_offline_queue_v2",
  syncUrl: "liftcoach_sync_url_v2",
  syncToken: "liftcoach_sync_token_v2",
  lastSync: "liftcoach_last_sync_v2",
  demoMode: "liftcoach_demo_mode_v2",
  demoSets: "liftcoach_demo_sets_v2",
  demoActiveWorkout: "liftcoach_demo_active_workout_v2",
  demoCompletedWorkouts: "liftcoach_demo_completed_workouts_v2"
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

const initialDemoMode = read(STORE.demoMode, false);
let state = {
  profile: read(STORE.profile, null),
  gyms: read(STORE.gyms, []),
  machines: read(STORE.machines, []),
  customExercises: read(STORE.customExercises, []),
  activeWorkout: read(initialDemoMode ? STORE.demoActiveWorkout : STORE.activeWorkout, null),
  completedWorkouts: read(initialDemoMode ? STORE.demoCompletedWorkouts : STORE.completedWorkouts, []),
  sets: read(initialDemoMode ? STORE.demoSets : STORE.sets, []),
  syncUrl: read(STORE.syncUrl, DEFAULT_API_URL),
  syncToken: read(STORE.syncToken, ""),
  lastSync: read(STORE.lastSync, ""),
  demoMode: initialDemoMode,
  bodypart: "",
  exercise: null,
  machine: null,
  executionVariant: "",
  editingSetId: null,
  lastSaved: null
};

function persist() {
  write(STORE.profile, state.profile);
  write(STORE.gyms, state.gyms);
  write(STORE.machines, state.machines);
  write(STORE.customExercises, state.customExercises);
  write(state.demoMode ? STORE.demoActiveWorkout : STORE.activeWorkout, state.activeWorkout);
  write(state.demoMode ? STORE.demoCompletedWorkouts : STORE.completedWorkouts, state.completedWorkouts);
  write(state.demoMode ? STORE.demoSets : STORE.sets, state.sets);
  write(STORE.syncUrl, state.syncUrl);
  write(STORE.syncToken, state.syncToken);
  write(STORE.lastSync, state.lastSync);
  write(STORE.demoMode, state.demoMode);
}

function allExercises() {
  return [...EXERCISES, ...state.customExercises];
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function migrateSetHistory() {
  if (state.profile && !state.profile.user_id) state.profile.user_id = uid("USER");
  const workouts = new Map();
  state.sets.forEach((set) => {
    if (!set.user_id || set.user_id === "local-user") set.user_id = state.profile?.user_id || "local-user";
    if (!set.workout_id) set.workout_id = `W-${localDateKey(new Date(set.timestamp))}`;
    if (set.equipment_variant_id && !set.execution_variant) set.execution_variant = "標準（両手）";
    const method = set.equipment_variant_id ? String(set.execution_variant || "標準").trim().toLowerCase() : "";
    set.comparison_key = `${set.exercise_id}|${set.equipment_variant_id || set.equipment_cat}|${method}`;
    if (!workouts.has(set.workout_id)) workouts.set(set.workout_id, []);
    workouts.get(set.workout_id).push(set);
  });
  workouts.forEach((sets) => {
    const ordered = [...sets].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const orderByExercise = new Map();
    ordered.forEach((set) => {
      if (!orderByExercise.has(set.comparison_key)) orderByExercise.set(set.comparison_key, orderByExercise.size + 1);
      if (!set.exercise_order) set.exercise_order = orderByExercise.get(set.comparison_key);
    });
  });
  persist();
}

migrateSetHistory();

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
  if (state.activeWorkout?.id && state.activeWorkout.date === localDateKey()) return state.activeWorkout.id;
  const todaySets = state.sets.filter((set) => set.workout_id?.startsWith(`W-${localDateKey()}`) && !state.completedWorkouts.includes(set.workout_id));
  if (todaySets.length && !state.activeWorkout) {
    state.activeWorkout = { id: todaySets[0].workout_id, date: localDateKey(), started_at: todaySets[todaySets.length - 1].timestamp };
  } else {
    state.activeWorkout = { id: `W-${localDateKey()}-${Date.now()}`, date: localDateKey(), started_at: new Date().toISOString() };
  }
  persist();
  return state.activeWorkout.id;
}

function comparisonKey(exercise, machineId = "", executionVariant = "") {
  const method = machineId ? (executionVariant.trim().toLowerCase() || "標準") : "";
  return `${exercise.exercise_id}|${machineId || exercise.equipment_cat}|${method}`;
}

function comparableSets(exercise, machineId = "") {
  const key = comparisonKey(exercise, machineId, state.executionVariant);
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
  if (name === "train") renderTodaySummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfile() {
  const firstName = state.profile?.name?.trim();
  $("greeting").textContent = firstName ? `${firstName}さん、今日は何を鍛える？` : "今日は何を鍛える？";
  $("currentGymName").textContent = currentGym()?.name || "未設定（マシン利用時に登録）";
}

function renderTodaySummary() {
  const todaySets = state.sets.filter((set) => localDateKey(new Date(set.timestamp)) === localDateKey()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  $("todaySummary").hidden = todaySets.length === 0;
  if (!todaySets.length) return;
  const workoutIds = [...new Set(todaySets.map((set) => set.workout_id))];
  const exerciseGroups = [];
  todaySets.forEach((set) => {
    const key = `${set.workout_id}|${set.comparison_key}`;
    let group = exerciseGroups.find((item) => item.key === key);
    if (!group) { group = { key, sets: [], workoutIndex: workoutIds.indexOf(set.workout_id) + 1 }; exerciseGroups.push(group); }
    group.sets.push(set);
  });
  const volume = todaySets.reduce((sum, set) => sum + Number(set.weight) * Number(set.reps), 0);
  $("todaySessionCount").textContent = workoutIds.length > 1 ? `${workoutIds.length}セッション` : "今日の合計";
  $("todayMetrics").innerHTML = `<div class="metric"><small>種目</small><strong>${exerciseGroups.length}</strong></div><div class="metric"><small>セット</small><strong>${todaySets.length}</strong></div><div class="metric"><small>総負荷量</small><strong>${Math.round(volume).toLocaleString()}kg</strong></div>`;
  $("todayExerciseList").innerHTML = exerciseGroups.map((group) => {
    const sets = group.sets; const first = sets[0]; const reps = sets.reduce((sum, set) => sum + Number(set.reps), 0);
    const session = workoutIds.length > 1 ? `セッション${group.workoutIndex} ・ ` : "";
    return `<article class="today-exercise"><span class="today-order">${first.exercise_order || "?"}</span><div><strong>${first.exercise_name}</strong><small>${session}${sets.map((set) => `${set.weight}kg×${set.reps}`).join(" / ")}</small></div><strong>${sets.length}セット<br>${reps}回</strong></article>`;
  }).join("");
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
  const items = allExercises().filter((ex) => ex.bodypart_ui === state.bodypart && `${ex.exercise_name} ${ex.equipment_cat}`.toLowerCase().includes(query));
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
  state.executionVariant = "";
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
  $("machineDialogHelp").textContent = gym ? `${gym.name}で使う物理的なマシンを選択` : "先にジムを登録してください。";
  const machines = gym ? state.machines.filter((machine) => machine.gym_id === gym.id) : [];
  $("machineList").innerHTML = machines.length ? machines.map((machine) => {
    const last = state.sets.find((set) => set.exercise_id === exercise.exercise_id && set.equipment_variant_id === machine.id);
    return `<button type="button" class="select-row" data-machine="${machine.id}"><span><strong>${machine.name}</strong><small>${[machine.maker, machine.note].filter(Boolean).join(" ・ ") || "登録済み"}</small></span><span>${last ? `${last.weight}kg × ${last.reps}` : "初回"}</span></button>`;
  }).join("") : `<div class="empty-state">この種目のマシンは未登録です。</div>`;
  $("showNewMachineBtn").textContent = gym ? "＋ このマシンを初回登録" : "＋ ジムを先に登録";
  $("newMachineFields").hidden = true;
  $("variationFields").hidden = true;
  $("machineDialog").showModal();
}

function showVariationFields(machine) {
  state.machine = machine;
  const variations = [...new Set(state.sets.filter((set) => set.exercise_id === state.exercise.exercise_id && set.equipment_variant_id === machine.id).map((set) => set.execution_variant).filter(Boolean))];
  $("variationMachineName").textContent = `${machine.name} × ${state.exercise.exercise_name}`;
  $("executionVariantList").innerHTML = ["標準（両手）", "ワンハンド", ...variations].filter((value, index, array) => array.indexOf(value) === index).map((value) => `<option value="${value}">`).join("");
  $("executionVariantInput").value = variations[0] || "標準（両手）";
  $("variationFields").hidden = false;
  $("variationFields").scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  $("setExerciseName").textContent = exercise.exercise_n…4012 tokens truncated… || new Date(b[0][0].timestamp) - new Date(a[0][0].timestamp));
  if (!candidates.length) {
    $("exerciseTrendTitle").textContent = "代表種目の強度";
    $("exerciseTrendChart").innerHTML = `<div class="chart-empty">同じ条件で2回以上記録すると<br>強度の推移が表示されます</div>`;
    return;
  }
  const sessions = candidates[0].slice(0, 8).reverse();
  const points = sessions.map((sets) => {
    const best = Math.max(...sets.map((set) => Number(set.weight) * (1 + Number(set.reps) / 30)));
    return { value: best, label: `${new Date(sets[0].timestamp).getMonth() + 1}/${new Date(sets[0].timestamp).getDate()}` };
  });
  const min = Math.min(...points.map((point) => point.value)); const max = Math.max(...points.map((point) => point.value)); const range = Math.max(max - min, 1);
  const coords = points.map((point, index) => ({ ...point, x: 18 + index * (284 / Math.max(points.length - 1, 1)), y: 118 - ((point.value - min) / range) * 88 }));
  $("exerciseTrendTitle").textContent = sessions[0][0].exercise_name;
  $("exerciseTrendChart").innerHTML = `<svg class="chart-svg" viewBox="0 0 320 150" role="img" aria-label="${sessions[0][0].exercise_name}の推定1RM推移"><line x1="12" y1="118" x2="308" y2="118" stroke="#354035"/><polyline points="${coords.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="#c8f55b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${coords.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#c8f55b"/><text class="chart-value" x="${point.x}" y="${Math.max(10, point.y - 8)}" text-anchor="middle">${point.value.toFixed(1)}</text><text class="chart-label" x="${point.x}" y="137" text-anchor="middle">${point.label}</text>`).join("")}</svg>`;
}

function renderHistory() {
  const start = weekStart();
  const weekSets = state.sets.filter((set) => new Date(set.timestamp) >= start);
  const volume = weekSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const activeParts = new Set(weekSets.map((set) => set.bodypart_ui)).size;
  $("progressSummary").innerHTML = `<div class="metric"><small>今週のセット</small><strong>${weekSets.length}</strong></div><div class="metric"><small>総負荷量</small><strong>${Math.round(volume).toLocaleString()}kg</strong></div><div class="metric"><small>実施部位</small><strong>${activeParts}</strong></div>`;
  renderTrendCharts();
  renderWeeklyReview();
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

function generateDemoSets() {
  const routines = [
    ["bench-press", "incline-db-press", "pec-fly-machine", "db-lateral-raise", "cable-pushdown"],
    ["lat-pulldown", "seated-row", "reverse-pec-deck", "barbell-curl", "db-shrug"],
    ["leg-press", "rdl", "leg-extension", "leg-curl", "calf-raise"],
    ["incline-db-press", "bench-press", "shoulder-press-machine", "cable-lateral-raise", "preacher-curl-machine"]
  ];
  const baseWeights = { "bench-press": 60, "incline-db-press": 20, "pec-fly-machine": 40, "db-lateral-raise": 8, "cable-pushdown": 25, "lat-pulldown": 50, "seated-row": 45, "reverse-pec-deck": 30, "barbell-curl": 25, "db-shrug": 24, "leg-press": 120, rdl: 70, "leg-extension": 45, "leg-curl": 40, "calf-raise": 60, "shoulder-press-machine": 35, "cable-lateral-raise": 7.5, "preacher-curl-machine": 25 };
  const schedule = [0, 1, 3, 5];
  const start = addDays(weekStart(), -77);
  const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
  const result = [];
  for (let week = 0; week < 12; week += 1) {
    schedule.forEach((dayOffset, dayIndex) => {
      const date = addDays(start, week * 7 + dayOffset); date.setHours(18, 10, 0, 0);
      if (date >= cutoff) return;
      let ids = [...routines[dayIndex]];
      if (dayIndex === 0 && week % 3 === 1) ids = [ids[2], ids[0], ids[1], ids[3], ids[4]];
      const workoutId = `DEMO-W-${localDateKey(date)}-${dayIndex + 1}`;
      ids.forEach((exerciseId, exerciseIndex) => {
        const exercise = EXERCISES.find((item) => item.exercise_id === exerciseId); if (!exercise) return;
        const isMachine = ["Machine", "Cable"].includes(exercise.equipment_cat);
        const machineId = isMachine ? `DEMO-M-${exercise.equipment_cat.toUpperCase()}-${exerciseId}` : "";
        const machineName = isMachine ? `${exercise.exercise_name} 1号機` : "";
        const step = Number(exercise.step_kg || 2.5);
        const deload = week === 7 ? -step * 2 : 0;
        const progressed = baseWeights[exerciseId] + Math.floor(week / 3) * step + deload;
        for (let setNo = 1; setNo <= 3; setNo += 1) {
          const timestamp = new Date(date); timestamp.setMinutes(date.getMinutes() + exerciseIndex * 14 + setNo * 3);
          const reps = Math.max(6, 12 - (week % 3) - (setNo - 1) + (week >= 9 ? 1 : 0));
          const execution = isMachine ? "標準（両手）" : "";
          result.push({
            set_id: `DEMO-S-${week}-${dayIndex}-${exerciseIndex}-${setNo}`, timestamp: timestamp.toISOString(), user_id: "demo-user",
            workout_id: workoutId, exercise_order: exerciseIndex + 1, set_no: setNo,
            exercise_id: exercise.exercise_id, exercise_name: exercise.exercise_name, bodypart_ui: exercise.bodypart_ui,
            anatomical_target: exercise.anatomical_target, pattern: exercise.pattern, range_type: exercise.range_type, equipment_cat: exercise.equipment_cat,
            gym_id: "DEMO-GYM", gym_name: "サンプルジム", equipment_variant_id: machineId, equipment_variant: machineName,
            execution_variant: execution, comparison_key: `${exercise.exercise_id}|${machineId || exercise.equipment_cat}|${execution.toLowerCase()}`,
            weight: Math.max(0, progressed), reps, rir: setNo === 3 ? 1 : 2,
            pain_area: week === 5 && dayIndex === 0 && exerciseIndex === 3 && setNo === 3 ? "右肩" : "",
            pain_score: week === 5 && dayIndex === 0 && exerciseIndex === 3 && setNo === 3 ? 3 : "",
            goal: "hypertrophy", set_style: "Normal", is_demo: true
          });
        }
      });
    });
  }
  return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function enterDemoMode() {
  state.demoMode = true; state.sets = generateDemoSets(); state.activeWorkout = null;
  state.completedWorkouts = [...new Set(state.sets.map((set) => set.workout_id))];
  state.bodypart = ""; state.exercise = null; state.machine = null; state.executionVariant = "";
  persist(); renderBodyparts(); renderProfile(); renderSettings(); showView("history");
  showToast("ダミーデータを作成しました", `${state.sets.length}セット・12週間分を表示しています。`, false);
}

function exitDemoMode() {
  state.demoMode = false; state.sets = read(STORE.sets, []); state.activeWorkout = read(STORE.activeWorkout, null);
  state.completedWorkouts = read(STORE.completedWorkouts, []); write(STORE.demoMode, false);
  state.bodypart = ""; state.exercise = null; state.machine = null; state.executionVariant = "";
  migrateSetHistory(); renderBodyparts(); renderProfile(); renderSettings(); showView("history");
  showToast("実データに戻りました", `${state.sets.length}セットの記録を表示しています。`, false);
}

function exportBackup() {
  const backup = { version: 2, exported_at: new Date().toISOString(), profile: state.profile, gyms: state.gyms, machines: state.machines, custom_exercises: state.customExercises, sets: state.sets, completed_workouts: state.completedWorkouts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `lift-coach-backup-${localDateKey()}.json`; anchor.click(); URL.revokeObjectURL(url);
}

async function importBackup(file) {
  if (state.demoMode) { showToast("実データに戻ってください", "ダミーモード中は復元できません。", false); return; }
  try {
    const backup = JSON.parse(await file.text());
    if (!Array.isArray(backup.sets)) throw new Error("setsが見つかりません");
    mergeSets(backup.sets);
    if (Array.isArray(backup.gyms)) state.gyms = backup.gyms;
    if (Array.isArray(backup.machines)) state.machines = backup.machines;
    if (Array.isArray(backup.custom_exercises)) state.customExercises = backup.custom_exercises;
    if (Array.isArray(backup.completed_workouts)) state.completedWorkouts = [...new Set([...state.completedWorkouts, ...backup.completed_workouts])];
    persist(); migrateSetHistory(); renderSettings();
    showToast("バックアップを復元しました", `${state.sets.length}セットを読み込みました。`, false);
  } catch (error) { showToast("復元できませんでした", error.message || "JSONファイルを確認してください。", false); }
}

function renderSettings() {
  $("settingsName").value = state.profile?.name || ""; $("settingsGoal").value = state.profile?.goal || "hypertrophy";
  $("syncUrl").value = state.syncUrl || "";
  $("syncToken").value = state.syncToken || "";
  $("syncState").textContent = state.demoMode ? "同期停止中" : state.lastSync && state.syncToken ? `最終 ${formatDate(state.lastSync)}` : state.syncUrl && state.syncToken ? "未同期" : "未設定";
  $("demoState").hidden = !state.demoMode; $("exitDemoBtn").hidden = !state.demoMode;
  $("demoBtn").textContent = state.demoMode ? "ダミーデータを作り直す" : "ダミーデータを作成して見る";
  $("machineLibrary").innerHTML = state.gyms.length ? state.gyms.map((gym) => `<div class="library-group"><strong>${gym.name}</strong>${state.machines.filter((machine) => machine.gym_id === gym.id).map((machine) => `<div><span>${machine.name}</span><small>${machine.maker || "登録済み"}</small></div>`).join("") || `<small>マシン未登録</small>`}</div>`).join("") : `<div class="empty-state">ジムとマシンは、トレーニング画面から登録できます。</div>`;
}

function finishWorkout() {
  if (!state.activeWorkout) { showToast("まだ記録がありません", "セットを保存するとトレーニングが開始されます。", false); return; }
  const workoutId = state.activeWorkout.id;
  const sets = state.sets.filter((set) => set.workout_id === workoutId);
  const exerciseCount = new Set(sets.map((set) => set.comparison_key)).size;
  if (!state.completedWorkouts.includes(workoutId)) state.completedWorkouts.push(workoutId);
  state.activeWorkout = null;
  state.bodypart = ""; state.exercise = null; state.machine = null; state.executionVariant = "";
  persist(); renderBodyparts(); renderTodaySummary(); $("exerciseSection").hidden = true;
  showToast("今日のトレーニングを終了しました", `${exerciseCount}種目・${sets.length}セットを保存しました。`, false);
}

function openExerciseDialog() {
  $("customBodypart").innerHTML = BODY_PARTS.map((part) => `<option value="${part}">${part}</option>`).join("");
  $("customBodypart").value = state.bodypart || BODY_PARTS[0];
  $("exerciseDialog").showModal();
}

function saveCustomExercise(event) {
  event.preventDefault();
  const name = $("customExerciseName").value.trim(); if (!name) return;
  const exercise = {
    exercise_id: uid("CUSTOM"), exercise_name: name, bodypart_ui: $("customBodypart").value,
    anatomical_target: $("customBodypart").value, equipment_cat: $("customEquipment").value,
    range_type: $("customRange").value, pattern: $("customPattern").value.trim() || "Custom",
    step_kg: Number($("customStep").value) || 2.5, custom: true
  };
  state.customExercises.push(exercise); state.bodypart = exercise.bodypart_ui; persist();
  event.currentTarget.reset(); $("exerciseDialog").close(); renderBodyparts(); $("exerciseSection").hidden = false; renderExercises();
  showToast("種目を追加しました", exercise.exercise_name, false);
}

function bindEvents() {
  $("onboardingForm").addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    state.profile = { user_id: uid("USER"), name: $("displayName").value.trim(), goal: data.get("goal"), currentGymId: "" }; persist();
    $("onboardingView").hidden = true; $("trainView").hidden = false; document.querySelector(".bottom-nav").hidden = false; $("greeting").textContent = "今日は何を鍛える？"; renderProfile();
  });
  document.querySelectorAll("input[name='goal']").forEach((radio) => radio.addEventListener("change", () => document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("selected", card.querySelector("input").checked))));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $("bodypartGrid").addEventListener("click", (event) => { const button = event.target.closest("[data-part]"); if (!button) return; state.bodypart = button.dataset.part; renderBodyparts(); $("exerciseSection").hidden = false; renderExercises(); $("exerciseSection").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("exerciseSearch").addEventListener("input", renderExercises);
  $("exerciseList").addEventListener("click", (event) => { const button = event.target.closest("[data-exercise]"); if (button) selectExercise(allExercises().find((ex) => ex.exercise_id === button.dataset.exercise)); });
  [$("openGymBtn"), $("changeGymBtn")].forEach((button) => button.addEventListener("click", openGymDialog));
  $("closeGymBtn").addEventListener("click", () => $("gymDialog").close());
  $("closeMachineBtn").addEventListener("click", () => $("machineDialog").close());
  $("closeSetBtn").addEventListener("click", () => $("setDialog").close());
  $("finishExerciseBtn").addEventListener("click", () => { $("setDialog").close(); showToast("種目を終了しました", "今日のセットは進捗画面から確認できます。", false); });
  $("finishWorkoutBtn").addEventListener("click", finishWorkout);
  $("addExerciseBtn").addEventListener("click", openExerciseDialog);
  $("closeExerciseBtn").addEventListener("click", () => $("exerciseDialog").close());
  $("exerciseForm").addEventListener("submit", saveCustomExercise);
  $("showNewGymBtn").addEventListener("click", () => $("newGymFields").hidden = false);
  $("saveGymBtn").addEventListener("click", () => { const name = $("newGymName").value.trim(); if (!name) return; const gym = { id: uid("GYM"), name }; state.gyms.push(gym); state.profile.currentGymId = gym.id; $("newGymName").value = ""; persist(); renderGyms(); renderProfile(); showToast("ジムを登録しました", name); if (state.exercise?.equipment_cat === "Machine") { $("gymDialog").close(); openMachineDialog(state.exercise); } });
  $("gymList").addEventListener("click", (event) => { const button = event.target.closest("[data-gym]"); if (!button) return; state.profile.currentGymId = button.dataset.gym; persist(); renderProfile(); $("gymDialog").close(); });
  $("showNewMachineBtn").addEventListener("click", () => { if (!currentGym()) { $("machineDialog").close(); openGymDialog(); return; } $("newMachineFields").hidden = false; });
  $("saveMachineBtn").addEventListener("click", () => { const name = $("newMachineName").value.trim(); if (!name || !currentGym()) return; const machine = { id: uid("MACHINE"), gym_id: currentGym().id, name, maker: $("newMachineMaker").value.trim(), note: $("newMachineNote").value.trim() }; state.machines.push(machine); ["newMachineName", "newMachineMaker", "newMachineNote"].forEach((id) => $(id).value = ""); persist(); $("newMachineFields").hidden = true; showVariationFields(machine); });
  $("machineList").addEventListener("click", (event) => { const button = event.target.closest("[data-machine]"); if (!button) return; showVariationFields(state.machines.find((machine) => machine.id === button.dataset.machine)); });
  $("startWithVariationBtn").addEventListener("click", () => { state.executionVariant = $("executionVariantInput").value.trim() || "標準（両手）"; $("machineDialog").close(); openSetDialog(); });
  document.querySelectorAll("[data-adjust]").forEach((button) => button.addEventListener("click", () => { const input = button.dataset.adjust === "weight" ? $("weightInput") : $("repsInput"); const value = Number(input.value || 0) + Number(button.dataset.delta); input.value = Math.max(button.dataset.adjust === "reps" ? 1 : 0, value); }));
  $("togglePainBtn").addEventListener("click", () => $("painFields").hidden = !$("painFields").hidden);
  $("painScore").addEventListener("input", () => $("painOutput").value = $("painScore").value);
  $("setForm").addEventListener("submit", saveSet); $("undoBtn").addEventListener("click", undoLast);
  $("saveSettingsBtn").addEventListener("click", () => { state.profile.name = $("settingsName").value.trim(); state.profile.goal = $("settingsGoal").value; persist(); renderProfile(); showToast("設定を保存しました", `目標：${goalLabel(state.profile.goal)}`); });
  $("saveSyncBtn").addEventListener("click", () => {
    const url = $("syncUrl").value.trim();
    if (url && (!url.startsWith("https://script.google.com/") || !url.endsWith("/exec"))) { showToast("URLを確認してください", "Apps Scriptでデプロイした /exec で終わるURLを入力してください。", false); return; }
    state.syncUrl = url; state.syncToken = $("syncToken").value.trim(); persist(); renderSettings(); showToast("同期設定を保存しました", url && state.syncToken ? "「今すぐ同期」で接続を確認できます。" : "URLと同期トークンの両方を設定してください。", false);
  });
  $("syncNowBtn").addEventListener("click", () => syncNow());
  $("exportBtn").addEventListener("click", exportBackup);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (event) => { const [file] = event.target.files; if (file) importBackup(file); event.target.value = ""; });
  $("demoBtn").addEventListener("click", enterDemoMode);
  $("exitDemoBtn").addEventListener("click", exitDemoMode);
  $("addMachineFromSettings").addEventListener("click", () => { showView("train"); openGymDialog(); });
  window.addEventListener("online", () => { updateQueueUI(); syncNow({ silent: true }); }); window.addEventListener("offline", updateQueueUI);
}

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  renderBodyparts(); renderProfile(); renderTodaySummary(); updateQueueUI(); bindEvents();
  if (!state.profile) { $("onboardingView").hidden = false; $("trainView").hidden = true; document.querySelector(".bottom-nav").hidden = true; }
  else { document.querySelector(".bottom-nav").hidden = false; syncNow({ silent: true }); }
});