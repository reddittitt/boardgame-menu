/* Rules for the Game Day Apps Script and the page's food math.
   Run: node tests/gameday-rules.mjs */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { createBackend } from "./gameday-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function same(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(message + "\n  actual: " + JSON.stringify(actual) + "\n  expected: " + JSON.stringify(expected));
}

function loadGameDay() {
  const context = vm.createContext({ console: console });
  context.window = context;
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(root, "game-day.js"), "utf8"), context, { filename: "game-day.js" });
  return context.GameDay;
}

const EVENT = "2026-11-21";
const KEY = "a".repeat(32);
const OTHER = "b".repeat(32);

function id(n) {
  return n.toString(16).padStart(32, "0");
}

function rsvp(extra) {
  return Object.assign({
    op: "rsvp",
    eventId: EVENT,
    id: id(1),
    editKey: KEY,
    family: "The Garcias",
    adults: 2,
    kids: 1,
    status: "going",
    note: "We'll bring a game"
  }, extra || {});
}

function checkScaling(GameDay) {
  const config = GameDay.parseConfig(JSON.parse(fs.readFileSync(path.join(root, "data/game-days.json"), "utf8")));
  const drinks = config.food.items.filter(function (item) { return item.id === "drinks"; })[0];
  const snacks = config.food.items.filter(function (item) { return item.id === "snacks"; })[0];
  const plates = config.food.items.filter(function (item) { return item.id === "plates"; })[0];
  const people = GameDay.foodPeople([
    { status: "going", adults: 10, kids: 10 },
    { status: "maybe", adults: 2, kids: 0 },
    { status: "no", adults: 4, kids: 1 }
  ], config.food);
  assert(people.people === 16, "10 adults + 10 kids at half, plus a maybe, is 16 (" + people.people + ")");
  assert(GameDay.foodPeople([{ status: "going", adults: 10, kids: 10 }], config.food).people === 15, "kids count as half");
  same(GameDay.suggestionLine(drinks, 15), "Drinks: about 2 per person, so ~30 cans", "drinks line");
  same(GameDay.suggestionLine(snacks, 15), "Snacks: 4 bags for 15 people", "snacks line");
  same(GameDay.suggestionLine(plates, 15), "Plates, cups, and napkins: about 1 per person, so ~15 place settings", "plates line");
  same(GameDay.formatDate("2026-11-21"), "Saturday, November 21, 2026", "date format");
  same(GameDay.nextDate(config.dates, "2026-11-20").id, "2026-11-21", "next date");
  assert(GameDay.nextDate(config.dates, "2027-03-01") == null, "no date after the list");
  assert(GameDay.endpointOpen("") === false, "empty endpoint is closed");
  assert(GameDay.endpointOpen("https://script.google.com/macros/s/abc_DEF-123/exec") === true, "exec url opens");
  assert(GameDay.endpointOpen("http://127.0.0.1:9/exec") === true, "loopback test url opens");
  assert(GameDay.endpointOpen("https://script.google.com/macros/s/PASTE_THE_LONG_ID/exec") === false, "placeholder stays closed");
  assert(GameDay.endpointOpen("https://evil.example/exec") === false, "other hosts stay closed");
  same(
    GameDay.totalsText([{ status: "going", adults: 10, kids: 10, family: "A" }]),
    "1 family going · 10 adults · 10 kids · 20 people",
    "totals"
  );
  assert(
    config.endpoint === "https://script.google.com/macros/s/AKfycbypC0DWIPjsGqwegeym0YKgoNk3XEPzRNZezCqLpJPMXztktWuuC9VqWlQpxYcRNvDuWg/exec",
    "published endpoint points at the deployed Apps Script web app"
  );
  assert(GameDay.endpointOpen(config.endpoint) === true, "published endpoint opens RSVPs");
  const joined = JSON.stringify(config);
  assert(!/street|avenue|boulevard|drive/i.test(joined), "config has no street address");
  assert(!joined.includes("@"), "config has no email");
}

function checkScript() {
  const backend = createBackend();
  const created = backend.post(rsvp());
  assert(created.ok === true, "create rsvp: " + JSON.stringify(created));
  assert(created.rsvps.length === 1, "one rsvp");
  assert(created.rsvps[0].family === "The Garcias", "family saved");
  assert(!Object.prototype.hasOwnProperty.call(created.rsvps[0], "editKey"), "edit key is not a field");
  assert(!JSON.stringify(created).includes(KEY), "response does not contain the edit key");
  assert(backend.flags.lockWaits > 0 && backend.flags.lockHeld === false, "lock was taken and released");

  const updated = backend.post(rsvp({ adults: 4, note: "Running late" }));
  assert(updated.ok === true && updated.rsvps.length === 1 && updated.rsvps[0].adults === 4, "same family updates");
  assert(updated.rsvps[0].note === "Running late", "note updates");

  const sneaky = backend.post(rsvp({ editKey: OTHER, family: "Hacker", adults: 9 }));
  assert(sneaky.ok === false, "wrong key is rejected");
  assert(backend.get(EVENT).rsvps[0].family === "The Garcias", "wrong key does not overwrite");

  const email = backend.post(rsvp({ id: id(2), editKey: OTHER, family: "Pat a@example.com" }));
  assert(email.ok === false && /email/i.test(email.error), "email rejected: " + JSON.stringify(email));
  const phone = backend.post(rsvp({ id: id(3), editKey: OTHER, note: "Call 555-123-4567" }));
  assert(phone.ok === false && /phone/i.test(phone.error), "phone rejected");
  assert(backend.get(EVENT).rsvps.length === 1, "bad contact info was not stored");

  assert(backend.post(rsvp({ id: id(4), editKey: OTHER, adults: 41 })).ok === false, "too many adults");
  assert(backend.post(rsvp({ id: id(5), editKey: OTHER, kids: "two" })).ok === false, "kids must be a number");
  assert(backend.post(rsvp({ id: id(6), editKey: OTHER, status: "host" })).ok === false, "bad status");
  assert(backend.post(rsvp({ id: id(7), editKey: OTHER, adults: 0, kids: 0, status: "going" })).ok === false, "going needs a person");
  assert(backend.post(rsvp({ id: id(8), editKey: OTHER, family: "=" + "cmd" })).ok === false, "formula text rejected");
  assert(backend.post(rsvp({ id: id(9), editKey: OTHER, family: "A".repeat(81) })).ok === false, "long name rejected");
  const declined = backend.post(rsvp({ id: id(10), editKey: OTHER, family: "The Ngs", adults: 0, kids: 0, status: "no", note: "" }));
  assert(declined.ok === true, "can't make it with nobody counted is allowed");

  const food = backend.post({
    op: "food",
    eventId: EVENT,
    id: id(20),
    editKey: KEY,
    itemId: "drinks",
    name: "The Garcias",
    bringing: "seltzer",
    quantity: 12
  });
  assert(food.ok === true && food.food.length === 1 && food.food[0].quantity === 12, "food claim");
  assert(!JSON.stringify(food.food).includes(KEY), "food response hides the edit key");
  const changed = backend.post({
    op: "food",
    eventId: EVENT,
    id: id(20),
    editKey: KEY,
    itemId: "drinks",
    name: "The Garcias",
    bringing: "water",
    quantity: 18
  });
  assert(changed.ok === true && changed.food.length === 1 && changed.food[0].bringing === "water", "food update");
  assert(backend.post({
    op: "unclaim",
    eventId: EVENT,
    id: id(20),
    editKey: OTHER
  }).ok === false, "wrong key cannot remove food");
  assert(backend.get(EVENT).food.length === 1, "food remains after a bad remove");
  assert(backend.post({ op: "unclaim", eventId: EVENT, id: id(20), editKey: KEY }).ok === true, "owner can remove food");
  assert(backend.get(EVENT).food.length === 0, "food removed");

  assert(backend.post({
    op: "food",
    eventId: EVENT,
    id: id(21),
    editKey: KEY,
    itemId: "Drinks",
    name: "The Garcias",
    bringing: "soda",
    quantity: 1
  }).ok === false, "item id must match the list shape");
  assert(backend.post({
    op: "food",
    eventId: EVENT,
    id: id(22),
    editKey: KEY,
    itemId: "ice",
    name: "The Garcias",
    bringing: "ice",
    quantity: 0
  }).ok === false, "quantity must be at least 1");

  const first = backend.post({ op: "rsvp", eventId: "2026-12-19", id: "", editKey: KEY, family: "The Lees", adults: 1, kids: 0, status: "going", note: "" });
  const second = backend.post({ op: "rsvp", eventId: "2026-12-19", id: "", editKey: KEY, family: "The Lees", adults: 3, kids: 1, status: "maybe", note: "" });
  assert(first.ok && second.ok && second.rsvps.length === 1 && second.rsvps[0].adults === 3, "empty id updates the same device");
  const extra = backend.post({ op: "food", eventId: "2026-12-19", id: "", editKey: KEY, itemId: "snacks", name: "The Lees", bringing: "chips", quantity: 2 });
  const extra2 = backend.post({ op: "food", eventId: "2026-12-19", id: "", editKey: KEY, itemId: "snacks", name: "The Lees", bringing: "pretzels", quantity: 1 });
  assert(extra.ok && extra2.ok && extra2.food.length === 2, "two food claims stay separate");
  assert(backend.get(EVENT).rsvps.some(function (row) { return row.family === "The Garcias"; }), "other date is separate");
  assert(!backend.get(EVENT).rsvps.some(function (row) { return row.family === "The Lees"; }), "december does not leak into november");

  assert(backend.postRaw("nope").ok === false, "bad json");
  assert(backend.postRaw("[" + "1]").ok === false, "array body");
  assert(backend.postRaw("{" + '"op":"rsvp"}'.padEnd(4001, " ")).ok === false, "huge body");
  assert(backend.get("").ok === false, "missing event");
  assert(backend.get("2026-02-31").ok === false, "impossible date");
  assert(backend.post({ op: "nope", eventId: EVENT, editKey: KEY }).ok === false, "unknown op");
  assert(backend.post({ op: "rsvp", eventId: EVENT, editKey: KEY, family: "The Garcias", adults: 1, kids: 0, status: "going", email: "a@b.co" }).ok === false, "email field rejected");

  backend.reset();
  const mime = backend.doGet({ parameter: { event: EVENT } });
  assert(mime.mime === "JSON", "doGet mime");
  assert(JSON.parse(mime.text).ok === true, "doGet json");
  const posted = backend.doPost({ postData: { contents: JSON.stringify(rsvp()) } });
  assert(posted.mime === "JSON" && JSON.parse(posted.text).ok === true, "doPost json");

  backend.flags.lockFail = true;
  const busy = backend.post(rsvp({ id: id(30) }));
  assert(busy.ok === false && busy.error === "The sheet is busy. Try again.", "busy lock");
  backend.flags.lockFail = false;
  backend.flags.boom = true;
  const boom = backend.get(EVENT);
  assert(boom.ok === false && boom.error === "Something went wrong. Try again.", "hidden failure");
  assert(!JSON.stringify(boom).includes("SECRET"), "error hides internals");
  assert(backend.flags.lockHeld === false, "lock released after a failure");

  backend.reset();
  let n = 0;
  for (; n < 40; n++) {
    const row = backend.post(rsvp({
      id: id(100 + n),
      editKey: id(400 + n),
      family: "Family " + n,
      adults: 1,
      kids: 0,
      note: ""
    }));
    if (!row.ok) failures.push("rate limit tripped early at " + n + " " + JSON.stringify(row));
  }
  const blocked = backend.post(rsvp({ id: id(999), editKey: id(999), family: "Family late", adults: 1, kids: 0, note: "" }));
  assert(blocked.ok === false && /wait/i.test(blocked.error), "rate limit: " + JSON.stringify(blocked));
  assert(backend.get(EVENT).rsvps.length === 40, "the blocked write was not stored");
  const otherDay = backend.post(rsvp({ eventId: "2027-01-23", id: id(1000), editKey: id(1000), family: "The Parks", adults: 2, kids: 0, note: "" }));
  assert(otherDay.ok === true, "a different date has its own limit");
}

function checkTables(GameDay) {
  same(GameDay.experienceLabel("teach"), "Can teach", "teach label");
  same(GameDay.formatStartTime("15:30"), "3:30 PM", "start time format");
  assert(GameDay.needsTeacher([{ experience: "new" }, { experience: "played" }]) === true, "needs teacher");
  assert(GameDay.needsTeacher([{ experience: "new" }, { experience: "teach" }]) === false, "has teacher");
  assert(GameDay.tableFull({ seats: 2, players: [{}, {}] }) === true, "full table");
  assert(GameDay.tableFull({ seats: 3, players: [{}, {}] }) === false, "open table");
  same(GameDay.maxPlayersFromGame({ players: "2–4" }), 4, "max from players");
  same(GameDay.maxPlayersFromGame({ players: "3+", playerPoll: { recommended: "3–6" } }), 6, "open uses recommended");
  const catalog = GameDay.parseCatalog({
    names: ["Azul", "Mystery Box"],
    enrich: { azul: { players: "2–4" } }
  });
  assert(catalog.length === 2 && catalog[0].maxPlayers === 4, "catalog max seats");
  assert(catalog[1].maxPlayers == null, "unknown game has no max");
  same(GameDay.filterGames(catalog, "azu").map(function (g) { return g.name; }), ["Azul"], "game search");
  assert(GameDay.payloadHasTables({ ok: true, rsvps: [], food: [] }) === false, "live snapshot without tables is not ready");
  assert(GameDay.payloadHasTables({ ok: true, rsvps: [], food: [], tables: [] }) === true, "empty tables list is ready");
  assert(GameDay.payloadHasTables({ ok: true, tables: [{ id: "1" }] }) === true, "tables list is ready");
  assert(GameDay.START_TIMES.indexOf("20:30") !== -1, "late start option");
}

function checkTableScript() {
  const backend = createBackend();
  const host = backend.post({
    op: "nominate",
    eventId: EVENT,
    id: id(50),
    playerId: id(51),
    editKey: KEY,
    game: "Azul",
    startTime: "15:00",
    seats: 2,
    name: "Alex",
    experience: "played"
  });
  assert(host.ok === true, "nominate: " + JSON.stringify(host));
  assert(host.tables.length === 1, "one table");
  assert(host.tables[0].players.length === 1, "host seated");
  assert(host.tables[0].players[0].name === "Alex", "host name");
  assert(host.tables[0].players[0].experience === "played", "host experience");
  assert(!JSON.stringify(host.tables).includes(KEY), "table response hides edit keys");
  assert(host.rsvps && Array.isArray(host.food), "rsvp and food shapes remain");

  const join = backend.post({
    op: "join",
    eventId: EVENT,
    tableId: id(50),
    id: id(52),
    editKey: OTHER,
    name: "Sam",
    experience: "new"
  });
  assert(join.ok === true && join.tables[0].players.length === 2, "join fills last seat");
  const locked = backend.flags.lockWaits;
  const overflow = backend.post({
    op: "join",
    eventId: EVENT,
    tableId: id(50),
    id: id(53),
    editKey: id(53),
    name: "Pat",
    experience: "teach"
  });
  assert(overflow.ok === false && /full/i.test(overflow.error), "seat limit: " + JSON.stringify(overflow));
  assert(backend.flags.lockWaits > locked, "seat limit checked under lock");
  assert(backend.get(EVENT).tables[0].players.length === 2, "overflow seat was not stored");

  assert(backend.post({
    op: "join",
    eventId: EVENT,
    tableId: id(50),
    id: id(54),
    editKey: OTHER,
    name: "Sam Again",
    experience: "new"
  }).ok === false, "same device cannot double join");

  const left = backend.post({
    op: "leave",
    eventId: EVENT,
    tableId: id(50),
    id: id(52),
    editKey: OTHER
  });
  assert(left.ok === true && left.tables[0].players.length === 1, "leave frees a seat");
  assert(left.tables[0].players[0].name === "Alex", "host remains");

  assert(backend.post({
    op: "nominate",
    eventId: EVENT,
    id: id(60),
    playerId: id(61),
    editKey: KEY,
    game: "a@b.com",
    startTime: "15:00",
    seats: 4,
    name: "Alex",
    experience: "teach"
  }).ok === false, "email in game rejected");
  assert(backend.post({
    op: "nominate",
    eventId: EVENT,
    id: id(62),
    playerId: id(63),
    editKey: KEY,
    game: "Catan",
    startTime: "12:00",
    seats: 4,
    name: "Alex",
    experience: "teach"
  }).ok === false, "start time out of range");
  assert(backend.post({
    op: "nominate",
    eventId: EVENT,
    id: id(64),
    playerId: id(65),
    editKey: KEY,
    game: "Catan",
    startTime: "16:00",
    seats: 4,
    name: "Alex",
    experience: "expert"
  }).ok === false, "bad experience");

  const alone = backend.post({
    op: "nominate",
    eventId: EVENT,
    id: id(70),
    playerId: id(71),
    editKey: id(70),
    game: "Solo Quest",
    startTime: "16:00",
    seats: 1,
    name: "Riley",
    experience: "teach"
  });
  assert(alone.ok === true, "single-seat table");
  const gone = backend.post({
    op: "leave",
    eventId: EVENT,
    tableId: id(70),
    id: id(71),
    editKey: id(70)
  });
  assert(gone.ok === true && !gone.tables.some(function (row) { return row.id === id(70); }), "empty table removed");

  const snap = backend.get(EVENT);
  assert(Array.isArray(snap.tables) && Array.isArray(snap.rsvps) && Array.isArray(snap.food), "snapshot keeps rsvp/food/tables");
}

const page = fs.readFileSync(path.join(root, "game-day.html"), "utf8");
const script = fs.readFileSync(path.join(root, "game-day.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert(page.includes('data-look="hig"'), "new look");
assert(page.includes("font-size:16px"), "inputs stay at 16px");
assert(!/type="email"|type="tel"|phone|email/i.test(page), "page has no contact fields");
assert(!/street|avenue|boulevard/i.test(page + script), "no street address in the page");
assert(script.includes(JSON.stringify("Location shared after you RSVP")), "location stays hidden until an RSVP");
assert(script.includes(JSON.stringify("CRPC")), "after RSVP the page says CRPC");
assert(sw.includes('var VERSION = "2026.11.21.7"'), "service worker version");
const fetchAt = sw.indexOf('addEventListener("fetch"');
const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
const respondAt = sw.indexOf("respondWith", fetchAt);
assert(originAt > fetchAt && originAt < respondAt, "cross-origin requests return before respondWith");
assert(page.includes("gd-badge") || script.includes("Needs a teacher"), "needs-teacher badge");
assert(script.includes("Table sign-ups open soon"), "closed tables copy");
assert(script.includes('op: "nominate"') && script.includes('op: "join"') && script.includes('op: "leave"'), "table client ops");

checkScaling(loadGameDay());
checkTables(loadGameDay());
checkScript();
checkTableScript();

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log("game day rules passed");
