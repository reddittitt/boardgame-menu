/* Verified Rulebook chips added in the previous shell.
   For every new chip, the page is in the index and the query occurs once
   on the folded page text, or a snippet does and contains the query.
   node tests/check-chips-batch-mine-36.mjs */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseSha = "04e43606275ebeee9de20469f6cd5608b255c9c3";
const failures = [];
function check(name, ok) {
  if (!ok) failures.push(name);
  console.log((ok ? "ok " : "FAIL ") + name);
}

function gamesFrom(html) {
  const open = html.indexOf(">", html.indexOf('<script id="games-json"')) + 1;
  return JSON.parse(html.slice(open, html.indexOf("</script>", open)));
}

function fold(value) {
  return String(value || "").replace(/[\u2018\u2019\u2032`]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

const sections = ["quickStart", "setupByPlayerCount", "playerCountSetup", "startingResources", "turnStructure", "remindersText", "commonMistakes", "endOfGame", "endGameScoring"];

function bulletsIn(game) {
  const out = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.text === "string") out.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "source") continue;
      visit(value);
    }
  }
  for (const section of sections) visit(game && game[section]);
  return out;
}

function keyOf(bullet) {
  return (bullet.lead || "") + "\n" + bullet.text;
}

const indexes = new Map();
function pageText(slug, pageNum) {
  if (!indexes.has(slug)) {
    const file = path.join(root, "rulebooks/index", slug + ".json");
    indexes.set(slug, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  const page = (indexes.get(slug).pages || []).find((row) => row.page === pageNum);
  if (!page) return null;
  return (page.lines || []).join(" ").replace(/\u0007/g, "").replace(/\s+/g, " ").trim();
}

function occurrences(text, query) {
  const folded = fold(text);
  const needle = fold(query);
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while (i <= folded.length) {
    const at = folded.indexOf(needle, i);
    if (at < 0) break;
    n += 1;
    i = at + needle.length;
  }
  return n;
}

const current = gamesFrom(fs.readFileSync(path.join(root, "index.html"), "utf8"));
const baseHtml = execFileSync("git", ["show", baseSha + ":index.html"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const base = gamesFrom(baseHtml);

const slugs = [
  "brink",
  "dune-imperium-uprising",
  "flamecraft",
  "unmatched",
  "watergate",
  "the-crew-mission-deep-sea",
  "wandering-towers",
  "ravine"
];

const counts = {};
let checked = 0;
for (const slug of slugs) {
  const now = bulletsIn(current.enrich[slug]);
  const then = bulletsIn(base.enrich[slug]);
  const before = new Set(then.filter((bullet) => bullet.source && bullet.source.query).map(keyOf));
  const fresh = now.filter((bullet) => bullet.source && bullet.source.query && !before.has(keyOf(bullet)));
  counts[slug] = fresh.length;
  for (const bullet of fresh) {
    checked += 1;
    const label = slug + " / " + (bullet.lead || bullet.text.slice(0, 32));
    const source = bullet.source;
    const text = pageText(slug, source.page);
    check(label + " page " + source.page + " is in the index", text != null);
    if (text == null) continue;
    const queryCount = occurrences(text, source.query);
    if (queryCount === 1) {
      check(label + " query once", true);
    } else if (source.snippet && source.snippet.indexOf(source.query) !== -1 && occurrences(text, source.snippet) === 1) {
      check(label + " snippet once and contains query", true);
    } else {
      check(label + " query once", false);
    }
  }
}

const primary = slugs.filter((slug) => slug !== "ravine");
const overFloor = primary.filter((slug) => counts[slug] >= 10);
check("at least 6 games have 10 or more new chips", overFloor.length >= 6);
for (const slug of primary) {
  if (counts[slug] > 0) check(slug + " new chips " + counts[slug] + " meet 10", counts[slug] >= 10);
}
console.log("counts " + JSON.stringify(counts));

const ravine = current.enrich.ravine;
const round = ravine.remindersText.find((bullet) => bullet.lead === "Round");
const madness = ravine.commonMistakes.find((bullet) => bullet.lead === "Madness");
check("ravine round details name the health check", round.details.indexOf("health check") !== -1);
check("ravine round details no longer say when the night begins", round.details.indexOf("when the night begins") === -1);
check("ravine madness names the health check", madness.text.indexOf("health check") !== -1);
check("ravine madness no longer says as the night starts", madness.text.indexOf("as the night starts") === -1);
check("ravine madness chip is the health-check line", madness.source && madness.source.page === 4 && madness.source.query === "drops to 1 Heart at the end of the Night");

const baseRavine = base.enrich.ravine;
for (const lead of ["Fire", "Spear", "Basket"]) {
  const now = ravine.remindersText.find((bullet) => bullet.lead === lead);
  const then = baseRavine.remindersText.find((bullet) => bullet.lead === lead);
  check("ravine " + lead + " craft reminder text is unchanged", now.text === then.text && now.details === then.details && !now.source);
}

check("new lines were checked", checked > 0);

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
console.log("chips batch 36 ok (" + checked + " new chips)");
