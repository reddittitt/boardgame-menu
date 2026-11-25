#!/usr/bin/env node
/* Phone-width check for Rules questions, Go Deeper, and count-specific play time. */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  const ext = path.extname(file);
  const type = ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : ext === ".png" ? "image/png" : "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = "http://127.0.0.1:" + port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const failures = [];
function check(name, ok) {
  if (!ok) failures.push(name);
  console.log((ok ? "ok " : "FAIL ") + name);
}

await page.goto(origin + "/index.html#/game/wingspan", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#questions-slot");
const questions = page.locator("#questions-slot");
const questionNote = questions.locator("details");
if ((await questionNote.getAttribute("open")) === null) await questionNote.locator("summary").click();
check("rules questions heading", (await questions.locator("summary").innerText()).includes("Rules questions"));
check("common mistakes still present", (await page.locator("#mistakes-slot summary").innerText()).includes("Common mistakes"));
const items = questions.locator(".rule-list > li");
check("five core rulings", (await items.count()) === 5);
check("first three visible", await items.nth(0).isVisible() && await items.nth(1).isVisible() && await items.nth(2).isVisible());
check("fourth starts hidden", await items.nth(3).isHidden());
const more = questions.locator(".show-more-toggle");
check("show 2 more", (await more.innerText()).trim() === "Show 2 more");
await questions.locator("summary").scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(shots, "rules-questions-phone.png") });
await more.click();
check("fourth visible after show more", await items.nth(3).isVisible() && await items.nth(4).isVisible());
check("show less", (await more.innerText()).trim() === "Show less");
check("official mark", (await questions.locator(".rules-official").count()) === 5);
const source = questions.locator(".rules-source").first();
check("source link", (await source.getAttribute("href")).startsWith("https://stonemaiergames.com/"));
check("source label", (await source.innerText()).trim() === "Source");
const questionText = await questions.innerText();
check("no forum username", !/@|jamey|stegmaier/i.test(questionText));
const deeper = page.locator("#go-deeper");
check("go deeper collapsed", (await deeper.getAttribute("open")) === null);
await deeper.locator("summary").click();
check("go deeper opens", (await deeper.getAttribute("open")) !== null);
check("topic group", (await deeper.innerText()).includes("Bird powers"));
await deeper.scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(shots, "go-deeper-phone.png") });

await page.goto(origin + "/index.html#/game/azul", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".title");
check("azul has no rules questions", (await page.locator("#questions-slot").count()) === 0 || await page.locator("#questions-slot").isHidden());
check("azul has no go deeper", (await page.locator("#go-deeper").count()) === 0);

await page.goto(origin + "/index.html#/game/new-york-zoo", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#play-time-value");
await page.locator('.pc-btn[data-count="1"]').click();
const solo = page.locator("#play-time-value");
check("solo time from the rulebook", (await solo.innerText()).trim() === "about 20 min");
check("solo time highlighted", (await solo.getAttribute("class") || "").includes("is-count-time"));
check("solo accessible name", (await solo.getAttribute("aria-label") || "").includes("1 player"));
await page.locator(".game-meta-bar").screenshot({ path: path.join(shots, "play-time-phone.png") });
await page.locator('.pc-btn[data-count="4"]').click();
check("four player falls back", (await solo.innerText()).includes("30"));
check("fallback is not highlighted", !((await solo.getAttribute("class") || "").includes("is-count-time")));

await page.goto(origin + "/index.html#/game/container", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#mistakes-slot");
check("container mistakes filled", (await page.locator("#mistakes-slot").evaluate((el) => el.textContent)).includes("Container Island"));
check("container deep only", await page.locator("#questions-slot").isHidden());
check("container go deeper present", (await page.locator("#go-deeper").count()) === 1);

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
check("worker ignores other origins", /url\.origin !== self\.location\.origin\) return;/.test(sw));
check("cache version bumped", /var VERSION = "2026\.11\.21\.12"/.test(sw));

await browser.close();
server.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("rules questions ok");
