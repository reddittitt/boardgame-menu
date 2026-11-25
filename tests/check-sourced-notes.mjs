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
  { slug: "tend", text: "60–90 min", index: "tend", must: ["Players: 1-6+", "Playtime: 60-90 minutes"] }
];
const perPlayerTimes = [
  { slug: "agricola", text: "half an hour per player, shorter as a Family game", counts: ["1", "2", "3", "4", "5"], index: "agricola", must: ["Half an hour per player, shorter as a Family game"] },
  { slug: "caverna-the-cave-farmers", text: "about 30 min per player", counts: ["1", "2", "3", "4", "5", "6", "7"], index: "caverna-the-cave-farmers", must: ["about 30 minutes per player"] }
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

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
check("worker version", sw.includes('var VERSION = "2026.11.21.15";'));
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
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

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

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("sourced notes ok");
