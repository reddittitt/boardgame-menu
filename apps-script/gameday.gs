/**
 * BGQuick monthly Game Day.
 * Bound to a Google Sheet. Deploy as a web app: Execute as Me, access Anyone.
 * See apps-script/README.md. The /exec URL is public. The sheet stays private.
 *
 * doGet  ?event=YYYY-MM-DD  → RSVPs, food claims, and tables, without edit keys.
 * doPost text/plain JSON    → create or update an RSVP, food claim, or table seat.
 */
var LIMITS = {
  family: 80,
  name: 80,
  note: 280,
  bringing: 140,
  game: 80,
  adults: 40,
  kids: 40,
  quantity: 500,
  seats: 20,
  body: 4000,
  rate: 40,
  rateSeconds: 600
};

var RSVP_SHEET = "RSVPs";
var FOOD_SHEET = "Food";
var TABLE_SHEET = "Tables";
var RSVP_HEADERS = ["eventId", "id", "editKey", "family", "adults", "kids", "status", "note", "updated"];
var FOOD_HEADERS = ["eventId", "id", "editKey", "itemId", "name", "bringing", "quantity", "updated"];
var TABLE_HEADERS = ["eventId", "id", "editKey", "game", "startTime", "seats", "players", "updated"];
var EXPERIENCES = { "new": true, played: true, teach: true };

function doGet(e) {
  return emit(handleGet(e || {}));
}

function doPost(e) {
  return emit(handlePost(e || {}));
}

function emit(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handleGet(e) {
  return withLock(function () {
    var eventId = param(e, "event");
    var dateError = eventError(eventId);
    if (dateError) return fail(dateError);
    return snapshot(eventId);
  });
}

function handlePost(e) {
  return withLock(function () {
    var raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : "";
    if (raw.length > LIMITS.body) return fail("That update is too large.");
    var body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      rateOk("bad");
      return fail("That update didn't make sense.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      rateOk("bad");
      return fail("That update didn't make sense.");
    }
    if (body.email || body.phone || body.tel || body.mail) {
      rateOk(eventError(String(body.eventId || "")) ? "bad" : String(body.eventId));
      return fail("Leave out phone numbers and email addresses.");
    }
    var eventId = String(body.eventId || "").trim();
    var dateError = eventError(eventId);
    if (dateError) {
      rateOk("bad");
      return fail(dateError);
    }
    if (!rateOk(eventId)) return fail("Too many updates for this date. Wait a few minutes and try again.");
    var op = String(body.op || "");
    if (op === "rsvp") return saveRsvp(eventId, body);
    if (op === "food") return saveFood(eventId, body);
    if (op === "unclaim") return removeFood(eventId, body);
    if (op === "nominate") return nominateTable(eventId, body);
    if (op === "join") return joinTable(eventId, body);
    if (op === "leave") return leaveTable(eventId, body);
    return fail("That update didn't make sense.");
  });
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  var got = false;
  try {
    lock.waitLock(10000);
    got = true;
  } catch (err) {
    return fail("The sheet is busy. Try again.");
  }
  try {
    return fn();
  } catch (err) {
    return fail("Something went wrong. Try again.");
  } finally {
    if (got) lock.releaseLock();
  }
}

function fail(message) {
  return { ok: false, error: message };
}

function param(e, name) {
  if (!e || !e.parameter) return "";
  var value = e.parameter[name];
  if (Object.prototype.toString.call(value) === "[object Array]") value = value[0];
  return String(value || "").trim();
}

function eventError(eventId) {
  if (!eventId) return "Pick an event.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventId)) return "That date isn't valid.";
  var parts = eventId.split("-");
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  if (year < 2020 || year > 2100) return "That date isn't valid.";
  var dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return "That date isn't valid.";
  }
  return "";
}

function rateOk(bucket) {
  var cache = CacheService.getScriptCache();
  var key = "gd:" + bucket;
  var n = parseInt(cache.get(key) || "0", 10) || 0;
  if (n >= LIMITS.rate) return false;
  cache.put(key, String(n + 1), LIMITS.rateSeconds);
  return true;
}

function looksLikePhone(text) {
  var digits = String(text || "").replace(/\D/g, "");
  if (digits.length >= 10) return true;
  if (/\(\d{3}\)/.test(text)) return true;
  if (/\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(text)) return true;
  return false;
}

function scrub(value) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function textProblem(text) {
  if (text.indexOf("@") !== -1 || /mailto:/i.test(text)) return "Leave out email addresses.";
  if (looksLikePhone(text)) return "Leave out phone numbers.";
  if (/[<>]/.test(text) || /^[=+]/.test(text)) return "That text isn't allowed.";
  return "";
}

function cleanRequired(value, max, emptyMessage) {
  var text = scrub(value);
  if (!text) return fail(emptyMessage);
  if (text.length > max) return fail("That text is too long.");
  var problem = textProblem(text);
  if (problem) return fail(problem);
  if (!/[A-Za-z]/.test(text) && !/[^\u0000-\u007f]/.test(text)) return fail("Use letters in that name.");
  return { ok: true, value: text };
}

function cleanNote(value) {
  var text = scrub(value);
  if (!text) return { ok: true, value: "" };
  if (text.length > LIMITS.note) return fail("The note is too long.");
  var problem = textProblem(text);
  if (problem) return fail(problem);
  return { ok: true, value: text };
}

function wholeNumber(value, max) {
  if (typeof value === "boolean" || value == null) return null;
  var text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  var n = parseInt(text, 10);
  if (n > max) return null;
  return n;
}

function cleanId(value, allowEmpty) {
  var text = String(value == null ? "" : value).trim();
  if (!text && allowEmpty) return { ok: true, value: "" };
  if (!/^[a-f0-9]{32}$/.test(text)) return fail("That update didn't make sense.");
  return { ok: true, value: text };
}

function cleanKey(value) {
  var text = String(value == null ? "" : value).trim();
  if (!/^[a-f0-9]{32}$/.test(text)) return fail("That update didn't make sense.");
  return { ok: true, value: text };
}

function newId() {
  return Utilities.getUuid().replace(/-/g, "").toLowerCase();
}

function sheet(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    return sh;
  }
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function valuesOf(sh) {
  if (sh.getLastRow() < 1) return [];
  return sh.getDataRange().getValues();
}

function writeRow(sh, row, values) {
  sh.getRange(row, 1, 1, values.length).setValues([values]);
}

function locate(sh, eventId, id, editKey, collapseEmptyId) {
  var values = valuesOf(sh);
  var keyRow = 0;
  var i;
  for (i = 1; i < values.length; i++) {
    var rowEvent = String(values[i][0] || "");
    var rowId = String(values[i][1] || "");
    var rowKey = String(values[i][2] || "");
    if (id && rowId === id) {
      if (rowEvent !== eventId || rowKey !== editKey) return { error: "That can't be edited from this device." };
      return { row: i + 1 };
    }
    if (collapseEmptyId && !id && rowEvent === eventId && rowKey === editKey && !keyRow) keyRow = i + 1;
  }
  if (keyRow) return { row: keyRow };
  return { row: 0 };
}

function saveRsvp(eventId, body) {
  var id = cleanId(body.id, true);
  if (!id.ok) return id;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var family = cleanRequired(body.family, LIMITS.family, "Enter a family name.");
  if (!family.ok) return family;
  var note = cleanNote(body.note);
  if (!note.ok) return note;
  var adults = wholeNumber(body.adults, LIMITS.adults);
  var kids = wholeNumber(body.kids, LIMITS.kids);
  if (adults == null || kids == null) return fail("Use whole numbers for adults and kids.");
  var status = String(body.status || "");
  if (status !== "going" && status !== "maybe" && status !== "no") return fail("Pick Going, Maybe, or Can't make it.");
  if (status !== "no" && adults + kids < 1) return fail("Add at least one person.");
  var sh = sheet(RSVP_SHEET, RSVP_HEADERS);
  var found = locate(sh, eventId, id.value, key.value, true);
  if (found.error) return fail(found.error);
  var rowId = id.value || newId();
  if (found.row) {
    var existing = valuesOf(sh)[found.row - 1];
    rowId = String(existing[1] || rowId);
  }
  var record = [eventId, rowId, key.value, family.value, adults, kids, status, note.value, new Date().toISOString()];
  if (found.row) writeRow(sh, found.row, record);
  else sh.appendRow(record);
  return snapshot(eventId);
}

function saveFood(eventId, body) {
  var id = cleanId(body.id, true);
  if (!id.ok) return id;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var itemId = String(body.itemId || "").trim();
  if (!/^[a-z0-9-]{1,40}$/.test(itemId)) return fail("Pick something from the food list.");
  var name = cleanRequired(body.name, LIMITS.name, "Enter your name.");
  if (!name.ok) return name;
  var bringing = cleanRequired(body.bringing, LIMITS.bringing, "Say what you're bringing.");
  if (!bringing.ok) return bringing;
  var quantity = wholeNumber(body.quantity, LIMITS.quantity);
  if (quantity == null || quantity < 1) return fail("Enter how many you're bringing.");
  var sh = sheet(FOOD_SHEET, FOOD_HEADERS);
  var found = locate(sh, eventId, id.value, key.value, false);
  if (found.error) return fail(found.error);
  var rowId = id.value || newId();
  if (found.row) {
    var existing = valuesOf(sh)[found.row - 1];
    rowId = String(existing[1] || rowId);
  }
  var record = [eventId, rowId, key.value, itemId, name.value, bringing.value, quantity, new Date().toISOString()];
  if (found.row) writeRow(sh, found.row, record);
  else sh.appendRow(record);
  return snapshot(eventId);
}

function removeFood(eventId, body) {
  var id = cleanId(body.id, false);
  if (!id.ok) return id;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var sh = sheet(FOOD_SHEET, FOOD_HEADERS);
  var found = locate(sh, eventId, id.value, key.value, false);
  if (found.error) return fail(found.error);
  if (!found.row) return fail("That can't be edited from this device.");
  sh.deleteRow(found.row);
  return snapshot(eventId);
}

function cleanExperience(value) {
  var text = String(value == null ? "" : value).trim();
  if (!EXPERIENCES[text]) return fail("Pick New to it, Played before, or Can teach.");
  return { ok: true, value: text };
}

function cleanStartTime(value) {
  var text = String(value == null ? "" : value).trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return fail("Pick a start time.");
  var parts = text.split(":");
  var hour = Number(parts[0]);
  var minute = Number(parts[1]);
  if (hour < 15 || hour > 20) return fail("Pick a start time between 3:00 and 8:30 PM.");
  if (minute !== 0 && minute !== 30) return fail("Pick a start time on the hour or half hour.");
  if (hour === 20 && minute === 30) return fail("Pick a start time between 3:00 and 8:30 PM.");
  return { ok: true, value: text };
}

function cleanSeats(value) {
  var seats = wholeNumber(value, LIMITS.seats);
  if (seats == null || seats < 1) return fail("Enter how many seats the table has.");
  return { ok: true, value: seats };
}

function parsePlayers(raw) {
  if (!raw) return [];
  if (Object.prototype.toString.call(raw) === "[object Array]") return raw;
  try {
    var parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function publicPlayers(list) {
  var out = [];
  var i;
  for (i = 0; i < list.length; i++) {
    var row = list[i] || {};
    var id = String(row.id || "");
    var name = String(row.name || "");
    var experience = String(row.experience || "");
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    if (!name || !EXPERIENCES[experience]) continue;
    out.push({ id: id, name: name, experience: experience });
  }
  return out;
}

function locateTable(sh, eventId, tableId) {
  var values = valuesOf(sh);
  var i;
  for (i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") !== eventId) continue;
    if (String(values[i][1] || "") !== tableId) continue;
    return {
      row: i + 1,
      editKey: String(values[i][2] || ""),
      game: String(values[i][3] || ""),
      startTime: String(values[i][4] || ""),
      seats: Number(values[i][5]) || 0,
      players: parsePlayers(values[i][6])
    };
  }
  return null;
}

function writeTable(sh, row, eventId, tableId, hostKey, game, startTime, seats, players) {
  var record = [
    eventId,
    tableId,
    hostKey,
    game,
    startTime,
    seats,
    JSON.stringify(players),
    new Date().toISOString()
  ];
  if (row) writeRow(sh, row, record);
  else sh.appendRow(record);
}

function nominateTable(eventId, body) {
  var id = cleanId(body.id, true);
  if (!id.ok) return id;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var game = cleanRequired(body.game, LIMITS.game, "Enter a game.");
  if (!game.ok) return game;
  var startTime = cleanStartTime(body.startTime);
  if (!startTime.ok) return startTime;
  var seats = cleanSeats(body.seats);
  if (!seats.ok) return seats;
  var name = cleanRequired(body.name, LIMITS.name, "Enter your first name.");
  if (!name.ok) return name;
  var experience = cleanExperience(body.experience);
  if (!experience.ok) return experience;
  var playerId = cleanId(body.playerId, true);
  if (!playerId.ok) return playerId;
  var sh = sheet(TABLE_SHEET, TABLE_HEADERS);
  var tableId = id.value || newId();
  if (id.value && locateTable(sh, eventId, tableId)) return fail("That table is already posted.");
  var seatPlayer = {
    id: playerId.value || newId(),
    editKey: key.value,
    name: name.value,
    experience: experience.value
  };
  writeTable(sh, 0, eventId, tableId, key.value, game.value, startTime.value, seats.value, [seatPlayer]);
  return snapshot(eventId);
}

function joinTable(eventId, body) {
  var tableId = cleanId(body.tableId, false);
  if (!tableId.ok) return tableId;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var name = cleanRequired(body.name, LIMITS.name, "Enter your first name.");
  if (!name.ok) return name;
  var experience = cleanExperience(body.experience);
  if (!experience.ok) return experience;
  var playerId = cleanId(body.id, true);
  if (!playerId.ok) return playerId;
  var sh = sheet(TABLE_SHEET, TABLE_HEADERS);
  var found = locateTable(sh, eventId, tableId.value);
  if (!found) return fail("That table isn't open anymore.");
  var players = found.players.slice();
  var i;
  for (i = 0; i < players.length; i++) {
    if (String(players[i].editKey || "") === key.value) return fail("You're already at this table.");
    if (playerId.value && String(players[i].id || "") === playerId.value) return fail("You're already at this table.");
  }
  if (players.length >= found.seats) return fail("That table is full.");
  players.push({
    id: playerId.value || newId(),
    editKey: key.value,
    name: name.value,
    experience: experience.value
  });
  writeTable(sh, found.row, eventId, tableId.value, found.editKey, found.game, found.startTime, found.seats, players);
  return snapshot(eventId);
}

function leaveTable(eventId, body) {
  var tableId = cleanId(body.tableId, false);
  if (!tableId.ok) return tableId;
  var key = cleanKey(body.editKey);
  if (!key.ok) return key;
  var playerId = cleanId(body.id, true);
  if (!playerId.ok) return playerId;
  var sh = sheet(TABLE_SHEET, TABLE_HEADERS);
  var found = locateTable(sh, eventId, tableId.value);
  if (!found) return fail("That table isn't open anymore.");
  var players = [];
  var removed = false;
  var i;
  for (i = 0; i < found.players.length; i++) {
    var row = found.players[i] || {};
    if (String(row.editKey || "") === key.value) {
      removed = true;
      continue;
    }
    if (playerId.value && String(row.id || "") === playerId.value) {
      return fail("That can't be edited from this device.");
    }
    players.push(row);
  }
  if (!removed) return fail("That can't be edited from this device.");
  if (!players.length) {
    sh.deleteRow(found.row);
    return snapshot(eventId);
  }
  writeTable(sh, found.row, eventId, tableId.value, found.editKey, found.game, found.startTime, found.seats, players);
  return snapshot(eventId);
}

function snapshot(eventId) {
  return {
    ok: true,
    eventId: eventId,
    rsvps: publicRsvps(eventId),
    food: publicFood(eventId),
    tables: publicTables(eventId)
  };
}

function publicTables(eventId) {
  var values = valuesOf(sheet(TABLE_SHEET, TABLE_HEADERS));
  var out = [];
  var i;
  for (i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") !== eventId) continue;
    if (!values[i][1]) continue;
    var seats = Number(values[i][5]) || 0;
    var players = publicPlayers(parsePlayers(values[i][6]));
    out.push({
      id: String(values[i][1]),
      game: String(values[i][3] || ""),
      startTime: String(values[i][4] || ""),
      seats: seats,
      players: players
    });
  }
  out.sort(function (a, b) {
    if (a.startTime < b.startTime) return -1;
    if (a.startTime > b.startTime) return 1;
    return a.game.localeCompare(b.game);
  });
  return out;
}

function publicRsvps(eventId) {
  var values = valuesOf(sheet(RSVP_SHEET, RSVP_HEADERS));
  var out = [];
  var i;
  for (i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") !== eventId) continue;
    if (!values[i][1]) continue;
    out.push({
      id: String(values[i][1]),
      family: String(values[i][3] || ""),
      adults: Number(values[i][4]) || 0,
      kids: Number(values[i][5]) || 0,
      status: String(values[i][6] || ""),
      note: String(values[i][7] || "")
    });
  }
  return out;
}

function publicFood(eventId) {
  var values = valuesOf(sheet(FOOD_SHEET, FOOD_HEADERS));
  var out = [];
  var i;
  for (i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") !== eventId) continue;
    if (!values[i][1]) continue;
    out.push({
      id: String(values[i][1]),
      itemId: String(values[i][3] || ""),
      name: String(values[i][4] || ""),
      bringing: String(values[i][5] || ""),
      quantity: Number(values[i][6]) || 0
    });
  }
  return out;
}
