/* Slug lock. Fails if a public slug changes, collides, or drifts from the pages.
   Run: node tests/game-slugs.mjs
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gamesFromHtml, publicSlug, slugify, stubHtml } from "../scripts/build-game-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const games = gamesFromHtml(html);
const map = JSON.parse(fs.readFileSync(path.join(root, "data", "game-slugs.json"), "utf8"));
const slugs = map.slugs || {};
const ids = Object.keys(slugs);
const derived = {};
games.forEach(function (_name, id) { derived[id] = publicSlug(id); });

assert(map.count === ids.length, "map count");
assert(ids.length === games.size, "map is missing a game or has an extra id");
assert(new Set(Object.values(slugs)).size === ids.length, "slug collision in the map");

["root", "azul", "brass-birmingham", "heat-pedal-to-the-metal"].forEach(function (id) {
  assert(slugs[id] === id, "locked slug changed: " + id + " -> " + slugs[id]);
  assert(derived[id] === id, "derived slug changed: " + id);
});

ids.forEach(function (id) {
  assert(derived[id] === slugs[id], "slug changed for " + id + ": map " + slugs[id] + ", derived " + derived[id]);
  assert(slugs[id] === id, "public slug drifted from the game id " + id);
});
Object.keys(derived).forEach(function (id) {
  assert(slugs[id] === derived[id], "game missing from the slug map: " + id);
});

assert(slugify("Brass: Birmingham") === "brass-birmingham", "slugify Brass: Birmingham");
assert(slugify("Heat: Pedal to the Metal") === "heat-pedal-to-the-metal", "slugify Heat");
assert(slugify("Root") === "root", "slugify Root");

const pageDirs = fs.readdirSync(path.join(root, "game"), { withFileTypes: true })
  .filter(function (entry) { return entry.isDirectory(); })
  .map(function (entry) { return entry.name; });
assert(pageDirs.length === ids.length, "page directory count " + pageDirs.length + " != " + ids.length);
pageDirs.forEach(function (dir) {
  assert(slugs[dir] === dir, "unexpected game page " + dir);
});

ids.forEach(function (id) {
  const file = path.join(root, "game", slugs[id], "index.html");
  assert(fs.existsSync(file), "missing page for " + id);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  const expected = stubHtml(id, games.get(id));
  assert(text === expected, "stub drifted for " + id);
  assert(text.includes("https://bgquick.com/game/" + id + "/"), "canonical missing for " + id);
  assert(text.includes("bgq-game-stub"), "stub marker missing for " + id);
  assert(text.includes('data-game="' + id + '"'), "data-game missing for " + id);
  assert(!/reddittitt|cody/i.test(text), "owner name in " + id);
  assert(text.length < 4000, "stub too large for " + id);
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("game slug checks passed (" + ids.length + ")");
