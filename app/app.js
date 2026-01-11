// ★ ここにGASのWebアプリURLを貼る
const API_URL = "https://script.google.com/macros/s/AKfycbwoEqusw52NrIIbNe14XqFs5GXgs_QH6jSTmELemtRqXa6z5-stcsHImVIrm2iIg2bn/exec";

// オフラインキュー（MVPはlocalStorage）
const QUEUE_KEY = "liftcoach_offline_queue_v1";

function genSetId() {
  return "S-" + Date.now() + "-" + Math.random().toString(16).slice(2);
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
    el.appendChild(div);
  });
  if (items.length > 30) {
    const more = document.createElement("div");
    more.className = "small";
    more.textContent = `表示は30件まで（検索で絞ってください）`;
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
