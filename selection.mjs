/* Shared selection condition engine for game-page sections.
   Items may carry when:{expansion,faction,players,variant} (or the same
   keys at the top level). Untagged items always match. */

export function asList(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map(function (v) { return String(v || "").trim(); }).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

export function readCondition(item) {
  if (!item || typeof item !== "object") return null;
  var src = item.when && typeof item.when === "object" ? item.when : item;
  var expansion = asList(src.expansion);
  var faction = asList(src.faction);
  var variant = asList(src.variant);
  var players = src.players;
  var hasPlayers = false;
  var min = null;
  var max = null;
  if (players != null && typeof players === "object" && !Array.isArray(players)) {
    if (players.min != null && players.min !== "") {
      min = Number(players.min);
      hasPlayers = true;
    }
    if (players.max != null && players.max !== "") {
      max = Number(players.max);
      hasPlayers = true;
    }
  } else if (typeof players === "number" || (typeof players === "string" && String(players).trim())) {
    min = max = Number(players);
    hasPlayers = true;
  }
  if (!expansion.length && !faction.length && !variant.length && !hasPlayers) return null;
  return {
    expansion: expansion,
    faction: faction,
    variant: variant,
    players: hasPlayers ? { min: min, max: max } : null
  };
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function listHas(selected, wanted) {
  if (!wanted.length) return true;
  var set = {};
  (selected || []).forEach(function (name) { set[norm(name)] = true; });
  return wanted.some(function (name) { return set[norm(name)]; });
}

export function matchesSelection(item, selection) {
  selection = selection || {};
  if (selection.showAll) return true;
  var cond = readCondition(item);
  if (!cond) return true;

  if (cond.expansion.length) {
    if (!listHas(selection.expansions || selection.exps || [], cond.expansion)) return false;
  }

  if (cond.faction.length) {
    var factions = selection.factions || selection.chars || [];
    if (factions.length && !listHas(factions, cond.faction)) return false;
  }

  if (cond.variant.length) {
    var variants = selection.variants || [];
    if (selection.variant) variants = variants.concat([selection.variant]);
    if (!listHas(variants, cond.variant)) return false;
  }

  if (cond.players) {
    var count = selection.players != null ? selection.players : selection.count;
    if (count == null || count === "") return false;
    var n = Number(count);
    if (!isFinite(n)) return false;
    if (cond.players.min != null && isFinite(cond.players.min) && n < cond.players.min) return false;
    if (cond.players.max != null && isFinite(cond.players.max) && n > cond.players.max) return false;
  }

  return true;
}

export function filterBySelection(items, selection) {
  return (Array.isArray(items) ? items : []).filter(function (item) {
    return matchesSelection(item, selection);
  });
}

export function filterContentTree(value, selection) {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return filterContentTree(item, selection);
    }).filter(function (item) {
      if (item == null || item === "") return false;
      if (typeof item === "string") return true;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") {
        if (!matchesSelection(item, selection)) return false;
        var hasText = !!(item.lead || item.text);
        var hasBullets = Array.isArray(item.bullets) && item.bullets.length;
        var hasDetails = item.details != null && item.details !== "";
        return hasText || hasBullets || hasDetails;
      }
      return true;
    });
  }
  if (typeof value === "object") {
    if (!matchesSelection(value, selection)) return null;
    var out = {};
    Object.keys(value).forEach(function (key) {
      if (key === "when" || key === "expansion" || key === "faction" || key === "variant" || key === "players") {
        out[key] = value[key];
        return;
      }
      if (key === "bullets" || key === "details") {
        out[key] = filterContentTree(value[key], selection);
        return;
      }
      out[key] = value[key];
    });
    if (Array.isArray(out.bullets) && !out.bullets.length) delete out.bullets;
    if (out.details == null || out.details === "" || (Array.isArray(out.details) && !out.details.length)) {
      delete out.details;
    }
    return out;
  }
  return value;
}

export function showingForLabel(selection, opts) {
  opts = opts || {};
  if (!selection || selection.showAll) return "Showing everything";
  var parts = [];
  var count = selection.players != null ? selection.players : selection.count;
  if (count != null && String(count) !== "") {
    parts.push(String(count) + " players");
  }
  var factions = selection.factions || selection.chars || [];
  if (factions.length) parts.push(factions.join(", "));
  var exps = selection.expansions || selection.exps || [];
  if (exps.length) {
    var short = exps.map(function (name) {
      return String(name || "").replace(/\s+Expansion$/i, "").trim() || name;
    });
    parts.push(short.join(", "));
  }
  var variant = selection.variant || (selection.variants && selection.variants[0]);
  if (variant && opts.variantLabels && opts.variantLabels[variant]) {
    parts.push(opts.variantLabels[variant]);
  } else if (variant) {
    parts.push(String(variant));
  }
  if (!parts.length) return "";
  return "Showing for: " + parts.join(" · ");
}
