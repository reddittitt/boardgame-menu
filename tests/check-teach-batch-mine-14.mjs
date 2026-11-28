/* Teaching scripts for 6 more short collection games in Cody's collection.
   Each new bullet and sub-bullet has a Rulebook chip. The chip page is in
   that game's rulebook index, and the query appears once in the page text.
   node tests/check-teach-batch-mine-14.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, ok) {
  if (!ok) failures.push(name);
  console.log((ok ? "ok " : "FAIL ") + name);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const open = html.indexOf(">", html.indexOf('<script id="games-json"')) + 1;
const games = JSON.parse(html.slice(open, html.indexOf("</script>", open)));

const slugs = [
  "kinfire-delve-vainglorys-grotto",
  "sniper-elite-the-board-game",
  "tenby",
  "container",
  "chess",
  "deep-regrets"
];

function pageText(slug, pageNum) {
  const indexPath = path.join(root, "rulebooks/index", slug + ".json");
  if (!fs.existsSync(indexPath)) return null;
  const data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const page = (data.pages || []).find((row) => row.page === pageNum);
  if (!page) return null;
  return (page.lines || []).join(" ").replace(/\u0007/g, "").replace(/\s+/g, " ").trim();
}

function occurrences(text, query) {
  let n = 0;
  let i = 0;
  while (i <= text.length) {
    const at = text.indexOf(query, i);
    if (at < 0) break;
    n += 1;
    i = at + query.length;
  }
  return n;
}

function chipOk(bullet) {
  const source = bullet && bullet.source;
  return !!(bullet && typeof bullet.text === "string" && bullet.text.length > 0 &&
    source && Number.isInteger(source.page) && source.page > 0 &&
    typeof source.query === "string" && source.query.length > 0);
}

check("at least 5 games", slugs.length >= 5);
let chips = 0;
for (const slug of slugs) {
  const game = games.enrich[slug];
  const script = game && game.teachingScript;
  const keys = script && typeof script === "object" ? Object.keys(script) : [];
  const section = !!(script && Array.isArray(script.bullets) && keys.every((key) => key === "bullets" || key === "lead" || key === "text"));
  check(slug + " is not a count map", section);
  const bullets = section ? script.bullets : [];
  const ranged = bullets.length >= 5 && bullets.length <= 9;
  check(slug + " has 5 to 9 bullets", ranged);
  if (!section) continue;
  const miss = bullets.filter((bullet) => bullet.lead === "New players miss");
  const subs = miss.length === 1 && Array.isArray(miss[0].bullets) ? miss[0].bullets : null;
  check(slug + " has one New players miss with 2 to 4 sub-bullets", !!(subs && subs.length >= 2 && subs.length <= 4 && bullets[bullets.length - 1] === miss[0]));
  function linesOf(bullet) {
    const out = [bullet];
    for (const sub of bullet.bullets || []) out.push(...linesOf(sub));
    return out;
  }
  const lines = bullets.flatMap(linesOf);
  for (const bullet of lines) {
    chips += 1;
    const label = slug + " / " + (bullet.lead || bullet.text.slice(0, 24));
    const shaped = chipOk(bullet) && (bullet.lead == null || typeof bullet.lead === "string");
    check(label + " shape", shaped);
    if (!shaped) continue;
    const text = pageText(slug, bullet.source.page);
    check(label + " page " + bullet.source.page + " is in the index", text != null);
    if (text == null) continue;
    const count = occurrences(text, bullet.source.query);
    check(label + " query once", count === 1);
    if (bullet.source.snippet) {
      check(label + " snippet contains query", bullet.source.snippet.indexOf(bullet.source.query) !== -1);
      check(label + " snippet once", occurrences(text, bullet.source.snippet) === 1);
    }
  }
}
check("new lines have chips", chips > 0);

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
console.log("teach batch ok (" + slugs.length + " games, " + chips + " chips)");
