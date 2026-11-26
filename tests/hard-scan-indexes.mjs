/* Hard-scan rulebook indexes.

   scripts/build-rulebook-ocr --tuned reads a scanned PDF at a higher
   resolution, straightens a sideways page, and stretches contrast before
   Tesseract. The derived files are rulebooks/ocr/<slug>.json (word boxes)
   and rulebooks/index/<slug>.json (search lines). A Rulebook chip on one
   of these games has to quote words that occur once on that page of the
   OCR, and those words have to be in the bullet. Page numbers come from
   that read. The PDF is not stored here.

   node tests/hard-scan-indexes.mjs
*/
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("function foldSearchChar");
const end = html.indexOf("var rulebookViewerToken");
if (start < 0 || end < start) throw new Error("could not find the search functions");
const sandbox = { Math, String, Object, isFinite, Number };
vm.createContext(sandbox);
vm.runInContext(html.slice(start, end) + "\nthis.api = { searchMatchRanges };", sandbox);
const api = sandbox.api;

const failures = [];
function assert(cond, message) {
  if (!cond) failures.push(message);
}

const raw = html.slice(html.indexOf('<script id="games-json"'));
const data = JSON.parse(raw.slice(raw.indexOf(">") + 1, raw.indexOf("</script>")));

const slugs = [
  "survive-the-island",
  "suburbia",
  "clue-master-detective",
  "maracaibo",
  "smash-up-awesome-level-9000",
  "smash-up-big-in-japan",
  "smash-up-its-your-fault",
  "smash-up-monster-smash",
  "smash-up-oops-you-did-it-again",
  "smash-up-science-fiction-double-feature",
  "smash-up-what-were-we-thinking",
  "smash-up-marvel",
  "flip-city",
  "steam-park"
];

// Quotes already on the page before this pass. They are verbatim lines from
// the booklet, not a window cut from the bullet.
const legacyQueries = new Set([
  "sharks and kaijus will be added",
  "the game ends as soon as 3 volcanoes are revealed"
]);

const signatures = [
  ["suburbia", 2, "One More Round"],
  ["suburbia", 2, "Game Setup"],
  ["clue-master-detective", 2, "Brief History"],
  ["clue-master-detective", 8, "Rules for Play"],
  ["maracaibo", 2, "Setup before your first game"],
  ["survive-the-island", 4, "one-space"],
  ["flip-city", 2, "Play Cards"],
  ["steam-park", 2, "Roboburg"],
  ["smash-up-awesome-level-9000", 13, "Bear Cavalry"],
  ["smash-up-big-in-japan", 0, "Magical Girls"],
  ["smash-up-its-your-fault", 0, "Dragons"],
  ["smash-up-monster-smash", 0, "Werewolves"],
  ["smash-up-oops-you-did-it-again", 0, "Explorers"],
  ["smash-up-science-fiction-double-feature", 0, "Dinosaurs"],
  ["smash-up-what-were-we-thinking", 14, "Rock Stars"],
  ["smash-up-marvel", 0, "Marvel"]
];

const floors = {
  "clue-master-detective": { letters: 8000, ratio: 0.7 },
  "flip-city": { letters: 3000, ratio: 0.7 },
  "survive-the-island": { letters: 6000, ratio: 0.7 },
  "steam-park": { letters: 12000, ratio: 0.7 },
  suburbia: { letters: 20000, ratio: 0.75, pages: 12 },
  maracaibo: { letters: 40000, ratio: 0.75, pages: 20 }
};

function compact(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function foldSpace(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function pageBlob(index) {
  return (index.pages || []).map((page) => (page.lines || []).join("\n")).join("\n");
}

function lettersOf(text) {
  return (String(text).match(/[A-Za-z]/g) || []).length;
}

function ratioOf(text) {
  const words = String(text).match(/[A-Za-z']+/g) || [];
  if (!words.length) return 0;
  const ok = words.filter((word) => word.length >= 3 && /[aeiouAEIOU]/.test(word)).length;
  return ok / words.length;
}

function pageRaw(words) {
  let raw = "";
  (words || []).forEach((word) => {
    const text = String(word[4] || "");
    const eol = word[5] === 1;
    raw += eol ? text : text + " ";
    if (eol) raw += "\n";
  });
  return raw;
}

function chips(game) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const src = node.source;
    if (src && src.page && src.query && typeof node.text === "string") {
      out.push({ page: src.page, query: String(src.query), text: node.text });
    }
    Object.keys(node).forEach((key) => {
      if (key !== "source") walk(node[key]);
    });
  }
  walk(game);
  return out;
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "rulebooks", "index", "manifest.json"), "utf8"));
const manifestGames = new Set(manifest.games || []);

for (const slug of slugs) {
  const indexPath = path.join(root, "rulebooks", "index", slug + ".json");
  const ocrPath = path.join(root, "rulebooks", "ocr", slug + ".json");
  assert(fs.existsSync(indexPath), slug + " index missing");
  assert(fs.existsSync(ocrPath), slug + " ocr missing");
  assert(manifestGames.has(slug), slug + " missing from the manifest");
  assert(!fs.existsSync(path.join(root, "rulebooks", slug + ".pdf")) || slug === "survive-the-island", slug + " pdf was committed");
  const game = data.enrich[slug];
  assert(game && game.rulebookSearchable === true, slug + " is not searchable");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const ocr = JSON.parse(fs.readFileSync(ocrPath, "utf8"));
  assert(index.slug === slug && ocr.slug === slug, slug + " file slug");
  const blob = pageBlob(index);
  const floor = floors[slug];
  if (floor) {
    assert(lettersOf(blob) >= floor.letters, slug + " index is still too short");
    assert(ratioOf(blob) >= floor.ratio, slug + " index is still garbled");
    if (floor.pages) assert((index.pages || []).length >= floor.pages, slug + " is missing pages");
  }
  assert(!/least funny/i.test(blob), slug + " still indexes the shared Smash Up booklet");
  assert(!blob.includes("\uFFFD"), slug + " index still has replacement characters");
  const byPage = new Map((ocr.pages || []).map((page) => [page.page, page]));
  for (const page of index.pages || []) {
    const words = byPage.get(page.page);
    assert(words && words.words && words.words.length, slug + " page " + page.page + " has no OCR words");
    if (!words) continue;
    const packed = compact(words.words.map((word) => word[4]).join(" "));
    for (const line of page.lines || []) {
      const key = compact(line);
      if (key.length < 8) continue;
      assert(packed.includes(key), slug + " index line is not on OCR page " + page.page + ": " + line.slice(0, 80));
    }
  }
  for (const chip of chips(game)) {
    const page = byPage.get(chip.page);
    assert(page, slug + " chip page " + chip.page + " is not in the OCR");
    if (!page) continue;
    const found = api.searchMatchRanges(pageRaw(page.words), chip.query);
    assert(found.ranges.length === 1, slug + " chip is not a single hit on page " + chip.page + ": " + chip.query);
    const inBullet = foldSpace(chip.text).includes(foldSpace(chip.query));
    const legacy = legacyQueries.has(chip.query);
    assert(inBullet || legacy, slug + " chip query is not in the bullet: " + chip.query);
  }
}

for (const [slug, page, phrase] of signatures) {
  const index = JSON.parse(fs.readFileSync(path.join(root, "rulebooks", "index", slug + ".json"), "utf8"));
  const pages = page ? (index.pages || []).filter((item) => item.page === page) : index.pages || [];
  const blob = pages.map((item) => (item.lines || []).join("\n")).join("\n");
  assert(blob.toLowerCase().includes(phrase.toLowerCase()), slug + " is missing " + phrase);
}

const suburbia = data.enrich.suburbia;
const stacks = suburbia.quickStart.bullets.find((item) => item.lead === "Stacks");
assert(stacks && stacks.text.includes("15 tiles each"), "suburbia bullet wording was rewritten");
assert(stacks.source && stacks.source.page === 2, "suburbia stacks chip page");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert(sw.includes('var VERSION = "2026.11.21.24";'), "service worker version");
const fetchAt = sw.indexOf('self.addEventListener("fetch"');
const originAt = sw.indexOf("if (url.origin !== self.location.origin) return;", fetchAt);
assert(originAt > fetchAt && originAt < sw.indexOf("respondWith", fetchAt), "cross-origin fetch returns before other work");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("hard-scan indexes ok (" + slugs.length + " games)");
