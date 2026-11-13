#!/usr/bin/env node
/* Check best/recommended player counts and play-time fallbacks. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("/* table-fit:start */");
const end = html.indexOf("/* table-fit:end */");
if (start < 0 || end < 0) {
  console.error("table-fit helpers were not found in index.html");
  process.exit(1);
}
const fns = new Function(
  html.slice(start, end) +
    "\nreturn { formatPlayTime, playerFitText, bggTimeLabel, listedPerPlayerMinutes };"
)();

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.error("FAIL", name, "got", actual, "expected", expected);
  }
}

const villain = {
  players: "2–4",
  time: "20 per player",
  bggTime: { min: 40, max: 80 },
  playerPoll: { best: "3", recommended: "2–4" }
};
check("villain no count uses the BGG range", fns.formatPlayTime(villain, null).text, "40–80 min");
check("villain at 3 scales the listed per-player time", fns.formatPlayTime(villain, 3).text, "60 min");
check("villain fit", fns.playerFitText(villain), "Best at 3 · Good 2–4");

const flip = { time: "20", players: "3+", bggTime: { min: 20, max: 20 }, playerPoll: { best: "5–6", recommended: "3–9" } };
check("single bgg time", fns.formatPlayTime(flip, null).text, "20 min");
check("flip stays in at 6", fns.playerFitText(flip).includes("5–6"), true);

const arcs = {
  time: "60–120",
  bggTime: { min: 60, max: 120 },
  playTimeByPlayerCount: { "2": "about 30 min per player" },
  playTimeSource: "rulebook",
  playerPoll: { best: "3–4", recommended: "2–4" }
};
check("rulebook time wins for that count", fns.formatPlayTime(arcs, 2).text, "about 30 min per player");
check("rulebook source", fns.formatPlayTime(arcs, 2).source, "rulebook");
check("no count uses BGG", fns.formatPlayTime(arcs, null).text, "60–120 min");

check("none is left out", fns.formatPlayTime({ time: "None" }, 4).text, "");
check("no poll is left out", fns.playerFitText({ time: "30" }), "");
check("same best and recommended shows once", fns.playerFitText({ playerPoll: { best: "4", recommended: "4" } }), "Best at 4");
check("bad time is left out", fns.bggTimeLabel({ bggTime: { min: 90, max: 30 } }), "");

const jsonStart = html.indexOf('<script id="games-json"');
const jsonBody = html.slice(html.indexOf(">", jsonStart) + 1, html.indexOf("</script>", jsonStart));
const games = JSON.parse(jsonBody).enrich;
let best = 0;
let recommended = 0;
let both = 0;
let timed = 0;
const problems = [];
for (const slug of Object.keys(games)) {
  const game = games[slug];
  const poll = game.playerPoll;
  const span = game.bggTime;
  if (poll) {
    if (poll.best) best += 1;
    if (poll.recommended) recommended += 1;
    if (poll.best && poll.recommended) both += 1;
    if (!poll.best && !poll.recommended) problems.push(slug + " empty poll");
    for (const key of ["best", "recommended"]) {
      if (poll[key] && !/^\d+(?:\u2013\d+)?$/.test(poll[key])) problems.push(slug + " " + key + " " + poll[key]);
    }
  }
  if (span) {
    timed += 1;
    if (!(span.min > 0 && span.max >= span.min)) problems.push(slug + " bad time " + JSON.stringify(span));
  }
  if (fns.playerFitText(game) && !poll) problems.push(slug + " fit without poll");
}
if (problems.length) {
  failed += problems.length;
  console.error(problems.slice(0, 20).join("\n"));
}
console.log(`best ${best} recommended ${recommended} both ${both} bgg time ${timed} of ${Object.keys(games).length}`);
if (failed) {
  console.error(failed + " check(s) failed");
  process.exit(1);
}
console.log("table fit ok");
