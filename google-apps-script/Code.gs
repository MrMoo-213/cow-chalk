const SPREADSHEET_ID = "1YNWPqO_uYRL6VsKpYgE696u8fM33-L3zf3D2Cv_GuYc";
const SHEET_NAME = "Lobbies";
const HEADERS = ["id","name","hostPlaying","private","pin","mode","server","createdAt","expiresAt"];

function doGet(e) {
  const params = (e && e.parameter) || {};
  let result;
  try {
    result = params.action === "create" ? createLobby_(params) : listLobbies_();
  } catch (error) {
    result = { ok: false, error: String(error && error.message || error) };
  }
  const callback = String(params.callback || "");
  const json = JSON.stringify(result);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const sheet = getSheet_();
  return { ok: true, sheet: sheet.getName(), headers: HEADERS };
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function listLobbies_() {
  const rows = getSheet_().getDataRange().getValues();
  const now = Date.now();
  const lobbies = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const expiresAt = Number(row[8]) || 0;
    if (!row[0] || expiresAt <= now) continue;
    lobbies.push({
      id: String(row[0]),
      name: String(row[1]),
      hostPlaying: String(row[2]) === "true",
      private: String(row[3]) === "true",
      mode: String(row[5] || "Classic"),
      server: String(row[6] || "sheets"),
      createdAt: Number(row[7]) || 0,
      expiresAt: expiresAt
    });
  }
  lobbies.sort((a, b) => a.createdAt - b.createdAt);
  return { ok: true, lobbies: lobbies.slice(0, 10), updatedAt: now };
}

function createLobby_(params) {
  const name = String(params.name || "").trim().slice(0, 32);
  const hostPlaying = String(params.hostPlaying) === "true";
  const isPrivate = String(params.private) === "true";
  const pin = String(params.pin || "");
  const mode = String(params.mode || "Classic");
  const server = String(params.server || "sheets");
  if (!name) throw new Error("Enter a lobby name.");
  if (isPrivate && !/^\d{4}$/.test(pin)) throw new Error("Private lobbies need a 4-digit PIN.");
  if (mode !== "Classic") throw new Error("That game mode is not available yet.");
  if (server !== "sheets") throw new Error("Firestore is not configured yet.");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const now = Date.now();
    const rows = sheet.getDataRange().getValues();
    let active = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && Number(rows[i][8]) > now) active++;
    }
    if (active >= 10) throw new Error("There are already 10 active lobbies.");
    const lobby = {
      id: Utilities.getUuid(),
      name: name,
      hostPlaying: hostPlaying,
      private: isPrivate,
      mode: mode,
      server: server,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000
    };
    sheet.appendRow([lobby.id, lobby.name, lobby.hostPlaying, lobby.private, isPrivate ? pin : "", lobby.mode, lobby.server, lobby.createdAt, lobby.expiresAt]);
    return { ok: true, lobby: lobby };
  } finally {
    lock.releaseLock();
  }
}