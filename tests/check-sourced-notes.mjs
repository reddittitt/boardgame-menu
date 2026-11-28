#!/usr/bin/env node
/* Play time by player count and official common-mistake quotes.
   Every quote is taken from the rulebook index and must match it. */
import fs from "fs";
import path from "path";
import http from "http";
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

function indexPages(slug) {
  return JSON.parse(fs.readFileSync(path.join(root, "rulebooks/index", slug + ".json"), "utf8")).pages || [];
}
function pageBlob(slug, pageNum) {
  const page = indexPages(slug).find((p) => p.page === pageNum);
  if (!page) return "";
  return page.lines.map((line) => line.replace(/\u0007/g, "")).join(" ").replace(/\s+/g, " ").trim();
}
function extract(indexSlug, start, end) {
  for (const page of indexPages(indexSlug)) {
    const text = page.lines.map((line) => line.replace(/\u0007/g, "")).join(" ").replace(/\s+/g, " ").trim();
    const i = text.indexOf(start);
    if (i < 0) continue;
    const j = text.indexOf(end, i);
    if (j < 0) return null;
    return { page: page.page, quote: text.slice(i, j + end.length).replace(/\s+/g, " ").trim() };
  }
  return null;
}
function mistakeTexts(value, out) {
  out = out || [];
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => mistakeTexts(item, out));
    return out;
  }
  if (typeof value === "object") {
    if (value.text) out.push(value);
    if (Array.isArray(value.bullets)) mistakeTexts(value.bullets, out);
  }
  return out;
}

const overallTimes = [
  { slug: "brink", text: "90–120 min", index: "brink", must: ["PLAYERS: 2-5", "MINUTES: 90-120"] },
  { slug: "for-sale", text: "20–30 min", index: "for-sale", must: ["Duration: 20 - 30 minutes"] },
  { slug: "sagrada", text: "30 min", index: "sagrada", must: ["1 TO 4 PLAYERS - 30 MINUTES"] },
  { slug: "forest-shuffle", text: "60 min", index: "forest-shuffle", must: ["Playing time: 60 minutes", "2-5 players"] },
  { slug: "moonrollers", text: "30–45 min", index: "moonrollers", must: ["2-5 players that takes", "30-45 minutes"] },
  { slug: "celestia", text: "30 min", index: "celestia", must: ["2 – 6 players", "30 minutes"] },
  { slug: "graft", text: "about 40 min", index: "graft", must: ["approximately 40 minutes to play"] },
  { slug: "tend", text: "60–90 min", index: "tend", must: ["Players: 1-6+", "Playtime: 60-90 minutes"] },
  { slug: "battle-line", text: "30 min", index: "battle-line", must: ["Playing Time: 30 minutes"] },
  { slug: "bohnanza", text: "about 45 min", index: "bohnanza", must: ["Duration: approx. 45 minutes"] },
  { slug: "carpe-diem", text: "45–75 min", index: "carpe-diem", must: ["Playing Time: 45-75 minutes"] },
  { slug: "costa-rica", text: "30–45 min", index: "costa-rica", must: ["Play time: 30-45 minutes"] },
  { slug: "illusion", text: "about 15 min", index: "illusion", must: ["Duration: app. 15 min."] },
  { slug: "l-l-a-m-a", text: "about 20 min", index: "l-l-a-m-a", must: ["Duration: about 20 minutes"] },
  { slug: "oh-my-goods", text: "30 min", index: "oh-my-goods", must: ["Playing time: 30 minutes"] },
  { slug: "silver-and-gold", text: "about 20 min", index: "silver-and-gold", must: ["Duration: approx. 20 min."] },
  { slug: "the-mind", text: "about 15 min", index: "the-mind", must: ["Duration: app. 15 min."] }
];
const perPlayerTimes = [
  { slug: "agricola", text: "half an hour per player, shorter as a Family game", counts: ["1", "2", "3", "4", "5"], index: "agricola", must: ["Half an hour per player, shorter as a Family game"] },
  { slug: "caverna-the-cave-farmers", text: "about 30 min per player", counts: ["1", "2", "3", "4", "5", "6", "7"], index: "caverna-the-cave-farmers", must: ["about 30 minutes per player"] },
  { slug: "the-gallerist", text: "30 min per player", counts: ["1", "2", "3", "4"], index: "the-gallerist", must: ["1 to 4 Players", "30 MIN per Player"] },
  { slug: "star-wars-villainous", text: "20 min per player", counts: ["2", "3", "4"], index: "star-wars-villainous", must: ["2 to 4 Players", "20 Minutes per Player"] },
  { slug: "marvel-villainous", text: "20 min per player", counts: ["2", "3", "4"], index: "marvel-villainous", must: ["2 to 4 Players", "20 Minutes per Player"] }
];
const overallTimesBatch2 = [
  { slug: "onitama", text: "usually 15 min", index: "onitama", must: ["Each game is quick, usually 15 minutes in length."] },
  { slug: "ravine", text: "20 min", index: "ravine", must: ["3-6 PLAYERS 20 MINUTES"] },
  { slug: "shallow-regrets", text: "15 min", index: "shallow-regrets", must: ["2-3 PLAYERS | AGES 8+ | 15 MINUTES"] },
  { slug: "kinfire-delve-vainglorys-grotto", text: "around 1 hour", index: "kinfire-delve-vainglorys-grotto", must: ["Kinfire Delve: Vainglory\u2019s Grotto is a game for 1-2 players that takes around 1 hour to play."] },
  { slug: "dont-l-l-a-m-a-dice", text: "about 20 min", index: "dont-l-l-a-m-a-dice", must: ["Playing time: about 20 minutes"] },
  { slug: "wits-and-wagers", text: "25 min", index: "wits-and-wagers", must: ["Playing Time: 25 minutes"] },
  { slug: "zooloretto", text: "45 min", index: "zooloretto", must: ["playing time 45 minutes"] },
  { slug: "spirit-island", text: "about 90\u2013120 min", index: "spirit-island", must: ["Spirit Island takes about 90-120 minutes to play"] },
  { slug: "scythe", text: "115 min", index: "scythe", must: ["1-5 PLAYERS \u2022 115 MINUTES"] },
  { slug: "mr-jack-pocket", text: "about 15 min", index: "mr-jack-pocket", must: ["A game lasts about fifteen minutes and takes a maximum of eight turns."] },
  { slug: "no-thanks", text: "about 20 min", index: "no-thanks", must: ["about 20 minutes"] },
  { slug: "monza", text: "10 - 15 minutes approx.", index: "monza", must: ["Length of the game: 10 - 15 minutes approx."] }
];
const overallTimesBatch3 = [
  { slug: "photosynthesis", text: "45\u201360 min", index: "photosynthesis", page: 1, must: ["45-60 Minutes"] },
  { slug: "small-world", text: "40\u201380 min", index: "small-world", page: 1, must: ["40-80 minutes"] },
  { slug: "worlds-fair-1893", text: "40 min", index: "worlds-fair-1893", page: 1, must: ["2-4 Players | 40 Minutes"] },
  { slug: "colosseum", text: "60\u201390 min", index: "colosseum", page: 1, must: ["60\u201390 Minutes"] },
  { slug: "iberia", text: "45 min", index: "iberia", page: 1, must: ["45 minutes."] },
  { slug: "whale-riders", text: "45 min", index: "whale-riders", page: 1, must: ["2-6 players / 45 minutes"] },
  { slug: "take-5", text: "about 45 min", index: "take-5", page: 1, must: ["2\u201310 players about 45 minutes"] },
  { slug: "word-on-the-street", text: "20\u201330 min", index: "word-on-the-street", page: 1, must: ["2\u201310 Players 20\u201330 Minutes"] },
  { slug: "new-york-1901", text: "30\u201360 min", index: "new-york-1901", page: 1, must: ["30-60 Minutes"] },
  { slug: "race-to-the-treasure", text: "20 min", index: "race-to-the-treasure", page: 1, must: ["2-4 players 20 minutes"] },
  { slug: "the-ancient-world-second-edition", text: "90 min", index: "the-ancient-world-second-edition", page: 2, must: ["2-4 Players 90 Minutes"] },
  { slug: "rhino-hero", text: "approx. 5\u201315 min", index: "rhino-hero", page: 2, must: ["approx. 5 - 15 minutes"] }
];
const overallTimesBatch4 = [
  { slug: "horrified", text: "60 min", index: "horrified", page: 1, must: ["1 TO 5 PLAYERS \u2022 AGES 10 AND UP \u2022 60 MINUTES"] },
  { slug: "gingerbread-house", text: "30\u201345 min", index: "gingerbread-house", page: 1, must: ["Playing time: 30 to 45 minutes"] },
  { slug: "icecool2", text: "30 min", index: "icecool2", page: 2, must: ["with a playing time of 30 minutes"] },
  { slug: "kings-forge", text: "60 min", index: "kings-forge", page: 2, must: ["2-4 players 60 minutes"] },
  { slug: "medici", text: "60 min", index: "medici", page: 1, must: ["60 minutes to play"] },
  { slug: "trains", text: "45 min", index: "trains", page: 2, must: ["Play Time: 45 minutes"] },
  { slug: "viral", text: "60\u201390 min", index: "viral", page: 2, must: ["incubating for 60 to 90 minutes"] },
  { slug: "the-grizzled", text: "roughly 30 min", index: "the-grizzled", page: 2, must: ["with a length of roughly 30 minutes"] },
  { slug: "tybor-the-builder", text: "about 30 min", index: "tybor-the-builder", page: 1, must: ["Playing time: ~30 minutes"] },
  { slug: "archaeology-the-new-expedition", text: "20 min", index: "archaeology-the-new-expedition", page: 2, must: ["playing time of 20 minutes"] },
  { slug: "blokus-3d", text: "typically 15\u201320 min", index: "blokus-3d", page: 1, must: ["Games typically last 15 to 20 minutes."] },
  { slug: "blokus-trigon", text: "typically 20\u201330 min", index: "blokus-trigon", page: 1, must: ["Games typically last 20 to 30 minutes."] }
];
const overallTimesBatch5 = [
  { slug: "deadwood-1876", text: "20\u201340 min", index: "deadwood-1876", page: 1, must: ["2 - 9 PLAYERS AGES 13+ 20 - 40 MINUTES"] },
  { slug: "disney-villainous-the-worst-takes-it-all", text: "50 min", index: "disney-villainous-the-worst-takes-it-all", page: 1, must: ["2 to 6 Players \u2022 Ages 10 and Up \u2022 50 Minutes"] },
  { slug: "flip-city", text: "30\u201350 min", index: "flip-city", page: 1, must: ["1-4 Players 8+Years. 30-50 Mins."] },
  { slug: "ghosts-of-christmas", text: "40 min", index: "ghosts-of-christmas", page: 1, must: ["3-4 Players 40 Mins"] },
  { slug: "9-lives", text: "15 min", index: "9-lives", page: 1, must: ["3-4 Players 15 Mins"] },
  { slug: "dandelions", text: "15 min", index: "dandelions", page: 1, must: ["2-3 Players 15 Mins"] },
  { slug: "joraku", text: "40\u201360 min", index: "joraku", page: 2, must: ["Players: 3-4 Time: 40-60min"] },
  { slug: "my-little-scythe", text: "45\u201360 min", index: "my-little-scythe", page: 1, must: ["1-6 players | 45-60 minutes | ages 8+"] },
  { slug: "on-tour", text: "20 min", index: "on-tour", page: 1, must: ["1 - 4+ players | 20 min"] },
  { slug: "planet", text: "30 min", index: "planet", page: 1, must: ["2 to 4 players \u2013 8 and up \u2013 30 Minutes"] },
  { slug: "vivid-memories", text: "30\u201360 min", index: "vivid-memories", page: 1, must: ["30\u201360 min"] },
  { slug: "10-days-in-europe", text: "20\u201330 min", index: "10-days-in-europe", page: 1, must: ["2-4 Players Ages 8 to Adult 20-30 Minutes per Game"] }
];

function rulebookHas(index, must) {
  return indexPages(index).some((page) => {
    const text = page.lines.join(" ").replace(/\s+/g, " ");
    return must.every((bit) => text.includes(bit));
  });
}
for (const row of overallTimes) {
  const game = games[row.slug];
  check(row.slug + " is one rulebook duration", game && game.rulebookTime === row.text && game.playTimeSource === "rulebook" && !game.playTimeByPlayerCount);
  check(row.slug + " rulebook states that duration", rulebookHas(row.index, row.must));
}
for (const row of perPlayerTimes) {
  const game = games[row.slug];
  const map = game && game.playTimeByPlayerCount;
  check(row.slug + " per-player rule on every count", !!map && game.playTimeSource === "rulebook" && row.counts.every((count) => map[count] === row.text) && Object.keys(map).length === row.counts.length);
  check(row.slug + " rulebook states the per-player time", rulebookHas(row.index, row.must));
}
check("twelve more rulebook durations", overallTimesBatch2.length === 12);
for (const row of overallTimesBatch2) {
  const game = games[row.slug];
  check(row.slug + " is one rulebook duration", game && game.rulebookTime === row.text && game.playTimeSource === "rulebook" && !game.playTimeByPlayerCount);
  check(row.slug + " rulebook states that duration", rulebookHas(row.index, row.must));
}
check("twelve rulebook durations in batch 3", overallTimesBatch3.length === 12);
for (const row of overallTimesBatch3) {
  const game = games[row.slug];
  check(row.slug + " is one rulebook duration", game && game.rulebookTime === row.text && game.playTimeSource === "rulebook" && !game.playTimeByPlayerCount);
  check(row.slug + " rulebook states that duration", rulebookHas(row.index, row.must) && pageBlob(row.index, row.page).includes(row.must[0]));
}
check("twelve rulebook durations in batch 4", overallTimesBatch4.length === 12);
for (const row of overallTimesBatch4) {
  const game = games[row.slug];
  check(row.slug + " is one rulebook duration", game && game.rulebookTime === row.text && game.playTimeSource === "rulebook" && !game.playTimeByPlayerCount);
  check(row.slug + " rulebook states that duration", rulebookHas(row.index, row.must) && pageBlob(row.index, row.page).includes(row.must[0]));
}
check("twelve rulebook durations in batch 5", overallTimesBatch5.length === 12);
for (const row of overallTimesBatch5) {
  const game = games[row.slug];
  check(row.slug + " is one rulebook duration", game && game.rulebookTime === row.text && game.playTimeSource === "rulebook" && !game.playTimeByPlayerCount);
  check(row.slug + " rulebook states that duration", rulebookHas(row.index, row.must) && pageBlob(row.index, row.page).includes(row.must[0]));
}

const quoteSpecs = [
  ["7-wonders-duel", "7-wonders-duel", "Important: resources aren’t spent during construction.", "is never reduced."],
  ["7-wonders-duel", "7-wonders-duel", "Note that the purchasing cost is calculated according to the resources present", "paid to the bank."],
  ["7-wonders-duel", "7-wonders-duel", "Clarification: the scientific symbols are found on the scientific Buildings", "and on a Progress token."],
  ["7-wonders-second-edition", "7-wonders-second-edition", "Important: You can never construct two identical Buildings", "the same name."],
  ["7-wonders-second-edition", "7-wonders-second-edition", "Important: Resources used for constructing are never lost", "of the entire game."],
  ["catan", "catan", "Important: A hex with the robber does not", "when its number is rolled."],
  ["catan", "catan", "Important: You may not give away cards in any way", "is not allowed)."],
  ["hanabi", "hanabi", "IMPORTANT: The player must give complete information.", "BOTH green cards."],
  ["hanabi", "hanabi", "IMPORTANT: The player must clearly point to the cards", "point to anything.)"],
  ["lost-cities", "lost-cities", "Important: Each new card you place in a column must have a", "placed in this column."],
  ["lost-cities", "lost-cities", "Important: You are not allowed to draw", "you have just discarded."],
  ["lost-cities", "lost-cities", "Important: This bonus is not multiplied by wager cards!", "Important: This bonus is not multiplied by wager cards!"],
  ["forest-shuffle", "forest-shuffle", "Important: You are limited to 10 cards in hand.", "draw one card."],
  ["the-quacks-of-quedlinburg", "the-quacks-of-quedlinburg", "Important: If the last chip drawn causes the pot to explode,", "the flask cannot be used!"],
  ["splendor-duel", "splendor-duel", "Important: During the game, when you must take a Privilege", "nothing happens."],
  ["toy-battle", "toy-battle", "Important: In this rulebook and the player aid, the notion of “base” always includes special bases.", "The H.Q. is not a base."],
  ["toy-battle", "toy-battle", "Important: Empty bases, or bases occupied by enemy Troops,", "to your H.Q."],
  ["castle-combo", "castle-combo", "Important: if the card you purchase has a discount ability, its own", "and not this one."],
  ["the-fellowship-of-the-ring-trick-taking-game", "the-fellowship-of-the-ring-trick-taking-game", "Important: Only the 1 of Rings can win any trick; the 2", "like any other card"],
  ["the-two-towers-trick-taking-game", "the-two-towers-trick-taking-game", "Important: Only the 1 of Rings can win any trick; the 2", "like any other card"],
  ["watergate", "watergate", "Important: When following a card’s instructions, you have to fully carry out all", "can be ignored."],
  ["air-land-and-sea", "air-land-and-sea", "Important: Covered cards", "can never be flipped."],
  ["everdell-the-complete-collection", "everdell", "Important: When playing a Critter for", "once per Construction."],
  ["everdell-the-complete-collection", "everdell", "Note, the occupied token is not removed", "removed from your city."],
  ["everdell-the-complete-collection", "everdell", "Important: Players do not have to", "at the same time."]
];

for (const [slug, index, start, end] of quoteSpecs) {
  const found = extract(index, start, end);
  const items = mistakeTexts(games[slug] && games[slug].commonMistakes);
  const item = items.find((row) => row.text === (found && found.quote));
  check(slug + " quotes " + start.slice(0, 42), !!found && !!item && item.source && item.source.page === found.page);
  if (found && item) {
    const blob = pageBlob(index, item.source.page);
    check(slug + " quote is verbatim on page " + found.page, blob.includes(found.quote) && found.quote.indexOf(item.source.query) === 0);
  }
}

function firstGameBullets(value, out) {
  out = out || [];
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => firstGameBullets(item, out));
    return out;
  }
  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text) out.push(value);
    if (Array.isArray(value.bullets)) firstGameBullets(value.bullets, out);
  }
  return out;
}
function occurrences(text, query) {
  let count = 0;
  let from = 0;
  while (query) {
    const at = text.indexOf(query, from);
    if (at < 0) break;
    count += 1;
    from = at + query.length;
  }
  return count;
}

const firstGames = [
  {
    slug: "pandemic",
    bullets: [
      { page: 3, text: "Use 4 Epidemic cards for your first game.", query: "Use 4 Epidemic cards for your first game." },
      { page: 7, text: "When playing the Introductory game (4 Epidemic cards), place your cards face up in front of you, for all players to see.", query: "place your cards face up in front of you, for all players to see." }
    ]
  },
  {
    slug: "acquire",
    bullets: [
      { page: 4, text: "If this is your first game, we recommend Tycoon Mode.", query: "we recommend Tycoon Mode." },
      { page: 4, text: "If it is your first time playing, we recommend displaying stocks and money.", query: "we recommend displaying stocks and money." }
    ]
  },
  {
    slug: "wandering-towers",
    bullets: [
      { page: 3, text: "For your first game: Place the 2 magic spells, Advance a Wizard and Advance a Tower (see Magic Spells, p. 8), face up near the circular path. Return the other 6 magic spells to the box.", query: "Return the other 6 magic spells to the box." }
    ]
  },
  {
    slug: "flamecraft",
    bullets: [
      { page: 5, text: "Choose either the Purple or Golden Enchantment deck (we recommend Purple for your first game).", query: "we recommend Purple for your first game" }
    ]
  },
  {
    slug: "arcs",
    bullets: [
      { page: 21, text: "Really, don’t play your first game with Leaders and Lore.", query: "don’t play your first game with Leaders and Lore." }
    ]
  },
  {
    slug: "seti",
    bullets: [
      { page: 22, text: "If this is your first game of SETI, consider choosing the 1-star difficulty. The lack of objectives will help ease you into the game as you won't need to learn everything at once.", query: "consider choosing the 1-star difficulty." }
    ]
  },
  {
    slug: "7-wonders-duel",
    bullets: [
      { page: 7, text: "For your first game, ignore the Wonders Selection phase and take the following Wonders tiles: Player 1: the Pyramids the Great Lighthouse the Temple of Artemis the Statue of Zeus Player 2: Circus Maximus Piraeus the Appian Way the Colossus", query: "ignore the Wonders Selection phase" }
    ]
  },
  {
    slug: "heat-pedal-to-the-metal",
    bullets: [
      { page: 3, text: "for your first game use the USA track, and consider only racing 1 lap as a learning experience instead of the regular 2 laps as printed on the board", query: "use the USA track, and consider only racing 1 lap" }
    ]
  },
  {
    slug: "rebel-princess-deluxe-edition",
    bullets: [
      { page: 5, text: "If this is your first game, we recommend starting with Round cards a, b,c, d, and e.", query: "Round cards a, b,c, d, and e." }
    ]
  },
  {
    slug: "parks",
    bullets: [
      { page: 3, text: "For your first game, just deal one to each player. Return any unused Year cards facedown to the box.", query: "just deal one to each player." }
    ]
  },
  {
    slug: "moon-colony-bloodbath",
    bullets: [
      { page: 3, text: "for your first game, use two Twists with the word “Twist” in white (they’re simpler).", query: "two Twists with the word “Twist” in white" }
    ]
  },
  {
    slug: "brass-birmingham",
    bullets: [
      { page: 7, text: "some players may prefer to play a shorter introductory game for their first experience. The introductory game plays exactly like the full game, except you only play the Canal Era and there are additional scoring rules to make players’ scores more closely reflect their success in the Canal Era.", query: "you only play the Canal Era" }
    ]
  },
  {
    slug: "catan",
    bullets: [
      { page: 4, text: "If this is your first time playing CATAN®, we recommend using the setup shown here.", query: "we recommend using the setup shown here." }
    ]
  },
  {
    slug: "tend",
    bullets: [
      { page: 7, text: "If this is your first time playing Tend, we recommend removing the task cards marked as \"advanced\".", query: "removing the task cards marked as \"advanced\"." }
    ]
  },
  {
    slug: "tiny-towns",
    bullets: [
      { page: 2, text: "For your first game, you may want to play without monuments.", query: "you may want to play without monuments." }
    ]
  }
];

check("fifteen new first-game games", firstGames.length >= 12 && firstGames.length <= 15);
for (const row of firstGames) {
  const game = games[row.slug];
  const stored = firstGameBullets(game && game.firstGameSetup);
  const section = game && game.firstGameSetup && Array.isArray(game.firstGameSetup.bullets);
  check(row.slug + " has first-game notes", !!game && game.mine === true && section && stored.length === row.bullets.length);
  row.bullets.forEach((spec, index) => {
    const item = stored[index];
    const blob = pageBlob(row.slug, spec.page);
    const query = item && item.source && item.source.query;
    check(
      row.slug + " first-game quote " + (index + 1) + " is on page " + spec.page,
      !!item &&
        item.text === spec.text &&
        blob.includes(item.text) &&
        item.source &&
        item.source.page === spec.page &&
        query === spec.query &&
        item.text.includes(query) &&
        blob.includes(query) &&
        occurrences(blob, query) === 1
    );
  });
}


const firstGamesBatch2 = [
  {
    slug: "7-wonders-second-edition",
    bullets: [
      { page: 4, text: "At the start of your first game, we recommend paying attention to everyone’s actions, playing one after another, to familiarize yourself with the game.", query: "we recommend paying attention to everyone’s actions" }
    ]
  },
  {
    slug: "root",
    bullets: [
      { page: 4, text: "If any players are new to the game, use the Standard Setup (5.1) If everyone has played and you want more variety, use the Advanced Setup (Appendix A).", query: "If any players are new to the game" }
    ]
  },
  {
    slug: "targi",
    bullets: [
      { page: 1, text: "During the first game, rather than learning the symbols before playing the game, you can simply place the cards with the back sides facing up to show the writing.", query: "place the cards with the back sides facing up" }
    ]
  },
  {
    slug: "sniper-elite-the-board-game",
    bullets: [
      { page: 4, text: "If anyone at the table is playing for the first time, we suggest using the Launch Facility map.", query: "we suggest using the Launch Facility map." },
      { page: 4, text: "For your first game you may want to assign loadout cards and specialists at random, until you learn what cards suit your play style.", query: "assign loadout cards and specialists at random" }
    ]
  },
  {
    slug: "oath",
    bullets: [
      { page: 2, text: "If you are playing for the first time, use the setup in the Playbook instead.", query: "use the setup in the Playbook instead." }
    ]
  },
  {
    slug: "sky-team",
    bullets: [
      { page: 3, text: "NOTE: This is the setup for the basic game. All other components not mentioned here (in the closed compartment) are part of the game’s advanced modules; you can leave these in the box for now.", query: "you can leave these in the box for now." }
    ]
  },
  {
    slug: "turing-machine",
    bullets: [
      { page: 2, text: "Choose a Problem to solve (on the next page). Numbers are introductory problems, perfect for new players.", query: "introductory problems, perfect for new players" }
    ]
  },
  {
    slug: "celestia",
    bullets: [
      { page: 7, text: "Variant Beginner Adventurers The Power cards are discarded and will not be used in the game. The Magic Spyglass cards are discarded, too. Nevertheless, the Turbo cards are used. The end of the game is different: At the beginning of a new journey, players check the number of different Treasure cards they own. The game ends as soon as a player has 5 different types of treasure. Then the points are counted as in the normal game.", query: "The Power cards are discarded and will not be used in the game" }
    ]
  },
  {
    slug: "chronicles-of-crime",
    bullets: [
      { page: 4, text: "Try the short tutorial investigation to get familiar with the game. Instructions are explained in this scenario to understand how the game works.", query: "Try the short tutorial investigation" }
    ]
  },
  {
    slug: "ravine",
    bullets: [
      { page: 2, text: "DIFFICULTY is controlled by the number of Night cards you decide to play with; follow the recommendations below as a guide: BEGINNER: 8 | NORMAL: 12 | DIFFICULT: 16+", query: "BEGINNER: 8 | NORMAL: 12 | DIFFICULT: 16+" }
    ]
  },
  {
    slug: "container",
    bullets: [
      { page: 20, text: "As such, we recommend first-time players use the default rules rather than the Classic Variant.", query: "As such, we recommend first-time players use the default rules rather than the Classic Variant." }
    ]
  },
  {
    slug: "raccoon-tycoon",
    bullets: [
      { page: 12, text: "Beginning Gamers and First-Time Players of Raccoon Tycoon: If any of the players is young or new to these kinds of games, remove the ‘Advanced Buildings’ from play. This will make the game easier to learn and play.", query: "remove the ‘Advanced Buildings’ from play" }
    ]
  }
];

check("twelve more first-game games", firstGamesBatch2.length === 12);
for (const row of firstGamesBatch2) {
  const game = games[row.slug];
  const stored = firstGameBullets(game && game.firstGameSetup);
  const setup = game && game.firstGameSetup;
  const section = !!setup && !Array.isArray(setup) && Array.isArray(setup.bullets) && !Object.keys(setup).some((key) => /^\d+$/.test(key) || key === "*");
  check(row.slug + " has a first-game section", !!game && game.mine === true && section && stored.length === row.bullets.length);
  row.bullets.forEach((spec, index) => {
    const item = stored[index];
    const blob = pageBlob(row.slug, spec.page);
    const query = item && item.source && item.source.query;
    check(
      row.slug + " first-game quote " + (index + 1) + " is on page " + spec.page,
      !!item &&
        item.text === spec.text &&
        blob.includes(item.text) &&
        item.source &&
        item.source.page === spec.page &&
        query === spec.query &&
        item.text.includes(query) &&
        blob.includes(query) &&
        occurrences(blob, query) === 1
    );
  });
}


const firstGamesBatch3 = [
  {
    slug: "azul-duel",
    bullets: [
      { page: 2, lead: "Scoring tablets", text: "For your first game, find the 3 Scoring tablets and place them,", query: "find the 3 Scoring tablets" },
      { page: 2, lead: "Then choose", text: "Once you are familiar with the game, choose or randomly determine which sides and which 3 (or 4) Scoring tablets to use.", query: "Once you are familiar with the game" }
    ]
  },
  {
    slug: "cover-your-assets",
    bullets: [
      { page: 3, lead: "Classic rules", text: "We recommend starting with the classic rules.", query: "We recommend starting with the classic rules." }
    ]
  },
  {
    slug: "dune-imperium-uprising",
    bullets: [
      { page: 16, lead: "Skip CHOAM", text: "We recommend that you play without it at least once to familiarize yourself with the game.", query: "play without it at least once" }
    ]
  },
  {
    slug: "new-york-zoo",
    bullets: [
      { page: 1, lead: "Skip the overview", text: "When you read the rules for the first time, you can simply ignore it.", query: "you can simply ignore it." }
    ]
  },
  {
    slug: "pan-am",
    bullets: [
      { page: 11, lead: "First round", text: "For the first round, try to claim a Route during the Resolution phase by assigning an Engineer to the Routes", query: "try to claim a Route during the Resolution phase" }
    ]
  },
  {
    slug: "burgle-bros-2-the-casino-capers",
    bullets: [
      { page: 3, lead: "Suspicion", text: "For your first heist, you start at 6 Suspicion.", query: "you start at 6 Suspicion." }
    ]
  },
  {
    slug: "the-crew-the-quest-for-planet-nine",
    bullets: [
      { page: 11, lead: "Mission 1", text: "You now know all the basic rules and can start with your first mission. To do so, flip this book over and read the logbook.", query: "flip this book over and read the logbook." }
    ]
  },
  {
    slug: "kingdomino",
    bullets: [
      { page: 2, lead: "Castles", text: "Before your first game, assemble the 4 3D castles.", query: "assemble the 4 3D castles." }
    ]
  },
  {
    slug: "bomb-busters",
    bullets: [
      { page: 1, lead: "Dial", text: "Install the dial on the board before the first game", query: "Install the dial on the board" }
    ]
  },
  {
    slug: "thunder-road-vendetta",
    bullets: [
      { page: 2, lead: "Rotors", text: "BEFORE YOUR FIRST GAME Carefully push the rotors onto the choppers.", query: "push the rotors onto the choppers." }
    ]
  },
  {
    slug: "jaipur",
    bullets: [
      { page: 4, lead: "Advice later", text: "NB: it is best to read this after your first game.", query: "read this after your first game." }
    ]
  }
];

check("eleven more first-game games", firstGamesBatch3.length === 11);
for (const row of firstGamesBatch3) {
  const game = games[row.slug];
  const stored = firstGameBullets(game && game.firstGameSetup);
  const setup = game && game.firstGameSetup;
  const section = !!setup && !Array.isArray(setup) && Array.isArray(setup.bullets) && !Object.keys(setup).some((key) => /^\d+$/.test(key) || key === "*");
  check(row.slug + " has a first-game section", !!game && game.mine === true && section && stored.length === row.bullets.length);
  row.bullets.forEach((spec, index) => {
    const item = stored[index];
    const blob = pageBlob(row.slug, spec.page);
    const query = item && item.source && item.source.query;
    check(
      row.slug + " first-game quote " + (index + 1) + " is on page " + spec.page,
      !!item &&
        item.lead === spec.lead &&
        item.text === spec.text &&
        blob.includes(item.text) &&
        item.source &&
        item.source.page === spec.page &&
        query === spec.query &&
        item.text.includes(query) &&
        blob.includes(query) &&
        occurrences(blob, query) === 1
    );
  });
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
check("worker version", sw.includes('var VERSION = "2026.11.21.59";'));
const fetchAt = sw.indexOf('self.addEventListener("fetch"');
const originAt = sw.indexOf("if (url.origin !== self.location.origin) return;", fetchAt);
check("fetch handler returns before other origins", originAt > fetchAt && originAt < sw.indexOf("respondWith", fetchAt));

const shots = process.env.SHOT_DIR || "/opt/cursor/artifacts";
fs.mkdirSync(shots, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const isPdf = rel.toLowerCase().endsWith(".pdf");
  const type = isPdf ? "application/pdf" : "text/html; charset=utf-8";
  if (isPdf && req.headers.range) {
    const stat = fs.statSync(file);
    const match = /bytes=(\d+)-(\d*)/.exec(String(req.headers.range));
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
      if (start <= end && start < stat.size) {
        res.writeHead(206, {
          "content-type": type,
          "accept-ranges": "bytes",
          "content-range": "bytes " + start + "-" + end + "/" + stat.size,
          "content-length": end - start + 1
        });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
    }
  }
  const headers = { "content-type": type };
  if (isPdf) {
    const stat = fs.statSync(file);
    headers["accept-ranges"] = "bytes";
    headers["content-length"] = stat.size;
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const execSeen = [];
function noteExec(url) {
  if (/\/exec(\?|$)/.test(url)) execSeen.push(url);
}
page.on("request", (req) => noteExec(req.url()));
await page.route("**/*script.google.com/**", (route) => {
  noteExec(route.request().url());
  return route.abort();
});
await page.route("**/*script.googleusercontent.com/**", (route) => {
  noteExec(route.request().url());
  return route.abort();
});
const relayPdf = new Map();
await page.route("**/*bgquick-rulebooks-relay.bgquick.workers.dev/**", async (route) => {
  const request = route.request();
  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    return;
  }
  const pdfUrl = request.url().split("#")[0];
  if (!relayPdf.has(pdfUrl)) {
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error("relay " + res.status + " " + pdfUrl);
    relayPdf.set(pdfUrl, Buffer.from(await res.arrayBuffer()));
  }
  const buf = relayPdf.get(pdfUrl);
  const range = request.headers()["range"];
  const match = range && /bytes=(\d+)-(\d*)/.exec(range);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = match[2] ? Math.min(parseInt(match[2], 10), buf.length - 1) : buf.length - 1;
    const slice = buf.subarray(start, end + 1);
    await route.fulfill({
      status: 206,
      contentType: "application/pdf",
      headers: {
        "accept-ranges": "bytes",
        "content-range": "bytes " + start + "-" + end + "/" + buf.length,
        "content-length": String(slice.length)
      },
      body: slice
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/pdf",
    headers: { "accept-ranges": "bytes", "content-length": String(buf.length) },
    body: buf
  });
});

await page.goto(origin + "/index.html#/game/for-sale", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
await page.locator('.pc-btn[data-count="4"]').click();
const forSale = (await page.locator("#play-time-value").innerText()).trim();
const forSaleSource = (await page.locator("#play-time-source").innerText()).trim();
check("for sale shows the rulebook duration", forSale === "20–30 min");
check("for sale labels the rulebook", forSaleSource.toLowerCase() === "rulebook");
check("for sale is not a count time", !((await page.locator("#play-time-value").getAttribute("class")) || "").includes("is-count-time"));
check("for sale has no count in the name", !(await page.locator("#play-time-value").getAttribute("aria-label")));
await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-for-sale-phone.png") });

await page.goto(origin + "/index.html#/game/agricola", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
await page.locator('.pc-btn[data-count="3"]').click();
check("agricola shows half an hour per player", (await page.locator("#play-time-value").innerText()).includes("half an hour per player"));
await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-agricola-phone.png") });

await page.goto(origin + "/index.html#/game/the-mind", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
await page.locator('.pc-btn[data-count="4"]').click();
const mind = page.locator("#play-time-value");
check("the mind shows the book duration", (await mind.innerText()).trim() === "about 15 min");
check("the mind labels the rulebook", ((await page.locator("#play-time-source").innerText()).trim().toLowerCase()) === "rulebook");
check("the mind is not a count time", !((await mind.getAttribute("class")) || "").includes("is-count-time"));
check("the mind has no count in the name", !(await mind.getAttribute("aria-label")));
await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-the-mind-phone.png") });

await page.goto(origin + "/index.html#/game/battle-line", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
check("battle line shows 30 min", (await page.locator("#play-time-value").innerText()).trim() === "30 min");
check("battle line labels the rulebook", ((await page.locator("#play-time-source").innerText()).trim().toLowerCase()) === "rulebook");
check("battle line is not a count time", !((await page.locator("#play-time-value").getAttribute("class")) || "").includes("is-count-time"));
check("battle line has no player-count buttons", await page.locator('.pc-btn[data-count]').count() === 0);

async function countRate(slug, fileSlug) {
  await page.goto(origin + "/index.html#/game/" + slug, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play-time-value");
  const value = page.locator("#play-time-value");
  await page.locator('.pc-btn[data-count="2"]').click();
  check(slug + " shows the rulebook rate", (await value.innerText()).trim() === "20 min per player");
  check(slug + " labels the rulebook", ((await page.locator("#play-time-source").innerText()).trim().toLowerCase()) === "rulebook");
  check(slug + " is a count time", ((await value.getAttribute("class")) || "").includes("is-count-time"));
  check(slug + " names 2 players", (await value.getAttribute("aria-label") || "") === "20 min per player at 2 players");
  await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-" + fileSlug + "-2-phone.png") });
  await page.locator("#table-bar").screenshot({ path: path.join(shots, "play-time-" + fileSlug + "-buttons-2-phone.png") });
  await page.locator('.pc-btn[data-count="4"]').click();
  check(slug + " keeps the rate at 4", (await value.innerText()).trim() === "20 min per player");
  check(slug + " stays a count time", ((await value.getAttribute("class")) || "").includes("is-count-time"));
  check(slug + " names 4 players", (await value.getAttribute("aria-label") || "") === "20 min per player at 4 players");
  await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-" + fileSlug + "-4-phone.png") });
  await page.locator("#table-bar").screenshot({ path: path.join(shots, "play-time-" + fileSlug + "-buttons-4-phone.png") });
}
await countRate("star-wars-villainous", "star-wars-villainous");
await countRate("marvel-villainous", "marvel-villainous");

await page.goto(origin + "/index.html#/game/the-gallerist", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
const galleristStored = await page.evaluate(() => {
  const raw = JSON.parse(document.getElementById("games-json").textContent);
  const game = raw.enrich["the-gallerist"] || {};
  return {
    source: game.playTimeSource || "",
    overall: game.rulebookTime || "",
    map: game.playTimeByPlayerCount || null
  };
});
check("gallerist page carries the rulebook rate", galleristStored.source === "rulebook" && !galleristStored.overall && galleristStored.map && ["1", "2", "3", "4"].every((count) => galleristStored.map[count] === "30 min per player") && Object.keys(galleristStored.map).length === 4);
const galleristCounts = await page.locator('.pc-btn[data-count]').count();
const gallerist = page.locator("#play-time-value");
if (galleristCounts) {
  await page.locator('.pc-btn[data-count="1"]').click();
  check("gallerist shows the rulebook rate", (await gallerist.innerText()).trim() === "30 min per player");
  check("gallerist labels the rulebook", ((await page.locator("#play-time-source").innerText()).trim().toLowerCase()) === "rulebook");
  check("gallerist is a count time", ((await gallerist.getAttribute("class")) || "").includes("is-count-time"));
  check("gallerist names 1 player", (await gallerist.getAttribute("aria-label") || "") === "30 min per player at 1 player");
  await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-the-gallerist-phone.png") });
  await page.locator("#table-bar").screenshot({ path: path.join(shots, "play-time-the-gallerist-buttons-phone.png") });
  await page.locator('.pc-btn[data-count="4"]').click();
  check("gallerist keeps the rate at 4", (await gallerist.innerText()).trim() === "30 min per player");
  check("gallerist names 4 players", (await gallerist.getAttribute("aria-label") || "") === "30 min per player at 4 players");
  await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-the-gallerist-4-phone.png") });
} else {
  check("gallerist shows the rulebook rate", (await gallerist.innerText()).trim() === "30 min per player");
  check("gallerist labels the rulebook", ((await page.locator("#play-time-source").innerText()).trim().toLowerCase()) === "rulebook");
  check("gallerist does not guess a count", !((await gallerist.getAttribute("class")) || "").includes("is-count-time"));
  check("gallerist has no count in the name", !(await gallerist.getAttribute("aria-label")));
  await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-the-gallerist-phone.png") });
}

await page.goto(origin + "/index.html#/game/7-wonders-duel", { waitUntil: "domcontentloaded" });
await page.locator('#chapter-pager [aria-label="On your turn"]').click();
await page.waitForSelector("#mistakes-slot summary");
const note = page.locator("#mistakes-slot details");
if ((await note.getAttribute("open")) === null) await note.locator("summary").click();
const mistakeText = await page.locator("#mistakes-slot").innerText();
check("duel shows the unspent-resources quote", mistakeText.includes("resources aren’t spent during construction"));
check("duel quote links to the rulebook", (await page.locator("#mistakes-slot .rulebook-ref").first().innerText()).trim() === "Rulebook");
await page.locator("#mistakes-slot").screenshot({ path: path.join(shots, "mistakes-7-wonders-duel-phone.png") });

await page.goto(origin + "/index.html#/game/catan", { waitUntil: "domcontentloaded" });
await page.locator('#chapter-pager [aria-label="On your turn"]').click();
await page.waitForSelector("#mistakes-slot summary");
const catanNote = page.locator("#mistakes-slot details");
if ((await catanNote.getAttribute("open")) === null) await catanNote.locator("summary").click();
check("catan shows the robber quote", (await page.locator("#mistakes-slot").innerText()).includes("A hex with the robber does not produce resources"));
await page.locator("#mistakes-slot").screenshot({ path: path.join(shots, "mistakes-catan-phone.png") });

for (const row of firstGames) {
  await page.goto(origin + "/index.html#/game/" + row.slug, { waitUntil: "domcontentloaded" });
  const slot = page.locator("#first-game-slot");
  const summary = slot.locator("summary");
  await summary.waitFor();
  const note = slot.locator("details.chapter-note");
  check(row.slug + " first game box is visible", await summary.isVisible());
  check(row.slug + " first game starts closed", (await note.getAttribute("open")) === null);
  check(row.slug + " first game title", (await summary.innerText()).trim() === "First game");
  if (row.slug === "7-wonders-duel") {
    check("duel has no player-count buttons", await page.locator(".pc-btn[data-count]").count() === 0);
  }
  await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await summary.click();
  const shown = await slot.innerText();
  for (const spec of row.bullets) {
    check(row.slug + " shows the first-game quote", shown.includes(spec.text));
  }
  const chips = slot.locator(".rulebook-ref");
  check(row.slug + " first-game rulebook chips", await chips.count() === row.bullets.length);
  for (let index = 0; index < row.bullets.length; index += 1) {
    check(row.slug + " chip " + (index + 1) + " says Rulebook", (await chips.nth(index).innerText()).trim() === "Rulebook");
    check(row.slug + " chip " + (index + 1) + " cites the page", (await chips.nth(index).getAttribute("data-page")) === String(row.bullets[index].page));
  }
  if (row.slug === "7-wonders-duel" || row.slug === "pandemic" || row.slug === "heat-pedal-to-the-metal") {
    await slot.screenshot({ path: path.join(shots, "first-game-" + row.slug + "-phone.png") });
  }
  if (row.slug === "pandemic") {
    await page.locator('.pc-btn[data-count="2"]').click();
    check("pandemic first game stays closed after a count change", (await slot.locator("details.chapter-note").getAttribute("open")) === null);
    await slot.locator("summary").click();
    const again = await slot.innerText();
    check("pandemic keeps the epidemic quote at 2 players", again.includes(row.bullets[0].text));
    check("pandemic keeps the face-up quote at 2 players", again.includes(row.bullets[1].text));
    await slot.screenshot({ path: path.join(shots, "first-game-pandemic-2-phone.png") });
  }
}


const noCountGames = new Set(["targi", "sky-team", "chronicles-of-crime", "ravine"]);
const switchCounts = { root: "4", "7-wonders-second-edition": "4" };
for (const row of firstGamesBatch2) {
  await page.goto(origin + "/index.html#/game/" + row.slug, { waitUntil: "domcontentloaded" });
  const slot = page.locator("#first-game-slot");
  const summary = slot.locator("summary");
  await summary.waitFor();
  const note = slot.locator("details.chapter-note");
  check(row.slug + " first game box is visible", await summary.isVisible());
  check(row.slug + " first game starts closed", (await note.getAttribute("open")) === null);
  check(row.slug + " first game title", (await summary.innerText()).trim() === "First game");
  if (noCountGames.has(row.slug)) {
    check(row.slug + " has no player-count buttons", await page.locator(".pc-btn[data-count]").count() === 0);
  }
  await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await summary.click();
  const shown = await slot.innerText();
  for (const spec of row.bullets) {
    check(row.slug + " shows the first-game quote", shown.includes(spec.text));
  }
  const chips = slot.locator(".rulebook-ref");
  check(row.slug + " first-game rulebook chips", await chips.count() === row.bullets.length);
  for (let index = 0; index < row.bullets.length; index += 1) {
    check(row.slug + " chip " + (index + 1) + " says Rulebook", (await chips.nth(index).innerText()).trim() === "Rulebook");
    check(row.slug + " chip " + (index + 1) + " cites the page", (await chips.nth(index).getAttribute("data-page")) === String(row.bullets[index].page));
  }
  if (row.slug === "targi" || row.slug === "sky-team" || row.slug === "root") {
    await slot.screenshot({ path: path.join(shots, "first-game-" + row.slug + "-phone.png") });
  }
  if (switchCounts[row.slug]) {
    await page.locator('.pc-btn[data-count="' + switchCounts[row.slug] + '"]').click();
    check(row.slug + " first game stays closed after a count change", (await slot.locator("details.chapter-note").getAttribute("open")) === null);
    await slot.locator("summary").click();
    const again = await slot.innerText();
    for (const spec of row.bullets) {
      check(row.slug + " keeps the first-game quote after a count change", again.includes(spec.text));
    }
  }
}


const firstGameSmoke = new Set(["azul-duel", "kingdomino", "pan-am"]);
for (const row of firstGamesBatch3) {
  await page.goto(origin + "/index.html#/game/" + row.slug, { waitUntil: "domcontentloaded" });
  const slot = page.locator("#first-game-slot");
  const summary = slot.locator("summary");
  await summary.waitFor();
  const note = slot.locator("details.chapter-note");
  check(row.slug + " first game box is visible", await summary.isVisible());
  check(row.slug + " first game starts closed", (await note.getAttribute("open")) === null);
  check(row.slug + " first game title", (await summary.innerText()).trim() === "First game");
  await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await summary.click();
  const shown = await slot.innerText();
  for (const spec of row.bullets) {
    check(row.slug + " shows the first-game quote", shown.includes(spec.text));
    check(row.slug + " shows the first-game lead", shown.includes(spec.lead));
  }
  const chips = slot.locator(".rulebook-ref");
  const leads = slot.locator(".rule-lead");
  check(row.slug + " first-game rulebook chips", await chips.count() === row.bullets.length);
  check(row.slug + " first-game leads", await leads.count() === row.bullets.length);
  for (let index = 0; index < row.bullets.length; index += 1) {
    check(row.slug + " chip " + (index + 1) + " says Rulebook", (await chips.nth(index).innerText()).trim() === "Rulebook");
    check(row.slug + " chip " + (index + 1) + " cites the page", (await chips.nth(index).getAttribute("data-page")) === String(row.bullets[index].page));
    check(row.slug + " lead " + (index + 1), (await leads.nth(index).innerText()).trim() === row.bullets[index].lead);
  }
  if (firstGameSmoke.has(row.slug)) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(row.slug + " has no horizontal overflow", overflow <= 1);
    await slot.screenshot({ path: path.join(shots, "first-game-" + row.slug + "-phone.png") });
    for (let index = 0; index < row.bullets.length; index += 1) {
      const spec = row.bullets[index];
      const chip = chips.nth(index);
      check(row.slug + " chip " + (index + 1) + " carries the query", (await chip.getAttribute("data-query")) === spec.query);
      await chip.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await chip.click();
      const viewer = page.locator("#rulebook-viewer");
      await viewer.waitFor({ state: "visible", timeout: 15000 });
      await page.waitForFunction(({ pageNum, query }) => {
        const title = document.getElementById("rulebook-viewer-title");
        const marked = document.querySelector("#rulebook-viewer .rulebook-viewer-note");
        const sheet = document.querySelector('#rulebook-viewer .rulebook-viewer-sheet[data-page="' + pageNum + '"]');
        const focus = sheet && sheet.querySelector(".rulebook-hl--focus");
        if (!title || !marked || !focus) return false;
        const noteText = marked.textContent || "";
        const titleText = title.textContent.trim();
        return titleText.indexOf("\u00b7 " + pageNum + " / ") !== -1 && noteText.includes("Marked") && noteText.includes(query);
      }, { pageNum: spec.page, query: spec.query }, { timeout: 120000 });
      const title = (await page.locator("#rulebook-viewer-title").innerText()).trim();
      const marked = (await page.locator("#rulebook-viewer .rulebook-viewer-note").innerText()).trim();
      const focusOnPage = await page.locator('#rulebook-viewer .rulebook-viewer-sheet[data-page="' + spec.page + '"] .rulebook-hl--focus').count();
      check(row.slug + " chip " + (index + 1) + " opens page " + spec.page, title.indexOf("\u00b7 " + spec.page + " / ") !== -1 && marked.includes("Marked") && marked.includes(spec.query) && focusOnPage > 0);
      await viewer.screenshot({ path: path.join(shots, "first-game-" + row.slug + "-rulebook-" + (index + 1) + "-phone.png") });
      await page.locator("#rulebook-viewer-close").click();
      await viewer.waitFor({ state: "hidden", timeout: 15000 });
      const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(row.slug + " has no horizontal overflow after the rulebook", overflowAfter <= 1);
    }
  }
}

const phoneOverflowSlugs = new Set(["deadwood-1876", "joraku", "my-little-scythe", "planet"]);
async function overallHeader(slug, text, counts) {
  await page.goto(origin + "/index.html#/game/" + slug, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play-time-value");
  const value = page.locator("#play-time-value");
  const source = page.locator("#play-time-source");
  const head = page.locator(".detail-head");
  const title = (await page.locator(".detail-head .title").innerText()).trim();
  check(slug + " header is on screen", await head.isVisible() && title.length > 0);
  check(slug + " shows the rulebook duration", (await value.innerText()).trim() === text && await value.isVisible());
  check(slug + " labels the rulebook", ((await source.innerText()).trim().toLowerCase()) === "rulebook" && await source.isVisible());
  check(slug + " is not a count time", !((await value.getAttribute("class")) || "").includes("is-count-time"));
  if (phoneOverflowSlugs.has(slug)) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(slug + " has no horizontal overflow", overflow <= 1);
  }
  await head.screenshot({ path: path.join(shots, "play-time-" + slug + "-phone.png") });
  const buttons = page.locator(".pc-btn[data-count]");
  const buttonCount = await buttons.count();
  if (slug === "onitama") {
    check("onitama has no player-count buttons", buttonCount === 0);
    check("onitama play time is not blank", (await value.innerText()).trim().length > 0);
  }
  const picks = counts && counts.length ? counts : [];
  if (!picks.length && buttonCount) {
    picks.push(await buttons.first().getAttribute("data-count"));
  }
  if (counts && counts.length) check(slug + " has player-count buttons", buttonCount > 0);
  for (const count of picks) {
    await page.locator('.pc-btn[data-count="' + count + '"]').click();
    check(slug + " keeps the overall time at " + count, (await value.innerText()).trim() === text && await value.isVisible());
    check(slug + " still labels the rulebook at " + count, ((await source.innerText()).trim().toLowerCase()) === "rulebook");
    check(slug + " stays an overall time at " + count, !((await value.getAttribute("class")) || "").includes("is-count-time"));
    if (phoneOverflowSlugs.has(slug)) {
      const overflowAt = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(slug + " has no horizontal overflow at " + count, overflowAt <= 1);
    }
    check(slug + " selected " + count, (await page.locator('.pc-btn[data-count="' + count + '"]').getAttribute("data-active")) === "true");
    await head.screenshot({ path: path.join(shots, "play-time-" + slug + "-" + count + "-phone.png") });
    const bar = page.locator("#table-bar");
    if (await bar.count()) await bar.screenshot({ path: path.join(shots, "play-time-" + slug + "-buttons-" + count + "-phone.png") });
  }
}
await overallHeader("onitama", "usually 15 min");
await overallHeader("spirit-island", "about 90\u2013120 min");
await overallHeader("scythe", "115 min");
await overallHeader("kinfire-delve-vainglorys-grotto", "around 1 hour", ["1", "2"]);
await overallHeader("photosynthesis", "45\u201360 min", ["2"]);
await overallHeader("worlds-fair-1893", "40 min", ["4"]);
await overallHeader("rhino-hero", "approx. 5\u201315 min", ["2"]);
await overallHeader("colosseum", "60\u201390 min");
await overallHeader("horrified", "60 min");
await overallHeader("medici", "60 min", ["2"]);
await overallHeader("blokus-3d", "typically 15\u201320 min");
await overallHeader("gingerbread-house", "30\u201345 min", ["2"]);
await overallHeader("deadwood-1876", "20\u201340 min");
await overallHeader("joraku", "40\u201360 min", ["3"]);
await overallHeader("my-little-scythe", "45\u201360 min");
await overallHeader("planet", "30 min");

check("no production exec request", execSeen.length === 0);
await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("sourced notes ok");
