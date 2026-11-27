/* Owner data and the people filter. Run: node tests/check-whose-games.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const night = fs.readFileSync(path.join(root, "game-night.js"), "utf8");
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
const map = json.ownersByBggId || {};

function ownersFor(id) {
  const row = map[String(id || "")];
  return Array.isArray(row) ? row.slice() : [];
}
function orderOwners(list) {
  return OWNER_NAMES.filter((name) => list.includes(name));
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
assert(sw.includes('var VERSION = "2026.11.21.39"'), "service worker version");
assert(html.includes('data-facet="whose"'), "whose facet");
assert(html.includes("Whose games"), "whose label");
assert(html.includes('matchesOwners'), "owner match");
assert(night.includes('facet === "who"'), "night who facet");
assert(night.includes('params.set("who"'), "night shareable who");
assert(!html.includes("Owned by"), "no Owned by line");

const added = [
  "60-second-city",
  "a-game-of-thrones-the-board-game-second-edition",
  "arkham-horror",
  "axis-and-allies-1941",
  "blood-rage",
  "brian-boru-high-king-of-ireland",
  "chaos-in-the-old-world",
  "coffee-rush",
  "coup",
  "doomlings",
  "galaxy-trucker",
  "garden-guests",
  "gloomhaven",
  "gloomhaven-jaws-of-the-lion",
  "horizons-of-spirit-island",
  "horrified-american-monsters",
  "hummingbirds",
  "inis",
  "kahuna",
  "letters-from-whitechapel",
  "mage-knight-board-game",
  "monopoly-deal-no-mercy",
  "pax-pamir",
  "pax-pamir-second-edition",
  "sidereal-confluence",
  "space-alert",
  "star-wars-rebellion",
  "summoner-wars-master-set",
  "t-i-m-e-stories",
  "the-lord-of-the-rings",
  "the-uzzle",
  "ticket-to-ride-legacy-legends-of-the-west",
  "twilight-imperium-fourth-edition",
  "twilight-struggle",
  "undaunted-stalingrad",
  "war-of-the-ring-second-edition",
  "warhammer-underworlds-shadespire",
  "wavelength",
  "zoo-vadis"
];
assert(added.length === 39, "added list");
for (const slug of added) {
  const game = games[slug];
  assert(!!game, "missing " + slug);
  if (!game) continue;
  assert(game.group === true, slug + " group");
  assert(game.rulesStatus === "pending", slug + " pending");
  assert(!!game.bggId && !!game.players && !!game.time && !!game.year, slug + " essentials");
  assert(typeof game.weight === "number", slug + " weight");
  assert(/^https:\/\/cf\.geekdo-images\.com\//.test(game.cover || ""), slug + " cover");
  assert(game.owners.length === 1 && game.owners[0] === "Zeek", slug + " owners " + game.owners.join(","));
  assert(game.mine !== true, slug + " is not mine");
}

assert(!json.names.includes("The Settlers of Catan"), "no duplicate Catan page");
assert(games.catan.bggId === "13", "catan keeps id 13");
assert(games.catan.owners.includes("Zeek") && games.catan.owners.includes("Cody"), "catan owners " + games.catan.owners.join(","));
assert(games["pax-pamir"].bggId === "155255", "pax pamir first");
assert(games["pax-pamir-second-edition"].bggId === "256960", "pax pamir second");
assert(games["the-lord-of-the-rings"].bggId === "823", "lotr 2000");
assert(games["the-lord-of-the-rings"].year === "2000", "lotr year");
const otherLotr = Object.values(games).filter((game) => /lord of the rings/i.test(game.name) && game.slug !== "the-lord-of-the-rings");
assert(otherLotr.length > 0, "other lord of the rings pages stay");
assert(otherLotr.every((game) => game.bggId !== "823"), "other lotr pages are different games");

const hiveIds = (games.hive.expansions || []).map((exp) => String(exp.bggId));
for (const id of ["70704", "30323", "139666"]) assert(hiveIds.includes(id), "hive expansion " + id);
const spiritIds = (games["spirit-island"].expansions || []).map((exp) => String(exp.bggId));
assert(spiritIds.includes("356510"), "feather and flame");
assert(spiritIds.includes("367498"), "horizons chip stays");
assert(spiritIds.includes("193065") && spiritIds.includes("262722") && spiritIds.includes("365137"), "spirit expansions stay");
assert((games["sky-team"].expansions || []).some((exp) => String(exp.bggId) === "423177"), "turbulence stays nested");

for (const title of [
  "Hive: The Ladybug",
  "Hive: The Mosquito",
  "Hive: The Pillbug",
  "Sky Team: Turbulence",
  "Spirit Island: Feather & Flame",
  "Spirit Island: Branch & Claw",
  "Spirit Island: Jagged Earth",
  "Spirit Island: Nature Incarnate"
]) {
  assert(!json.names.includes(title), "expansion is not a page: " + title);
}

assert(!games["7-wonders"].owners.includes("Cody"), "Armada does not make 7 Wonders Cody's");
assert(games["7-wonders"].owners.includes("Zeek"), "Zeek owns 7 Wonders");
assert(!games["hive-pocket"].owners.includes("Zeek"), "Pillbug does not make Hive Pocket Zeek's");
assert(games.hive.owners.includes("Zeek"), "Zeek owns Hive");

const counts = {};
for (const name of OWNER_NAMES) counts[name] = 0;
for (const game of Object.values(games)) {
  for (const name of game.owners) counts[name] += 1;
}
assert(counts.Cody === 184, "Cody " + counts.Cody);
assert(counts.Zeek === 72, "Zeek " + counts.Zeek);
assert(counts.Tim === 480, "Tim " + counts.Tim);
assert(counts.John === 134, "John " + counts.John);
assert(counts.Ryan === 39, "Ryan " + counts.Ryan);
assert(counts.Andrew === 13, "Andrew " + counts.Andrew);

const myGames = Object.values(games).filter((game) => game.mine === true || (game.mine !== true && game.group !== true));
assert(myGames.length === counts.Cody, "My games matches Cody " + myGames.length);
assert(myGames.every((game) => game.owners.includes("Cody")), "every My games entry includes Cody");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("whose games data ok (" + json.names.length + " games)");
