/* Pretty /game/<slug>/ links and the existing ?game= links.
   Run: node tests/game-links.mjs
   Uses Playwright Chromium. Not part of the site. */
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

async function loadChromium() {
  const from = process.env.PLAYWRIGHT_PATH || "playwright";
  const mod = await import(from);
  return mod.chromium || (mod.default && mod.default.chromium);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = "/opt/cursor/artifacts";
const failures = [];
let drop = false;

function assert(cond, message) {
  if (!cond) failures.push(message);
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function serveFile(req, res) {
  if (drop) {
    req.socket.destroy();
    return;
  }
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const bare = rel.replace(/\/+$/, "");
  const asDir = path.join(root, bare.replace(/^\/+/, ""));
  if (bare && fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) {
    rel = bare + "/index.html";
  } else if (rel.endsWith("/")) {
    rel += "index.html";
  }
  rel = rel.replace(/^\/+/, "");
  if (!rel || rel.split("/").includes("..")) {
    res.writeHead(403);
    res.end();
    return;
  }
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("missing");
    return;
  }
  const body = fs.readFileSync(file);
  const type = mime[path.extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store", "content-length": body.length });
  res.end(body);
}

function listen(handler) {
  return new Promise(function (resolve) {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

function getText(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      const chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    }).on("error", reject);
  });
}

async function textOf(page, selector) {
  await page.waitForSelector(selector);
  return (await page.locator(selector).innerText()).trim();
}

async function shot(page, name) {
  fs.mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, name), fullPage: false });
}

async function goOffline(page, context) {
  drop = true;
  await context.setOffline(true);
}

async function goOnline(page, context) {
  drop = false;
  await context.setOffline(false);
}

async function main() {
  const site = await listen(serveFile);
  const base = "http://127.0.0.1:" + site.address().port;
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const logs = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", function (err) { logs.push("PAGE " + err.message); });
    page.on("console", function (msg) {
      if (msg.type() === "error") logs.push("CONSOLE " + msg.text());
    });

    const preview = await getText(base + "/game/root/");
    assert(preview.includes('property="og:title" content="Root"'), "root og:title");
    assert(preview.includes('rel="canonical" href="https://bgquick.com/game/root/"'), "root canonical meta");
    assert(preview.includes('property="og:url" content="https://bgquick.com/game/root/"'), "root og:url");
    assert(preview.includes('content="Root. 2–4 players, 60–90 min."'), "root description");

    const crews = [
      ["the-crew-the-quest-for-planet-nine", "The Crew: The Quest for Planet Nine"],
      ["the-crew-mission-deep-sea", "The Crew: Mission Deep Sea"],
      ["the-crew-journey-to-the-ends-of-the-earth", "The Crew: Journey to the Ends of the Earth"]
    ];

    await page.goto(base + "/?game=root", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Root", "old ?game=root title");
    const oldRoot = new URL(page.url());
    assert(oldRoot.pathname === "/", "old ?game=root stayed on / (" + oldRoot.pathname + ")");
    assert(oldRoot.hash.indexOf("#/game/root") === 0, "old ?game=root hash " + oldRoot.hash);
    assert(!oldRoot.pathname.startsWith("/game/"), "old ?game= was redirected");

    await page.goto(base + "/?game=" + encodeURIComponent("The Crew: The Quest for Planet Nine"), { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "The Crew: The Quest for Planet Nine", "old quest title");
    assert(new URL(page.url()).pathname === "/", "old quest stayed on /");
    await shot(page, "game-crew-quest-phone.png");

    await page.goto(base + "/?game=the-crew-mission-deep-sea", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "The Crew: Mission Deep Sea", "old deep sea title");

    await page.goto(base + "/?game=" + encodeURIComponent("The Crew: Journey to the Ends of the Earth"), { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "The Crew: Journey to the Ends of the Earth", "old journey title");

    await page.goto(base + "/?game=kinfire-delve-vainglorys-grotto", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Kinfire Delve: Vainglory's Grotto", "old kinfire id");
    assert(new URL(page.url()).pathname === "/", "old kinfire stayed on /");

    await page.goto(base + "/?game=" + encodeURIComponent("Kinfire Delve: Vainglory's Grotto"), { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Kinfire Delve: Vainglory's Grotto", "old kinfire name");

    await page.goto(base + "/?game=root&players=4", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Root", "old root with players");
    assert((await page.locator('#pc-text').innerText()).includes("21 or more"), "old URL 4p setup");
    assert(await page.locator('button[data-count="4"][aria-pressed="true"]').count() === 1, "old URL 4p pressed");
    const oldPlayers = new URL(page.url());
    assert(oldPlayers.pathname === "/", "players query was not navigated off /");
    assert(oldPlayers.hash.indexOf("players=4") !== -1, "players kept in the hash " + oldPlayers.hash);
    await page.evaluate(function () {
      navigator.share = function (data) {
        window.__shared = data.url;
        return Promise.resolve();
      };
    });
    await page.locator("#share").click();
    const shared = await page.evaluate(function () { return window.__shared || ""; });
    const sharedUrl = new URL(shared);
    assert(sharedUrl.pathname === "/game/root/", "share path " + shared);
    assert(sharedUrl.searchParams.get("players") === "4", "share keeps players " + shared);
    assert(new URL(page.url()).pathname === "/", "share did not leave the NFC URL");

    await page.goto(base + "/game/root/", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Root", "pretty root title");
    assert(new URL(page.url()).pathname === "/game/root/", "pretty root pathname");
    const logo = await page.evaluate(function () { return document.querySelector(".header-logo").src; });
    assert(logo.endsWith("/logo.png") && logo.indexOf("/game/root/") === -1, "logo resolved from the site root: " + logo);
    const canonical = await page.evaluate(function () {
      var link = document.querySelector('link[rel="canonical"]');
      return link ? link.href : "";
    });
    assert(new URL(canonical).pathname === "/game/root/", "canonical link " + canonical);
    assert((await page.locator("#pc-text").innerText()).includes("dominance"), "pretty root default 2p");
    await page.locator('button[data-count="4"]').click();
    assert((await page.locator("#pc-text").innerText()).includes("21 or more"), "pretty root 4p click");
    await shot(page, "game-root-phone.png");

    await page.goto(base + "/game/root/?players=4", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Root", "pretty root players title");
    assert(new URL(page.url()).searchParams.get("players") === "4", "pretty URL kept ?players=");
    assert((await page.locator("#pc-text").innerText()).includes("21 or more"), "pretty URL 4p setup");
    await page.locator("#teach-link").click();
    await page.waitForFunction(function () {
      var title = document.querySelector("h2.title");
      return title && title.innerText === "Teach it";
    });
    const teachUrl = new URL(page.url());
    assert(teachUrl.pathname === "/game/root/", "teach stayed on /game/root/ (" + teachUrl.pathname + ")");
    assert(teachUrl.hash.indexOf("#/game/root/teach") === 0, "teach hash " + teachUrl.hash);
    assert(teachUrl.searchParams.get("players") === "4", "teach kept ?players=");
    assert(await page.locator('button[data-count="4"][aria-pressed="true"]').count() === 1, "teach followed players=4");

    const faction = encodeURIComponent("Marquise de Cat");
    await page.goto(base + "/game/root/#/game/root/teach?count=4&chars=" + faction, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () {
      var title = document.querySelector("h2.title");
      return title && title.innerText === "Teach it";
    });
    assert((await page.locator(".byline").innerText()) === "Root", "teach byline");
    assert((await page.locator('.char-chip[aria-pressed="true"]').innerText()) === "Marquise de Cat", "faction chip");
    assert((await page.locator("#teach-script").innerText()).includes("cats start spread"), "faction teach script");
    assert(new URL(page.url()).pathname === "/game/root/", "faction URL stayed pretty");
    await page.locator('.char-chip[aria-pressed="true"]').scrollIntoViewIfNeeded();
    await shot(page, "game-root-teach-phone.png");

    for (const pair of crews) {
      await page.goto(base + "/game/" + pair[0] + "/", { waitUntil: "domcontentloaded" });
      assert(await textOf(page, "h2.title") === pair[1], "pretty " + pair[0]);
    }
    await page.goto(base + "/game/kinfire-delve-vainglorys-grotto/", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Kinfire Delve: Vainglory's Grotto", "pretty kinfire");
    await shot(page, "game-kinfire-phone.png");

    await page.goto(base + "/game/root/?players=4", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () { return navigator.serviceWorker.controller; });
    await page.waitForSelector("html[data-game-cached='root']");
    const scope = await page.evaluate(async function () {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? reg.scope : "";
    });
    assert(scope === base + "/", "service worker scope " + scope);

    const cachedGamePages = await page.evaluate(async function () {
      const names = await caches.keys();
      const urls = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) urls.push(req.url);
      }
      return urls.filter(function (url) { return url.indexOf("/game/") !== -1; }).length;
    });
    assert(cachedGamePages > 0 && cachedGamePages < 20, "visited game pages cached, not all 741: " + cachedGamePages);

    await goOffline(page, context);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "Root", "offline pretty root");
    assert((await page.locator("#pc-text").innerText()).includes("21 or more"), "offline pretty 4p");
    assert(new URL(page.url()).pathname === "/game/root/", "offline pretty path");

    await page.goto(base + "/?game=the-crew-mission-deep-sea", { waitUntil: "domcontentloaded" });
    assert(await textOf(page, "h2.title") === "The Crew: Mission Deep Sea", "offline old deep sea");
    assert(new URL(page.url()).pathname === "/", "offline old URL stayed on /");
  } catch (err) {
    failures.push(err && err.stack ? err.stack : String(err));
  } finally {
    if (failures.length && logs.length) console.log(logs.slice(0, 40).join("\n"));
    await browser.close();
    site.close();
  }
}

main().then(function () {
  if (failures.length) {
    console.error(failures.join("\n\n"));
    process.exit(1);
  }
  console.log("game link checks passed");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
