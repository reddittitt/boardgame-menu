/* Monthly Game Day. Dates and food rules come from data/game-days.json.
   RSVPs, food claims, and table sign-ups go to the Apps Script /exec URL.
   The edit key stays in localStorage and is never shown. */
(function (root) {
  var LOCATION_BEFORE = "Location shared after you RSVP";
  var LOCATION_AFTER = "CRPC";
  var KEY_NAME = "bgq-gameday-key";
  var EXPERIENCE_LABELS = {
    "new": "New to it",
    played: "Played before",
    teach: "Can teach"
  };
  var START_TIMES = [
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"
  ];

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function validDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-");
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return dt.getUTCFullYear() === +p[0] && dt.getUTCMonth() === +p[1] - 1 && dt.getUTCDate() === +p[2];
  }

  function formatDate(iso) {
    var p = String(iso || "").split("-");
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(dt);
    } catch (e) {
      return iso;
    }
  }

  function formatNum(n) {
    if (!isFinite(n)) return "0";
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }

  function endpointOpen(url) {
    var u = String(url || "").trim();
    if (!u || /PASTE|REPLACE|YOUR_/i.test(u)) return false;
    if (/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(u)) return true;
    if (/^http:\/\/(127\.0\.0\.1|localhost):\d+\/exec\/?$/.test(u)) return true;
    return false;
  }


  function payloadHasTables(payload) {
    return !!(payload && Object.prototype.hasOwnProperty.call(payload, "tables"));
  }

  function parseConfig(raw) {
    var data = raw && typeof raw === "object" ? raw : {};
    var dates = [];
    var list = Array.isArray(data.dates) ? data.dates : [];
    list.forEach(function (item) {
      var date = typeof item === "string" ? item : item && item.date;
      var id = typeof item === "string" ? item : item && (item.id || item.date);
      var note = item && typeof item === "object" ? String(item.note || "") : "";
      date = String(date || "");
      id = String(id || "");
      if (!validDate(date)) return;
      if (!/^[a-z0-9-]{1,40}$/.test(id)) return;
      dates.push({ id: id, date: date, note: note.slice(0, 160) });
    });
    dates.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
    var food = data.food && typeof data.food === "object" ? data.food : {};
    var kid = Number(food.kidWeight);
    var maybe = Number(food.maybeWeight);
    if (!isFinite(kid) || kid < 0) kid = 0.5;
    if (!isFinite(maybe) || maybe < 0) maybe = 0.5;
    var items = [];
    (Array.isArray(food.items) ? food.items : []).forEach(function (item) {
      if (!item || !/^[a-z0-9-]{1,40}$/.test(String(item.id || ""))) return;
      var every = Number(item.every);
      var amount = Number(item.amount);
      if (!(every > 0) || !(amount > 0)) return;
      items.push({
        id: String(item.id),
        label: String(item.label || item.id).slice(0, 80),
        every: every,
        amount: amount,
        unit: String(item.unit || "item").slice(0, 40),
        unitPlural: String(item.unitPlural || "").slice(0, 40)
      });
    });
    return {
      endpoint: String(data.endpoint || "").trim(),
      timeLabel: String(data.timeLabel || "3:00–9:00 PM").slice(0, 40),
      dates: dates,
      food: { kidWeight: kid, maybeWeight: maybe, items: items }
    };
  }

  function nextDate(dates, today) {
    var i;
    for (i = 0; i < dates.length; i++) {
      if (dates[i].date >= today) return dates[i];
    }
    return null;
  }

  function foodPeople(rsvps, rules) {
    var kid = rules && isFinite(Number(rules.kidWeight)) ? Number(rules.kidWeight) : 0.5;
    var maybe = rules && isFinite(Number(rules.maybeWeight)) ? Number(rules.maybeWeight) : 0.5;
    if (kid < 0) kid = 0.5;
    if (maybe < 0) maybe = 0.5;
    var people = 0;
    (rsvps || []).forEach(function (row) {
      var weight = row.status === "going" ? 1 : row.status === "maybe" ? maybe : 0;
      if (!weight) return;
      people += weight * ((Number(row.adults) || 0) + kid * (Number(row.kids) || 0));
    });
    return { people: people, kidWeight: kid, maybeWeight: maybe };
  }

  function suggestedCount(item, people) {
    if (!(people > 0) || !item) return 0;
    return Math.ceil((people / item.every) * item.amount - 1e-9);
  }

  function unitName(item, n) {
    if (n === 1) return item.unit;
    return item.unitPlural || item.unit + "s";
  }

  function suggestionLine(item, people) {
    var count = suggestedCount(item, people);
    var label = item.label;
    if (!(people > 0)) {
      if (item.every === 1) return label + ": about " + formatNum(item.amount) + " per person. Waiting on RSVPs to estimate a count.";
      return label + ": " + formatNum(item.amount) + " " + unitName(item, item.amount) + " for every " + formatNum(item.every) + " people. Waiting on RSVPs to estimate a count.";
    }
    if (item.every === 1) return label + ": about " + formatNum(item.amount) + " per person, so ~" + count + " " + unitName(item, count);
    return label + ": " + count + " " + unitName(item, count) + " for " + formatNum(people) + " people";
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function totalsText(rsvps) {
    var going = [];
    var maybe = [];
    var i;
    for (i = 0; i < rsvps.length; i++) {
      if (rsvps[i].status === "going") going.push(rsvps[i]);
      else if (rsvps[i].status === "maybe") maybe.push(rsvps[i]);
    }
    if (!rsvps.length) return "Nobody has RSVPed yet.";
    var adults = 0;
    var kids = 0;
    going.forEach(function (row) {
      adults += row.adults;
      kids += row.kids;
    });
    var parts = [
      plural(going.length, "family", "families") + " going",
      plural(adults, "adult", "adults"),
      plural(kids, "kid", "kids"),
      plural(adults + kids, "person", "people")
    ];
    if (maybe.length) parts.push(plural(maybe.length, "family", "families") + " maybe");
    return parts.join(" · ");
  }

  function foodIntro(stats) {
    var half = Math.abs(stats.kidWeight - 0.5) < 1e-6;
    var kidPhrase = half ? "Kids count as half an adult for food." : "Kids count as " + formatNum(stats.kidWeight) + " of an adult for food.";
    if (!(stats.people > 0)) return "Quantities scale with RSVPs. " + kidPhrase;
    return "Planning food for about " + formatNum(stats.people) + " people. " + kidPhrase;
  }

  function experienceLabel(code) {
    return EXPERIENCE_LABELS[code] || "";
  }

  function playerSpan(value) {
    if (value == null || value === "") return null;
    var text = String(value).trim();
    if (!text || /^(none|varies)$/i.test(text)) return null;
    var nums = text.match(/\d+/g);
    if (!nums) return null;
    var values = nums.map(Number);
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var open = /(\+|or more|and up)/i.test(text);
    if (open) max = Math.max(max, 99);
    return { min: min, max: max, open: open };
  }

  function maxPlayersFromGame(game) {
    if (!game || typeof game !== "object") return null;
    var span = playerSpan(game.players);
    if (span && !span.open) return span.max;
    var rec = playerSpan(game.playerPoll && game.playerPoll.recommended);
    if (rec && !rec.open) return rec.max;
    if (span && span.open) return Math.min(Math.max(span.min, 4), 12);
    if (rec) return Math.min(rec.max, 12);
    return null;
  }

  function formatStartTime(value) {
    var text = String(value || "");
    if (!/^\d{2}:\d{2}$/.test(text)) return text;
    var hour = Number(text.slice(0, 2));
    var minute = text.slice(3);
    var suffix = hour >= 12 ? "PM" : "AM";
    var twelve = hour % 12;
    if (twelve === 0) twelve = 12;
    return twelve + ":" + minute + " " + suffix;
  }

  function needsTeacher(players) {
    var list = players || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].experience === "teach") return false;
    }
    return list.length > 0;
  }

  function seatsTaken(table) {
    return table && Array.isArray(table.players) ? table.players.length : 0;
  }

  function tableFull(table) {
    if (!table) return false;
    var seats = Number(table.seats) || 0;
    return seats > 0 && seatsTaken(table) >= seats;
  }

  function filterGames(games, query) {
    var q = String(query || "").trim().toLowerCase();
    var list = Array.isArray(games) ? games : [];
    if (!q) return list.slice(0, 12);
    var out = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var name = String(list[i].name || "");
      if (name.toLowerCase().indexOf(q) !== -1) out.push(list[i]);
      if (out.length >= 12) break;
    }
    return out;
  }

  function parseCatalog(raw) {
    var data = raw && typeof raw === "object" ? raw : {};
    var enrich = data.enrich && typeof data.enrich === "object" ? data.enrich : {};
    var names = Array.isArray(data.names) ? data.names : [];
    var out = [];
    names.forEach(function (name) {
      var title = String(name || "").trim();
      if (!title) return;
      var slug = title.toLowerCase().replace(/[:'"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      var game = Object.assign({ name: title, slug: slug }, enrich[slug] || {});
      out.push({
        name: title,
        slug: slug,
        players: game.players || "",
        playerPoll: game.playerPoll || null,
        maxPlayers: maxPlayersFromGame(game)
      });
    });
    return out;
  }

  root.GameDay = {
    parseConfig: parseConfig,
    foodPeople: foodPeople,
    suggestedCount: suggestedCount,
    suggestionLine: suggestionLine,
    totalsText: totalsText,
    nextDate: nextDate,
    formatDate: formatDate,
    endpointOpen: endpointOpen,
    payloadHasTables: payloadHasTables,
    validDate: validDate,
    experienceLabel: experienceLabel,
    playerSpan: playerSpan,
    maxPlayersFromGame: maxPlayersFromGame,
    formatStartTime: formatStartTime,
    needsTeacher: needsTeacher,
    seatsTaken: seatsTaken,
    tableFull: tableFull,
    filterGames: filterGames,
    parseCatalog: parseCatalog,
    START_TIMES: START_TIMES,
    EXPERIENCE_LABELS: EXPERIENCE_LABELS
  };

  if (!root.document) return;

  var state = {
    config: null,
    event: null,
    open: false,
    rsvps: [],
    food: [],
    tables: [],
    tablesReady: false,
    catalog: [],
    loaded: false,
    loadError: ""
  };
  var ui = { editingId: "", error: "", saving: false, gameQuery: "", pickedMax: null };
  var drafts = {};
  var mainEl = document.getElementById("gd");

  function pageToday() {
    var on = "";
    try { on = new URLSearchParams(window.location.search).get("on") || ""; } catch (e) {}
    if (validDate(on)) return on;
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function randomId() {
    var bytes = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = "";
    for (var j = 0; j < bytes.length; j++) out += bytes[j].toString(16).padStart(2, "0");
    return out;
  }

  function storageGet(name) {
    try { return localStorage.getItem(name) || ""; } catch (e) { return ""; }
  }

  function storageSet(name, value) {
    try { localStorage.setItem(name, value); } catch (e) {}
  }

  function storageRemove(name) {
    try { localStorage.removeItem(name); } catch (e) {}
  }

  function deviceKey() {
    var key = storageGet(KEY_NAME);
    if (/^[a-f0-9]{32}$/.test(key)) return key;
    key = randomId();
    storageSet(KEY_NAME, key);
    return key;
  }

  function rsvpStorageName(eventId) {
    return "bgq-gameday-rsvp-" + eventId;
  }

  function storedRsvpId(eventId) {
    var id = storageGet(rsvpStorageName(eventId));
    return /^[a-f0-9]{32}$/.test(id) ? id : "";
  }

  function rememberRsvp(eventId, id) {
    storageSet(rsvpStorageName(eventId), id);
  }

  function forgetRsvp(eventId) {
    storageRemove(rsvpStorageName(eventId));
  }

  function foodStorageName(eventId) {
    return "bgq-gameday-food-" + eventId;
  }

  function storedFoodIds(eventId) {
    try {
      var raw = JSON.parse(storageGet(foodStorageName(eventId)) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (id) { return /^[a-f0-9]{32}$/.test(id); });
    } catch (e) {
      return [];
    }
  }

  function rememberFood(eventId, id) {
    var ids = storedFoodIds(eventId);
    if (ids.indexOf(id) === -1) ids.push(id);
    storageSet(foodStorageName(eventId), JSON.stringify(ids));
  }

  function forgetFood(eventId, id) {
    var ids = storedFoodIds(eventId).filter(function (item) { return item !== id; });
    storageSet(foodStorageName(eventId), JSON.stringify(ids));
  }

  function tableStorageName(eventId) {
    return "bgq-gameday-tables-" + eventId;
  }

  function storedTableSeats(eventId) {
    try {
      var raw = JSON.parse(storageGet(tableStorageName(eventId)) || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      var out = {};
      Object.keys(raw).forEach(function (tableId) {
        if (/^[a-f0-9]{32}$/.test(tableId) && /^[a-f0-9]{32}$/.test(String(raw[tableId] || ""))) {
          out[tableId] = String(raw[tableId]);
        }
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function rememberTableSeat(eventId, tableId, playerId) {
    var map = storedTableSeats(eventId);
    map[tableId] = playerId;
    storageSet(tableStorageName(eventId), JSON.stringify(map));
  }

  function forgetTableSeat(eventId, tableId) {
    var map = storedTableSeats(eventId);
    delete map[tableId];
    storageSet(tableStorageName(eventId), JSON.stringify(map));
  }

  function rsvpIdFor(eventId) {
    var saved = storedRsvpId(eventId);
    if (saved) return saved;
    var key = "rsvp:" + eventId;
    if (!drafts[key]) drafts[key] = randomId();
    return drafts[key];
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

  function asRsvp(raw) {
    if (!raw || typeof raw !== "object") return null;
    var status = raw.status === "going" || raw.status === "maybe" || raw.status === "no" ? raw.status : "";
    var id = String(raw.id || "");
    if (!status || !/^[a-f0-9]{16,32}$/.test(id)) return null;
    var adults = Math.floor(Number(raw.adults));
    var kids = Math.floor(Number(raw.kids));
    if (!isFinite(adults) || adults < 0) adults = 0;
    if (!isFinite(kids) || kids < 0) kids = 0;
    return {
      id: id,
      family: String(raw.family || "").slice(0, 80),
      adults: Math.min(40, adults),
      kids: Math.min(40, kids),
      status: status,
      note: String(raw.note || "").slice(0, 280)
    };
  }

  function asClaim(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "");
    var itemId = String(raw.itemId || "");
    if (!/^[a-f0-9]{16,32}$/.test(id)) return null;
    if (!/^[a-z0-9-]{1,40}$/.test(itemId)) return null;
    var quantity = Math.floor(Number(raw.quantity));
    if (!isFinite(quantity) || quantity < 0) quantity = 0;
    return {
      id: id,
      itemId: itemId,
      name: String(raw.name || "").slice(0, 80),
      bringing: String(raw.bringing || "").slice(0, 140),
      quantity: Math.min(500, quantity)
    };
  }

  function asSeat(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "");
    var experience = String(raw.experience || "");
    if (!/^[a-f0-9]{16,32}$/.test(id)) return null;
    if (!EXPERIENCE_LABELS[experience]) return null;
    return {
      id: id,
      name: String(raw.name || "").slice(0, 80),
      experience: experience
    };
  }

  function asTable(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "");
    if (!/^[a-f0-9]{16,32}$/.test(id)) return null;
    var seats = Math.floor(Number(raw.seats));
    if (!isFinite(seats) || seats < 1) seats = 1;
    if (seats > 20) seats = 20;
    var startTime = String(raw.startTime || "");
    if (START_TIMES.indexOf(startTime) === -1) startTime = startTime.slice(0, 5);
    return {
      id: id,
      game: String(raw.game || "").slice(0, 80),
      startTime: startTime,
      seats: seats,
      players: (raw.players || []).map(asSeat).filter(Boolean)
    };
  }

  function ownRsvp() {
    if (!state.event) return null;
    var id = storedRsvpId(state.event.id);
    if (!id) return null;
    var i;
    for (i = 0; i < state.rsvps.length; i++) {
      if (state.rsvps[i].id === id) return state.rsvps[i];
    }
    return null;
  }

  function revealed() {
    return !!storedRsvpId(state.event && state.event.id);
  }

  function statusLabel(status) {
    if (status === "maybe") return "Maybe";
    if (status === "no") return "Can't make it";
    return "Going";
  }

  function sortedRsvps() {
    var order = { going: 0, maybe: 1, no: 2 };
    return state.rsvps.slice().sort(function (a, b) {
      var diff = (order[a.status] || 9) - (order[b.status] || 9);
      if (diff) return diff;
      return a.family.localeCompare(b.family);
    });
  }

  function claimsFor(itemId) {
    return state.food.filter(function (claim) { return claim.itemId === itemId; });
  }

  function haveQty(claims) {
    return claims.reduce(function (sum, claim) { return sum + (Number(claim.quantity) || 0); }, 0);
  }

  function upcoming() {
    var today = pageToday();
    return state.config.dates.filter(function (item) { return item.date >= today; });
  }

  function chooseEvent() {
    var dates = upcoming();
    var requested = "";
    try { requested = new URLSearchParams(window.location.search).get("date") || ""; } catch (e) {}
    var i;
    if (requested) {
      for (i = 0; i < dates.length; i++) {
        if (dates[i].id === requested || dates[i].date === requested) return dates[i];
      }
    }
    return dates[0] || null;
  }

  function playLinks() {
    return (
      '<section class="gd-card" id="gd-play">' +
        "<h2>What we might play</h2>" +
        "<p>A picker for the night is a later project. These open the All Games filters.</p>" +
        '<nav class="gd-links" aria-label="All Games filters">' +
          '<a href="./#/?players=6">6 players</a>' +
          '<a href="./#/?time=60-120">60–120 minutes</a>' +
          '<a href="./#/?weight=light">Light games</a>' +
          '<a href="./#/?collection=group">Group games</a>' +
          '<a href="./#/">All games</a>' +
        "</nav>" +
      "</section>"
    );
  }

  function experienceChoices(name, selected) {
    var codes = ["new", "played", "teach"];
    return (
      '<div class="gd-choices" role="group" aria-label="Experience with this game">' +
        codes.map(function (code) {
          return (
            '<button type="button" class="gd-choice" data-exp-group="' + name + '" data-experience="' + code + '" aria-pressed="' +
            (selected === code ? "true" : "false") + '">' + EXPERIENCE_LABELS[code] + "</button>"
          );
        }).join("") +
      "</div>"
    );
  }

  function startTimeOptions(selected) {
    return START_TIMES.map(function (value) {
      var sel = value === selected ? " selected" : "";
      return '<option value="' + value + '"' + sel + ">" + escapeHtml(formatStartTime(value)) + "</option>";
    }).join("");
  }

  function gameSuggestions() {
    var matches = filterGames(state.catalog, ui.gameQuery);
    if (!matches.length) return '<p class="gd-muted" id="gd-game-suggestions">No catalog match — you can still type a game name.</p>';
    return (
      '<ul class="gd-suggest-list" id="gd-game-suggestions">' +
        matches.map(function (game) {
          var max = game.maxPlayers != null ? ' data-max="' + game.maxPlayers + '"' : "";
          return '<li><button type="button" class="gd-game-pick" data-game="' + escapeHtml(game.name) + '"' + max + ">" + escapeHtml(game.name) +
            (game.maxPlayers != null ? ' <span class="gd-muted">· up to ' + game.maxPlayers + "</span>" : "") +
            "</button></li>";
        }).join("") +
      "</ul>"
    );
  }

  function nominateForm() {
    var seatsDefault = ui.pickedMax != null ? String(ui.pickedMax) : "4";
    return (
      '<form id="gd-nominate" class="gd-card">' +
        "<h3>Nominate a table</h3>" +
        '<p class="gd-muted">Host a game at a set time. You take the first seat.</p>' +
        '<label class="gd-field">Your first name <input name="name" required maxlength="80" autocomplete="given-name" autocapitalize="words"></label>' +
        '<label class="gd-field">Game <input id="gd-game" name="game" required maxlength="80" autocomplete="off" list="gd-game-list" placeholder="Search or type a game" value="' + escapeHtml(ui.gameQuery) + '"></label>' +
        '<datalist id="gd-game-list"></datalist>' +
        gameSuggestions() +
        '<label class="gd-field">Start time <select name="startTime" required>' + startTimeOptions("15:00") + "</select></label>" +
        '<label class="gd-field">Seats <input name="seats" inputmode="numeric" type="number" min="1" max="20" step="1" value="' + escapeHtml(seatsDefault) + '"></label>' +
        '<p class="gd-muted">Includes you. Default is the game\'s max player count when we know it.</p>' +
        '<label class="gd-field">Your experience</label>' +
        experienceChoices("nominate", "teach") +
        '<button type="submit">Nominate table</button>' +
      "</form>"
    );
  }

  function tableCard(table, ownSeats) {
    var taken = seatsTaken(table);
    var full = tableFull(table);
    var ownId = ownSeats[table.id] || "";
    var mine = ownId && table.players.some(function (p) { return p.id === ownId; });
    var teacher = needsTeacher(table.players);
    var seatsLabel = taken + " / " + table.seats + " seats";
    var status = full
      ? '<p class="gd-full">Full · ' + escapeHtml(seatsLabel) + "</p>"
      : '<p class="gd-open-seats">' + escapeHtml(seatsLabel) + "</p>";
    var badge = teacher ? '<p class="gd-badge" role="status">Needs a teacher</p>' : "";
    var people = table.players.map(function (player) {
      var yours = mine && player.id === ownId ? ' <span class="gd-yours">You</span>' : "";
      return (
        "<li>" +
          '<span class="gd-seat-name">' + escapeHtml(player.name) + yours + "</span>" +
          '<span class="gd-seat-exp">' + escapeHtml(experienceLabel(player.experience)) + "</span>" +
        "</li>"
      );
    }).join("");
    var actions = "";
    if (mine) {
      actions = '<button type="button" class="gd-leave" data-leave-table="' + escapeHtml(table.id) + '">Leave table</button>';
    } else if (!full && state.open) {
      actions =
        '<form class="gd-join" data-table="' + escapeHtml(table.id) + '">' +
          '<label class="gd-field">Your first name <input name="name" required maxlength="80" autocomplete="given-name" autocapitalize="words"></label>' +
          '<label class="gd-field">Your experience</label>' +
          experienceChoices("join-" + table.id, "new") +
          '<button type="submit">Join table</button>' +
        "</form>";
    }
    return (
      '<section class="gd-card gd-table" id="table-' + escapeHtml(table.id) + '" data-full="' + (full ? "true" : "false") + '">' +
        "<h3>" + escapeHtml(table.game) + "</h3>" +
        '<p class="gd-table-time">' + escapeHtml(formatStartTime(table.startTime)) + "</p>" +
        status +
        badge +
        (people ? '<ul class="gd-seats">' + people + "</ul>" : "") +
        actions +
      "</section>"
    );
  }

  function tablesSection() {
    if (!state.open || (state.loaded && !state.tablesReady)) {
      return (
        '<section class="gd-card" id="gd-tables">' +
          "<h2>Tables</h2>" +
          '<p id="gd-tables-soon" role="status">Table sign-ups open soon</p>' +
          "<p class=\"gd-muted\">Nominate a game, set a start time, and let people claim seats — including who can teach.</p>" +
        "</section>"
      );
    }
    if (!state.loaded && !state.loadError) {
      return '<section class="gd-card" id="gd-tables"><h2>Tables</h2><p>Loading tables…</p></section>';
    }
    var ownSeats = state.event ? storedTableSeats(state.event.id) : {};
    var cards = state.tables.map(function (table) { return tableCard(table, ownSeats); }).join("");
    var empty = state.tables.length ? "" : '<p class="gd-muted" id="gd-tables-empty">No tables yet. Nominate one below.</p>';
    return (
      '<section id="gd-tables">' +
        "<h2>Tables</h2>" +
        "<p>Want to play something specific? Nominate a table or join one that still has seats.</p>" +
        empty +
        cards +
        nominateForm() +
      "</section>"
    );
  }

  function datePicker(dates, selected) {
    if (dates.length < 2) return "";
    var options = dates.map(function (item) {
      var sel = item.id === selected.id ? " selected" : "";
      return '<option value="' + escapeHtml(item.id) + '"' + sel + ">" + escapeHtml(formatDate(item.date)) + "</option>";
    }).join("");
    return '<label class="gd-field">Date <select id="gd-date-select">' + options + "</select></label>";
  }

  function choiceButton(value, label, pressed) {
    return '<button type="button" class="gd-choice" data-status="' + value + '" aria-pressed="' + (pressed ? "true" : "false") + '">' + label + "</button>";
  }

  function rsvpForm(mine) {
    var status = mine ? mine.status : "going";
    var family = mine ? mine.family : "";
    var adults = mine ? String(mine.adults) : "2";
    var kids = mine ? String(mine.kids) : "0";
    var note = mine ? mine.note : "";
    return (
      '<form id="gd-form" class="gd-card">' +
        "<h2>" + (mine ? "Your RSVP" : "RSVP") + "</h2>" +
        '<label class="gd-field">Family name <input id="gd-family" name="family" required maxlength="80" autocomplete="off" autocapitalize="words" value="' + escapeHtml(family) + '"></label>' +
        '<div class="gd-counts">' +
          '<label class="gd-field">Adults <input id="gd-adults" name="adults" inputmode="numeric" type="number" min="0" max="40" step="1" value="' + escapeHtml(adults) + '"></label>' +
          '<label class="gd-field">Kids <input id="gd-kids" name="kids" inputmode="numeric" type="number" min="0" max="40" step="1" value="' + escapeHtml(kids) + '"></label>' +
        "</div>" +
        '<label class="gd-field">Note <textarea id="gd-note" name="note" maxlength="280" rows="2" placeholder="Optional">' + escapeHtml(note) + "</textarea></label>" +
        '<div class="gd-choices" role="group" aria-label="Are you coming?">' +
          choiceButton("going", "Going", status === "going") +
          choiceButton("maybe", "Maybe", status === "maybe") +
          choiceButton("no", "Can't make it", status === "no") +
        "</div>" +
        '<button type="submit" id="gd-save">' + (mine ? "Update RSVP" : "Save RSVP") + "</button>" +
      "</form>"
    );
  }

  function rsvpList(mine) {
    var rows = sortedRsvps();
    if (!rows.length) return "";
    var items = rows.map(function (row) {
      var yours = mine && row.id === mine.id ? ' <span class="gd-yours">Your RSVP</span>' : "";
      var counts = row.adults + row.kids > 0
        ? " · " + plural(row.adults, "adult", "adults") + " · " + plural(row.kids, "kid", "kids")
        : "";
      var note = row.note ? '<p class="gd-note">' + escapeHtml(row.note) + "</p>" : "";
      return (
        "<li>" +
          '<p class="gd-family">' + escapeHtml(row.family) + yours + "</p>" +
          "<p>" + escapeHtml(statusLabel(row.status) + counts) + "</p>" +
          note +
        "</li>"
      );
    }).join("");
    return '<section class="gd-card" id="gd-list"><h2>RSVPs</h2><ul>' + items + "</ul></section>";
  }

  function claimLine(claim, item, own) {
    var actions = "";
    if (own) {
      actions =
        '<span class="gd-claim-actions">' +
          '<button type="button" data-edit="' + escapeHtml(claim.id) + '">Update</button>' +
          '<button type="button" data-remove="' + escapeHtml(claim.id) + '">Remove</button>' +
        "</span>";
    }
    return "<li><span>" + escapeHtml(claim.name) + " — " + escapeHtml(claim.bringing) + ", " + claim.quantity + " " + escapeHtml(unitName(item, claim.quantity)) + "</span>" + actions + "</li>";
  }

  function foodCard(item, people, ownIds, familyName) {
    var claims = claimsFor(item.id);
    var want = suggestedCount(item, people);
    var have = haveQty(claims);
    var left = Math.max(0, want - have);
    var cover = "Unclaimed";
    if (claims.length && want > 0 && left <= 0) cover = "Covered";
    else if (claims.length && left > 0) cover = "Still needed: ~" + left + " " + unitName(item, left);
    else if (claims.length) cover = "Signed up";
    var editing = null;
    var i;
    for (i = 0; i < claims.length; i++) {
      if (claims[i].id === ui.editingId) editing = claims[i];
    }
    var lines = claims.map(function (claim) {
      return claimLine(claim, item, ownIds.indexOf(claim.id) !== -1);
    }).join("");
    var name = editing ? editing.name : familyName;
    var bringing = editing ? editing.bringing : "";
    var quantity = editing ? String(editing.quantity) : "";
    var howMany = "How many " + (item.unitPlural || item.unit) + "?";
    var form =
      '<form class="gd-claim" data-item="' + escapeHtml(item.id) + '"' + (editing ? ' data-claim="' + escapeHtml(editing.id) + '"' : "") + ">" +
        '<label class="gd-field">Your name <input name="name" maxlength="80" autocomplete="off" autocapitalize="words" value="' + escapeHtml(name) + '"></label>' +
        '<label class="gd-field">What you\'re bringing <input name="bringing" maxlength="140" autocomplete="off" value="' + escapeHtml(bringing) + '"></label>' +
        '<label class="gd-field">' + escapeHtml(howMany) + ' <input name="quantity" inputmode="numeric" type="number" min="1" max="500" step="1" value="' + escapeHtml(quantity) + '"></label>' +
        '<button type="submit">' + (editing ? "Update this" : "I'll bring this") + "</button>" +
      "</form>";
    return (
      '<section class="gd-card gd-item" id="food-' + escapeHtml(item.id) + '">' +
        "<h3>" + escapeHtml(item.label) + "</h3>" +
        '<p class="gd-suggest">' + escapeHtml(suggestionLine(item, people)) + "</p>" +
        '<p class="gd-cover">' + escapeHtml(cover) + "</p>" +
        (lines ? "<ul>" + lines + "</ul>" : "") +
        (state.open ? form : "") +
      "</section>"
    );
  }

  function gapSummary(items, people) {
    var unclaimed = [];
    var short = [];
    items.forEach(function (item) {
      var claims = claimsFor(item.id);
      var want = suggestedCount(item, people);
      var have = haveQty(claims);
      if (!claims.length) unclaimed.push(item.label);
      else if (want > have) short.push(item.label + " (~" + (want - have) + " " + unitName(item, want - have) + ")");
    });
    var unclaimedText = unclaimed.length
      ? "Still unclaimed: " + unclaimed.join(", ")
      : "Still unclaimed: nothing. Every item has someone signed up.";
    var shortHtml = short.length ? '<p id="gd-short">Still short: ' + escapeHtml(short.join(", ")) + "</p>" : '<p id="gd-short" hidden></p>';
    return '<div id="gd-gaps"><p id="gd-unclaimed">' + escapeHtml(unclaimedText) + "</p>" + shortHtml + "</div>";
  }

  function render() {
    if (!state.config) {
      mainEl.innerHTML = '<p role="alert">Game Day couldn\'t be loaded.</p>';
      return;
    }
    var event = state.event;
    if (!event) {
      mainEl.innerHTML =
        '<p class="gd-kicker">Monthly Game Day</p>' +
        "<h2>The next date isn't posted yet.</h2>" +
        playLinks();
      return;
    }
    var mine = state.loaded ? ownRsvp() : null;
    var stats = foodPeople(state.rsvps, state.config.food);
    var location = revealed() ? LOCATION_AFTER : LOCATION_BEFORE;
    var closed = state.open ? "" : '<p id="gd-closed" role="status">RSVPs aren\'t open yet.</p>';
    var live = "";
    if (state.open && state.loaded) {
      live =
        '<p id="gd-totals" tabindex="-1">' + escapeHtml(totalsText(state.rsvps)) + "</p>" +
        '<p id="gd-error" role="alert">' + escapeHtml(ui.error) + "</p>" +
        rsvpForm(mine) +
        rsvpList(mine);
    } else if (state.open && state.loadError) {
      live =
        '<p id="gd-error" role="alert">' + escapeHtml(state.loadError) + "</p>" +
        '<button type="button" id="gd-retry">Try again</button>';
    } else if (state.open) {
      live = "<p>Loading RSVPs…</p>";
    }
    var items = state.config.food.items.map(function (item) {
      return foodCard(item, stats.people, storedFoodIds(event.id), mine ? mine.family : "");
    }).join("");
    var note = event.note ? '<p class="gd-muted">' + escapeHtml(event.note) + "</p>" : "";
    mainEl.innerHTML =
      '<p class="gd-kicker">Monthly Game Day</p>' +
      '<h2 id="gd-date">' + escapeHtml(formatDate(event.date)) + "</h2>" +
      note +
      '<p id="gd-time">' + escapeHtml(state.config.timeLabel) + "</p>" +
      '<p id="gd-location">' + escapeHtml(location) + "</p>" +
      datePicker(upcoming(), event) +
      closed +
      live +
      tablesSection() +
      '<section class="gd-food" id="gd-food">' +
        "<h2>Food</h2>" +
        '<p id="gd-food-intro">' + escapeHtml(foodIntro(stats)) + "</p>" +
        gapSummary(state.config.food.items, stats.people) +
        items +
      "</section>" +
      playLinks();
    fillGameDatalist();
  }

  function fillGameDatalist() {
    var list = document.getElementById("gd-game-list");
    if (!list) return;
    list.innerHTML = state.catalog.slice(0, 200).map(function (game) {
      return '<option value="' + escapeHtml(game.name) + '"></option>';
    }).join("");
  }

  function showError(message) {
    ui.error = message || "";
    var el = document.getElementById("gd-error");
    if (el) el.textContent = ui.error;
    else render();
  }

  function readJson(res, fallback) {
    return res.text().then(function (text) {
      try { return JSON.parse(text); }
      catch (e) { return { ok: false, error: fallback }; }
    });
  }

  function loadRsvps() {
    if (!state.open || !state.event) {
      state.loaded = false;
      render();
      return Promise.resolve();
    }
    var url = state.config.endpoint + (state.config.endpoint.indexOf("?") >= 0 ? "&" : "?") + "event=" + encodeURIComponent(state.event.id);
    var fallback = "RSVPs couldn't be loaded. Check the connection and try again.";
    return fetch(url, { method: "GET", cache: "no-store", credentials: "omit" }).then(function (res) {
      return readJson(res, fallback);
    }).then(function (payload) {
      if (!payload || payload.ok === false) {
        state.loaded = false;
        state.loadError = (payload && payload.error) || "RSVPs couldn't be loaded. Check the connection and try again.";
        render();
        return;
      }
      state.loadError = "";
      state.rsvps = (payload.rsvps || []).map(asRsvp).filter(Boolean);
      state.food = (payload.food || []).map(asClaim).filter(Boolean);
      state.tablesReady = payloadHasTables(payload);
      state.tables = state.tablesReady ? (payload.tables || []).map(asTable).filter(Boolean) : [];
      state.loaded = true;
      var stored = storedRsvpId(state.event.id);
      if (stored && !state.rsvps.some(function (row) { return row.id === stored; })) forgetRsvp(state.event.id);
      syncOwnTableSeats();
      render();
    }).catch(function () {
      state.loaded = false;
      state.loadError = "RSVPs couldn't be loaded. Check the connection and try again.";
      render();
    });
  }

  function send(body) {
    return fetch(state.config.endpoint, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return readJson(res, "That didn't save. If this keeps happening, deploy the web app as Anyone.");
    }).catch(function () {
      return { ok: false, error: "That didn't save. Check the connection and try again." };
    });
  }

  function applyPayload(payload) {
    state.rsvps = (payload.rsvps || []).map(asRsvp).filter(Boolean);
    state.food = (payload.food || []).map(asClaim).filter(Boolean);
    state.tablesReady = payloadHasTables(payload);
    state.tables = state.tablesReady ? (payload.tables || []).map(asTable).filter(Boolean) : [];
    syncOwnTableSeats();
    state.loaded = true;
    state.loadError = "";
  }

  function syncOwnTableSeats() {
    if (!state.event) return;
    var map = storedTableSeats(state.event.id);
    var changed = false;
    Object.keys(map).forEach(function (tableId) {
      var table = state.tables.filter(function (row) { return row.id === tableId; })[0];
      if (!table || !table.players.some(function (p) { return p.id === map[tableId]; })) {
        delete map[tableId];
        changed = true;
      }
    });
    if (changed) storageSet(tableStorageName(state.event.id), JSON.stringify(map));
  }

  function currentStatus() {
    var pressed = document.querySelector(".gd-choice[aria-pressed='true']");
    var status = pressed ? pressed.getAttribute("data-status") : "going";
    if (status !== "going" && status !== "maybe" && status !== "no") return "going";
    return status;
  }

  function onRsvpSubmit(form) {
    var family = scrub(form.family.value);
    var note = scrub(form.note.value);
    var problem = textProblem(family) || textProblem(note);
    if (!family) {
      showError("Enter a family name.");
      return;
    }
    if (family.length > 80 || note.length > 280) {
      showError("That text is too long.");
      return;
    }
    if (problem) {
      showError(problem);
      return;
    }
    if (!/[A-Za-z]/.test(family) && !/[^\u0000-\u007f]/.test(family)) {
      showError("Use letters in that name.");
      return;
    }
    var adultsText = String(form.adults.value == null ? "" : form.adults.value).trim();
    var kidsText = String(form.kids.value == null ? "" : form.kids.value).trim();
    if (adultsText === "") adultsText = "0";
    if (kidsText === "") kidsText = "0";
    if (!/^\d+$/.test(adultsText) || !/^\d+$/.test(kidsText)) {
      showError("Use whole numbers for adults and kids.");
      return;
    }
    var adults = parseInt(adultsText, 10);
    var kids = parseInt(kidsText, 10);
    if (adults > 40 || kids > 40) {
      showError("Use whole numbers for adults and kids.");
      return;
    }
    var status = currentStatus();
    if (status !== "no" && adults + kids < 1) {
      showError("Add at least one person.");
      return;
    }
    var eventId = state.event.id;
    var id = rsvpIdFor(eventId);
    ui.saving = true;
    form.querySelector("button[type=submit]").disabled = true;
    showError("");
    send({
      op: "rsvp",
      eventId: eventId,
      id: id,
      editKey: deviceKey(),
      family: family,
      adults: adults,
      kids: kids,
      status: status,
      note: note
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        var button = form.querySelector("button[type=submit]");
        if (button) button.disabled = false;
        return;
      }
      rememberRsvp(eventId, id);
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function onFoodSubmit(form) {
    var itemId = form.getAttribute("data-item") || "";
    var name = scrub(form.name.value);
    var bringing = scrub(form.bringing.value);
    var problem = textProblem(name) || textProblem(bringing);
    if (!name) {
      showError("Enter your name.");
      return;
    }
    if (!bringing) {
      showError("Say what you're bringing.");
      return;
    }
    if (problem) {
      showError(problem);
      return;
    }
    var qtyText = String(form.quantity.value == null ? "" : form.quantity.value).trim();
    if (!/^\d+$/.test(qtyText) || parseInt(qtyText, 10) < 1 || parseInt(qtyText, 10) > 500) {
      showError("Enter how many you're bringing.");
      return;
    }
    var existing = form.getAttribute("data-claim") || "";
    var draftKey = state.event.id + ":" + itemId;
    if (!existing) {
      if (!drafts[draftKey]) drafts[draftKey] = randomId();
      existing = drafts[draftKey];
    }
    ui.saving = true;
    form.querySelector("button[type=submit]").disabled = true;
    showError("");
    send({
      op: "food",
      eventId: state.event.id,
      id: existing,
      editKey: deviceKey(),
      itemId: itemId,
      name: name,
      bringing: bringing,
      quantity: parseInt(qtyText, 10)
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        var button = form.querySelector("button[type=submit]");
        if (button) button.disabled = false;
        return;
      }
      rememberFood(state.event.id, existing);
      delete drafts[draftKey];
      ui.editingId = "";
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function onRemove(id) {
    if (ui.saving) return;
    ui.saving = true;
    send({
      op: "unclaim",
      eventId: state.event.id,
      id: id,
      editKey: deviceKey()
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        return;
      }
      forgetFood(state.event.id, id);
      if (ui.editingId === id) ui.editingId = "";
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function chosenExperience(group) {
    var pressed = document.querySelector('.gd-choice[data-exp-group="' + group + '"][aria-pressed="true"]');
    var value = pressed ? pressed.getAttribute("data-experience") : "";
    return EXPERIENCE_LABELS[value] ? value : "";
  }

  function validatePerson(name) {
    name = scrub(name);
    if (!name) return { error: "Enter your first name." };
    if (name.length > 80) return { error: "That text is too long." };
    var problem = textProblem(name);
    if (problem) return { error: problem };
    if (!/[A-Za-z]/.test(name) && !/[^\u0000-\u007f]/.test(name)) return { error: "Use letters in that name." };
    return { value: name };
  }

  function onNominate(form) {
    var person = validatePerson(form.name.value);
    if (person.error) {
      showError(person.error);
      return;
    }
    var game = scrub(form.game.value);
    if (!game) {
      showError("Enter a game.");
      return;
    }
    if (game.length > 80) {
      showError("That text is too long.");
      return;
    }
    var gameProblem = textProblem(game);
    if (gameProblem) {
      showError(gameProblem);
      return;
    }
    var startTime = String(form.startTime.value || "");
    if (START_TIMES.indexOf(startTime) === -1) {
      showError("Pick a start time.");
      return;
    }
    var seatsText = String(form.seats.value == null ? "" : form.seats.value).trim();
    if (!/^\d+$/.test(seatsText) || parseInt(seatsText, 10) < 1 || parseInt(seatsText, 10) > 20) {
      showError("Enter how many seats the table has.");
      return;
    }
    var experience = chosenExperience("nominate");
    if (!experience) {
      showError("Pick New to it, Played before, or Can teach.");
      return;
    }
    var tableId = randomId();
    var playerId = randomId();
    ui.saving = true;
    form.querySelector("button[type=submit]").disabled = true;
    showError("");
    send({
      op: "nominate",
      eventId: state.event.id,
      id: tableId,
      playerId: playerId,
      editKey: deviceKey(),
      game: game,
      startTime: startTime,
      seats: parseInt(seatsText, 10),
      name: person.value,
      experience: experience
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        var button = form.querySelector("button[type=submit]");
        if (button) button.disabled = false;
        return;
      }
      rememberTableSeat(state.event.id, tableId, playerId);
      ui.gameQuery = "";
      ui.pickedMax = null;
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function onJoin(form) {
    var tableId = form.getAttribute("data-table") || "";
    var person = validatePerson(form.name.value);
    if (person.error) {
      showError(person.error);
      return;
    }
    var experience = chosenExperience("join-" + tableId);
    if (!experience) {
      showError("Pick New to it, Played before, or Can teach.");
      return;
    }
    var playerId = randomId();
    ui.saving = true;
    form.querySelector("button[type=submit]").disabled = true;
    showError("");
    send({
      op: "join",
      eventId: state.event.id,
      tableId: tableId,
      id: playerId,
      editKey: deviceKey(),
      name: person.value,
      experience: experience
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        var button = form.querySelector("button[type=submit]");
        if (button) button.disabled = false;
        return;
      }
      rememberTableSeat(state.event.id, tableId, playerId);
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function onLeaveTable(tableId) {
    if (ui.saving) return;
    var map = storedTableSeats(state.event.id);
    var playerId = map[tableId] || "";
    ui.saving = true;
    send({
      op: "leave",
      eventId: state.event.id,
      tableId: tableId,
      id: playerId,
      editKey: deviceKey()
    }).then(function (payload) {
      ui.saving = false;
      if (!payload || payload.ok === false) {
        showError((payload && payload.error) || "That didn't save. Try again.");
        return;
      }
      forgetTableSeat(state.event.id, tableId);
      ui.error = "";
      applyPayload(payload);
      render();
    });
  }

  function lookupMaxPlayers(name) {
    var needle = String(name || "").trim().toLowerCase();
    if (!needle) return null;
    var i;
    for (i = 0; i < state.catalog.length; i++) {
      if (String(state.catalog[i].name || "").toLowerCase() === needle) return state.catalog[i].maxPlayers;
    }
    return null;
  }

  mainEl.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !mainEl.contains(form)) return;
    event.preventDefault();
    if (ui.saving) return;
    if (form.id === "gd-form") onRsvpSubmit(form);
    else if (form.id === "gd-nominate") onNominate(form);
    else if (form.classList.contains("gd-claim")) onFoodSubmit(form);
    else if (form.classList.contains("gd-join")) onJoin(form);
  });

  mainEl.addEventListener("click", function (event) {
    var choice = event.target.closest ? event.target.closest(".gd-choice") : null;
    if (choice && mainEl.contains(choice)) {
      var groupName = choice.getAttribute("data-exp-group");
      var siblings = groupName
        ? choice.parentNode.querySelectorAll('.gd-choice[data-exp-group="' + groupName + '"]')
        : choice.parentNode.querySelectorAll(".gd-choice");
      Array.prototype.forEach.call(siblings, function (other) {
        other.setAttribute("aria-pressed", other === choice ? "true" : "false");
      });
      return;
    }
    var pick = event.target.closest ? event.target.closest(".gd-game-pick") : null;
    if (pick) {
      var gameInput = document.getElementById("gd-game");
      var seatsInput = document.querySelector("#gd-nominate input[name='seats']");
      var name = pick.getAttribute("data-game") || "";
      var max = pick.getAttribute("data-max");
      ui.gameQuery = name;
      ui.pickedMax = max ? Number(max) : null;
      if (gameInput) gameInput.value = name;
      if (seatsInput && ui.pickedMax != null) seatsInput.value = String(ui.pickedMax);
      var suggestions = document.getElementById("gd-game-suggestions");
      if (suggestions) {
        var wrap = document.createElement("div");
        wrap.innerHTML = gameSuggestions();
        suggestions.replaceWith(wrap.firstChild);
      }
      return;
    }
    var edit = event.target.closest ? event.target.closest("[data-edit]") : null;
    if (edit) {
      ui.editingId = edit.getAttribute("data-edit") || "";
      ui.error = "";
      render();
      return;
    }
    var remove = event.target.closest ? event.target.closest("[data-remove]") : null;
    if (remove) {
      onRemove(remove.getAttribute("data-remove") || "");
      return;
    }
    var leave = event.target.closest ? event.target.closest("[data-leave-table]") : null;
    if (leave) {
      onLeaveTable(leave.getAttribute("data-leave-table") || "");
      return;
    }
    if (event.target.id === "gd-retry") loadRsvps();
  });

  mainEl.addEventListener("input", function (event) {
    if (event.target.id !== "gd-game") return;
    ui.gameQuery = event.target.value || "";
    ui.pickedMax = lookupMaxPlayers(ui.gameQuery);
    var seatsInput = document.querySelector("#gd-nominate input[name='seats']");
    if (seatsInput && ui.pickedMax != null && document.activeElement === event.target) {
      seatsInput.value = String(ui.pickedMax);
    }
    var suggestions = document.getElementById("gd-game-suggestions");
    if (!suggestions) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = gameSuggestions();
    suggestions.replaceWith(wrap.firstChild);
  });

  mainEl.addEventListener("change", function (event) {
    if (event.target.id !== "gd-date-select") return;
    var id = event.target.value;
    var dates = upcoming();
    var i;
    for (i = 0; i < dates.length; i++) {
      if (dates[i].id === id) {
        state.event = dates[i];
        state.rsvps = [];
        state.food = [];
        state.tables = [];
        state.tablesReady = false;
        state.loaded = false;
        ui.editingId = "";
        ui.error = "";
        ui.gameQuery = "";
        ui.pickedMax = null;
        try {
          var url = new URL(window.location.href);
          url.searchParams.set("date", id);
          history.replaceState(null, "", url.pathname + url.search + url.hash);
        } catch (e) {}
        render();
        loadRsvps();
        return;
      }
    }
  });

  function initTheme() {
    var themes = ["classic", "dark", "darkwood", "neongrid"];
    var saved = storageGet("theme");
    var theme = themes.indexOf(saved) === -1 ? "classic" : saved;
    document.documentElement.setAttribute("data-theme", theme);
    var button = document.getElementById("themeToggle");
    if (!button) return;
    button.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") || "classic";
      var idx = themes.indexOf(current);
      theme = themes[(idx + 1) % themes.length];
      document.documentElement.setAttribute("data-theme", theme);
      storageSet("theme", theme);
    });
  }

  function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(function (reg) {
      function prompt(worker) {
        if (!worker || !navigator.serviceWorker.controller) return;
        var bar = document.getElementById("app-update");
        var refresh = document.getElementById("app-update-refresh");
        if (!bar || !refresh) return;
        bar.hidden = false;
        refresh.onclick = function () {
          worker.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        };
      }
      function watch(worker) {
        if (!worker) return;
        if (worker.state === "installed") prompt(worker);
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed") prompt(worker);
        });
      }
      watch(reg.installing);
      watch(reg.waiting);
      reg.addEventListener("updatefound", function () { watch(reg.installing); });
    }).catch(function () {});
  }

  function loadCatalog() {
    return fetch("./index.html", { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("catalog");
      return res.text();
    }).then(function (html) {
      var start = html.indexOf('<script id="games-json"');
      if (start < 0) return;
      var open = html.indexOf(">", start);
      var close = html.indexOf("</script>", open);
      if (open < 0 || close < 0) return;
      state.catalog = parseCatalog(JSON.parse(html.slice(open + 1, close)));
    }).catch(function () {
      state.catalog = [];
    });
  }

  function init() {
    initTheme();
    Promise.all([
      fetch("./data/game-days.json", { cache: "no-store", credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("config");
        return res.json();
      }),
      loadCatalog()
    ]).then(function (results) {
      state.config = parseConfig(results[0]);
      state.event = chooseEvent();
      state.open = endpointOpen(state.config.endpoint);
      render();
      registerSw();
      return loadRsvps();
    }).catch(function () {
      state.config = null;
      render();
      registerSw();
    });
  }

  init();
})(typeof window !== "undefined" ? window : globalThis);
