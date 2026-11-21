/* Condition engine + selection-aware Root/Wingspan coverage.
   Run: node tests/selection.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  matchesSelection,
  filterBySelection,
  filterContentTree,
  showingForLabel,
  readCondition
} from "../selection.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

assert(matchesSelection({ text: "always" }, { players: 2 }), "untagged shows");
assert(!matchesSelection({ faction: ["Marquise de Cat"] }, { factions: ["Eyrie Dynasties"] }), "other faction hides");
assert(matchesSelection({ faction: ["Marquise de Cat"] }, { factions: [] }), "no faction selected shows all");
assert(matchesSelection({ faction: ["Marquise de Cat"] }, { factions: ["Marquise de Cat"] }), "matching faction");
assert(matchesSelection({ expansion: ["Riverfolk Expansion"] }, { expansions: ["Riverfolk Expansion"] }), "expansion on");
assert(!matchesSelection({ expansion: ["Riverfolk Expansion"] }, { expansions: [] }), "expansion off");
assert(matchesSelection({ players: { min: 2, max: 2 } }, { players: 2 }), "players match");
assert(!matchesSelection({ players: { min: 4, max: 4 } }, { players: 2 }), "players miss");
assert(matchesSelection({ variant: ["advanced"] }, { variant: "advanced" }), "variant match");
assert(!matchesSelection({ variant: ["advanced"] }, { variant: "standard" }), "variant miss");
assert(matchesSelection({ faction: ["Marquise de Cat"] }, { factions: ["Eyrie Dynasties"], showAll: true }), "showAll");

assert(filterBySelection([
  { name: "a" },
  { name: "b", faction: ["Marquise de Cat"] },
  { name: "c", faction: ["Eyrie Dynasties"] }
], { factions: ["Marquise de Cat"] }).map((item) => item.name).join(",") === "a,b", "filter list");

const tree = filterContentTree({
  bullets: [
    { lead: "Shared", text: "always" },
    { lead: "Cats", text: "only", faction: ["Marquise de Cat"] },
    { lead: "Birds", text: "only", faction: ["Eyrie Dynasties"] }
  ]
}, { factions: ["Marquise de Cat"] });
assert(tree.bullets.length === 2 && tree.bullets[1].lead === "Cats", "filter tree");

assert(showingForLabel({
  players: 4,
  factions: ["Marquise de Cat", "Eyrie Dynasties"],
  expansions: ["Riverfolk Expansion"]
}) === "Showing for: 4 players · Marquise de Cat, Eyrie Dynasties · Riverfolk", "showing label");

assert(readCondition({ when: { expansion: ["Europe Expansion"] } }).expansion[0] === "Europe Expansion", "when block");

const components = JSON.parse(read("components.json"));
assert(components.root && components.root.expansions["Riverfolk Expansion"], "root riverfolk components");
assert(components.root.items.some((item) => item.faction && item.faction[0] === "Marquise de Cat"), "root faction tags");
assert(components.wingspan && components.wingspan.expansions["Europe Expansion"], "wingspan europe components");

const html = read("index.html");
assert(html.includes("/* selection-engine:start */"), "engine inlined");
assert(html.includes("showing-for"), "showing for bar");
assert(html.includes("Show everything"), "show everything toggle");
assert(html.includes("put-away-public"), "public put away");
assert(html.includes("function detailHistoryUrl"), "detail url state");
assert(html.includes("mountPutAwayGuide"), "put away guide");

const match = html.match(/<script id="games-json"[^>]*>([\s\S]*?)<\/script>/);
const catalog = JSON.parse(match[1]);
const rootGame = catalog.enrich.root;
const riverfolk = rootGame.expansions.find((exp) => exp.name === "Riverfolk Expansion");
assert(riverfolk.setup.bullets.some((item) => item.faction && item.faction[0] === "Lizard Cult"), "root setup retagged");
assert(rootGame.setupVariants[0].setup.bullets[0].variant, "variant retagged");
assert(rootGame.setupByPlayerCount["2"].bullets[0].players, "players retagged");

const quacks = components["the-quacks-of-quedlinburg"];
const herb = quacks && quacks.expansions["The Herb Witches"];
assert(herb && herb.source === "bgg" && /BoardGameGeek/.test(herb.label), "herb witches sourced from BoardGameGeek");
assert(herb.items.some((item) => item.expansion && item.expansion[0] === "The Herb Witches" && item.count === "1" && /Pot/.test(item.name)), "herb witches pot");
assert(herb.items.every((item) => quotedCount(item)), "herb witches counts are quoted");

const cities = components.catan.expansions["Catan: Cities & Knights"];
assert(cities && cities.label === "BoardGameGeek · Mayfair 4th Edition", "cities and knights edition label");
assert(cities.items.some((item) => item.count === "36" && /Commodity Cards/.test(item.name)), "cities and knights commodities");
assert(!components.root.expansions.Hirelings, "generic Hirelings chip did not inherit another pack");

const scout = catalog.enrich.scout;
const scoutTwo = scout.quickStart.bullets.find((item) => item.lead === "Two players");
const scoutRounds = scout.quickStart.bullets.find((item) => item.lead === "Rounds");
assert(scoutTwo.players.min === 2 && scoutTwo.players.max === 2, "scout two-player line tagged");
assert(!scoutRounds.players && !scoutRounds.expansion && !scoutRounds.faction, "scout shared round line stays untagged");
assert(matchesSelection(scoutTwo, { players: 2 }), "scout two-player shows at 2");
assert(!matchesSelection(scoutTwo, { players: 4 }), "scout two-player hides at 4");
assert(matchesSelection(scoutTwo, { players: 4, showAll: true }), "show everything restores scout");
assert(matchesSelection(scoutRounds, { players: 4 }), "untagged scout line still shows");

const wildlife = catalog.enrich.parks.expansions.find((exp) => exp.name === "Wildlife");
const nightfall = wildlife.setup.bullets.find((item) => /Nightfall is also in play/.test(item.lead || ""));
assert(nightfall.expansion[0] === "Nightfall", "wildlife line waits for Nightfall");
assert(!matchesSelection(nightfall, { expansions: ["Wildlife"] }), "nightfall line hidden without Nightfall");
assert(matchesSelection(nightfall, { expansions: ["Wildlife", "Nightfall"] }), "nightfall line shows with both");

const azulFactory = catalog.enrich.azul.quickStart.bullets.find((item) => /factory/.test((item.lead || "") + " " + (item.text || "")));
assert(!azulFactory.players, "mixed player-count line stays untagged");

const watergateSetup = catalog.enrich.watergate.quickStart;
const watergateBullets = Array.isArray(watergateSetup) ? watergateSetup : watergateSetup.bullets;
const editor = watergateBullets.find((item) => item.lead === "Editor");
assert(editor.faction[0] === "Editor", "watergate editor line tagged");
assert(matchesSelection(editor, { factions: [] }), "no faction selected still shows editor");
assert(!matchesSelection(editor, { factions: ["Nixon"] }), "nixon selection hides the editor line");

function quotedCount(item) {
  const line = String((item.lines && item.lines[0]) || "");
  return line.includes(String(item.count).replace(/x$/i, ""));
}

const sw = read("sw.js");
assert(/var VERSION = "2026\.11\.21\.7";/.test(sw), "service worker version");
assert(sw.includes("./components.json"), "components shell");
assert(sw.includes("./selection.mjs"), "selection module is in the app shell");
assert(sw.includes("./expansion-guides.json"), "expansion guide is in the app shell");
const fetchAt = sw.indexOf('addEventListener("fetch"');
const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
const respondAt = sw.indexOf("respondWith", fetchAt);
assert(originAt > fetchAt && originAt < respondAt, "cross-origin still returns first");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("selection.mjs ok");
