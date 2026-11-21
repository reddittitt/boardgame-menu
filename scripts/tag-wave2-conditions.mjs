/* Tag existing Set up / Finish bullets that are already about one player
   count, one faction, or one expansion. The words stay as they are.
   Run: node scripts/tag-wave2-conditions.mjs
   Pass --apply to write index.html. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const start = html.indexOf('<script id="games-json"');
const open = html.indexOf(">", start) + 1;
const close = html.indexOf("</script>", open);
const catalog = JSON.parse(html.slice(open, close));
const enrich = catalog.enrich;
const uncovered = JSON.parse(fs.readFileSync("/cursor/stores/bot/bgquick-patches/pr260-collection-no-selection-aware.json", "utf8"));
const slugs = new Set([
  ...uncovered.has_source_and_chips_but_no_new_tags_or_expansion_lists,
  ...uncovered.no_component_source_chips_may_still_react,
  ...uncovered.base_components_only_nothing_to_condition_on,
  ...uncovered.no_source_nothing_to_condition_on
]);

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const FIELDS = ["quickStart", "endGameScoring", "endOfGame"];

function blob(item) {
  return [item && item.lead, item && item.text].filter(Boolean).join(" ");
}

function hasCondition(item) {
  if (!item || typeof item !== "object") return false;
  return !!(item.expansion || item.faction || item.players || item.variant || (item.when && typeof item.when === "object"));
}

function mentionedCounts(text) {
  const raw = " " + String(text || "").toLowerCase().replace(/[–—]/g, "-") + " ";
  if (/\b(\d+)\s*(?:to|-|or)\s*(\d+)\s*-?\s*players?\b/.test(raw)) return { mixed: true, counts: [] };
  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/.test(raw)) return { mixed: true, counts: [] };
  if (/\botherwise\b|\bor more\b|\beach player count\b|\bper player\b|\bnumber of players\b/.test(raw)) return { mixed: true, counts: [] };
  const found = new Set();
  if (/\bsolo\b/.test(raw)) found.add(1);
  for (let n = 1; n <= 12; n++) {
    const word = WORDS[n];
    const re = new RegExp("\\b(?:" + n + "\\s*-\\s*player|" + n + "\\s+players?|" + word + "\\s*-\\s*player|" + word + "\\s+players?)\\b");
    if (word && re.test(raw)) found.add(n);
  }
  return { mixed: false, counts: [...found] };
}

function leadIsCount(lead, n) {
  const text = String(lead || "").trim();
  if (!text) return false;
  const word = WORDS[n];
  const re = new RegExp("^(?:for |with |at |in an? )?(?:solo|" + n + "(?:\\s*-\\s*player|\\s+players?)|" + word + "(?:\\s*-\\s*player|\\s+players?))$", "i");
  return re.test(text);
}

function textStartsWithCount(text, n) {
  const raw = String(text || "").trim();
  const word = WORDS[n];
  const re = new RegExp("^(?:for |with |at |in an? |a |the )?(?:solo\\b|" + n + "\\s*-\\s*player|" + n + "\\s+players?|" + word + "\\s*-\\s*player|" + word + "\\s+players?)", "i");
  return re.test(raw);
}

function tagPlayers(item, n) {
  if (!item || typeof item !== "object" || hasCondition(item)) return false;
  item.players = { min: n, max: n };
  return true;
}

function walk(value, fn) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, fn));
    return;
  }
  fn(value);
  if (Array.isArray(value.bullets)) value.bullets.forEach((item) => walk(item, fn));
  if (value.details) walk(value.details, fn);
}

const playerTags = [];
const playerCandidates = [];
const expansionCandidates = [];
const factionCandidates = [];

const ROLE_NOT_COUNT = /\bone player (is|who|places|draws|sits|to be|has|takes)\b|\bor (a group|cooperative|teams|two teams|three teams|\d+ teams)\b|\bsolo (or|and)\b|\bthe two players\b|\bone player mat\b|\band cooperative\b/i;

function considerPlayerBullet(slug, where, item) {
  if (!item || typeof item !== "object" || hasCondition(item)) return;
  const text = blob(item);
  if (!text) return;
  const found = mentionedCounts(text);
  if (found.mixed || found.counts.length !== 1) return;
  const n = found.counts[0];
  const focused = leadIsCount(item.lead, n) || textStartsWithCount(item.text, n) || textStartsWithCount(item.lead, n);
  if (!focused) {
    playerCandidates.push({ slug, where, n, text: text.slice(0, 180) });
    return;
  }
  const counts = (enrich[slug] && enrich[slug].setupByPlayerCount) || {};
  if (!Object.prototype.hasOwnProperty.call(counts, String(n)) || ROLE_NOT_COUNT.test(text)) {
    playerCandidates.push({ slug, where, n, text: text.slice(0, 180) });
    return;
  }
  playerTags.push({ slug, where, n, text: text.slice(0, 160) });
  if (apply) tagPlayers(item, n);
}

function expansionAliases(name) {
  const full = String(name || "").trim();
  const aliases = [full];
  const colon = full.split(":").pop().trim();
  if (colon && colon !== full && colon.length >= 6) aliases.push(colon);
  return aliases;
}

function mentions(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:^|[^A-Za-z0-9])" + escaped + "(?:[^A-Za-z0-9]|$)", "i").test(text);
}

slugs.forEach((slug) => {
  const game = enrich[slug];
  if (!game) return;

  Object.keys(game.setupByPlayerCount || {}).forEach((key) => {
    if (!/^\d+$/.test(key)) return;
    const n = Number(key);
    const block = game.setupByPlayerCount[key];
    walk(block, (item) => {
      if (apply && tagPlayers(item, n)) {
        playerTags.push({ slug, where: "setupByPlayerCount." + key, n, text: blob(item).slice(0, 80) });
      } else if (!apply && item && typeof item === "object" && !hasCondition(item) && (item.lead || item.text || item.bullets)) {
        playerTags.push({ slug, where: "setupByPlayerCount." + key, n, text: blob(item).slice(0, 80) });
      }
    });
  });

  FIELDS.forEach((field) => {
    walk(game[field], (item) => considerPlayerBullet(slug, field, item));
  });

  const expansions = (game.expansions || []).map((exp) => exp && exp.name).filter(Boolean);
  function scanExpansion(item, where) {
    if (!item || typeof item !== "object" || hasCondition(item)) return;
    const text = blob(item);
    if (!text) return;
    const hits = [];
    expansions.forEach((name) => {
      const aliases = expansionAliases(name);
      if (aliases.some((alias) => mentions(text, alias))) hits.push(name);
    });
    if (!hits.length) return;
    const host = (/^exp:(.+)\.(setup|scoring|rules|quickStart)$/.exec(where) || [])[1] || "";
    const others = hits.filter((name) => name !== host);
    const cross = others.length === 1 && /\b(if|when|unless)\b/i.test(text) && /\b(also in play|is also)\b/i.test(text);
    expansionCandidates.push({
      slug,
      where,
      hits,
      conditional: cross,
      text: text.slice(0, 200)
    });
    if (cross && apply) item.expansion = [others[0]];
  }
  FIELDS.forEach((field) => walk(game[field], (item) => scanExpansion(item, field)));
  (game.expansions || []).forEach((exp) => {
    ["setup", "scoring", "rules", "quickStart"].forEach((field) => {
      walk(exp[field], (item) => scanExpansion(item, "exp:" + exp.name + "." + field));
    });
  });

  const characters = (game.characters || []).map((ch) => ch && ch.name).filter((name) => name && name.length >= 4);
  function scanFaction(item, where) {
    if (!item || typeof item !== "object" || hasCondition(item)) return;
    if (where.indexOf("char:") === 0) return;
    const text = blob(item);
    if (!text || /\bwins?\b/i.test(text)) return;
    const hits = characters.filter((name) => mentions(text, name));
    if (hits.length !== 1) return;
    const name = hits[0];
    const lead = String(item.lead || "").trim();
    const role = lead.toLowerCase() === name.toLowerCase() || /^(one player is|the other( player)? is)\b/i.test(text);
    if (!role) return;
    factionCandidates.push({ slug, where, faction: name, text: text.slice(0, 200) });
    if (apply) item.faction = [name];
  }
  FIELDS.forEach((field) => walk(game[field], (item) => scanFaction(item, field)));
  (game.characters || []).forEach((ch) => {
    walk(ch.setup, (item) => scanFaction(item, "char:" + ch.name));
  });
});

const bySlug = {};
playerTags.forEach((row) => {
  if (row.where.indexOf("setupByPlayerCount") !== 0) {
    bySlug[row.slug] = bySlug[row.slug] || { pcBlocks: 0, pcBullets: [] };
  }
});
const pcBlockGames = new Set(playerTags.filter((row) => row.where.indexOf("setupByPlayerCount") === 0).map((row) => row.slug));
const pcBulletGames = playerTags.filter((row) => row.where.indexOf("setupByPlayerCount") !== 0);

console.log(JSON.stringify({
  apply,
  pcBlockGames: pcBlockGames.size,
  pcBlockObjects: playerTags.filter((row) => row.where.indexOf("setupByPlayerCount") === 0).length,
  focusedBullets: pcBulletGames.length,
  unfocusedCandidates: playerCandidates.length,
  expansionCandidates: expansionCandidates.length,
  factionCandidates: factionCandidates.length
}, null, 2));

console.log("\n## FOCUSED PLAYER BULLETS");
pcBulletGames.forEach((row) => console.log(row.slug, row.where, row.n, "|", row.text));
console.log("\n## UNFOCUSED (not tagged)");
playerCandidates.slice(0, 80).forEach((row) => console.log(row.slug, row.where, row.n, "|", row.text));
console.log("\n## EXPANSION CANDIDATES");
expansionCandidates.forEach((row) => console.log((row.conditional ? "COND" : "ment"), row.slug, row.where, row.hits.join(" + "), "|", row.text));
console.log("\n## FACTION CANDIDATES");
factionCandidates.forEach((row) => console.log(row.slug, row.where, row.faction, "|", row.text));

if (apply) {
  const next = "\n" + JSON.stringify(catalog, null, 2) + "\n";
  const updated = html.slice(0, open) + next + html.slice(close);
  fs.writeFileSync(htmlPath, updated);
  console.log("\nwrote index.html");
}
