// assets/games.js
export const slugify = (name) =>
name.toLowerCase()
.replace(/[:’'"]/g, "")
.replace(/&/g, "and")
.replace(/[^a-z0-9]+/g, "-")
.replace(/(^-|-$)/g, "");

// ---------- DEFAULTS (edit if you have a consistent pattern) ----------
const DEFAULTS = {
youtube: "", // e.g., "https://www.youtube.com/watch?v=XXXXXX"
notionBase: "", // e.g., "https://www.notion.so/yourworkspace/"
bgstatsBase: "https://bgstats.app/game/",
storageBase: "", // e.g., "https://<username>.github.io/<repo>/storage/",
rulebookBase: "/rulebooks/", // will form /rulebooks/<slug>.pdf
};

// ---------- YOUR COLLECTION (names from your list) ----------
const NAMES = [
"7 Wonders",
"7 Wonders Duel",
"Acquire",
"Air, Land & Sea: Critters at War",
"Archduke",
"Ark Nova",
"Ark Nova: Marine Worlds",
"Azul",
"Azul: Crystal Mosaic",
"Backgammon",
"Brass: Birmingham",
"Candy Land: Bluey",
"Century: Golem Edition",
"Chess",
"Chronicles of Crime",
"Cover Your Assets",
"Critters at War: Flies, Lies, and Supplies",
"Dune: Imperium - Uprising",
"Dutch Blitz",
"Everdell",
"The Fellowship of the Ring Trick-Taking Game",
"Fire Tower",
"Fire Tower: Rising Flames",
"Five Crowns",
"For Sale",
"For Sale: Advisors",
"Forbidden Island",
"Foundations of Metropolis",
"Heat: Pedal to the Metal",
"Heat: Heavy Rain",
"Jaipur",
"Kingdomino",
"Kingdomino Origins",
"Monopoly Deal",
"Moonrakers: Titan Edition",
"Moonrakers: Dark Matter",
"Moonrakers: The Endless",
"Moonrakers: The Shard",
"Moonrakers: Starfall",
"Moonrollers",
"New York Zoo",
"Pan Am",
"PARKS",
"PARKS: Nightfall",
"PARKS: Wildlife",
"Patchwork",
"Play Nine",
"Quacks of Quedlinburg",
"Quacks of Quedlinburg: Alchemists",
"Quacks of Quedlinburg: Herb Witches",
"Radlands",
"Rage",
"Ravine",
"Ravine: The Spirits Expansion",
"Rook",
"Rummikub",
"Sail",
"Sequence",
"Skip-Bo",
"Sky Team",
"Sniper Elite",
"Splendor",
"Star Wars: The Deck-Building Game",
"Vinhos Deluxe Edition",
"Watergate",
"Wingspan",
"Project L",
"Project L: Finesse",
"Project L: Ghost",
"Harmonies",
"Wingspan: European Expansion",
"Forest Shuffle",
// Upcoming/mentioned:
"Heat: Tunnel Vision",
"Brink",
"Tend",
];

// Optional per-game enrichments (examples shown for a few)
const ENRICH = {
[slugify("Heat: Pedal to the Metal")]: {
players: "2–6",
youtube: "https://www.youtube.com/watch?v=REPLACE_HEAT_VIDEO",
bgstats: "https://bgstats.app/game/heat-pedal-to-the-metal",
notion: "", // e.g., "https://www.notion.so/yourworkspace/heat-abcdef123456"
storage: "", // e.g., "https://<username>.github.io/<repo>/storage/heat.html"
quickStart: `Players: 2–6 • Setup ~5–7 min

1) Track & Modules
- Choose track; shuffle track cards as required.
- If using Heavy Rain: place rain boards; shuffle weather.

2) Player Setup
- Give each player: car, dashboard, starting gear & starting hand.
- Starting money and upgrade cards per scenario.

3) Decks & Supply
- Shuffle stress/heat decks as rules specify.
- Place weather tokens and slipstream marker.

4) Round (high-level)
- Select speed card → reveal → resolve heat/stress → move → slipstream → cleanup.

First game tips:
- Don’t burn heat too early.
- Slipstream when possible; mind corner speed limits.`,
},

[slugify("Quacks of Quedlinburg")]: {
players: "2–4",
youtube: "",
bgstats: "https://bgstats.app/game/the-quacks-of-quedlinburg",
quickStart: `Players: 2–4 • 9 rounds

1) Setup
- Each player: pot board, droplet on 0, rat tail at 0, rubies 0, starting bag (per rules).
- Market: ingredient books for current set.

2) Round
- Simultaneously draw chips, place in pot until you stop or explode.
- Resolve phase: bonus die, rubies, buy ingredients, move rat tails as needed.

Tip: push your luck, but track 7+ white chips carefully.`,
},
};

// ---------- Build the GAMES map ----------
export const GAMES = {};
for (const name of NAMES) {
const slug = slugify(name);
const base = {
name,
slug,
players: "", // fill if you want it on the list
};
GAMES[slug] = { ...base, ...(ENRICH[slug] || {}) };
}

// ---------- Link builder ----------
export function buildLinks(game) {
const slug = game.slug;
const bgstats = game.bgstats || (DEFAULTS.bgstatsBase ? DEFAULTS.bgstatsBase + slug : "");
const notion = game.notion || (DEFAULTS.notionBase ? DEFAULTS.notionBase + slug : "");
const storage = game.storage || (DEFAULTS.storageBase ? DEFAULTS.storageBase + slug + ".html" : "");
// rulebook default: /rulebooks/<slug>.pdf (works on GitHub Pages in same repo)
const rules = game.rulebook || `${DEFAULTS.rulebookBase}${slug}.pdf`;

return {
youtube: game.youtube || DEFAULTS.youtube || "",
bgstats,
notion,
storage,
rules,
};
}
