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
const { blankFacet, playerSpan, playMinutes } = new Function(
  source + "\nreturn { blankFacet, playerSpan, playMinutes };"
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
check("per player at max", playMinutes(villainous, 0), { min: 80, max: 80 });
check("per player at 2", playMinutes(villainous, 2), { min: 40, max: 40 });
check("per player at 4", playMinutes(villainous, 4), { min: 80, max: 80 });
check("plain time", playMinutes({ time: "45–90" }, 0), { min: 45, max: 90 });
check("none time", playMinutes({ time: "None" }, 0), null);
check("varies time", playMinutes({ time: "varies" }, 4), null);
check("open per player uses 12", playMinutes({ players: "3+", time: "20 per player" }, 0), { min: 240, max: 240 });

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

if (failed) {
  console.error(failed + " check(s) failed");
  process.exit(1);
}
console.log("catalog filters ok (" + Object.keys(games).length + " games)");
