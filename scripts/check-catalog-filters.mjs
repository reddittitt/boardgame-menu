#!/usr/bin/env node
/* Check catalog player-count and play-time parsing against the game JSON. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("/* catalog-filter-parse:start */");
const end = html.indexOf("/* catalog-filter-parse:end */");
if (start < 0 || end < 0) {
  console.error("catalog filter parsers were not found in index.html");
  process.exit(1);
}
const source = html.slice(start, end);
const { blankFacet, playerSpan, playMinutes, weightBand, timeHits, countIncluded } = new Function(
  source + "\nreturn { blankFacet, playerSpan, playMinutes, weightBand, timeHits, countIncluded };"
)();

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.error("FAIL", name, "got", actual, "expected", expected);
  }
}

const flip = playerSpan("3+");
check("3+ min", flip && flip.min, 3);
check("3+ includes 6", flip && flip.max >= 6, true);
check("3+ includes 4", flip && 4 >= flip.min && 4 <= flip.max, true);
check("3+ excludes 2", flip && 2 >= flip.min && 2 <= flip.max, false);
check("closed range", playerSpan("2–4"), { min: 2, max: 4, open: false });
check("or more", playerSpan("5 or more"), { min: 5, max: 99, open: true });
check("none players", playerSpan("None"), null);
check("varies players", playerSpan("varies"), null);

const villainous = { players: "2–4", time: "20 per player" };
check("per player span", playMinutes(villainous, 0), { min: 40, max: 80 });
check("per player at 2", playMinutes(villainous, 2), { min: 40, max: 40 });
check("per player at 4", playMinutes(villainous, 4), { min: 80, max: 80 });
check("plain time", playMinutes({ time: "45–90" }, 0), { min: 45, max: 90 });
check("none time", playMinutes({ time: "None" }, 0), null);
check("varies time", playMinutes({ time: "varies" }, 4), null);
check("open per player uses 12", playMinutes({ players: "3+", time: "20 per player" }, 0), { min: 60, max: 240 });
check("bgg time fallback", playMinutes({ bggTime: { min: 60, max: 90 } }, 0), { min: 60, max: 90 });
check("listed time wins over bgg", playMinutes({ time: "30", bggTime: { min: 15, max: 25 } }, 0), { min: 30, max: 30 });

check("weight 1.99", weightBand(1.99), "light");
check("weight 2", weightBand(2), "medium-light");
check("weight 2.49", weightBand(2.49), "medium-light");
check("weight 2.5", weightBand(2.5), "medium");
check("weight 3.49", weightBand(3.49), "medium");
check("weight 3.5", weightBand(3.5), "medium-heavy");
check("weight 3.99", weightBand(3.99), "medium-heavy");
check("weight 4", weightBand(4), "heavy");
check("weight 4.45", weightBand(4.45), "heavy");
check("weight 4.5", weightBand(4.5), "heavy");
check("weight blank", weightBand(""), "");
check("weight missing", weightBand(null), "");

const halfHour = { min: 30, max: 30 };
const spansBoth = { min: 15, max: 30 };
const longGame = { min: 90, max: 240 };
check("exact 30 is not under 30", timeHits(halfHour, "under30"), false);
check("exact 30 is 30-60", timeHits(halfHour, "30-60"), true);
check("15-30 overlaps under 30", timeHits(spansBoth, "under30"), true);
check("15-30 overlaps 30-60", timeHits(spansBoth, "30-60"), true);
check("15-30 misses 2h", timeHits(spansBoth, "120"), false);
check("90-240 hits 2h", timeHits(longGame, "120"), true);
check("90-240 hits 60-120", timeHits(longGame, "60-120"), true);
check("missing time misses a bucket", timeHits(null, "under30"), false);
check("7+ includes 8-10", countIncluded({ min: 8, max: 10 }, "7"), true);
check("7+ excludes 2-6", countIncluded({ min: 2, max: 6 }, "7"), false);
check("4 inside 2-4", countIncluded({ min: 2, max: 4 }, "4"), true);

const jsonStart = html.indexOf('<script id="games-json"');
const jsonBody = html.slice(html.indexOf(">", jsonStart) + 1, html.indexOf("</script>", jsonStart));
const games = JSON.parse(jsonBody).enrich;
const odd = [];
for (const slug of Object.keys(games)) {
  const game = games[slug];
  const players = game.players;
  const time = game.time;
  if (!blankFacet(players) && !playerSpan(players)) odd.push(slug + " players " + JSON.stringify(players));
  if (!blankFacet(time) && !playMinutes(game, 0)) odd.push(slug + " time " + JSON.stringify(time));
}
if (odd.length) {
  failed += odd.length;
  console.error("unparsed fields:\n" + odd.join("\n"));
}

const flipGame = games["flip-7"];
const villain = games["marvel-villainous"];
check("flip-7 data", playerSpan(flipGame && flipGame.players).min, 3);
check("villainous scaled", playMinutes(villain, 0).max > 20, true);
check("azul light", weightBand(games.azul.weight), "light");
check("wonders medium-light", weightBand(games["7-wonders"].weight), "medium-light");
check("villainous medium", weightBand(villain.weight), "medium");
check("chess medium-heavy", weightBand(games.chess.weight), "medium-heavy");
check("john company heavy", weightBand(games["john-company-second-edition"].weight), "heavy");
check("jaipur is 30-60", timeHits(playMinutes(games.jaipur, 0), "30-60"), true);
check("jaipur is not under 30", timeHits(playMinutes(games.jaipur, 0), "under30"), false);
check("suburbia uses bgg time", playMinutes(games.suburbia, 0), { min: 60, max: 90 });
check("codenames best includes 7+", countIncluded(playerSpan(games.codenames.playerPoll.best), "7"), true);
check("flip-7 best excludes 7+", countIncluded(playerSpan(flipGame.playerPoll.best), "7"), false);

function slugify(s) {
  return String(s).toLowerCase().replace(/[:'"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
const catalog = JSON.parse(jsonBody).names.map((name) => {
  const slug = slugify(name);
  return Object.assign({ name, slug }, games[slug] || {});
});
const coverage = {
  games: catalog.length,
  players: 0,
  best: 0,
  listedTime: 0,
  timeWithFallback: 0,
  weight: 0,
  bands: { light: 0, "medium-light": 0, medium: 0, "medium-heavy": 0, heavy: 0 }
};
const missing = { players: [], time: [], weight: [] };
for (const game of catalog) {
  if (playerSpan(game.players)) coverage.players += 1;
  else missing.players.push(game.slug);
  if (playerSpan(game.playerPoll && game.playerPoll.best)) coverage.best += 1;
  if (!blankFacet(game.time) && playMinutes(game, 0)) coverage.listedTime += 1;
  if (playMinutes(game, 0)) coverage.timeWithFallback += 1;
  else missing.time.push(game.slug);
  const band = weightBand(game.weight);
  if (band) {
    coverage.weight += 1;
    coverage.bands[band] += 1;
  } else missing.weight.push(game.slug);
}
console.log("coverage " + JSON.stringify(coverage));
console.log("missing players " + missing.players.join(", "));
console.log("missing time " + missing.time.join(", "));
console.log("missing weight " + missing.weight.length + ": " + missing.weight.join(", "));

if (failed) {
  console.error(failed + " check(s) failed");
  process.exit(1);
}
console.log("catalog filters ok (" + catalog.length + " games)");
