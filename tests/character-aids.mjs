#!/usr/bin/env node
/* Character aids for the asymmetric games whose unique text is in the
   official booklet. Each checked phrase is also in the rulebook index. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, ok) {
  if (!ok) failures.push(name);
  console.log((ok ? "ok " : "FAIL ") + name);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const open = html.indexOf(">", html.indexOf('<script id="games-json"')) + 1;
const close = html.indexOf("</script>", open);
const RAW = JSON.parse(html.slice(open, close));

function slugify(name) {
  return name.toLowerCase()
    .replace(/[:'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
const games = {};
for (const name of RAW.names) {
  const slug = slugify(name);
  games[slug] = Object.assign({ name, slug }, RAW.enrich[slug] || {});
}

function indexText(slug, pageNum) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "rulebooks/index", slug + ".json"), "utf8"));
  const page = (data.pages || []).find((p) => p.page === pageNum);
  if (!page) return "";
  return page.lines.map((line) => line.replace(/\u0007/g, " ")).join(" ").replace(/\s+/g, " ");
}
function aidText(ch) {
  return JSON.stringify(ch).replace(/\s+/g, " ");
}
function has(hay, needle) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

const sourced = [
  {
    slug: "marvel-villainous",
    label: "Villains",
    names: ["Hela", "Killmonger", "Taskmaster", "Thanos", "Ultron"],
    phrases: [
      ["Hela", 2, "Have a combination of eight"],
      ["Hela", 2, "Odin"],
      ["Killmonger", 2, "Klaw starts the game at The Golden City"],
      ["Killmonger", 2, "Take control of the mines"],
      ["Taskmaster", 2, "Photographic Reflexes"],
      ["Taskmaster", 2, "four different locations"],
      ["Thanos", 15, "Thanos thrives on conflict"],
      ["Thanos", 2, "Collect the six"],
      ["Ultron", 2, "When Age of Ultron is revealed"],
      ["Ultron", 2, "Alkhema"]
    ]
  },
  {
    slug: "star-wars-villainous",
    label: "Villains",
    names: ["Asajj Ventress", "Darth Vader", "General Grievous", "Kylo Ren", "Moff Gideon"],
    phrases: [
      ["Asajj Ventress", 2, "The Banshee"],
      ["Asajj Ventress", 5, "three Missions"],
      ["Darth Vader", 5, "must flip Luke"],
      ["Darth Vader", 2, "Mustafar"],
      ["General Grievous", 5, "eight Lightsabers"],
      ["General Grievous", 2, "Anakin Skywalker"],
      ["Kylo Ren", 5, "six Destiny"],
      ["Kylo Ren", 2, "Knights of Ren"],
      ["Moff Gideon", 5, "Doctor Pershing"],
      ["Moff Gideon", 5, "5 Ambition"]
    ]
  },
  {
    slug: "arcs",
    label: "Leaders",
    names: ["Elder", "Mystic"],
    phrases: [
      ["Elder", 3, "Beloved"],
      ["Elder", 3, "Ransack the"],
      ["Mystic", 21, "The Mystic starts with a"],
      ["Mystic", 21, "Cryptic"],
      ["Mystic", 3, "Tool-Priests"]
    ]
  }
];

for (const spec of sourced) {
  const game = games[spec.slug];
  check(spec.slug + " label", game && game.charactersLabel === spec.label);
  const chars = game && game.characters || [];
  check(spec.slug + " names", chars.map((ch) => ch.name).join("|") === spec.names.join("|"));
  check(spec.slug + " no owner", !/Cody|reddit/i.test(JSON.stringify(chars)));
  for (const ch of chars) {
    const aid = ch.aid || {};
    const text = aidText(ch);
    check(spec.slug + " " + ch.name + " aid", !!(aid.setup && aid.actions && aid.abilities && aid.tip && ch.overview && ch.teachingScript));
    check(spec.slug + " " + ch.name + " page", /page \d+/.test(aid.tip || ""));
    check(spec.slug + " " + ch.name + " no picture file", !aid.reference);
  }
  for (const [name, page, phrase] of spec.phrases) {
    const ch = chars.find((item) => item.name === name);
    const indexed = indexText(spec.slug, page);
    check(spec.slug + " index p" + page + " " + phrase, has(indexed, phrase));
    check(spec.slug + " aid " + name + " " + phrase, ch && has(aidText(ch), phrase));
  }
}

const elder = aidText(games.arcs.characters.find((ch) => ch.name === "Elder"));
check("elder trophies capitalized", elder.includes("any Trophies"));
check("elder ransack capitalized", elder.includes("Ransack the Court"));
check("elder just is the card sentence", elder.includes("When you're scoring Tyrant, gain no Power for second place, and gain Power for second place if you get first place. (Don't get bonus city Power.)"));
check("elder is not the reworded just", !elder.includes("you are scoring") && !elder.includes("Do not get the bonus"));

const hela = aidText(games["marvel-villainous"].characters.find((ch) => ch.name === "Hela"));
check("hela keeps the printed discard sentence", hela.includes("Keep these cards off to the side of your discard pile to help keep track of their Strength."));
check("hela drops the beside paraphrase", !hela.includes("beside the discard"));

const taskmaster = aidText(games["marvel-villainous"].characters.find((ch) => ch.name === "Taskmaster"));
check("butterball card sentence", taskmaster.includes("Butterball cannot be defeated. Before moving your Villain, you may pay 3 Power and discard one card from your hand to remove Butterball."));
check("butterball guide sentence is quoted with a page", taskmaster.includes("Page 2 of the guide also prints: Butterball cannot be defeated via a vanquish action. You must pay 3 Power and discard one card in play to remove him from your Domain."));

const dune = games["dune-imperium-uprising"];
check("dune has no character row", dune && !dune.characters);

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
check("sw version", /var VERSION = "2026\.11\.21\.43";/.test(sw));
check("sw cross-origin return", sw.includes("if (url.origin !== self.location.origin) return;"));
check("sw no pdf added", !fs.existsSync(path.join(root, "rulebooks/marvel-villainous.pdf")));

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
console.log("character aids ok");
