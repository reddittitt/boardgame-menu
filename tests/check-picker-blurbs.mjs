/* Newcomer picker blurbs. Run: node tests/check-picker-blurbs.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[:'"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const jsonStart = html.indexOf('<script id="games-json"');
const json = JSON.parse(html.slice(html.indexOf(">", jsonStart) + 1, html.indexOf("</script>", jsonStart)));
const OWNER_NAMES = ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"];
const KIND_IDS = ["party", "coop", "strategy", "card", "puzzle", "dice", "word", "duel"];
const UNSOURCED = [
  "altera",
  "annulet",
  "honors-end",
  "square-one",
  "candy-land-bluey",
  "corps-of-discovery-ultimate-edition",
  "everdell-journeys",
  "gather-an-everdell-card-game",
  "an-infamous-traffic-second-edition",
  "parks-europe",
  "tag-team-snk-arcade-legends"
];
const map = json.ownersByBggId || {};

function ownersFor(id) {
  const row = map[String(id || "")];
  return Array.isArray(row) ? row.slice() : [];
}
function orderOwners(list) {
  return OWNER_NAMES.filter((name) => list.includes(name));
}
function hasRepoSource(slug, game) {
  if (game.quickStart || game.teachingScript || game.scoringSummary || game.rulebook) return true;
  return fs.existsSync(path.join(root, "rulebooks", "index", slug + ".json"));
}

const games = {};
for (const name of json.names) {
  const slug = slugify(name);
  const game = Object.assign({ name, slug }, json.enrich[slug] || {});
  let gathered = ownersFor(game.bggId);
  if (String(game.bggId) === "13") gathered = gathered.concat(ownersFor("152959"));
  if (game.mine === true || (game.mine !== true && game.group !== true)) {
    if (!gathered.includes("Cody")) gathered.push("Cody");
  }
  game.owners = orderOwners(gathered);
  games[slug] = game;
}

assert(json.names.length === 780, "catalog size " + json.names.length);
const cody = Object.values(games).filter((game) => game.owners.includes("Cody"));
assert(cody.length === 184, "Cody " + cody.length);

const codySlugs = {};
cody.forEach((game) => { codySlugs[game.slug] = true; });

for (const slug of Object.keys(json.enrich || {})) {
  const entry = json.enrich[slug];
  if (!entry || !Object.prototype.hasOwnProperty.call(entry, "picker")) continue;
  assert(!!codySlugs[slug], slug + " picker is not Cody-owned");
}

let sourced = 0;
for (const game of cody) {
  const picker = game.picker;
  if (!picker) continue;
  sourced += 1;
  const blurb = typeof picker.blurb === "string" ? picker.blurb.trim() : "";
  assert(blurb.length > 0, game.slug + " empty blurb");
  const words = blurb.split(/\s+/).filter(Boolean);
  assert(words.length <= 40, game.slug + " blurb words " + words.length);
  assert(/^[^.!?]*\.$/.test(blurb), game.slug + " blurb is not one sentence");
  assert(!/\b(Cody|Zeek|Tim|John|Ryan|Andrew)\b/.test(blurb), game.slug + " blurb names an owner");
  assert(Array.isArray(picker.kinds) && picker.kinds.length > 0, game.slug + " kinds");
  const seen = {};
  (picker.kinds || []).forEach((id) => {
    assert(KIND_IDS.includes(id), game.slug + " kind " + id);
    assert(!seen[id], game.slug + " duplicate " + id);
    seen[id] = true;
  });
  if (game.players === "2") assert(picker.kinds.includes("duel"), game.slug + " 2-player picker needs duel");
}

assert(sourced >= 150, "sourced floor " + sourced);

for (const slug of UNSOURCED) {
  const game = games[slug];
  assert(!!game, "missing unsourced " + slug);
  if (!game || !game.picker) continue;
  assert(hasRepoSource(slug, game), slug + " has picker without a repo source");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("picker blurbs ok (" + sourced + " sourced, " + cody.length + " Cody, " + json.names.length + " names)");
