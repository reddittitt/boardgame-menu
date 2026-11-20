/* Tag component rows with faction/expansion conditions and pull expansion
   component lists from BoardGameGeek when a rulebook list is not present.
   Run: node scripts/tag-selection-components.mjs
   Pass --no-bgg to skip the network. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractWiki, slugify } from "./extract-components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "components.json");
const noBgg = process.argv.includes("--no-bgg");

const FACTION_RULES = {
  root: [
    { faction: ["Marquise de Cat"], re: /\bMarquise\b|\bKeep token\b|\bWood tokens\b/i },
    { faction: ["Eyrie Dynasties"], re: /\bEyrie\b|\bRoost\b/i },
    { faction: ["Woodland Alliance"], re: /\bWoodland Alliance\b|\bSympathy\b/i },
    { faction: ["Vagabond"], re: /\bVagabond\b/i },
    { faction: ["Lizard Cult"], re: /\bLizard\b/i },
    { faction: ["Riverfolk Company"], re: /\bRiverfolk\b|\botter/i },
    { faction: ["Underground Duchy"], re: /\bDuchy\b|\bCrown/i },
    { faction: ["Corvid Conspiracy"], re: /\bCorvid\b/i },
    { faction: ["Lord of the Hundreds"], re: /\bHundreds\b/i },
    { faction: ["Keepers in Iron"], re: /\bKeepers\b/i },
    { faction: ["Lilypad Diaspora"], re: /\bLilypad\b/i },
    { faction: ["Twilight Council"], re: /\bTwilight\b/i },
    { faction: ["Knaves of the Deepwood"], re: /\bKnaves\b/i }
  ],
  unmatched: [
    { faction: null, re: /.*/ } // characters tagged later by name match against catalog
  ],
  "spirit-island": []
};

function loadCatalog() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const match = html.match(/<script id="games-json"[^>]*>([\s\S]*?)<\/script>/);
  return JSON.parse(match[1]);
}

function tagItem(slug, item) {
  const rules = FACTION_RULES[slug];
  if (!rules || !rules.length) return item;
  const blob = String(item.name || "");
  // Shared trays that list several sides stay untagged so every table sees them.
  if (/faction (?:boards?|mats?)/i.test(blob) && /,/.test(blob)) {
    const next = Object.assign({}, item);
    delete next.faction;
    return next;
  }
  if (/Mechanical Marquise/i.test(blob) && !/\bMarquise de Cat\b/i.test(blob)) {
    const next = Object.assign({}, item);
    delete next.faction;
    return next;
  }
  for (const rule of rules) {
    if (!rule.faction) continue;
    if (rule.re.test(blob)) {
      return Object.assign({}, item, { faction: rule.faction.slice() });
    }
  }
  const next = Object.assign({}, item);
  delete next.faction;
  return next;
}

function tagBaseItems(slug, entry) {
  if (!entry || !Array.isArray(entry.items)) return entry;
  return Object.assign({}, entry, {
    items: entry.items.map((item) => tagItem(slug, item))
  });
}

async function fetchWiki(id, cache) {
  if (cache[id]) return cache[id];
  const url = "https://api.geekdo.com/api/geekitems?objectid=" + id + "&objecttype=thing&nosession=1";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("BGG " + id + " HTTP " + res.status);
  const data = await res.json();
  const wiki = (data.item && data.item.wiki) || "";
  cache[id] = wiki;
  return wiki;
}

function recordExpansion(name, found, bggId) {
  return {
    source: "bgg",
    label: found.subtitle ? "BoardGameGeek · " + found.subtitle : "BoardGameGeek",
    origin: "",
    page: null,
    bggId: String(bggId || ""),
    items: found.items.map((item) => ({
      count: item.count,
      name: item.name,
      lines: item.lines,
      expansion: [name]
    }))
  };
}

function tagExpansionItems(slug, expansionName, entry) {
  entry.items = entry.items.map((item) => {
    const tagged = tagItem(slug, item);
    if (!tagged.expansion) tagged.expansion = [expansionName];
    return tagged;
  });
  return entry;
}

async function main() {
  const catalog = loadCatalog();
  const data = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const cache = {};
  const priority = [
    "root", "wingspan", "7-wonders-duel", "unmatched", "dune-imperium-uprising",
    "arcs", "oath", "catan", "ticket-to-ride", "sky-team",
    "the-crew-the-quest-for-planet-nine", "spirit-island", "everdell",
    "everdell-the-complete-collection", "cascadia"
  ];

  let taggedBase = 0;
  let expansionLists = 0;

  for (const slug of Object.keys(data)) {
    const before = JSON.stringify(data[slug].items || []);
    data[slug] = tagBaseItems(slug, data[slug]);
    if (JSON.stringify(data[slug].items || []) !== before) taggedBase += 1;
  }

  for (const slug of priority) {
    const game = catalog.enrich[slug];
    if (!game || !data[slug]) continue;
    const expansions = Array.isArray(game.expansions) ? game.expansions : [];
    if (!data[slug].expansions) data[slug].expansions = {};
    for (const exp of expansions) {
      const name = String(exp.name || "").trim();
      const bggId = String(exp.bggId || "").replace(/\D/g, "");
      if (!name) continue;
      if (data[slug].expansions[name] && data[slug].expansions[name].items && data[slug].expansions[name].items.length) {
        data[slug].expansions[name] = tagExpansionItems(slug, name, data[slug].expansions[name]);
        continue;
      }
      if (noBgg || !bggId) continue;
      try {
        const wiki = await fetchWiki(bggId, cache);
        const found = extractWiki(wiki);
        if (!found || !found.items.length) continue;
        data[slug].expansions[name] = tagExpansionItems(slug, name, recordExpansion(name, found, bggId));
        expansionLists += 1;
        console.log("added", slug, name, found.items.length);
      } catch (err) {
        console.error(slug, name, String(err.message || err));
      }
    }
  }

  // Unmatched: tag character-specific rows when the name matches a character chip
  const unmatched = catalog.enrich.unmatched;
  if (unmatched && data.unmatched) {
    const names = (unmatched.characters || []).map((ch) => ch.name);
    data.unmatched.items = data.unmatched.items.map((item) => {
      const hit = names.find((name) => item.name.toLowerCase().includes(String(name).toLowerCase()));
      if (hit) return Object.assign({}, item, { faction: [hit] });
      return item;
    });
  }

  fs.writeFileSync(outPath, JSON.stringify(data) + "\n");
  console.log(JSON.stringify({ taggedBaseGames: taggedBase, expansionLists: expansionLists }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
