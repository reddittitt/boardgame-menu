/* Expansion chips keep the BoardGameGeek thing that matches the chip label.
   Run: node tests/expansion-bgg-ids.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function idFromUrl(url) {
  const match = String(url || "").match(/(\d+)\s*$/);
  return match ? match[1] : "";
}

const html = read("index.html");
const jsonStart = html.indexOf('<script id="games-json"');
const enrich = JSON.parse(html.slice(html.indexOf(">", jsonStart) + 1, html.indexOf("</script>", jsonStart))).enrich;
const guides = JSON.parse(read("expansion-guides.json"));
const components = JSON.parse(read("components.json"));

const fixed = {
  "marvel-villainous": {
    "Mischief & Malice": ["335528", "316765"],
    "Twisted Ambitions": ["379056", "372644"],
    "We Are Venom": ["369671", "399355"]
  },
  "7-wonders": {
    Cities: ["111661", "108745"]
  },
  "7-wonders-duel": {
    Pantheon: ["202976", "199786"]
  },
  "fire-tower": {
    "Rising Flames": ["311033", "276224"]
  },
  "project-l": {
    "Project L: Ghost Piece": ["284988", "312993"],
    "Project L: Finesse": ["287508", "291789"]
  }
};

for (const [slug, names] of Object.entries(fixed)) {
  const game = enrich[slug];
  assert(game, "missing " + slug);
  if (!game) continue;
  for (const [name, [id, previous]] of Object.entries(names)) {
    const chip = (game.expansions || []).find((exp) => exp && exp.name === name);
    assert(chip, slug + " chip " + name);
    if (!chip) continue;
    assert(String(chip.bggId) === id, slug + " / " + name + " bgg id " + chip.bggId);
    assert(String(chip.bggId) !== previous, slug + " / " + name + " still has " + previous);
    const guide = guides[slug] && guides[slug].expansions && guides[slug].expansions[name];
    assert(guide, slug + " guide " + name);
    if (guide) assert(idFromUrl(guide.sourceUrl) === id, slug + " / " + name + " guide id " + guide.sourceUrl);
    const block = components[slug] && components[slug].expansions && components[slug].expansions[name];
    if (block && block.bggId) assert(String(block.bggId) === id, slug + " / " + name + " component id");
    if (block && Array.isArray(block.items)) {
      block.items.forEach((item) => {
        const tagged = Array.isArray(item.expansion) ? item.expansion : [];
        assert(tagged.includes(name), slug + " / " + name + " component row lost its expansion tag");
      });
    }
  }
}

assert(!html.includes('"bggId": "316765"'), "old Mischief & Malice id is gone");
assert(!html.includes('"bggId": "372644"'), "old Twisted Ambitions id is gone");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("expansion bgg ids ok");
