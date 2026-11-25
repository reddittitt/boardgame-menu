/* Component checklists quote their counts from a rulebook file or a BoardGameGeek line.
   Run: node tests/components.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractWiki, norm } from "../scripts/extract-components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function quoted(count, line) {
  const text = norm(line);
  const token = norm(count);
  if (!token) return false;
  if (/\d/.test(token)) return text.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^A-Za-z])" + escaped + "([^A-Za-z]|$)").test(text);
}

const data = JSON.parse(read("components.json"));
const html = read("index.html");
const match = html.match(/<script id="games-json"[^>]*>([\s\S]*?)<\/script>/);
const catalog = JSON.parse(match[1]);
const mine = new Set();
catalog.names.forEach(function (name) {
  const slug = name.toLowerCase().replace(/[:'"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (catalog.enrich[slug] && catalog.enrich[slug].mine === true) mine.add(slug);
});

let collection = 0;
let collectionRulebook = 0;
let collectionBgg = 0;
let others = 0;
Object.keys(data).forEach(function (slug) {
  const entry = data[slug];
  assert(entry.source === "rulebook" || entry.source === "bgg", slug + " source");
  assert(Array.isArray(entry.items) && entry.items.length >= 2, slug + " items");
  if (entry.source === "bgg") {
    assert(/BoardGameGeek/.test(entry.label), slug + " bgg label");
    assert(/^\d+$/.test(entry.bggId), slug + " bgg id");
  } else {
    assert(entry.origin.indexOf("rulebooks/") === 0, slug + " origin");
    const book = JSON.parse(read(entry.origin));
    const lines = new Set();
    book.pages.forEach(function (page) {
      (page.lines || []).forEach(function (line) { lines.add(norm(line)); });
    });
    entry.items.forEach(function (item) {
      item.lines.forEach(function (line) {
        assert(lines.has(norm(line)), slug + " line not in rulebook: " + line.slice(0, 80));
      });
    });
  }
  entry.items.forEach(function (item) {
    assert(quoted(item.count, item.lines[0]), slug + " count " + item.count + " not quoted");
    assert(!/\bCody\b/.test(item.name), slug + " names a person");
  });
  if (mine.has(slug)) {
    collection += 1;
    if (entry.source === "rulebook") collectionRulebook += 1;
    else collectionBgg += 1;
  } else {
    others += 1;
  }
});

assert(data.cascadia && data.cascadia.source === "rulebook", "cascadia rulebook");
assert(data.cascadia.items.some(function (item) { return item.count === "85" && /Habitat Tiles/.test(item.name); }), "cascadia 85");
assert(data.hive.expansions["Hive: The Mosquito"].items.some((item) => item.count === "1" && item.name === "white Mosquito" && item.expansion[0] === "Hive: The Mosquito"), "hive mosquito tile");
assert(data["blood-rage"].source === "bgg" && data["blood-rage"].expansions["Blood Rage: Mystics of Midgard"].items.some((item) => item.count === "10" && /Mystic miniatures/.test(item.name)), "blood rage mystics");
assert(data["war-of-the-ring-second-edition"].expansions["War of the Ring: Lords of Middle-earth"].items.some((item) => item.count === "8" && item.name === "plastic figures"), "lords figures");
assert(data["mage-knight-board-game"].expansions["Mage Knight Board Game: Krang Character Expansion"].bggId === "144763", "krang component list");
assert(data["mage-knight-board-game"].expansions["Mage Knight Board Game: Shades of Tezla Expansion"].items.some((item) => item.count === "24" && item.name === "Faction Tokens"), "tezla faction tokens");
assert(data.azul && data.azul.source === "bgg", "azul is the bgg fallback");
assert(/BoardGameGeek/.test(data.azul.label), "azul labeled");
assert(!data["sky-team"], "no checklist without a source");
assert(collection > 0 && others > 0, "both groups");

const wiki = extractWiki("<p><strong>Components</strong></p><ul><li>85 Habitat Tiles</li><li>1 Cloth Bag</li><li>5 Starter tiles</li></ul><p>FAQ</p><ul><li>9 Ignore this</li></ul>");
assert(wiki && wiki.items.length === 3, "wiki parser stops at the next section");
assert(wiki.items[0].count === "85" && wiki.items[0].name === "Habitat Tiles", "wiki count");

const sw = read("sw.js");
assert(/var VERSION = "2026\.11\.21\.14";/.test(sw), "service worker version");
assert(sw.includes("./components.json"), "components.json is a shell file");
const fetchAt = sw.indexOf('addEventListener("fetch"');
const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
const respondAt = sw.indexOf("respondWith", fetchAt);
assert(originAt > fetchAt && originAt < respondAt, "cross-origin still returns first");
assert(html.includes("bgqPieces:") && html.includes('class="piece-check"') === false && html.includes("piece-check"), "checklist hook");
assert(html.includes("From BoardGameGeek."), "bgg label is shown");
const pieceStart = html.indexOf("function loadPieceCatalog");
const pieceEnd = html.indexOf("function paintExpansionGuide", pieceStart);
const pieceBlock = pieceStart > 0 ? html.slice(pieceStart, pieceEnd > pieceStart ? pieceEnd : pieceStart + 20000) : "";
assert(pieceBlock.includes("function mountPieceCheck"), "piece-check renderer");
assert(!/\bCody\b/.test(pieceBlock), "checklist renderer does not name the owner");
assert(!html.includes("Owned by"), "no Owned by line");

console.log(JSON.stringify({
  collection: collection,
  collectionRulebook: collectionRulebook,
  collectionBgg: collectionBgg,
  others: others,
  failures: failures.length
}, null, 2));
if (failures.length) {
  console.error(failures.slice(0, 30).join("\n"));
  process.exit(1);
}
