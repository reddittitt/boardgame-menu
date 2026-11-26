/* Glossary entries for 30 games in Cody's collection.
   Each new line is a term bullet with a Rulebook chip. The chip page is in
   that game's rulebook index, and the query appears once in the page text.
   node tests/check-glossary-batch-mine.mjs */
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
  "agent-avenue",
  "air-land-and-sea",
  "air-land-and-sea-spies-lies-and-supplies",
  "brick-like-this",
  "cozy-stickerville",
  "fliptoons",
  "fliptoons-season-2",
  "for-sale-autorama",
  "got-five",
  "gruntz",
  "hypothetically",
  "inkling",
  "kinfire-delve-vainglorys-grotto",
  "light-speed-arena",
  "magic-maze-pocket",
  "moon-colony-bloodbath",
  "moonrakers",
  "mycelia-2024",
  "night-at-the-zoo",
  "ostia-mariner-edition",
  "rebel-princess-deluxe-edition",
  "sea-salt-and-paper-includes-expansions-extra-salt-and-extra-pepper",
  "spot-it",
  "tacta",
  "tag-team",
  "tenby",
  "thunder-road-vendetta-maximum-chrome",
  "unmatched",
  "wingspan-asia",
  "wingspan-pocket"
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

check("at least 24 games", slugs.length >= 24);
let lines = 0;
for (const slug of slugs) {
  const game = games.enrich[slug];
  const gloss = game && game.rulesGlossary;
  check(slug + " is searchable", !!(game && game.rulebookSearchable === true));
  const shaped = Array.isArray(gloss) && gloss.length >= 3 && gloss.length <= 6;
  check(slug + " has 3 to 6 terms", shaped);
  if (!shaped) continue;
  for (const entry of gloss) {
    const desc = entry && entry.desc;
    const termOk = typeof entry.term === "string" && entry.term.length > 0 && Array.isArray(desc) && desc.length >= 1 && desc.length <= 3;
    check(slug + " term " + (entry && entry.term), termOk);
    if (!termOk) continue;
    for (const bullet of desc) {
      lines += 1;
      const source = bullet.source || {};
      const label = slug + " " + entry.term + " / " + bullet.lead;
      const bulletOk = typeof bullet.lead === "string" && bullet.lead.length > 0 &&
        typeof bullet.text === "string" && bullet.text.length > 0 &&
        Number.isInteger(source.page) && source.page > 0 &&
        typeof source.query === "string" && source.query.length > 0;
      check(label + " shape", bulletOk);
      if (!bulletOk) continue;
      const text = pageText(slug, source.page);
      check(label + " page " + source.page + " is in the index", text != null);
      if (text == null) continue;
      check(label + " query once", occurrences(text, source.query) === 1);
    }
  }
}
check("new lines have chips", lines > 0);

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
console.log("glossary batch ok (" + slugs.length + " games, " + lines + " lines)");
