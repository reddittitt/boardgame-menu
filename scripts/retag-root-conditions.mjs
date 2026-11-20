/* Retag Root (and a few expansion-heavy collection games) Set up / Finish
   bullets that already name a faction, expansion, player count, or variant. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const start = html.indexOf('<script id="games-json"');
const open = html.indexOf(">", start) + 1;
const close = html.indexOf("</script>", open);
const catalog = JSON.parse(html.slice(open, close));
const enrich = catalog.enrich;

const ROOT_FACTIONS = [
  ["Marquise de Cat", /\bMarquise\b/i],
  ["Eyrie Dynasties", /\bEyrie\b/i],
  ["Woodland Alliance", /\b(?:Woodland )?Alliance\b|\bSympathy\b/i],
  ["Vagabond", /\bVagabond\b/i],
  ["Lizard Cult", /\bLizard/i],
  ["Riverfolk Company", /\bRiverfolk\b|\bfunds\b|\btrade post/i],
  ["Underground Duchy", /\bDuchy\b/i],
  ["Corvid Conspiracy", /\bCorvid/i],
  ["Lord of the Hundreds", /\bHundreds\b/i],
  ["Keepers in Iron", /\bKeepers\b/i],
  ["Lilypad Diaspora", /\bLilypad\b/i],
  ["Twilight Council", /\bTwilight\b/i],
  ["Knaves of the Deepwood", /\bKnaves\b/i]
];

function blob(item) {
  return [item.lead, item.text].filter(Boolean).join(" ");
}

function tagFaction(item, allowed) {
  if (!item || typeof item !== "object") return item;
  if (item.faction || (item.when && item.when.faction)) return item;
  const text = blob(item);
  const hits = ROOT_FACTIONS.filter(([, re]) => re.test(text)).map(([name]) => name)
    .filter((name) => !allowed || allowed.has(name));
  if (hits.length === 1) {
    item.faction = hits;
  }
  if (Array.isArray(item.bullets)) item.bullets.forEach((child) => tagFaction(child, allowed));
  return item;
}

function tagVariant(item, id) {
  if (!item || typeof item !== "object") return item;
  item.variant = [id];
  if (Array.isArray(item.bullets)) item.bullets.forEach((child) => tagVariant(child, id));
  return item;
}

function tagPlayers(item, min, max) {
  if (!item || typeof item !== "object") return item;
  item.players = { min: min, max: max };
  if (Array.isArray(item.bullets)) item.bullets.forEach((child) => tagPlayers(child, min, max));
  return item;
}

function walkSection(value, fn) {
  if (!value) return value;
  if (Array.isArray(value)) return value.map((item) => walkSection(item, fn));
  if (typeof value === "object") {
    fn(value);
    if (Array.isArray(value.bullets)) value.bullets = value.bullets.map((item) => walkSection(item, fn));
    if (value.details) value.details = walkSection(value.details, fn);
  }
  return value;
}

const game = enrich.root;
if (!game) throw new Error("root missing");

// Expansion setup/scoring: tag faction-specific lines
const expansionFactions = {
  "Riverfolk Expansion": new Set(["Lizard Cult", "Riverfolk Company", "Vagabond"]),
  "Underworld Expansion": new Set(["Underground Duchy", "Corvid Conspiracy"]),
  "Marauder Expansion": new Set(["Lord of the Hundreds", "Keepers in Iron"]),
  "Homeland Expansion": new Set(["Lilypad Diaspora", "Twilight Council", "Knaves of the Deepwood"])
};

let tagged = 0;
(game.expansions || []).forEach((exp) => {
  const allowed = expansionFactions[exp.name];
  ["setup", "scoring", "rules", "reminders", "quickStart"].forEach((field) => {
    if (!exp[field]) return;
    const before = JSON.stringify(exp[field]);
    walkSection(exp[field], (item) => tagFaction(item, allowed));
    if (JSON.stringify(exp[field]) !== before) tagged += 1;
  });
});

// Setup variants: tag bullets with their variant id
(game.setupVariants || []).forEach((variant) => {
  if (!variant.setup) return;
  const before = JSON.stringify(variant.setup);
  walkSection(variant.setup, (item) => {
    if (!item.variant) item.variant = [variant.id];
  });
  // Standard mentions hirelings/landmarks belonging to Advanced — keep visible on standard
  if (JSON.stringify(variant.setup) !== before) tagged += 1;
});

// Player-count blocks: tag every bullet with that count so the shared engine can filter
Object.keys(game.setupByPlayerCount || {}).forEach((count) => {
  const n = Number(count);
  const block = game.setupByPlayerCount[count];
  const before = JSON.stringify(block);
  walkSection(block, (item) => {
    if (!item.players) item.players = { min: n, max: n };
  });
  if (JSON.stringify(block) !== before) tagged += 1;
});

// Wingspan Europe/Oceania already gated by chips; tag Americas/Asia scoring lines that name nectar? skip inventing.

enrich.root = game;

// 7 Wonders Duel Pantheon/Agora: no faction tags needed

const next = JSON.stringify(catalog);
html = html.slice(0, open) + next + html.slice(close);
fs.writeFileSync(htmlPath, html);
console.log(JSON.stringify({ rootSectionsTagged: tagged }, null, 2));
