/* Cody's collection gap pass: official setup diagrams and verified Rulebook chips.
   node tests/check-collection-gaps.mjs */
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
const games = JSON.parse(html.slice(open, html.indexOf("</script>", open)));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function fold(value) {
  return String(value || "").replace(/[\u2018\u2019\u2032`]/g, "'").replace(/\s+/g, " ").toLowerCase();
}
function pageText(slug, pageNum) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "rulebooks/index", slug + ".json"), "utf8"));
  const page = data.pages.find((row) => row.page === pageNum);
  return fold((page && page.lines || []).join(" "));
}

const photos = {
  "bomb-busters": "Example setup from the Bomb Busters rulebook",
  mycelia: "Shared setup from the Mycelia rulebook",
  "moon-colony-bloodbath": "Setup overview from the Moon Colony Bloodbath rulebook",
  "star-wars-villainous": "Player setup diagram from the Star Wars Villainous rulebook"
};
const owners = ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"];
for (const [slug, altStart] of Object.entries(photos)) {
  const metaPath = path.join(root, "setup-photos", slug + ".json");
  const imagePath = path.join(root, "setup-photos", slug + ".webp");
  check(slug + " setup json", fs.existsSync(metaPath));
  check(slug + " setup image", fs.existsSync(imagePath) && fs.statSync(imagePath).size > 8000);
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const blob = JSON.stringify(meta);
  check(slug + " alt names the diagram", String(meta.alt || "").startsWith(altStart));
  check(slug + " src is the webp", meta.src === slug + ".webp");
  check(slug + " has no link", !meta.href && !/https?:/i.test(blob));
  check(slug + " names nobody", owners.every((name) => !new RegExp("\\b" + name + "\\b").test(blob)));
}

const chips = [
  [3, "Place your Villain mover on the Villain portrait"],
  [6, "Actions covered this way are blocked."],
  [6, "As soon as a player fulfills their Villain's Objective, the game ends and that player wins!"],
  [3, "The first player does not start with any Credits. The second player starts with 1 Credit."],
  [3, "The third and fourth players start with 2 Credits each."]
];
const villain = games.enrich["star-wars-villainous"];
const stored = JSON.stringify(villain);
for (const [page, query] of chips) {
  const text = pageText("star-wars-villainous", page);
  const folded = fold(query);
  check("quote once on page " + page + ": " + query.slice(0, 42), text.split(folded).length - 1 === 1);
  check("chip stored: " + query.slice(0, 42), stored.includes(query));
}
check("villainous mover chip page", villain.quickStart.bullets[1].source.page === 3);
check("villainous blocked chip page", villain.turnStructure.bullets[1].source.page === 6);
check("villainous win chip page", villain.endOfGame.bullets[0].source.page === 6);
check("two-player credits chip", villain.setupByPlayerCount["2"][0].source.page === 3);
check("four-player credits chip", villain.setupByPlayerCount["4"][0].source.page === 3);

check("worker version", sw.includes('var VERSION = "2026.11.21.25";'));
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
  const type = file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "text/html; charset=utf-8";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

for (const slug of Object.keys(photos)) {
  await page.goto(origin + "/index.html#/game/" + slug, { waitUntil: "domcontentloaded" });
  const img = page.locator("#setup-photo img");
  await img.waitFor({ state: "visible", timeout: 15000 });
  const loaded = await img.evaluate((node) => node.complete && node.naturalWidth > 200);
  check(slug + " phone setup photo loaded", loaded);
  await page.locator("#setup-photo").screenshot({ path: path.join(shots, "setup-" + slug + "-phone.png") });
}

await page.goto(origin + "/index.html#/game/star-wars-villainous", { waitUntil: "domcontentloaded" });
const mover = page.getByText("The mover starts on the portrait", { exact: false }).first();
await mover.waitFor({ state: "visible" });
const moverChip = page.locator("a.rulebook-ref[data-query='Place your Villain mover on the Villain portrait']");
check("mover rulebook chip is on the page", await moverChip.count() === 1);
await page.locator('.pc-btn[data-count="4"]').click();
const fourChip = page.locator("a.rulebook-ref[data-query='The third and fourth players start with 2 Credits each.']");
await fourChip.waitFor({ state: "visible" });
check("four-player credits chip shows at 4", await fourChip.count() === 1);
await fourChip.locator("xpath=ancestor::li[1]").screenshot({ path: path.join(shots, "villainous-credits-chip-phone.png") });

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("collection gaps ok");
