// ★ ここにGASのWebアプリURLを貼る
const API_URL = "https://script.google.com/macros/s/AKfycbwoEqusw52NrIIbNe14XqFs5GXgs_QH6jSTmELemtRqXa6z5-stcsHImVIrm2iIg2bn/exec";

// オフラインキュー（MVPはlocalStorage）
const QUEUE_KEY = "liftcoach_offline_queue_v1";

function genSetId() {
  return "S-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}
function makeProgressKey(ex) {
  // A案：枠（部位×pattern×range×equipment）
  return `${ex.bodypart_ui}|${ex.pattern}|${ex.range_type}|${ex.equipment_cat}`;
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); updateQueueUI(); }
function enqueue(item) { const q = loadQueue(); q.push(item); saveQueue(q); }
function updateQueueUI() {
  const q = loadQueue();
  document.getElementById("queueInfo").textContent = `未送信：${q.length}件`;
}

function updateNetBadge() {
  const b = document.getElementById("netBadge");
  b.textContent = navigator.onLine ? "ONLINE" : "OFFLINE";
  b.className = "badge " + (navigator.onLine ? "ok" : "ng");
}

// CORS安定版：simple request（text/plain）で送る
async function postToGAS(payload) {
  const url = `${API_URL}?origin=${encodeURIComponent(location.origin)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function getLastByProgressKey(progress_key, limit = 5) {
  const res = await postToGAS({
    action: "get_last_by_progress_key",
    query: { progress_key, limit }
  });
  return res.items || [];
}

async function flushQueue() {
  if (!navigator.onLine) return;
  const items = loadQueue();
  if (items.length === 0) return;

  // 先に空にして、失敗だけ戻す
  saveQueue([]);
  const failed = [];

  for (const it of items) {
    try {
      await postToGAS(it);
    } catch (e) {
      failed.push(it);
    }
  }
  if (failed.length) saveQueue(failed);
}

let cachedExercises = [];
let selectedExercise = null;
let currentSetNo = 1;

async function loadExercises(bodypart_ui) {
  if (!bodypart_ui) {
    cachedExercises = [];
    renderExerciseList([]);
    document.getElementById("exInfo").textContent = "";
    return;
  }
  const res = await postToGAS({
    action: "get_exercises",
    filters: { bodypart_ui, q: "", limit: 200, offset: 0 }
  });
  cachedExercises = res.items || [];
  renderExerciseList(cachedExercises);
  document.getElementById("exInfo").textContent = `候補：${cachedExercises.length}件`;
}

function filterExercises(q) {
  const query = q.trim().toLowerCase();
  if (!query) return cachedExercises;
  return cachedExercises.filter(x => {
    const s = `${x.exercise_name} ${x.pattern} ${x.equipment_cat} ${x.alt_group_key}`.toLowerCase();
    return s.includes(query);
  });
}

function renderExerciseList(items) {
  const el = document.getElementById("exList");
  el.innerHTML = "";

  items.slice(0, 30).forEach(x => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = `${x.exercise_name}（${x.equipment_cat} / ${x.range_type}）`;

    div.addEventListener("click", async () => {
  selectedExercise = x;
  currentSetNo = 1;

  document.getElementById("selectedName").textContent = x.exercise_name;
  document.getElementById("selectedCard").style.display = "block";

  // いったんクリア表示（ローディングの代わり）
  document.getElementById("weightInput").value = "";
  document.getElementById("repsInput").value = "";
  document.getElementById("rirInput").value = "";

  // 前回値プリセット
  try {
    const progress_key = makeProgressKey(x);
    const items = await getLastByProgressKey(progress_key, 5);

    // 直近1件を採用（まずはシンプル）
    if (items.length > 0) {
      const last = items[0];
      document.getElementById("weightInput").value = last.weight || "";
      document.getElementById("repsInput").value = last.reps || "";
      document.getElementById("rirInput").value = (last.rir === "" ? "" : last.rir);
    }
  } catch (e) {
    // 取れなくても入力はできるので握りつぶし
    console.warn("prefill failed", e);
  }
});


    el.appendChild(div);
  });

  if (items.length > 30) {
    const more = document.createElement("div");
    more.className = "small";
    more.textContent = "表示は30件まで（検索で絞ってください）";
    el.appendChild(more);
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  updateQueueUI();
  updateNetBadge();

  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./service-worker.js"); } catch {}
  }

  window.addEventListener("online", () => { updateNetBadge(); flushQueue(); });
  window.addEventListener("offline", updateNetBadge);

  document.getElementById("syncBtn").addEventListener("click", flushQueue);

  document.getElementById("pingBtn").addEventListener("click", async () => {
    const el = document.getElementById("pingInfo");
    try {
      const r = await postToGAS({ action: "ping" });
      el.textContent = `OK: ${r.ts}`;
    } catch (e) {
      el.textContent = `NG: ${String(e)}`;
    }
  });

  document.getElementById("bodypartSel").addEventListener("change", (e) => {
    loadExercises(e.target.value);
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    renderExerciseList(filterExercises(e.target.value));
  });

  document.getElementById("demoSaveBtn").addEventListener("click", async () => {
    const payload = {
      action: "append_set_log",
      data: {
        set_id: genSetId(),
        timestamp: new Date().toISOString(),
        user_id: "U001",
        workout_id: "W-demo",
        bodypart_ui: "肩中",
        pattern: "サイドレイズ",
        range_type: "Mid",
        equipment_cat: "Cable",
        exercise_id: "EX0012",
        exercise_name: "ケーブルサイドレイズ",
        slot: "Sub",
        target_rep_min: 8,
        target_rep_max: 12,
        set_no: 1,
        weight: 7.5,
        reps: 12,
        rir: 1,
        mode: "Normal",
        notes: ""
      }
    };
  // セット保存（本番）
  document.getElementById("saveSetBtn").addEventListener("click", async () => {
    if (!selectedExercise) return alert("種目を選択してください");

    const weight = Number(document.getElementById("weightInput").value);
    const reps = Number(document.getElementById("repsInput").value);
    const rir = Number(document.getElementById("rirInput").value);

    if (!weight || !reps) return alert("重量と回数を入力してください");

    const payload = {
      action: "append_set_log",
      data: {
        set_id: genSetId(),
        timestamp: new Date().toISOString(),
        user_id: "U001",
        workout_id: "W-" + new Date().toISOString().slice(0, 10),
        bodypart_ui: selectedExercise.bodypart_ui,
        pattern: selectedExercise.pattern,
        range_type: selectedExercise.range_type,
        equipment_cat: selectedExercise.equipment_cat,
        exercise_id: selectedExercise.exercise_id,
        exercise_name: selectedExercise.exercise_name,

        slot: "Main",          // まずは固定でOK（後でMain/Sub/Finishにする）
        target_rep_min: 8,
        target_rep_max: 12,

        set_no: currentSetNo,
        weight,
        reps,
        rir,
        mode: "Normal",
        notes: ""
      }
    };

    // オフラインも含めて保存
    try {
      await postToGAS(payload);
      alert(`セット${currentSetNo} 保存しました`);
    } catch (e) {
      enqueue(payload);
      alert("通信失敗：未送信に保存しました");
    } finally {
      currentSetNo += 1;
    }
  });

    
    if (!navigator.onLine) {
      enqueue(payload);
      alert("OFFLINE：未送信に保存しました");
      return;
    }

    try {
      await postToGAS(payload);
      alert("送信完了（sets_logに追加）");
    } catch (e) {
      enqueue(payload);
      alert("通信失敗：未送信に保存しました");
    }
  });
});
