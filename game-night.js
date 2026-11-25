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

  /* One slice per game. Weight is how many people picked it, unless duplicates
     are not supposed to count extra. */
  function groupPicks(picks, dup) {
    var order = [];
    var by = {};
    (picks || []).forEach(function (pick) {
      var slug = pick && pick.slug;
      if (!slug) return;
      if (!by[slug]) {
        by[slug] = { slug: slug, who: [], weight: 0 };
        order.push(by[slug]);
      }
      if (pick.name && by[slug].who.indexOf(pick.name) === -1) by[slug].who.push(pick.name);
      by[slug].weight += 1;
    });
    if (!dup) order.forEach(function (seg) { seg.weight = 1; });
    return order;
  }

  /* Fair draw where a slice of weight 2 is twice as likely as a slice of weight 1. */
  function weightedIndex(weights, rng) {
    var roll = rng || randomIndex;
    var total = 0;
    var i = 0;
    for (; i < weights.length; i += 1) total += weights[i];
    if (total <= 0) return 0;
    var pick = roll(total);
    var acc = 0;
    for (i = 0; i < weights.length; i += 1) {
      acc += weights[i];
      if (pick < acc) return i;
    }
    return weights.length - 1;
  }

  /* CSS rotation, in degrees, that parks segment `index` under the top pointer.
     `n` may be a count of equal slices or an array of weights.
     Extra full turns keep a re-spin moving the same direction. */
  function landingRotation(index, n, fromDeg, turns) {
    var target;
    if (typeof n === "number") {
      target = segmentCenterDeg(index, n);
    } else {
      var weights = n || [];
      var total = 0;
      var before = 0;
      var i = 0;
      for (; i < weights.length; i += 1) total += weights[i];
      for (i = 0; i < index; i += 1) before += weights[i];
      var mid = total ? (before + weights[index] / 2) / total : 0;
      target = -90 + mid * 360;
    }
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
    return { players: "", time: "", kids: false, weightFrom: "", weightTo: "", who: [], games: [], pool: null };
  }

  function render(ctx) {
    var bySlug = {};
    ctx.games.forEach(function (game) { if (game && game.slug) bySlug[game.slug] = game; });
    var catalogHasAge = ctx.games.some(function (game) { return recordedMinAge(game) != null; });
    var state = emptyState();
    var decision = null;
    var query = "";
    var dropped = 0;
    var resultsToken = 0;
    var ownerNames = (ctx.owners && ctx.owners.length)
      ? ctx.owners.slice()
      : ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"];

    function allowed(code, list) {
      return list.indexOf(code) !== -1 ? code : "";
    }

    function cleanWho(value) {
      var allowedNames = {};
      ownerNames.forEach(function (name) { allowedNames[name.toLowerCase()] = name; });
      var seen = {};
      var next = [];
      String(value || "").split(",").forEach(function (part) {
        var name = allowedNames[part.trim().toLowerCase()];
        if (!name || seen[name]) return;
        seen[name] = true;
        next.push(name);
      });
      next.sort(function (a, b) { return ownerNames.indexOf(a) - ownerNames.indexOf(b); });
      return next;
    }

    function readParams(params) {
      var next = emptyState();
      if (!params) return next;
      next.players = allowed(params.get("players") || "", PLAYERS);
      next.time = allowed(params.get("time") || "", TIMES);
      next.kids = params.get("kids") === "1";
      next.weightFrom = allowed(params.get("w0") || "", WEIGHTS);
      next.weightTo = allowed(params.get("w1") || "", WEIGHTS);
      next.who = cleanWho(params.get("who") || "");
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
      var pool = readPool(params.get("pool"));
      if (pool) {
        next.pool = pool;
        if (pool.picks.length) {
          next.games = [];
          var have = {};
          pool.picks.forEach(function (pick) {
            if (have[pick.slug] || next.games.length >= MAX_NOMINEES) return;
            have[pick.slug] = true;
            next.games.push(pick.slug);
          });
        }
      }
      return next;
    }

    function cleanName(raw) {
      var name = String(raw || "").replace(/\s+/g, " ").trim();
      if (!name) return "";
      if (name.length > 24) name = name.slice(0, 24).trim();
      return name;
    }

    function readPool(raw) {
      if (!raw) return null;
      var data;
      try { data = JSON.parse(raw); } catch (err) { return null; }
      if (!data || typeof data !== "object") return null;
      var per = parseInt(data.n, 10);
      if (per !== 1 && per !== 2 && per !== 3) per = 2;
      var roster = [];
      var seen = {};
      (Array.isArray(data.r) ? data.r : []).forEach(function (item) {
        var name = cleanName(item);
        var key = name.toLowerCase();
        if (!name || seen[key] || roster.length >= 12) return;
        seen[key] = true;
        roster.push(name);
      });
      var picks = [];
      (Array.isArray(data.p) ? data.p : []).forEach(function (pair) {
        if (!pair || pair.length < 2 || picks.length >= 36) return;
        var name = cleanName(pair[0]);
        var slug = String(pair[1] || "").trim().toLowerCase();
        if (!name || !bySlug[slug]) {
          if (slug && !bySlug[slug]) dropped += 1;
          return;
        }
        var key = name.toLowerCase();
        var already = picks.some(function (pick) {
          return pick.name.toLowerCase() === key && pick.slug === slug;
        });
        if (already) return;
        var count = picks.filter(function (pick) { return pick.name.toLowerCase() === key; }).length;
        if (count >= per) return;
        picks.push({ name: name, slug: slug });
        if (!seen[key] && roster.length < 12) {
          seen[key] = true;
          roster.push(name);
        }
      });
      if (!roster.length && !picks.length) return null;
      return { roster: roster, per: per, dup: data.d !== 0, picks: picks };
    }

    function compactPool(pool) {
      return JSON.stringify({
        r: pool.roster,
        n: pool.per,
        d: pool.dup ? 1 : 0,
        p: pool.picks.map(function (pick) { return [pick.name, pick.slug]; })
      });
    }

    function paramsHaveState(params) {
      if (!params) return false;
      return params.has("players") || params.has("time") || params.has("kids") ||
        params.has("w0") || params.has("w1") || params.has("who") || params.has("games") || params.has("pool");
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
        if (saved.who && saved.who.length) params.set("who", saved.who.join(","));
        if (saved.games && saved.games.length) params.set("games", saved.games.join(","));
        if (saved.pool) params.set("pool", compactPool(saved.pool));
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
      if (state.who.length) params.set("who", state.who.map(function (name) { return name.toLowerCase(); }).join(","));
      if (state.games.length) params.set("games", state.games.join(","));
      if (state.pool && (state.pool.roster.length || state.pool.picks.length)) params.set("pool", compactPool(state.pool));
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
      if (state.who.length) {
        var owners = game.owners || [];
        var hit = false;
        for (var i = 0; i < state.who.length; i++) {
          if (owners.indexOf(state.who[i]) !== -1) hit = true;
        }
        if (!hit) return false;
      }
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

    function filtersActive() {
      return !!(state.players || state.time || state.weightFrom || state.weightTo || state.kids || state.who.length);
    }

    function fitSentence() {
      var n = 0;
      ctx.games.forEach(function (game) { if (fits(game)) n += 1; });
      if (!filtersActive()) return n + (n === 1 ? " game is in the catalog." : " games are in the catalog.");
      if (n === 0) return "No games fit tonight.";
      if (n === 1) return "1 game fits tonight.";
      return n + " games fit tonight.";
    }

    function fitListLabel(n) {
      if (n === 0) return "No games fit";
      if (n === 1) return "1 game fits";
      return n + " games fit";
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
      var whoChips = ownerNames.map(function (name) {
        return chip("who", name, name, name + "\u2019s games", state.who.indexOf(name) !== -1);
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
            '<div class="gn-facet">' +
              '<span class="gn-facet-label" id="gn-who-label">Whose games</span>' +
              '<div class="gn-chips" role="group" aria-labelledby="gn-who-label">' + whoChips + "</div>" +
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
            (typeof ctx.packForNight === "function"
              ? '<p class="gn-actions"><button type="button" class="gn-btn" id="gn-pack"' + (state.games.length ? "" : " hidden") + ">Pack for game night</button></p>"
              : "") +
            '<label class="gn-field" for="gn-search">Add a game' +
              '<input id="gn-search" type="search" placeholder="Search the catalog" autocomplete="off" enterkeyhint="search" aria-label="Add a game">' +
            "</label>" +
            '<p id="gn-results-label" class="gn-note" aria-live="polite">Fits tonight</p>' +
            '<ul id="gn-results" class="gn-results" aria-labelledby="gn-results-label"></ul>' +
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
        else if (facet === "who") on = state.who.indexOf(value) !== -1;
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
          var who = pickersOf(slug);
          return (
            '<li class="gn-row">' +
              '<span><span class="gn-name">' + ctx.escapeHtml(game.name) + "</span>" +
              '<span class="gn-sub">' + ctx.escapeHtml(metaLine(game)) +
                (who ? " · Picked by " + ctx.escapeHtml(who) : "") +
              "</span></span>" +
              '<button type="button" data-remove="' + ctx.escapeHtml(slug) + '" aria-label="Remove ' + ctx.escapeHtml(game.name) + '">Remove</button>' +
            "</li>"
          );
        }).join("");
      }
      var clear = document.getElementById("gn-clear");
      if (clear) clear.hidden = !state.games.length;
      var pack = document.getElementById("gn-pack");
      if (pack) pack.hidden = !state.games.length;
      var missing = document.getElementById("gn-dropped");
      if (missing) {
        missing.hidden = !dropped;
        missing.textContent = dropped
          ? (dropped === 1 ? "1 game in that link is not in the catalog." : dropped + " games in that link are not in the catalog.")
          : "";
      }
    }

    function resultRow(game, q) {
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
      /* Alphabetical, same as before. Search stays a short list. With tonight's
         filters on, every match is listed so the first names are not the only ones. */
      pool.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      var showAll = !q && filtersActive();
      if (q) pool = pool.slice(0, 12);
      else if (!showAll) pool = pool.slice(0, 8);
      list.classList.toggle("gn-fit-scroll", showAll);
      if (label) label.textContent = q ? "Matches" : (showAll ? fitListLabel(pool.length) : "Fits tonight");
      var token = ++resultsToken;
      var keepScroll = showAll ? list.scrollTop : 0;
      if (!pool.length) {
        list.innerHTML = '<li class="gn-note">' + (q ? "No games match that search." : "Nothing else fits tonight.") + "</li>";
        return;
      }
      /* First screen is sync so a search can replace a long list immediately.
         The rest arrives in frames so a few hundred matches do not freeze the phone.
         scrollTop is restored after each chunk so Add does not jump the list. */
      list.innerHTML = "";
      var i = 0;
      function paintChunk() {
        if (token !== resultsToken || !list.isConnected) return;
        var html = "";
        var end = Math.min(i + 40, pool.length);
        for (; i < end; i++) html += resultRow(pool[i], q);
        list.insertAdjacentHTML("beforeend", html);
        if (keepScroll) list.scrollTop = keepScroll;
        if (i < pool.length) requestAnimationFrame(paintChunk);
      }
      paintChunk();
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
      if (state.pool) {
        state.pool.picks = state.pool.picks.filter(function (pick) { return next.indexOf(pick.slug) !== -1; });
      }
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
      if (type === "wheel") {
        decision = freshWheel();
      } else if (state.games.length < 2) {
        decision = { type: "need", source: type };
        paintModes();
        paintPanel(true);
        return;
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

    function pickersOf(slug) {
      if (!state.pool) return "";
      var names = [];
      state.pool.picks.forEach(function (pick) {
        if (pick.slug === slug && names.indexOf(pick.name) === -1) names.push(pick.name);
      });
      return names.join(", ");
    }

    function activeWheelGames() {
      if (state.pool && state.pool.picks.length) {
        var dup = state.pool.dup !== false;
        return groupPicks(state.pool.picks, dup).map(function (seg) {
          var game = bySlug[seg.slug];
          return {
            slug: seg.slug,
            name: game ? game.name : seg.slug,
            who: seg.who,
            weight: seg.weight
          };
        });
      }
      return nomineeGames().map(function (game) {
        return { slug: game.slug, name: game.name, who: [], weight: 1 };
      });
    }

    function wheelWeights(games) {
      return games.map(function (game) { return game.weight > 0 ? game.weight : 1; });
    }

    function wheelChanceText(games) {
      var weighted = (games || activeWheelGames()).some(function (game) { return game.weight > 1; });
      if (weighted) return "A bigger slice is more likely. The winner is chosen before the wheel moves.";
      return "Each nominee has the same chance. The winner is chosen before the wheel moves.";
    }

    function drawWheel(canvas, games, rotationDeg) {
      var g = canvas.getContext("2d");
      var size = canvas.width;
      var cx = size / 2;
      var cy = size / 2;
      var radius = size / 2 - 8;
      var n = games.length;
      var weights = wheelWeights(games);
      var total = 0;
      var i = 0;
      for (; i < n; i += 1) total += weights[i];
      if (!total) total = 1;
      var rot = (rotationDeg || 0) * Math.PI / 180;
      g.clearRect(0, 0, size, size);
      var cursor = 0;
      for (i = 0; i < n; i += 1) {
        var sweep = weights[i] / total * Math.PI * 2;
        var start = -Math.PI / 2 + rot + cursor;
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, radius, start, start + sweep);
        g.closePath();
        g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = "#ffffff";
        g.stroke();
        cursor += sweep;
      }
      /* Names stay upright. The spin uses a CSS rotate, then the settled
         wheel is redrawn so the labels are level again. */
      cursor = 0;
      for (i = 0; i < n; i += 1) {
        var sweep2 = weights[i] / total * Math.PI * 2;
        var mid = -Math.PI / 2 + rot + cursor + sweep2 / 2;
        var dist = radius * (n > 6 ? 0.62 : 0.56);
        var who = (games[i].who || []).join(", ");
        g.save();
        g.translate(cx + Math.cos(mid) * dist, cy + Math.sin(mid) * dist);
        g.fillStyle = "#ffffff";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = "600 " + (n > 6 ? 20 : 28) + "px sans-serif";
        var label = games[i].name || "";
        var maxChars = n > 6 ? 11 : 14;
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + "\u2026";
        if (who.length > 18) who = who.slice(0, 17) + "\u2026";
        g.fillText(label, 0, who ? -14 : 0);
        if (who) {
          g.font = "600 18px sans-serif";
          g.fillText(who, 0, 16);
        }
        g.restore();
        cursor += sweep2;
      }
      g.beginPath();
      g.arc(cx, cy, 22, 0, Math.PI * 2);
      g.fillStyle = getComputedStyle(canvas).getPropertyValue("--card").trim() || "#ffffff";
      g.fill();
    }

    function wheelHtml() {
      if (decision.phase === "names") return namesHtml();
      if (decision.phase === "join") return joinHtml();
      if (decision.phase === "cover") return passCoverHtml();
      if (decision.phase === "pick") return pickHtml();
      var games = activeWheelGames();
      var weights = wheelWeights(games).join(",");
      var few = games.length < 2;
      var dupOn = !state.pool || state.pool.dup !== false;
      var poolNote = state.pool && state.pool.picks.length
        ? '<p class="gn-note">Copy the link so another phone can add picks, then send that link back. There is no server.</p>' +
          '<button type="button" class="gn-chip" id="gn-dup" aria-pressed="' + (dupOn ? "true" : "false") + '">Duplicates count extra</button>'
        : "";
      return (
        '<div class="gn-actions">' +
          '<button type="button" class="gn-primary" id="gn-everyone">Everyone picks</button>' +
          (state.pool && state.pool.picks.length ? '<button type="button" class="gn-btn" id="gn-join">Add my picks</button>' : "") +
        "</div>" +
        (few
          ? "<p>Add at least two nominees first, or have everyone add their own picks.</p>"
          : '<div class="gn-wheel-wrap" id="gn-wheel-wrap" data-spinning="false" data-weights="' + weights + '">' +
              '<div class="gn-pointer" aria-hidden="true"></div>' +
              '<canvas class="gn-wheel-canvas" id="gn-wheel" width="640" height="640" aria-hidden="true"></canvas>' +
            "</div>" +
            '<p id="gn-wheel-status" class="gn-note" role="status">' + ctx.escapeHtml(wheelChanceText(games)) + "</p>" +
            '<div id="gn-wheel-result" hidden></div>' +
            '<div class="gn-actions">' +
              '<button type="button" class="gn-primary" id="gn-spin">Spin</button>' +
              '<button type="button" class="gn-btn" id="gn-respin" hidden>Spin again</button>' +
              '<button type="button" class="gn-btn" id="gn-drop" hidden>Remove winner and spin again</button>' +
            "</div>" +
            poolNote)
      );
    }

    var NAMES_KEY = "bgq_night_names";

    function recentNames() {
      try {
        var list = JSON.parse(localStorage.getItem(NAMES_KEY) || "[]");
        return Array.isArray(list) ? list.map(cleanName).filter(Boolean).slice(0, 12) : [];
      } catch (err) {
        return [];
      }
    }

    function rememberName(name) {
      var clean = cleanName(name);
      if (!clean) return;
      var list = recentNames().filter(function (item) { return item.toLowerCase() !== clean.toLowerCase(); });
      list.unshift(clean);
      try { localStorage.setItem(NAMES_KEY, JSON.stringify(list.slice(0, 12))); } catch (err) {}
    }

    function namesHtml() {
      var roster = decision.roster || [];
      var recent = recentNames().filter(function (name) {
        return !roster.some(function (have) { return have.toLowerCase() === name.toLowerCase(); });
      });
      var rows = roster.map(function (name) {
        return '<li class="gn-row"><span class="gn-name">' + ctx.escapeHtml(name) + "</span>" +
          '<button type="button" data-drop-name="' + ctx.escapeHtml(name) + '" aria-label="Remove ' + ctx.escapeHtml(name) + '">Remove</button></li>';
      }).join("");
      var chips = recent.map(function (name) {
        return '<button type="button" class="gn-chip" data-recent-name="' + ctx.escapeHtml(name) + '">' + ctx.escapeHtml(name) + "</button>";
      }).join("");
      var per = decision.per || 2;
      return (
        "<h3>Everyone picks</h3>" +
        "<p>Add each person, then pass the phone. Each person adds their own games.</p>" +
        '<div class="gn-name-row">' +
          '<label class="gn-field">Name' +
            '<input id="gn-player-name" type="text" maxlength="24" autocomplete="name" enterkeyhint="done" placeholder="Sam">' +
          "</label>" +
          '<button type="button" class="gn-btn" id="gn-name-add">Add name</button>' +
        "</div>" +
        (chips ? '<div class="gn-chips" aria-label="Recent names">' + chips + "</div>" : "") +
        '<ul class="gn-list">' + (rows || '<li class="gn-note">No names yet.</li>') + "</ul>" +
        '<div class="gn-facet">' +
          '<span class="gn-facet-label" id="gn-per-label">Picks per person</span>' +
          '<div class="gn-chips" role="group" aria-labelledby="gn-per-label">' +
            chipPer(1, per) + chipPer(2, per) + chipPer(3, per) +
          "</div>" +
        "</div>" +
        '<div class="gn-actions"><button type="button" class="gn-primary" id="gn-pass-start"' + (roster.length ? "" : " disabled") + ">Start passing the phone</button></div>"
      );
    }

    function chipPer(n, current) {
      var label = n === 1 ? "1 pick" : n + " picks";
      return '<button type="button" class="gn-chip" data-per="' + n + '" aria-pressed="' + (current === n ? "true" : "false") + '" aria-label="' + label + '">' + n + "</button>";
    }

    function joinHtml() {
      var recent = recentNames();
      var chips = recent.map(function (name) {
        return '<button type="button" class="gn-chip" data-recent-name="' + ctx.escapeHtml(name) + '">' + ctx.escapeHtml(name) + "</button>";
      }).join("");
      return (
        '<div class="gn-cover gn-pick-sheet" id="gn-pick-sheet" role="dialog" aria-modal="true" aria-labelledby="gn-join-title">' +
          '<h3 id="gn-join-title">Add my picks</h3>' +
          "<p>Open this link on another phone, add your name, then copy the link back.</p>" +
          '<label class="gn-field">Your name' +
            '<input id="gn-player-name" type="text" maxlength="24" autocomplete="name" enterkeyhint="done">' +
          "</label>" +
          (chips ? '<div class="gn-chips">' + chips + "</div>" : "") +
          '<p id="gn-join-note" class="gn-note" role="status"></p>' +
          '<div class="gn-actions">' +
            '<button type="button" class="gn-primary" id="gn-join-next">Next</button>' +
            '<button type="button" class="gn-btn" id="gn-join-back">Back to the wheel</button>' +
          "</div>" +
        "</div>"
      );
    }

    function passCoverHtml() {
      var name = currentPickerName();
      return (
        '<div class="gn-cover" id="gn-cover" role="dialog" aria-modal="true" aria-labelledby="gn-cover-title">' +
          '<h3 id="gn-cover-title">Pass the phone</h3>' +
          "<p>Hand this phone to " + ctx.escapeHtml(name) + ". Picks stay hidden until you hand it over.</p>" +
          '<button type="button" class="gn-primary" id="gn-ready">' + ctx.escapeHtml(name) + " is ready</button>" +
        "</div>"
      );
    }

    function currentPickerName() {
      if (decision.picker) return decision.picker;
      var roster = (state.pool && state.pool.roster) || [];
      return roster[decision.rosterIndex] || "";
    }

    function pickHtml() {
      var name = currentPickerName();
      var per = (state.pool && state.pool.per) || decision.per || 2;
      var chosen = (decision.draft || []).map(function (slug, index) {
        var game = bySlug[slug];
        return "<li>" + ctx.escapeHtml(game ? game.name : slug) + "</li>";
      }).join("");
      var ready = (decision.draft || []).length >= per;
      return (
        '<div class="gn-cover gn-pick-sheet" id="gn-pick-sheet" role="dialog" aria-modal="true" aria-labelledby="gn-pick-title">' +
          '<h3 id="gn-pick-title">' + ctx.escapeHtml(name) + "</h3>" +
          "<p>Add " + per + (per === 1 ? " pick" : " picks") + ". Search any game, or choose a suggestion.</p>" +
          (chosen ? '<ol class="gn-ranked" id="gn-my-picks">' + chosen + "</ol>" : '<ol class="gn-ranked" id="gn-my-picks" hidden></ol>') +
          '<div class="gn-actions">' +
            '<button type="button" class="gn-btn" id="gn-pick-undo"' + ((decision.draft || []).length ? "" : " disabled") + ">Remove last</button>" +
            '<button type="button" class="gn-btn" id="gn-pick-suggest">Suggest</button>' +
          "</div>" +
          '<label class="gn-field">Search' +
            '<input id="gn-pick-search" type="search" placeholder="Search the catalog" autocomplete="off" enterkeyhint="search" aria-label="Search games to pick">' +
          "</label>" +
          '<ul id="gn-pick-results" class="gn-results"></ul>' +
          '<div class="gn-actions"><button type="button" class="gn-primary" id="gn-pick-done"' + (ready ? "" : " disabled") + ">Done</button></div>" +
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
        drawWheel(canvas, activeWheelGames(), to);
      } else {
        drawWheel(canvas, activeWheelGames(), 0);
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
        var whoLine = (decision.winnerWho || []).join(", ");
        var why = whoLine ? "Picked by " + whoLine + "." : "Picked by the wheel.";
        canvas.style.transition = "none";
        canvas.style.transform = "none";
        drawWheel(canvas, activeWheelGames(), decision.rotation || 0);
        if (wrap && wrap.isConnected) wrap.setAttribute("data-weights", wheelWeights(activeWheelGames()).join(","));
        var box = document.getElementById("gn-wheel-result");
        if (box) {
          box.hidden = false;
          box.innerHTML = resultHtml(bySlug[game.slug] || game, why);
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
      var games = activeWheelGames();
      if (games.length < 2) {
        if (games.length === 1) showResult(bySlug[games[0].slug], "Only one nominee left.", "", "wheel");
        return;
      }
      var weights = wheelWeights(games);
      var index = weightedIndex(weights);
      var from = decision.rotation || 0;
      var to = landingRotation(index, weights, from, motionOK() ? 5 : 0);
      decision.winner = games[index].slug;
      decision.rotation = to;
      decision.winnerWho = games[index].who || [];
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
      runSpin(canvas, from, to, bySlug[games[index].slug] || games[index]);
    }

    function dropWinner() {
      if (!decision || !decision.winner) return;
      var removed = decision.winner;
      var next = state.games.filter(function (slug) { return slug !== removed; });
      if (state.pool) {
        state.pool.picks = state.pool.picks.filter(function (pick) { return pick.slug !== removed; });
      }
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
      var sheet = decision && decision.type === "wheel" && (decision.phase === "cover" || decision.phase === "pick" || decision.phase === "join");
      var cover = (decision && decision.type === "vote" && decision.phase === "cover") || sheet;
      document.body.style.overflow = cover ? "hidden" : "";
      if (decision && decision.type === "wheel" && decision.phase !== "names" && decision.phase !== "cover" && decision.phase !== "pick" && decision.phase !== "join") {
        var canvas = document.getElementById("gn-wheel");
        if (canvas) {
          canvas.style.transition = "none";
          canvas.style.transform = "none";
          drawWheel(canvas, activeWheelGames(), decision.rotation || 0);
        }
      }
      bindPickSheet();
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

    function freshWheel() {
      return {
        type: "wheel",
        source: "wheel",
        phase: "spin",
        rotation: 0,
        winner: "",
        winnerWho: [],
        spinning: false,
        draft: [],
        suggestions: [],
        pickQuery: "",
        roster: [],
        per: state.pool && state.pool.per ? state.pool.per : 2,
        rosterIndex: 0,
        picker: "",
        single: false
      };
    }

    function openEveryone() {
      if (!decision || decision.type !== "wheel") decision = freshWheel();
      decision.phase = "names";
      decision.roster = state.pool ? state.pool.roster.slice() : [];
      decision.per = state.pool && state.pool.per ? state.pool.per : 2;
      decision.picker = "";
      decision.single = false;
      paintPanel(false);
    }

    function addRosterName(raw) {
      var name = cleanName(raw);
      if (!name) return;
      decision.roster = decision.roster || [];
      var exists = decision.roster.some(function (have) { return have.toLowerCase() === name.toLowerCase(); });
      if (!exists && decision.roster.length < 12) decision.roster.push(name);
      rememberName(name);
      paintPanel(false);
    }

    function addRosterFromInput() {
      var input = document.getElementById("gn-player-name");
      addRosterName(input ? input.value : "");
      if (input) input.value = "";
    }

    function useRecentName(name) {
      if (decision.phase === "join") {
        var input = document.getElementById("gn-player-name");
        if (input) input.value = name;
        beginJoin(name);
        return;
      }
      addRosterName(name);
    }

    function dropRosterName(name) {
      decision.roster = (decision.roster || []).filter(function (have) { return have !== name; });
      paintPanel(false);
    }

    function picksFor(name) {
      if (!state.pool) return [];
      return state.pool.picks.filter(function (pick) { return pick.name.toLowerCase() === name.toLowerCase(); });
    }

    function beginPassing() {
      if (!decision.roster || !decision.roster.length) return;
      state.pool = {
        roster: decision.roster.slice(),
        per: decision.per || 2,
        dup: !state.pool || state.pool.dup !== false,
        picks: []
      };
      state.games = [];
      decision.single = false;
      decision.rosterIndex = 0;
      decision.picker = state.pool.roster[0];
      decision.phase = "cover";
      paintNominees();
      paintResults();
      syncUrl();
      paintPanel(false);
    }

    function beginJoin(preset) {
      var input = document.getElementById("gn-player-name");
      var name = cleanName(preset || (input ? input.value : ""));
      var note = document.getElementById("gn-join-note");
      if (!name) {
        if (note) note.textContent = "Type a name first.";
        return;
      }
      if (!state.pool) state.pool = { roster: [], per: 2, dup: true, picks: [] };
      var per = state.pool.per || 2;
      if (picksFor(name).length >= per) {
        if (note) note.textContent = name + " already added " + per + (per === 1 ? " pick" : " picks") + ".";
        return;
      }
      var known = state.pool.roster.some(function (have) { return have.toLowerCase() === name.toLowerCase(); });
      if (!known) state.pool.roster.push(name);
      rememberName(name);
      decision.single = true;
      decision.picker = name;
      decision.draft = picksFor(name).map(function (pick) { return pick.slug; });
      state.pool.picks = state.pool.picks.filter(function (pick) { return pick.name.toLowerCase() !== name.toLowerCase(); });
      decision.pickQuery = "";
      decision.suggestions = [];
      decision.phase = "pick";
      syncUrl();
      paintPanel(false);
    }

    function fillSuggestions() {
      var have = {};
      (decision.draft || []).forEach(function (slug) { have[slug] = true; });
      var matches = ctx.games.filter(function (game) { return fits(game) && !have[game.slug]; });
      decision.suggestions = orderForSuggest(matches, isBestAt).slice(0, 8).map(function (game) { return game.slug; });
      decision.pickQuery = "";
      var search = document.getElementById("gn-pick-search");
      if (search) search.value = "";
      paintPickResults();
    }

    function undoDraft() {
      if (!decision.draft || !decision.draft.length) return;
      decision.draft.pop();
      paintPanel(false);
    }

    function addDraft(slug) {
      if (!bySlug[slug]) return;
      decision.draft = decision.draft || [];
      var per = (state.pool && state.pool.per) || decision.per || 2;
      if (decision.draft.length >= per) return;
      if (decision.draft.indexOf(slug) !== -1) return;
      decision.draft.push(slug);
      paintPanel(false);
    }

    function commitPicks() {
      var name = decision.picker || currentPickerName();
      var per = (state.pool && state.pool.per) || 2;
      if (!state.pool || !name || (decision.draft || []).length < per) return;
      decision.draft.forEach(function (slug) {
        state.pool.picks.push({ name: name, slug: slug });
      });
      rememberName(name);
      var seen = {};
      var games = [];
      state.pool.picks.forEach(function (pick) {
        if (seen[pick.slug] || games.length >= MAX_NOMINEES) return;
        seen[pick.slug] = true;
        games.push(pick.slug);
      });
      state.games = games;
      decision.draft = [];
      decision.winner = "";
      decision.rotation = 0;
      paintNominees();
      paintResults();
      syncUrl();
      if (decision.single) {
        decision.single = false;
        decision.phase = "spin";
        decision.picker = "";
        paintPanel(true);
        return;
      }
      var next = decision.rosterIndex + 1;
      if (next >= state.pool.roster.length) {
        decision.phase = "spin";
        decision.picker = "";
        paintPanel(true);
        return;
      }
      decision.rosterIndex = next;
      decision.picker = state.pool.roster[next];
      decision.phase = "cover";
      paintPanel(false);
    }

    function toggleDup() {
      if (!state.pool) return;
      state.pool.dup = state.pool.dup === false;
      decision.winner = "";
      decision.rotation = 0;
      syncUrl();
      paintPanel(false);
    }

    function paintPickResults() {
      var list = document.getElementById("gn-pick-results");
      if (!list) return;
      var q = String(decision.pickQuery || "").trim().toLowerCase();
      var have = {};
      (decision.draft || []).forEach(function (slug) { have[slug] = true; });
      var rows = [];
      if (q) {
        ctx.games.forEach(function (game) {
          if (have[game.slug] || rows.length >= 8) return;
          var named = String(game.name || "").toLowerCase().indexOf(q) !== -1;
          var alias = Array.isArray(game.aliases) && game.aliases.some(function (item) {
            return String(item || "").toLowerCase().indexOf(q) !== -1;
          });
          if (named || alias) rows.push(game);
        });
      } else {
        (decision.suggestions || []).forEach(function (slug) {
          if (have[slug] || !bySlug[slug]) return;
          rows.push(bySlug[slug]);
        });
      }
      if (!rows.length) {
        list.innerHTML = '<li class="gn-note">' + (q ? "No games match that search." : "Tap Suggest, or search for a game.") + "</li>";
        return;
      }
      list.innerHTML = rows.map(function (game) {
        return '<li class="gn-row"><span class="gn-name">' + ctx.escapeHtml(game.name) + "</span>" +
          '<button type="button" data-pick-slug="' + ctx.escapeHtml(game.slug) + '" aria-label="Pick ' + ctx.escapeHtml(game.name) + '">Add</button></li>';
      }).join("");
    }

    function bindPickSheet() {
      var search = document.getElementById("gn-pick-search");
      if (search && !search.dataset.bound) {
        search.dataset.bound = "1";
        search.value = decision.pickQuery || "";
        search.addEventListener("input", function () {
          decision.pickQuery = search.value;
          paintPickResults();
        });
      }
      if (document.getElementById("gn-pick-results")) paintPickResults();
      var nameInput = document.getElementById("gn-player-name");
      if (nameInput && !nameInput.dataset.bound) {
        nameInput.dataset.bound = "1";
        nameInput.addEventListener("keydown", function (event) {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (decision.phase === "join") beginJoin();
          else addRosterFromInput();
        });
      }
    }

    function onPanelClick(event) {
      var btn = event.target.closest ? event.target.closest("button") : null;
      if (!btn) return;
      var id = btn.id;
      if (btn.disabled) return;
      if (id === "gn-spin" || id === "gn-respin") { spin(); return; }
      if (id === "gn-everyone") { openEveryone(); return; }
      if (id === "gn-name-add") { addRosterFromInput(); return; }
      if (id === "gn-pass-start") { beginPassing(); return; }
      if (id === "gn-pick-suggest") { fillSuggestions(); return; }
      if (id === "gn-pick-undo") { undoDraft(); return; }
      if (id === "gn-pick-done") { commitPicks(); return; }
      if (id === "gn-join") { decision.phase = "join"; decision.picker = ""; paintPanel(false); return; }
      if (id === "gn-join-back") { decision.phase = "spin"; paintPanel(false); return; }
      if (id === "gn-join-next") { beginJoin(); return; }
      if (id === "gn-dup") { toggleDup(); return; }
      if (btn.hasAttribute("data-per")) { decision.per = parseInt(btn.getAttribute("data-per"), 10) || 2; paintPanel(false); return; }
      if (btn.hasAttribute("data-recent-name")) { useRecentName(btn.getAttribute("data-recent-name")); return; }
      if (btn.hasAttribute("data-drop-name")) { dropRosterName(btn.getAttribute("data-drop-name")); return; }
      if (btn.hasAttribute("data-pick-slug")) { addDraft(btn.getAttribute("data-pick-slug")); return; }
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
        if (decision.type === "wheel") {
          decision.phase = "pick";
          decision.picker = currentPickerName();
          decision.draft = [];
          decision.pickQuery = "";
          decision.suggestions = [];
          paintPanel(false);
          return;
        }
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
      if (btn.id === "gn-pack") {
        if (typeof ctx.packForNight === "function") ctx.packForNight(state.games.slice());
        return;
      }
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
      else if (facet === "who") {
        var at = state.who.indexOf(value);
        if (at === -1) state.who.push(value);
        else state.who.splice(at, 1);
        state.who = cleanWho(state.who.join(","));
      } else return;
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
    landingRotation: landingRotation,
    groupPicks: groupPicks,
    weightedIndex: weightedIndex
  };
})();
