// assets/games.js
(function(){
const slugify = (name) =>
name.toLowerCase()
.replace(/[:’'"]/g, "")
.replace(/&/g, "and")
.replace(/[^a-z0-9]+/g, "-")
.replace(/(^-|-$)/g, "");

// --- Your collection (base names) ---
const NAMES = [
"7 Wonders","7 Wonders Duel","Acquire","Air, Land & Sea: Critters at War","Archduke","Ark Nova",
"Ark Nova: Marine Worlds","Azul","Azul: Crystal Mosaic","Backgammon","Brass: Birmingham","Candy Land: Bluey",
"Century: Golem Edition","Chess","Chronicles of Crime","Cover Your Assets","Critters at War: Flies, Lies, and Supplies",
"Dune: Imperium - Uprising","Dutch Blitz","Everdell","The Fellowship of the Ring Trick-Taking Game","Fire Tower",
"Fire Tower: Rising Flames","Five Crowns","For Sale","For Sale: Advisors","Forbidden Island","Foundations of Metropolis",
"Heat: Pedal to the Metal","Heat: Heavy Rain","Jaipur","Kingdomino","Kingdomino Origins","Monopoly Deal",
"Moonrakers: Titan Edition","Moonrakers: Dark Matter","Moonrakers: The Endless","Moonrakers: The Shard","Moonrakers: Starfall",
"Moonrollers","New York Zoo","Pan Am","PARKS","PARKS: Nightfall","PARKS: Wildlife","Patchwork","Play Nine",
"Quacks of Quedlinburg","Quacks of Quedlinburg: Alchemists","Quacks of Quedlinburg: Herb Witches","Radlands","Rage",
"Ravine","Ravine: The Spirits Expansion","Rook","Rummikub","Sail","Sequence","Skip-Bo","Sky Team","Sniper Elite","Splendor",
"Star Wars: The Deck-Building Game","Vinhos Deluxe Edition","Watergate","Wingspan","Project L","Project L: Finesse",
"Project L: Ghost","Harmonies","Wingspan: European Expansion","Forest Shuffle","Heat: Tunnel Vision","Brink","Tend"
];

// --- Optional per-game enrichments: fill what you know now; add more later ---
const ENRICH = {
[slugify("Heat: Pedal to the Metal")]: {
players:"2–6",
year: "2022",
youtube: "https://www.youtube.com/watch?v=REPLACE_HEAT_VIDEO",
bgstats: "https://bgstats.app/game/heat-pedal-to-the-metal",
// reminders: "/reminders/heat-pedal-to-the-metal.html", // leave blank if you haven't created it
// rulebook: "/rulebooks/heat-pedal-to-the-metal.pdf", // default already does this; override if needed
quickStart: `Players: 2–6 • Setup ~5–7 min

1) Track & Modules
- Choose track; shuffle track cards as required.
- If using Heavy Rain: place rain boards; shuffle weather.

2) Player Setup
- Each: car, dashboard, starting gear & hand.
- Scenario starting money & upgrades.

3) Decks & Supply
- Shuffle stress/heat per rules; set weather tokens & slipstream.

4) Round (high level)
- Select speed → reveal → resolve heat/stress → move → slipstream → cleanup.

Tips: Don’t burn heat early; plan corners; slipstream when possible.`
},

[slugify("Quacks of Quedlinburg")]: {
players:"2–4",
year:"2018",
youtube:"https://www.youtube.com/watch?v=REPLACE_QUACKS_VIDEO",
bgstats:"https://bgstats.app/game/the-quacks-of-quedlinburg",
quickStart:`Players: 2–4 • 9 rounds

Setup
- Each player: pot board, droplet at 0, rat at 0, rubies 0, starting bag (per rules).
- Ingredient books for chosen set.

Round
- Simultaneously draw & place chips; stop or risk explosion.
- Resolve: bonus die, rubies, buy ingredients, rats next round.

Tips: Track white chips; manage risk near 7+.`
},

[slugify("Wingspan")]: {
players:"1–5",
year:"2019",
youtube:"https://www.youtube.com/watch?v=REPLACE_WINGSPAN_VIDEO",
quickStart:`Players: 1–5 • 4 rounds

Setup
- Deal bird cards & food; keep some, pay others.
- Player mats & cubes; round goals per board.

Turn (choose 1):
- Play a bird; Gain food; Lay eggs; Draw cards.
- Resolve habitat powers right-to-left.

Tips: Eggs are points; balance engine vs goals.`
}
};

// --- Build the export ---
const GAMES = {};
for (const name of NAMES) {
const slug = slugify(name);
GAMES[slug] = { name, slug, ...(ENRICH[slug] || {}) };
}

// Expose globally (non-module)
window.GAMES = GAMES;
})();
