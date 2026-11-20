/* What should we play?
   Client-side game night picker. No server, no accounts, no remote voting.
   Filter math is the catalog's (player span, time buckets, weight bands),
   passed in from index.html so the two stay on the same rules. */
(function () {
  var PLAYERS = ["1", "2", "3", "4", "5", "6", "7"];
  var TIMES = ["under30", "30-60", "60-120", "120"];
  var WEIGHTS = ["light", "medium-light", "medium", "medium-heavy", "heavy"];
  var WEIGHT_LABELS = {
    light: "Light",
    "medium-light": "Medium-light",
    medium: "Medium",
    "medium-heavy": "Medium-heavy",
    heavy: "Heavy"
  };
  var TIME_LABELS = {
    under30: "Under 30 min",
    "30-60": "30\u201360",
    "60-120": "60\u2013120",
    "120": "2h+"
  };
  var TIME_ARIA = {
    under30: "Under 30 minutes",
    "30-60": "30 to 60 minutes",
    "60-120": "60 to 120 minutes",
    "120": "2 hours or more"
  };
  var WHEEL_COLORS = ["#007aff", "#34c759", "#ff9f0a", "#ff375f", "#5e5ce6", "#30b0c7", "#ac8e68", "#64d2ff"];
  var STORAGE_KEY = "bgq_game_night";
  var MAX_NOMINEES = 16;
  /* Applied only when a game actually has a stored minimum age. */
  var KIDS_HIDE_AT = 12;

  function cryptoObj() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto;
    throw new Error("A random source is required.");
  }

  function randomIndex(n) {
    var count = n | 0;
    if (count <= 1) return 0;
    var limit = Math.floor(0x100000000 / count) * count;
    var buf = new Uint32Array(1);
    var value = 0;
    do {
      cryptoObj().getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % count;
  }

  function shuffle(list, rng) {
    var roll = rng || randomIndex;
    var arr = list.slice();
    var i = arr.length;
    while (i > 1) {
      i -= 1;
      var j = roll(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function asAge(value) {
    if (value == null || value === "" || typeof value === "boolean") return null;
    var n = typeof value === "number" ? value : parseFloat(String(value).trim());
    if (!isFinite(n) || n <= 0 || n > 21) return null;
    return n;
  }

  function recordedMinAge(game) {
    if (!game || typeof game !== "object") return null;
    var keys = ["minAge", "minimumAge", "bggMinAge"];
    var i = 0;
    for (; i < keys.length; i += 1) {
      var age = asAge(game[keys[i]]);
      if (age != null) return age;
    }
    if (game.bgg && typeof game.bgg === "object") {
      var nested = game.bgg.minAge != null ? game.bgg.minAge : game.bgg.minage;
      return asAge(nested);
    }
    return null;
  }

  function kidsAllows(game, kidsOn, catalogHasAge) {
    if (!kidsOn || !catalogHasAge) return true;
    var age = recordedMinAge(game);
    if (age == null) return true;
    return age < KIDS_HIDE_AT;
  }

  /* Hook for a future "longest since played" sort from BGG plays.
     Nothing in the catalog sets this yet. When play history is stored, the
     expected field is game.bggPlays.lastPlayed as an ISO date. Games with no
     recorded play sort ahead of games that have one. */
  function playTimestamp(game) {
    var plays = game && game.bggPlays;
    if (!plays || typeof plays !== "object") return null;
    if (plays.lastPlayed == null || plays.lastPlayed === "") return null;
    var t = Date.parse(String(plays.lastPlayed));
    return isFinite(t) ? t : null;
  }

  function sortByLongestSincePlayed(games) {
    var copy = games.slice();
    if (!copy.some(function (game) { return playTimestamp(game) != null; })) return copy;
    copy.sort(function (a, b) {
      var ta = playTimestamp(a);
      var tb = playTimestamp(b);
      if (ta == null && tb == null) return String(a.name || "").localeCompare(String(b.name || ""));
      if (ta == null) return -1;
      if (tb == null) return 1;
      if (ta !== tb) return ta - tb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return copy;
  }

  function orderForSuggest(games, isBest, rng) {
    if (games.some(function (game) { return playTimestamp(game) != null; })) {
      return sortByLongestSincePlayed(games);
    }
    var best = [];
    var rest = [];
    games.forEach(function (game) {
      if (typeof isBest === "function" && isBest(game)) best.push(game);
      else rest.push(game);
    });
    return shuffle(best, rng).concat(shuffle(rest, rng));
  }

  function suggestCount(available, rng) {
    var roll = rng || randomIndex;
    if (available <= 0) return 0;
    if (available < 4) return available;
    var max = Math.min(8, available);
    return 4 + roll(max - 4 + 1);
  }

  function pollText(names) {
    return names.filter(function (name) { return String(name || "").trim(); }).join("\n");
  }

  function segmentCenterDeg(index, n) {
    return -90 + (index + 0.5) * (360 / n);
  }

  /* CSS rotation, in degrees, that parks segment `index` under the top pointer.
     Extra full turns keep a re-spin moving the same direction. */
  function landingRotation(index, n, fromDeg, turns) {
    var target = segmentCenterDeg(index, n);
    var base = -90 - target;
    base = ((base % 360) + 360) % 360;
    if (base !== 0) base -= 360;
    var spins = turns || 0;
    var dest = (fromDeg || 0) - 360 * spins;
    var destMod = ((dest % 360) + 360) % 360;
    if (destMod !== 0) destMod -= 360;
    dest -= destMod - base;
    if (dest > (fromDeg || 0) - 360 * spins) dest -= 360;
    return dest;
  }

  function bordaWinner(ballots, slugs, rng) {
    var roll = rng || randomIndex;
    var totals = {};
    var placeCounts = {};
    slugs.forEach(function (slug) {
      totals[slug] = 0;
      placeCounts[slug] = { 1: 0, 2: 0, 3: 0 };
    });
    (ballots || []).forEach(function (ballot) {
      slugs.forEach(function (slug) {
        totals[slug] += (ballot.scores && ballot.scores[slug]) || 0;
        var place = ballot.places && ballot.places[slug];
        if (place >= 1 && place <= 3) placeCounts[slug][place] += 1;
      });
    });
    var best = -1;
    slugs.forEach(function (slug) { if (totals[slug] > best) best = totals[slug]; });
    var tied = slugs.filter(function (slug) { return totals[slug] === best; });
    var note = "";
    var placeNames = { 1: "first", 2: "second", 3: "third" };
    [1, 2, 3].forEach(function (place) {
      if (tied.length < 2) return;
      var top = -1;
      tied.forEach(function (slug) {
        if (placeCounts[slug][place] > top) top = placeCounts[slug][place];
      });
      var next = tied.filter(function (slug) { return placeCounts[slug][place] === top; });
      if (next.length < tied.length) note = "Tie broken by " + placeNames[place] + "-place votes.";
      tied = next;
    });
    var randomTie = false;
    if (tied.length > 1) {
      randomTie = true;
      note = "Tie broken at random. Each tied game had the same chance.";
      tied = [tied[roll(tied.length)]];
    }
    return {
      slug: tied[0],
      totals: totals,
      placeCounts: placeCounts,
      note: note,
      randomTie: randomTie
    };
  }

  function motionOK() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  function emptyState() {
    return { players: "", time: "", kids: false, weightFrom: "", weightTo: "", games: [] };
  }

  function render(ctx) {
    var bySlug = {};
    ctx.games.forEach(function (game) { if (game && game.slug) bySlug[game.slug] = game; });
    var catalogHasAge = ctx.games.some(function (game) { return recordedMinAge(game) != null; });
    var state = emptyState();
    var decision = null;
    var query = "";
    var dropped = 0;

    function allowed(code, list) {
      return list.indexOf(code) !== -1 ? code : "";
    }

    function readParams(params) {
      var next = emptyState();
      if (!params) return next;
      next.players = allowed(params.get("players") || "", PLAYERS);
      next.time = allowed(params.get("time") || "", TIMES);
      next.kids = params.get("kids") === "1";
      next.weightFrom = allowed(params.get("w0") || "", WEIGHTS);
      next.weightTo = allowed(params.get("w1") || "", WEIGHTS);
      normalizeWeights(next);
      var seen = {};
      String(params.get("games") || "").split(",").forEach(function (part) {
        var slug = part.trim().toLowerCase();
        if (!slug || seen[slug]) return;
        seen[slug] = true;
        if (!bySlug[slug]) {
          dropped += 1;
          return;
        }
        if (next.games.length < MAX_NOMINEES) next.games.push(slug);
      });
      return next;
    }

    function paramsHaveState(params) {
      if (!params) return false;
      return params.has("players") || params.has("time") || params.has("kids") ||
        params.has("w0") || params.has("w1") || params.has("games");
    }

    function loadState() {
      dropped = 0;
      if (paramsHaveState(ctx.params)) return readParams(ctx.params);
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyState();
        var saved = JSON.parse(raw);
        var params = new URLSearchParams();
        if (saved.players) params.set("players", saved.players);
        if (saved.time) params.set("time", saved.time);
        if (saved.kids) params.set("kids", "1");
        if (saved.weightFrom) params.set("w0", saved.weightFrom);
        if (saved.weightTo) params.set("w1", saved.weightTo);
        if (saved.games && saved.games.length) params.set("games", saved.games.join(","));
        return readParams(params);
      } catch (err) {
        return emptyState();
      }
    }

    function normalizeWeights(target) {
      if (!target.weightFrom || !target.weightTo) return;
      if (WEIGHTS.indexOf(target.weightFrom) > WEIGHTS.indexOf(target.weightTo)) {
        var swap = target.weightFrom;
        target.weightFrom = target.weightTo;
        target.weightTo = swap;
      }
    }

    function syncUrl() {
      var params = new URLSearchParams();
      if (state.players) params.set("players", state.players);
      if (state.time) params.set("time", state.time);
      if (state.kids) params.set("kids", "1");
      if (state.weightFrom) params.set("w0", state.weightFrom);
      if (state.weightTo) params.set("w1", state.weightTo);
      if (state.games.length) params.set("games", state.games.join(","));
      var qs = params.toString();
      var nextHash = "#/night" + (qs ? "?" + qs : "");
      var next = window.location.pathname + window.location.search + nextHash;
      if ((window.location.pathname + window.location.search + window.location.hash) !== next) {
        history.replaceState(null, "", next);
      }
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) {}
    }

    function fits(game) {
      if (!game) return false;
      if (state.players) {
        if (!ctx.countIncluded(ctx.playerSpan(game.players), state.players)) return false;
      }
      if (state.time) {
        var minutes = ctx.playMinutes(game, parseInt(state.players, 10) || 0);
        if (!ctx.timeHits(minutes, state.time)) return false;
      }
      if (state.weightFrom || state.weightTo) {
        var band = ctx.weightBand(game.weight);
        var idx = WEIGHTS.indexOf(band);
        if (idx < 0) return false;
        var from = state.weightFrom ? WEIGHTS.indexOf(state.weightFrom) : 0;
        var to = state.weightTo ? WEIGHTS.indexOf(state.weightTo) : WEIGHTS.length - 1;
        if (from > to) {
          var swap = from;
          from = to;
          to = swap;
        }
        if (idx < from || idx > to) return false;
      }
      if (!kidsAllows(game, state.kids, catalogHasAge)) return false;
      return true;
    }

    function fitsGame(slug) {
      return fits(bySlug[slug]);
    }

    function isBestAt(game) {
      if (!state.players || !game || !game.playerPoll) return false;
      return ctx.countIncluded(ctx.playerSpan(game.playerPoll.best), state.players);
    }

    function nomineeGames() {
      return state.games.map(function (slug) { return bySlug[slug]; }).filter(Boolean);
    }

    function metaLine(game) {
      var bits = [];
      if (game.players) bits.push(String(game.players));
      if (game.time) {
        var time = String(game.time);
        bits.push(/min|hour|hr/i.test(time) ? time : time + " min");
      }
      var band = ctx.weightBand(game.weight);
      if (band && WEIGHT_LABELS[band]) bits.push(WEIGHT_LABELS[band]);
      return bits.join(" \u00b7 ");
    }

    function chip(facet, value, label, aria, pressed) {
      return '<button type="button" class="gn-chip" data-facet="' + facet + '" data-value="' + ctx.escapeHtml(value) + '" aria-pressed="' + (pressed ? "true" : "false") + '" aria-label="' + ctx.escapeHtml(aria) + '">' + ctx.escapeHtml(label) + "</button>";
    }

    function playerAria(value) {
      if (value === "1") return "1 player";
      if (value === "7") return "7 or more players";
      return value + " players";
    }

    function weightSummary() {
      if (!state.weightFrom && !state.weightTo) return "Any weight";
      if (state.weightFrom && state.weightTo && state.weightFrom !== state.weightTo) {
        return WEIGHT_LABELS[state.weightFrom] + " to " + WEIGHT_LABELS[state.weightTo];
      }
      if (state.weightFrom && !state.weightTo) return WEIGHT_LABELS[state.weightFrom] + " and heavier";
      if (!state.weightFrom && state.weightTo) return "Up to " + WEIGHT_LABELS[state.weightTo];
      return WEIGHT_LABELS[state.weightFrom || state.weightTo];
    }

    function kidsNote() {
      if (!state.kids) return "";
      if (!catalogHasAge) {
        return "No minimum age is stored for these games, and BoardGameGeek minimum ages are not in this catalog, so Kids present does not hide any games.";
      }
      return "Games with a listed minimum age of 12 or older are hidden. Games with no age listed stay in the list.";
    }

    function fitSentence() {
      var n = 0;
      ctx.games.forEach(function (game) { if (fits(game)) n += 1; });
      var filtering = !!(state.players || state.time || state.weightFrom || state.weightTo || state.kids);
      if (!filtering) return n + (n === 1 ? " game is in the catalog." : " games are in the catalog.");
      if (n === 0) return "No games fit tonight.";
      if (n === 1) return "1 game fits tonight.";
      return n + " games fit tonight.";
    }

    function resultHtml(game, why) {
      var cover = "";
      try { cover = ctx.coverUrl(game.slug) || ""; } catch (err) { cover = ""; }
      var img = cover
        ? '<img class="gn-cover-img" alt="" src="' + ctx.escapeHtml(cover) + '" onerror="this.remove()">'
        : "";
      return (
        '<article class="gn-result" data-slug="' + ctx.escapeHtml(game.slug) + '">' +
          img +
          '<p class="gn-kicker">Tonight\u2019s game</p>' +
          '<h3 class="gn-winner" id="gn-winner-name">' + ctx.escapeHtml(game.name) + "</h3>" +
          '<p class="gn-meta">' + ctx.escapeHtml(metaLine(game)) + "</p>" +
          '<p class="gn-why">' + ctx.escapeHtml(why) + "</p>" +
          '<div class="gn-result-links">' +
            '<a class="gn-link" href="' + ctx.escapeHtml(ctx.gameHref(game.slug)) + '">Game page</a>' +
            '<a class="gn-link" href="' + ctx.escapeHtml(ctx.teachHref(game.slug)) + '">Teach it</a>' +
          "</div>" +
        "</article>"
      );
    }

    function paintShell() {
      var playerChips = PLAYERS.map(function (value) {
        var label = value === "7" ? "7+" : value;
        return chip("players", value, label, playerAria(value), state.players === value);
      }).join("");
      var timeChips = TIMES.map(function (value) {
        return chip("time", value, TIME_LABELS[value], TIME_ARIA[value], state.time === value);
      }).join("");
      var fromChips = WEIGHTS.map(function (value) {
        return chip("w0", value, WEIGHT_LABELS[value], "Weight from " + WEIGHT_LABELS[value], state.weightFrom === value);
      }).join("");
      var toChips = WEIGHTS.map(function (value) {
        return chip("w1", value, WEIGHT_LABELS[value], "Weight up to " + WEIGHT_LABELS[value], state.weightTo === value);
      }).join("");
      ctx.appEl.innerHTML =
        '<article class="gn" id="gn-page">' +
          '<p class="page-back"><a class="back-link" href="#/">\u2190 All games</a></p>' +
          '<h2 class="title">What should we play?</h2>' +
          '<p class="gn-lead">Set tonight, nominate a few games, then decide on this phone.</p>' +
          '<section class="gn-card" aria-labelledby="gn-context-title">' +
            '<h3 id="gn-context-title">Tonight</h3>' +
            '<p id="gn-fit" class="gn-note"></p>' +
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-players-label">Players</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-players-label">' + playerChips + "</div>" +
            "</div>" +
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-time-label">Time</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-time-label">' + timeChips + "</div>" +
            "</div>" +
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-kids-label">Kids present</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-kids-label">' +
                chip("kids", "0", "No", "Kids present: no", !state.kids) +
                chip("kids", "1", "Yes", "Kids present: yes", state.kids) +
              "</div>" +
              '<p id="gn-kids-note" class="gn-note"' + (state.kids ? "" : " hidden") + "></p>" +
            "</div>" +
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-w0-label">Weight from</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-w0-label">' + fromChips + "</div>" +
            "</div>" +
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-w1-label">Up to</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-w1-label">' + toChips + "</div>" +
              '<p id="gn-weight-summary" class="gn-note"></p>' +
            "</div>" +
          "</section>" +
          '<section class="gn-card" aria-labelledby="gn-nom-title">' +
            '<h3 id="gn-nom-title">Nominees</h3>' +
            '<div class="gn-actions">' +
              '<button type="button" class="gn-primary" id="gn-suggest">Suggest some</button>' +
              '<button type="button" class="gn-btn" id="gn-clear"' + (state.games.length ? "" : " hidden") + ">Clear nominees</button>" +
            "</div>" +
            '<p id="gn-suggest-note" class="gn-note gn-status" role="status"></p>' +
            '<p id="gn-dropped" class="gn-note"' + (dropped ? "" : " hidden") + "></p>" +
            '<ul id="gn-nominee-list" class="gn-list"></ul>' +
            '<label class="gn-field" for="gn-search">Add a game' +
              '<input id="gn-search" type="search" placeholder="Search the catalog" autocomplete="off" enterkeyhint="search" aria-label="Add a game">' +
            "</label>" +
            '<p id="gn-results-label" class="gn-note">Fits tonight</p>' +
            '<ul id="gn-results" class="gn-results"></ul>' +
            '<div class="gn-actions">' +
              '<button type="button" class="gn-btn" id="gn-share">Copy link</button>' +
              '<button type="button" class="gn-btn" id="gn-poll">Copy as poll</button>' +
            "</div>" +
            '<p id="gn-share-status" class="gn-note gn-status" role="status"></p>' +
            '<p id="gn-share-url" class="gn-share-url" hidden></p>' +
            '<pre id="gn-poll-out" class="gn-poll" hidden></pre>' +
          "</section>" +
          '<section class="gn-card" aria-labelledby="gn-decide-title">' +
            '<h3 id="gn-decide-title">Decide</h3>' +
            '<p class="gn-note">Voting happens on this one phone. A shared link sends the nominee list. Other devices do not join the vote, because there is no server.</p>' +
            '<div class="gn-modes" id="gn-modes">' +
              '<button type="button" class="gn-btn" data-mode="wheel">Spin the wheel</button>' +
              '<button type="button" class="gn-btn" data-mode="vote">Pass-the-phone vote</button>' +
              '<button type="button" class="gn-btn" data-mode="veto">Veto rounds</button>' +
              '<button type="button" class="gn-btn" data-mode="bracket">Bracket</button>' +
              '<button type="button" class="gn-btn" data-mode="quick">Quick pick</button>' +
            "</div>" +
            '<div id="gn-panel"></div>' +
          "</section>" +
          '<p class="gn-actions"><button type="button" class="gn-btn" id="gn-start-over">Start over</button></p>' +
        "</article>";

      var page = document.getElementById("gn-page");
      page.addEventListener("click", onShellClick);
      document.getElementById("gn-search").addEventListener("input", function (event) {
        query = event.target.value;
        paintResults();
      });
      document.getElementById("gn-search").addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        var first = document.querySelector("#gn-results [data-add]");
        if (!first) return;
        event.preventDefault();
        addSlug(first.getAttribute("data-add"));
      });
      document.getElementById("gn-panel").addEventListener("click", function (event) {
        onPanelClick(event);
        event.stopPropagation();
      });
    }

    function paintPressed() {
      Array.prototype.forEach.call(document.querySelectorAll("#gn-page .gn-chip"), function (btn) {
        var facet = btn.getAttribute("data-facet");
        var value = btn.getAttribute("data-value");
        var on = false;
        if (facet === "players") on = state.players === value;
        else if (facet === "time") on = state.time === value;
        else if (facet === "w0") on = state.weightFrom === value;
        else if (facet === "w1") on = state.weightTo === value;
        else if (facet === "kids") on = (value === "1") === !!state.kids;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function paintContext() {
      paintPressed();
      var fit = document.getElementById("gn-fit");
      if (fit) fit.textContent = fitSentence();
      var note = document.getElementById("gn-kids-note");
      if (note) {
        note.textContent = kidsNote();
        note.hidden = !state.kids;
      }
      var summary = document.getElementById("gn-weight-summary");
      if (summary) summary.textContent = weightSummary();
    }

    function paintNominees() {
      var list = document.getElementById("gn-nominee-list");
      if (!list) return;
      if (!state.games.length) {
        list.innerHTML = '<li class="gn-note">No nominees yet. Suggest some, or add a game.</li>';
      } else {
        list.innerHTML = state.games.map(function (slug) {
          var game = bySlug[slug];
          return (
            '<li class="gn-row">' +
              '<span><span class="gn-name">' + ctx.escapeHtml(game.name) + "</span>" +
              '<span class="gn-sub">' + ctx.escapeHtml(metaLine(game)) + "</span></span>" +
              '<button type="button" data-remove="' + ctx.escapeHtml(slug) + '" aria-label="Remove ' + ctx.escapeHtml(game.name) + '">Remove</button>' +
            "</li>"
          );
        }).join("");
      }
      var clear = document.getElementById("gn-clear");
      if (clear) clear.hidden = !state.games.length;
      var missing = document.getElementById("gn-dropped");
      if (missing) {
        missing.hidden = !dropped;
        missing.textContent = dropped
          ? (dropped === 1 ? "1 game in that link is not in the catalog." : dropped + " games in that link are not in the catalog.")
          : "";
      }
    }

    function paintResults() {
      var list = document.getElementById("gn-results");
      var label = document.getElementById("gn-results-label");
      if (!list) return;
      var q = String(query || "").trim().toLowerCase();
      var pool = ctx.games.filter(function (game) {
        if (state.games.indexOf(game.slug) !== -1) return false;
        if (!q) return fits(game);
        if (String(game.name || "").toLowerCase().indexOf(q) !== -1) return true;
        if (!Array.isArray(game.aliases)) return false;
        return game.aliases.some(function (name) {
          return String(name || "").toLowerCase().indexOf(q) !== -1;
        });
      });
      pool.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      pool = pool.slice(0, q ? 12 : 8);
      if (label) label.textContent = q ? "Matches" : "Fits tonight";
      if (!pool.length) {
        list.innerHTML = '<li class="gn-note">' + (q ? "No games match that search." : "Nothing else fits tonight.") + "</li>";
        return;
      }
      list.innerHTML = pool.map(function (game) {
        var outside = q && !fits(game);
        return (
          '<li class="gn-row">' +
            '<span><span class="gn-name">' + ctx.escapeHtml(game.name) + "</span>" +
            '<span class="gn-sub">' + ctx.escapeHtml(metaLine(game)) +
              (outside ? '<span class="gn-outside">Outside tonight\u2019s filters</span>' : "") +
            "</span></span>" +
            '<button type="button" data-add="' + ctx.escapeHtml(game.slug) + '" aria-label="Add ' + ctx.escapeHtml(game.name) + '">Add</button>' +
          "</li>"
        );
      }).join("");
    }

    function paintModes() {
      var active = "";
      if (decision) active = decision.type === "result" ? (decision.source || "") : decision.type;
      Array.prototype.forEach.call(document.querySelectorAll("#gn-modes [data-mode]"), function (btn) {
        var on = btn.getAttribute("data-mode") === active;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function setSuggestNote(text) {
      var note = document.getElementById("gn-suggest-note");
      if (note) note.textContent = text || "";
    }

    function setShare(text) {
      var note = document.getElementById("gn-share-status");
      if (note) note.textContent = text || "";
    }

    function setNominees(slugs) {
      var next = [];
      var seen = {};
      slugs.forEach(function (slug) {
        if (!bySlug[slug] || seen[slug]) return;
        seen[slug] = true;
        if (next.length < MAX_NOMINEES) next.push(slug);
      });
      var changed = next.join(",") !== state.games.join(",");
      state.games = next;
      if (changed && decision) {
        decision = null;
        document.body.style.overflow = "";
        paintPanel(false);
        paintModes();
      }
      paintNominees();
      paintResults();
      syncUrl();
    }

    function addSlug(slug) {
      if (!bySlug[slug] || state.games.indexOf(slug) !== -1) return;
      if (state.games.length >= MAX_NOMINEES) {
        setSuggestNote("16 nominees is the limit.");
        return;
      }
      setSuggestNote("");
      setNominees(state.games.concat([slug]));
    }

    function onSuggest() {
      var matches = ctx.games.filter(fits);
      var ordered = orderForSuggest(matches, isBestAt);
      if (!state.games.length) {
        var count = suggestCount(ordered.length);
        setNominees(ordered.slice(0, count).map(function (game) { return game.slug; }));
        setSuggestNote(count
          ? ("Suggested " + count + (count === 1 ? " game" : " games") + " that fit tonight.")
          : "No games fit tonight.");
        return;
      }
      var have = {};
      state.games.forEach(function (slug) { have[slug] = true; });
      var next = state.games.slice();
      ordered.forEach(function (game) {
        if (next.length >= 8 || have[game.slug]) return;
        have[game.slug] = true;
        next.push(game.slug);
      });
      if (next.length === state.games.length) {
        setSuggestNote(matches.length ? "Every game that fits is already nominated." : "No games fit tonight.");
        return;
      }
      setNominees(next);
      setSuggestNote("Added games that fit tonight.");
    }

    function contextCount(min, fallback) {
      var n = state.players === "7" ? 7 : parseInt(state.players, 10);
      if (!n || n < min) n = fallback;
      if (n > 12) n = 12;
      return n;
    }

    function showResult(game, why, extra, source) {
      decision = { type: "result", source: source, slug: game.slug, why: why, extra: extra || "" };
      document.body.style.overflow = "";
      paintModes();
      paintPanel(true);
    }

    function quickPick() {
      var matches = ctx.games.filter(fits);
      if (!matches.length) {
        decision = { type: "quick-empty", source: "quick" };
        paintModes();
        paintPanel(true);
        return;
      }
      var game = matches[randomIndex(matches.length)];
      showResult(game, "Quick pick from games that fit tonight.", "", "quick");
    }

    function startMode(type) {
      if (type === "quick") {
        quickPick();
        return;
      }
      if (state.games.length < 2) {
        decision = { type: "need", source: type };
        paintModes();
        paintPanel(true);
        return;
      }
      if (type === "wheel") {
        decision = { type: "wheel", source: "wheel", rotation: 0, winner: "", spinning: false };
      } else if (type === "vote") {
        decision = {
          type: "vote",
          source: "vote",
          phase: "setup",
          method: "rank",
          voters: contextCount(2, 4),
          voter: 0,
          ballots: [],
          draft: []
        };
      } else if (type === "veto") {
        decision = {
          type: "veto",
          source: "veto",
          left: state.games.slice(),
          turn: 0,
          voters: contextCount(1, state.games.length > 1 ? 2 : 1),
          history: []
        };
      } else if (type === "bracket") {
        decision = { type: "bracket", source: "bracket", round: buildRound(state.games, 1) };
      }
      paintModes();
      paintPanel(true);
    }

    function buildRound(slugs, roundNumber) {
      var order = shuffle(slugs);
      var bye = null;
      if (order.length % 2 === 1) bye = order.pop();
      var matches = [];
      var i = 0;
      for (; i < order.length; i += 2) {
        matches.push({ a: order[i], b: order[i + 1], winner: null });
      }
      return { matches: matches, bye: bye, round: roundNumber || 1 };
    }

    function roundTitle(round) {
      if (round.matches.length === 1 && !round.bye) return "Final";
      return "Round " + round.round;
    }

    function drawWheel(canvas, games, rotationDeg) {
      var g = canvas.getContext("2d");
      var size = canvas.width;
      var cx = size / 2;
      var cy = size / 2;
      var radius = size / 2 - 8;
      var n = games.length;
      var slice = (Math.PI * 2) / n;
      var rot = (rotationDeg || 0) * Math.PI / 180;
      g.clearRect(0, 0, size, size);
      var i = 0;
      for (; i < n; i += 1) {
        var start = -Math.PI / 2 + rot + i * slice;
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, radius, start, start + slice);
        g.closePath();
        g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = "#ffffff";
        g.stroke();
      }
      /* Names stay upright. The spin uses a CSS rotate, then the settled
         wheel is redrawn so the labels are level again. */
      for (i = 0; i < n; i += 1) {
        var mid = -Math.PI / 2 + rot + (i + 0.5) * slice;
        var dist = radius * (n > 6 ? 0.66 : 0.58);
        g.save();
        g.translate(cx + Math.cos(mid) * dist, cy + Math.sin(mid) * dist);
        g.fillStyle = "#ffffff";
        g.font = "600 " + (n > 6 ? 20 : 28) + "px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        var label = games[i].name;
        var maxChars = n > 6 ? 11 : 14;
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + "\u2026";
        g.fillText(label, 0, 0);
        g.restore();
      }
      g.beginPath();
      g.arc(cx, cy, 22, 0, Math.PI * 2);
      g.fillStyle = getComputedStyle(canvas).getPropertyValue("--card").trim() || "#ffffff";
      g.fill();
    }

    function wheelHtml() {
      return (
        '<div class="gn-wheel-wrap" id="gn-wheel-wrap" data-spinning="false">' +
          '<div class="gn-pointer" aria-hidden="true"></div>' +
          '<canvas class="gn-wheel-canvas" id="gn-wheel" width="640" height="640" aria-hidden="true"></canvas>' +
        "</div>" +
        '<p id="gn-wheel-status" class="gn-note" role="status">Each nominee has the same chance. The winner is chosen before the wheel moves.</p>' +
        '<div id="gn-wheel-result" hidden></div>' +
        '<div class="gn-actions">' +
          '<button type="button" class="gn-primary" id="gn-spin">Spin</button>' +
          '<button type="button" class="gn-btn" id="gn-respin" hidden>Spin again</button>' +
          '<button type="button" class="gn-btn" id="gn-drop" hidden>Remove winner and spin again</button>' +
        "</div>"
      );
    }

    function runSpin(canvas, from, to, game) {
      var reduce = !motionOK();
      var wrap = document.getElementById("gn-wheel-wrap");
      var status = document.getElementById("gn-wheel-status");
      if (reduce) {
        canvas.style.transition = "none";
        canvas.style.transform = "none";
        drawWheel(canvas, nomineeGames(), to);
      } else {
        drawWheel(canvas, nomineeGames(), 0);
        canvas.style.transition = "none";
        canvas.style.transform = "rotate(" + from + "deg)";
        canvas.getBoundingClientRect();
        canvas.style.transition = "transform 2.4s cubic-bezier(.12,.7,.08,1)";
      }
      if (wrap) wrap.setAttribute("data-spinning", reduce ? "false" : "true");
      if (status && !reduce) status.textContent = "Spinning.";
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        if (!decision || decision.type !== "wheel" || !canvas.isConnected) return;
        decision.spinning = false;
        if (wrap && wrap.isConnected) {
          wrap.setAttribute("data-spinning", "false");
          wrap.setAttribute("data-winner", game.slug);
        }
        if (status) status.textContent = "Winner: " + game.name + ".";
        canvas.style.transition = "none";
        canvas.style.transform = "none";
        drawWheel(canvas, nomineeGames(), decision.rotation || 0);
        var box = document.getElementById("gn-wheel-result");
        if (box) {
          box.hidden = false;
          box.innerHTML = resultHtml(game, "Picked by the wheel.");
        }
        var spinBtn = document.getElementById("gn-spin");
        var again = document.getElementById("gn-respin");
        var drop = document.getElementById("gn-drop");
        if (spinBtn) spinBtn.hidden = true;
        if (again) again.hidden = false;
        if (drop) drop.hidden = game && state.games.length > 1 ? false : true;
      }
      if (reduce) {
        finish();
        return;
      }
      function onEnd(event) {
        if (event.propertyName && event.propertyName !== "transform") return;
        canvas.removeEventListener("transitionend", onEnd);
        finish();
      }
      canvas.addEventListener("transitionend", onEnd);
      setTimeout(function () {
        if (!settled) finish();
      }, 3200);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          canvas.style.transform = "rotate(" + to + "deg)";
        });
      });
    }

    function spin() {
      if (!decision || decision.type !== "wheel" || decision.spinning) return;
      var games = nomineeGames();
      if (games.length < 2) {
        if (games.length === 1) showResult(games[0], "Only one nominee left.", "", "wheel");
        return;
      }
      var index = randomIndex(games.length);
      var from = decision.rotation || 0;
      var to = landingRotation(index, games.length, from, motionOK() ? 5 : 0);
      decision.winner = games[index].slug;
      decision.rotation = to;
      decision.spinning = !motionOK() ? false : true;
      var canvas = document.getElementById("gn-wheel");
      if (!canvas) return;
      var box = document.getElementById("gn-wheel-result");
      if (box) {
        box.hidden = true;
        box.innerHTML = "";
      }
      var again = document.getElementById("gn-respin");
      var drop = document.getElementById("gn-drop");
      var spinBtn = document.getElementById("gn-spin");
      if (again) again.hidden = true;
      if (drop) drop.hidden = true;
      if (spinBtn) spinBtn.disabled = true;
      runSpin(canvas, from, to, games[index]);
    }

    function dropWinner() {
      if (!decision || !decision.winner) return;
      var removed = decision.winner;
      var next = state.games.filter(function (slug) { return slug !== removed; });
      state.games = next;
      paintNominees();
      paintResults();
      syncUrl();
      if (next.length < 2) {
        if (next.length === 1) showResult(bySlug[next[0]], "Last nominee left.", "", "wheel");
        else startMode("wheel");
        return;
      }
      decision.winner = "";
      decision.rotation = 0;
      decision.spinning = false;
      paintPanel(false);
      spin();
    }

    function tallyHtml(result, slugs) {
      var rows = slugs.slice().sort(function (a, b) {
        if (result.totals[b] !== result.totals[a]) return result.totals[b] - result.totals[a];
        return String(bySlug[a].name).localeCompare(String(bySlug[b].name));
      });
      return '<ol class="gn-tally">' + rows.map(function (slug) {
        return "<li><span>" + ctx.escapeHtml(bySlug[slug].name) + "</span><span>" + result.totals[slug] + "</span></li>";
      }).join("") + "</ol>";
    }

    function voteHtml() {
      if (decision.phase === "cover") {
        var who = decision.voter + 1;
        return (
          '<div class="gn-cover" id="gn-cover" role="dialog" aria-modal="true" aria-labelledby="gn-cover-title">' +
            "<h3 id=\"gn-cover-title\">Pass the phone</h3>" +
            "<p>Hand this phone to Player " + who + ". Rankings stay hidden until everyone has voted.</p>" +
            '<button type="button" class="gn-primary" id="gn-ready">Player ' + who + " is ready</button>" +
          "</div>"
        );
      }
      if (decision.phase === "ballot") {
        var games = nomineeGames();
        var heading = "<h3>Player " + (decision.voter + 1) + "</h3>";
        if (decision.method === "points") return heading + pointsBallot(games);
        return heading + rankBallot(games);
      }
      return (
        "<p>Each player ranks in private. Full ranking is a Borda count: first place gets " +
          state.games.length + " points, down to 1. Top 3 gives 3, 2, and 1. Ties break on first-place votes, then second, then third, then a random pick.</p>" +
        '<div class="gn-chips" role="group" aria-label="How to vote">' +
          '<button type="button" class="gn-chip" data-vote-method="rank" aria-pressed="' + (decision.method === "rank" ? "true" : "false") + '">Full ranking</button>' +
          '<button type="button" class="gn-chip" data-vote-method="points" aria-pressed="' + (decision.method === "points" ? "true" : "false") + '">Top 3 points</button>' +
        "</div>" +
        '<div class="gn-stepper" role="group" aria-label="Players voting">' +
          '<button type="button" class="gn-btn" id="gn-voter-dec" aria-label="Fewer players voting">\u2212</button>' +
          "<strong id=\"gn-voter-count\">" + decision.voters + "</strong>" +
          '<button type="button" class="gn-btn" id="gn-voter-inc" aria-label="More players voting">+</button>' +
        "</div>" +
        '<div class="gn-actions"><button type="button" class="gn-primary" id="gn-vote-start">Start vote</button></div>'
      );
    }

    function rankBallot(games) {
      var ranked = decision.draft.map(function (slug) {
        return "<li>" + ctx.escapeHtml(bySlug[slug].name) + "</li>";
      }).join("");
      var open = games.filter(function (game) { return decision.draft.indexOf(game.slug) === -1; });
      var buttons = open.map(function (game) {
        return '<button type="button" class="gn-choice" data-rank="' + ctx.escapeHtml(game.slug) + '" aria-label="Rank ' + ctx.escapeHtml(game.name) + '">' + ctx.escapeHtml(game.name) + "</button>";
      }).join("");
      var ready = decision.draft.length === games.length;
      return (
        '<div id="gn-ballot">' +
          "<p>Tap games from favorite to least favorite.</p>" +
          (ranked ? '<ol class="gn-ranked">' + ranked + "</ol>" : "") +
          '<div class="gn-actions">' + buttons + "</div>" +
          '<div class="gn-actions">' +
            '<button type="button" class="gn-btn" id="gn-undo"' + (decision.draft.length ? "" : " disabled") + ">Remove last</button>" +
            '<button type="button" class="gn-primary" id="gn-submit"' + (ready ? "" : " disabled") + ">Submit ranking</button>" +
          "</div>" +
        "</div>"
      );
    }

    function pointsBallot(games) {
      var labels = ["3 points", "2 points", "1 point"];
      var used = {};
      decision.draft.forEach(function (slug) { if (slug) used[slug] = true; });
      var slots = labels.map(function (label, index) {
        if (games.length <= index) return "";
        var chosen = decision.draft[index];
        var body = "";
        if (chosen) {
          body = '<p class="gn-name">' + ctx.escapeHtml(bySlug[chosen].name) + "</p>" +
            '<button type="button" class="gn-btn" data-clear-slot="' + index + '">Clear</button>';
        } else {
          body = games.filter(function (game) { return !used[game.slug]; }).map(function (game) {
            return '<button type="button" class="gn-choice" data-point-slot="' + index + '" data-point-slug="' + ctx.escapeHtml(game.slug) + '">' + ctx.escapeHtml(game.name) + "</button>";
          }).join("");
        }
        return '<div class="gn-slot"><p class="gn-facet-label">' + label + "</p>" + body + "</div>";
      }).join("");
      var ready = !!decision.draft[0];
      return (
        '<div id="gn-ballot">' +
          "<p>Give up to 3 points. First choice gets 3. Second and third are optional.</p>" +
          slots +
          '<div class="gn-actions"><button type="button" class="gn-primary" id="gn-submit"' + (ready ? "" : " disabled") + ">Submit points</button></div>" +
        "</div>"
      );
    }

    function vetoHtml() {
      var player = decision.turn + 1;
      var rows = decision.left.map(function (slug) {
        var name = bySlug[slug].name;
        return '<button type="button" class="gn-choice" data-strike="' + ctx.escapeHtml(slug) + '">Strike ' + ctx.escapeHtml(name) + "</button>";
      }).join("");
      return (
        '<p id="gn-turn">Player ' + player + " strikes one game.</p>" +
        '<div class="gn-stepper" role="group" aria-label="Players striking">' +
          '<button type="button" class="gn-btn" id="gn-veto-dec" aria-label="Fewer players striking">\u2212</button>' +
          "<strong id=\"gn-veto-count\">" + decision.voters + "</strong>" +
          '<button type="button" class="gn-btn" id="gn-veto-inc" aria-label="More players striking">+</button>' +
        "</div>" +
        '<div class="gn-actions">' + rows + "</div>" +
        '<div class="gn-actions"><button type="button" class="gn-btn" id="gn-veto-undo"' + (decision.history.length ? "" : " disabled") + ">Undo last strike</button></div>"
      );
    }

    function bracketHtml() {
      var round = decision.round;
      var matches = round.matches.map(function (match, index) {
        if (match.winner) {
          var loser = match.winner === match.a ? match.b : match.a;
          return '<p class="gn-note">' + ctx.escapeHtml(bySlug[match.winner].name) + " beat " + ctx.escapeHtml(bySlug[loser].name) + "</p>";
        }
      return (
        '<div class="gn-match" role="group" aria-label="Match ' + (index + 1) + '">' +
          '<p class="gn-facet-label">Match ' + (index + 1) + "</p>" +
          '<button type="button" class="gn-choice" data-match="' + index + '" data-pick="' + ctx.escapeHtml(match.a) + '">' + ctx.escapeHtml(bySlug[match.a].name) + "</button>" +
          '<span class="gn-or">or</span>' +
          '<button type="button" class="gn-choice" data-match="' + index + '" data-pick="' + ctx.escapeHtml(match.b) + '">' + ctx.escapeHtml(bySlug[match.b].name) + "</button>" +
        "</div>"
      );
      }).join("");
      var bye = round.bye
        ? '<p class="gn-note">' + ctx.escapeHtml(bySlug[round.bye].name) + " has a bye this round. The bye was chosen at random.</p>"
        : "";
      return "<h3>" + ctx.escapeHtml(roundTitle(round)) + "</h3><p>Tap the game that should go through.</p>" + matches + bye;
    }

    function paintPanel(scroll) {
      var panel = document.getElementById("gn-panel");
      if (!panel) return;
      var html = "";
      if (!decision) html = "";
      else if (decision.type === "need") html = "<p>Add at least two nominees first.</p>";
      else if (decision.type === "quick-empty") html = "<p>No games fit tonight, so there is nothing to pick. Widen the player count or the time.</p>";
      else if (decision.type === "wheel") html = wheelHtml();
      else if (decision.type === "vote") html = voteHtml();
      else if (decision.type === "veto") html = vetoHtml();
      else if (decision.type === "bracket") html = bracketHtml();
      else if (decision.type === "result") {
        var game = bySlug[decision.slug];
        html = resultHtml(game, decision.why) + (decision.extra || "") +
          '<div class="gn-actions">' +
            (decision.source === "quick" ? '<button type="button" class="gn-primary" id="gn-again">Pick another</button>' : "") +
            '<button type="button" class="gn-btn" id="gn-clear-decision">Decide another way</button>' +
          "</div>";
      }
      panel.innerHTML = html;
      var cover = decision && decision.type === "vote" && decision.phase === "cover";
      document.body.style.overflow = cover ? "hidden" : "";
      if (decision && decision.type === "wheel") {
        var canvas = document.getElementById("gn-wheel");
        if (canvas) {
          canvas.style.transition = "none";
          canvas.style.transform = "none";
          drawWheel(canvas, nomineeGames(), decision.rotation || 0);
        }
      }
      if (cover) {
        var ready = document.getElementById("gn-ready");
        if (ready) ready.focus();
      } else if (scroll && decision) {
        panel.scrollIntoView({ block: "start" });
      }
    }

    function submitBallot() {
      var games = nomineeGames();
      var ballot = { scores: {}, places: {} };
      games.forEach(function (game) { ballot.scores[game.slug] = 0; });
      if (decision.method === "points") {
        if (!decision.draft[0]) return;
        [3, 2, 1].forEach(function (points, index) {
          var slug = decision.draft[index];
          if (!slug) return;
          ballot.scores[slug] = points;
          ballot.places[slug] = index + 1;
        });
      } else {
        if (decision.draft.length !== games.length) return;
        decision.draft.forEach(function (slug, index) {
          ballot.places[slug] = index + 1;
          ballot.scores[slug] = games.length - index;
        });
      }
      decision.ballots.push(ballot);
      decision.voter += 1;
      decision.draft = decision.method === "points" ? [null, null, null] : [];
      if (decision.voter >= decision.voters) {
        var slugs = state.games.slice();
        var result = bordaWinner(decision.ballots, slugs);
        var why = "Won the pass-the-phone vote.";
        if (result.note) why += " " + result.note;
        showResult(bySlug[result.slug], why, tallyHtml(result, slugs), "vote");
        return;
      }
      decision.phase = "cover";
      paintPanel(false);
    }

    function strike(slug) {
      var index = decision.left.indexOf(slug);
      if (index < 0) return;
      decision.history.push({ slug: slug, index: index, turn: decision.turn });
      decision.left.splice(index, 1);
      decision.turn = (decision.turn + 1) % decision.voters;
      if (decision.left.length <= 1) {
        if (decision.left.length === 1) showResult(bySlug[decision.left[0]], "Last game after the vetoes.", "", "veto");
        return;
      }
      paintPanel(false);
    }

    function undoVeto() {
      var item = decision.history.pop();
      if (!item) return;
      decision.left.splice(item.index, 0, item.slug);
      decision.turn = item.turn;
      paintPanel(false);
    }

    function pickMatch(btn) {
      var index = parseInt(btn.getAttribute("data-match"), 10);
      var slug = btn.getAttribute("data-pick");
      var match = decision.round.matches[index];
      if (!match || match.winner || (slug !== match.a && slug !== match.b)) return;
      match.winner = slug;
      if (!decision.round.matches.every(function (item) { return item.winner; })) {
        paintPanel(false);
        return;
      }
      var next = decision.round.matches.map(function (item) { return item.winner; });
      if (decision.round.bye) next.push(decision.round.bye);
      if (next.length === 1) {
        showResult(bySlug[next[0]], "Won the bracket.", "", "bracket");
        return;
      }
      decision.round = buildRound(next, decision.round.round + 1);
      paintPanel(false);
    }

    function onPanelClick(event) {
      var btn = event.target.closest ? event.target.closest("button") : null;
      if (!btn) return;
      var id = btn.id;
      if (btn.disabled) return;
      if (id === "gn-spin" || id === "gn-respin") { spin(); return; }
      if (id === "gn-drop") { dropWinner(); return; }
      if (id === "gn-vote-start") {
        decision.phase = "cover";
        decision.voter = 0;
        decision.ballots = [];
        decision.draft = decision.method === "points" ? [null, null, null] : [];
        paintPanel(false);
        return;
      }
      if (id === "gn-ready") {
        decision.phase = "ballot";
        decision.draft = decision.method === "points" ? [null, null, null] : [];
        paintPanel(false);
        return;
      }
      if (id === "gn-submit") { submitBallot(); return; }
      if (id === "gn-undo") {
        decision.draft.pop();
        paintPanel(false);
        return;
      }
      if (id === "gn-voter-dec" || id === "gn-voter-inc") {
        var step = id === "gn-voter-inc" ? 1 : -1;
        var nextVoters = decision.voters + step;
        if (nextVoters < 2 || nextVoters > 12) return;
        decision.voters = nextVoters;
        paintPanel(false);
        return;
      }
      if (id === "gn-veto-dec" || id === "gn-veto-inc") {
        var vetoStep = id === "gn-veto-inc" ? 1 : -1;
        var vetoNext = decision.voters + vetoStep;
        if (vetoNext < 1 || vetoNext > 12) return;
        decision.voters = vetoNext;
        decision.turn = decision.turn % decision.voters;
        paintPanel(false);
        return;
      }
      if (id === "gn-veto-undo") { undoVeto(); return; }
      if (id === "gn-again") { quickPick(); return; }
      if (id === "gn-clear-decision") {
        decision = null;
        paintModes();
        paintPanel(false);
        return;
      }
      if (btn.hasAttribute("data-vote-method")) {
        decision.method = btn.getAttribute("data-vote-method");
        paintPanel(false);
        return;
      }
      if (btn.hasAttribute("data-rank")) {
        var rankSlug = btn.getAttribute("data-rank");
        if (decision.draft.indexOf(rankSlug) === -1) decision.draft.push(rankSlug);
        paintPanel(false);
        return;
      }
      if (btn.hasAttribute("data-point-slot")) {
        decision.draft[parseInt(btn.getAttribute("data-point-slot"), 10)] = btn.getAttribute("data-point-slug");
        paintPanel(false);
        return;
      }
      if (btn.hasAttribute("data-clear-slot")) {
        decision.draft[parseInt(btn.getAttribute("data-clear-slot"), 10)] = null;
        paintPanel(false);
        return;
      }
      if (btn.hasAttribute("data-strike")) { strike(btn.getAttribute("data-strike")); return; }
      if (btn.hasAttribute("data-match")) pickMatch(btn);
    }

    function onShellClick(event) {
      var btn = event.target.closest ? event.target.closest("button") : null;
      if (!btn || (document.getElementById("gn-panel") && document.getElementById("gn-panel").contains(btn))) return;
      if (btn.id === "gn-suggest") { onSuggest(); return; }
      if (btn.id === "gn-clear") { setSuggestNote(""); setNominees([]); return; }
      if (btn.id === "gn-share") {
        syncUrl();
        var url = window.location.href;
        var box = document.getElementById("gn-share-url");
        box.hidden = false;
        box.textContent = url;
        copyText(url).then(function (ok) {
          setShare(ok ? "Link copied." : "Select the link below and copy it.");
        });
        return;
      }
      if (btn.id === "gn-poll") {
        var names = nomineeGames().map(function (game) { return game.name; });
        if (!names.length) {
          setShare("Add nominees before copying a poll.");
          return;
        }
        var text = pollText(names);
        var pre = document.getElementById("gn-poll-out");
        pre.hidden = false;
        pre.textContent = text;
        copyText(text).then(function (ok) {
          setShare(ok ? "Poll copied. Paste it into Signal." : "Poll text is below. Select it and copy.");
        });
        return;
      }
      if (btn.id === "gn-start-over") {
        state = emptyState();
        decision = null;
        query = "";
        dropped = 0;
        document.body.style.overflow = "";
        var search = document.getElementById("gn-search");
        if (search) search.value = "";
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
        paintContext();
        paintNominees();
        paintResults();
        paintModes();
        paintPanel(false);
        syncUrl();
        setSuggestNote("");
        setShare("");
        var linkBox = document.getElementById("gn-share-url");
        var pollBox = document.getElementById("gn-poll-out");
        if (linkBox) linkBox.hidden = true;
        if (pollBox) pollBox.hidden = true;
        return;
      }
      if (btn.hasAttribute("data-mode")) {
        startMode(btn.getAttribute("data-mode"));
        return;
      }
      if (btn.hasAttribute("data-add")) { addSlug(btn.getAttribute("data-add")); return; }
      if (btn.hasAttribute("data-remove")) {
        setSuggestNote("");
        setNominees(state.games.filter(function (slug) { return slug !== btn.getAttribute("data-remove"); }));
        return;
      }
      var facet = btn.getAttribute("data-facet");
      if (!facet) return;
      var value = btn.getAttribute("data-value");
      if (facet === "players") state.players = state.players === value ? "" : value;
      else if (facet === "time") state.time = state.time === value ? "" : value;
      else if (facet === "kids") state.kids = value === "1";
      else if (facet === "w0") state.weightFrom = state.weightFrom === value ? "" : value;
      else if (facet === "w1") state.weightTo = state.weightTo === value ? "" : value;
      else return;
      normalizeWeights(state);
      paintContext();
      paintResults();
      syncUrl();
    }

    state = loadState();
    window.BGQuickNight.fitsGame = fitsGame;
    paintShell();
    paintContext();
    paintNominees();
    paintResults();
    paintModes();
    paintPanel(false);
    syncUrl();
  }

  var root = typeof window !== "undefined" ? window : globalThis;
  root.BGQuickNight = {
    render: render,
    randomIndex: randomIndex,
    shuffle: shuffle,
    bordaWinner: bordaWinner,
    sortByLongestSincePlayed: sortByLongestSincePlayed,
    orderForSuggest: orderForSuggest,
    suggestCount: suggestCount,
    recordedMinAge: recordedMinAge,
    kidsAllows: kidsAllows,
    pollText: pollText,
    landingRotation: landingRotation
  };
})();
