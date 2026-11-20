/* Expansion guide data: sourced blurbs, no empty facts, names match the catalog.
   Run: node tests/expansion-guide.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const html = read("index.html");
const jsonStart = html.indexOf('<script id="games-json"');
const jsonBody = html.slice(html.indexOf(">", jsonStart) + 1, html.indexOf("</script>", jsonStart));
const enrich = JSON.parse(jsonBody).enrich;
const guides = JSON.parse(read("expansion-guides.json"));
const sw = read("sw.js");

assert(sw.includes('var VERSION = "2026.11.20.17";'), "service worker version");
assert(sw.includes('"./expansion-guides.json"'), "guide file is in the app shell");
const fetchAt = sw.indexOf('addEventListener("fetch"');
const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
const respondAt = sw.indexOf("respondWith", fetchAt);
assert(fetchAt > 0 && originAt > fetchAt && originAt < respondAt, "cross-origin requests return before respondWith");
assert(html.includes('id="expansion-guide-slot"'), "game page has a guide slot");
assert(html.includes("Expansion guide"), "game page titles the section");
assert(html.includes("Stored in the base box."), "collection note is in the renderer");
assert(!html.includes("View on publisher site"), "no publisher-site link label");

let expansions = 0;
const thin = [];
for (const slug of Object.keys(guides)) {
  const game = enrich[slug];
  const page = guides[slug];
  assert(game, "guide for an unknown game " + slug);
  if (!game) continue;
  assert(page.storedInBaseBox === !!game.mine, slug + " storedInBaseBox follows the collection flag");
  const names = new Set((game.expansions || []).map((exp) => exp && exp.name).filter(Boolean));
  const entries = page.expansions || {};
  let bare = 0;
  for (const name of Object.keys(entries)) {
    expansions += 1;
    const entry = entries[name];
    assert(names.has(name), slug + " guide names an expansion that is not on the game: " + name);
    assert(typeof entry.adds === "string" && entry.adds.trim().length >= 40, slug + " / " + name + " missing what it adds");
    assert(entry.source === "BoardGameGeek" || entry.source === "Rulebook", slug + " / " + name + " source");
    if (entry.sourceUrl) assert(/^https:\/\//.test(entry.sourceUrl), slug + " / " + name + " source url");
    ["firstPlay", "players", "combines"].forEach((key) => {
      if (entry[key] == null) return;
      assert(typeof entry[key] === "string" && entry[key].trim().length >= 12, slug + " / " + name + " empty " + key);
    });
    const blob = JSON.stringify(entry);
    assert(!/cody/i.test(blob), slug + " / " + name + " names an owner");
    assert(!/view on publisher site/i.test(blob), slug + " / " + name + " publisher-site label");
    const exp = (game.expansions || []).find((item) => item && item.name === name);
    const hasRules = !!(exp && exp.rules && JSON.stringify(exp.rules).length > 20);
    if (!entry.firstPlay && !entry.players && !entry.combines && !hasRules) bare += 1;
  }
  if (game.mine && bare > 0 && bare === Object.keys(entries).length) thin.push(slug);
}

assert(Object.keys(guides).length >= 140, "expected guides for most base games");
assert(expansions >= 300, "expected guides for most expansions");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("expansion guide ok (" + Object.keys(guides).length + " base games, " + expansions + " expansions, " + thin.length + " thin collection games)");
