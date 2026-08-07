const SETS_SHEET = "sets_log";
const SET_HEADERS = [
  "set_id", "timestamp", "user_id", "workout_id", "exercise_order", "set_no",
  "exercise_id", "exercise_name", "bodypart_ui", "anatomical_target", "pattern",
  "range_type", "equipment_cat", "gym_id", "gym_name", "equipment_variant_id",
  "equipment_variant", "execution_variant", "comparison_key", "weight", "reps",
  "rir", "pain_area", "pain_score", "goal", "set_style"
];

function setup() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheet;
  const existingId = props.getProperty("SHEET_ID");
  if (!existingId) throw new Error("Set SHEET_ID in Apps Script Properties before running setup().");
  spreadsheet = SpreadsheetApp.openById(existingId);
  getOrCreateSheet_(spreadsheet, SETS_SHEET, SET_HEADERS);
  return { spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl() };
}

function doGet() {
  return json_({ ok: true, service: "lift-coach", message: "Use POST requests." });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedToken = PropertiesService.getScriptProperties().getProperty("SYNC_TOKEN");
    if (!expectedToken) throw new Error("Set SYNC_TOKEN in Apps Script Properties before deploying.");
    if (String(request.token || "") !== expectedToken) return json_({ ok: false, error: "Unauthorized" });
    const action = request.action || "";
    if (action === "ping") return json_({ ok: true, ts: new Date().toISOString() });
    if (action === "append_set_log") return json_(appendSet_(request.data || {}));
    if (action === "upsert_set_logs") return json_(upsertSets_(request.items || []));
    if (action === "get_set_logs") return json_(getSets_(request.query || {}));
    return json_({ ok: false, error: "Unknown action: " + action });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!id) throw new Error("Run setup() once before deploying the web app.");
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function setsSheet_() {
  return getOrCreateSheet_(spreadsheet_(), SETS_SHEET, SET_HEADERS);
}

function rowFor_(item) {
  return SET_HEADERS.map(function(header) {
    const value = item[header];
    return value === undefined || value === null ? "" : value;
  });
}

function existingSetIds_(sheet) {
  if (sheet.getLastRow() < 2) return {};
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  return values.reduce(function(index, row, offset) {
    if (row[0]) index[row[0]] = offset + 2;
    return index;
  }, {});
}

function appendSet_(item) {
  if (!item.set_id) throw new Error("set_id is required");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = setsSheet_();
    const ids = existingSetIds_(sheet);
    if (ids[item.set_id]) return { ok: true, duplicate: true, set_id: item.set_id };
    sheet.appendRow(rowFor_(item));
    return { ok: true, inserted: true, set_id: item.set_id };
  } finally { lock.releaseLock(); }
}

function upsertSets_(items) {
  if (!Array.isArray(items)) throw new Error("items must be an array");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = setsSheet_();
    const ids = existingSetIds_(sheet);
    let inserted = 0;
    items.forEach(function(item) {
      if (!item.set_id || ids[item.set_id]) return;
      sheet.appendRow(rowFor_(item)); ids[item.set_id] = true; inserted += 1;
    });
    return { ok: true, inserted: inserted, received: items.length };
  } finally { lock.releaseLock(); }
}

function getSets_(query) {
  const sheet = setsSheet_();
  if (sheet.getLastRow() < 2) return { ok: true, items: [] };
  const limit = Math.min(Math.max(Number(query.limit) || 5000, 1), 10000);
  const userId = String(query.user_id || "");
  const since = query.since ? new Date(query.since) : null;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SET_HEADERS.length).getValues();
  const items = values.map(function(row) {
    return SET_HEADERS.reduce(function(item, header, index) { item[header] = row[index]; return item; }, {});
  }).filter(function(item) {
    if (userId && String(item.user_id) !== userId) return false;
    if (since && new Date(item.timestamp) < since) return false;
    return true;
  }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); }).slice(0, limit);
  return { ok: true, items: items };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}