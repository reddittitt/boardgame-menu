/* Offline and update checks for the installed BGQuick app.
   Run: node tests/pwa-offline.mjs
   Uses Playwright Chromium with offline emulation. Not part of the site. */
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
const config = { version: "build-1", imageCap: 80, drop: false };
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file));
}

function checkStatic() {
  const manifest = JSON.parse(read("manifest.json").toString("utf8"));
  assert(manifest.start_url === "./", "manifest start_url");
  assert(manifest.scope === "./", "manifest scope");
  assert(manifest.display === "standalone", "manifest display");
  assert(manifest.theme_color === "#0b63ff", "manifest theme_color");
  assert(manifest.icons.some(function (icon) { return icon.sizes === "192x192"; }), "icon 192");
  assert(manifest.icons.some(function (icon) { return icon.sizes === "512x512" && icon.purpose === "any"; }), "icon 512");
  assert(manifest.icons.some(function (icon) { return icon.purpose === "maskable"; }), "maskable icon");
  ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-512.png", "offline.html"].forEach(function (file) {
    assert(fs.existsSync(path.join(root, file)), "missing " + file);
  });
  const html = read("index.html").toString("utf8");
  assert(html.includes('rel="manifest"'), "manifest link");
  assert(html.includes("apple-touch-icon"), "apple touch icon link");
  assert(html.includes('apple-mobile-web-app-capable'), "apple web app capable");
  assert(html.includes('name="theme-color"'), "theme-color");
  const sw = read("sw.js").toString("utf8");
  const fetchAt = sw.indexOf('addEventListener("fetch"');
  const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
  const respondAt = sw.indexOf("respondWith", fetchAt);
  assert(fetchAt > 0 && originAt > fetchAt && originAt < respondAt, "cross-origin requests return before respondWith");
  const pdfAt = sw.indexOf("url.pathname)) return;", fetchAt);
  assert(pdfAt > fetchAt && pdfAt < respondAt, "same-origin PDFs are not intercepted");
  const offline = read("offline.html").toString("utf8");
  assert(offline.includes("You're offline"), "offline page copy");
  assert(!offline.includes("owner"), "offline page has no owner name");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function serveFile(req, res) {
  if (req.method === "POST" && req.url.split("?")[0] === "/__test/config") {
    let body = "";
    req.on("data", function (chunk) { body += chunk; });
    req.on("end", function () {
      const next = JSON.parse(body || "{}");
      if (next.version) config.version = String(next.version);
      if (next.imageCap) config.imageCap = Number(next.imageCap);
      if (typeof next.drop === "boolean") config.drop = next.drop;
      res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("ok");
    });
    return;
  }
  if (config.drop) {
    req.socket.destroy();
    return;
  }
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/evict-test.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end("<!doctype html><title>evict</title><script>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(function(reg){function arm(worker){if(!worker)return;if(worker.state==='installed'&&!navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});else worker.addEventListener('statechange',function(){if(worker.state==='installed'&&!navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});});}arm(reg.installing);arm(reg.waiting);});</script>");
    return;
  }
  if (rel === "/") rel = "/index.html";
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
  let body = fs.readFileSync(file);
  const ext = path.extname(file);
  let type = mime[ext] || "application/octet-stream";
  if (rel === "manifest.json") type = "application/manifest+json";
  if (rel === "sw.js") {
    let text = body.toString("utf8");
    text = text.replace('var VERSION = "2026.11.20.2";', 'var VERSION = "' + config.version + '";');
    text = text.replace(/var IMAGE_CAP = \d+;/, "var IMAGE_CAP = " + config.imageCap + ";");
    body = Buffer.from(text);
  } else if (rel === "index.html") {
    let text = body.toString("utf8");
    text = text.replace("<head>\n", '<head>\n<meta name="bgq-build" content="' + config.version + '">\n');
    body = Buffer.from(text);
  }
  res.writeHead(200, { "content-type": type, "cache-control": "no-store", "content-length": body.length });
  res.end(body);
}

function listen(handler) {
  return new Promise(function (resolve) {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", function () {
      resolve(server);
    });
  });
}

async function cacheDump(page) {
  return page.evaluate(async function () {
    const names = await caches.keys();
    const out = {};
    for (const name of names) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).map(function (req) { return req.url; });
    }
    return out;
  });
}

function urlsOf(dump) {
  return Object.values(dump).flat();
}

async function goOffline(page, context) {
  await page.evaluate(async function () {
    const res = await fetch("/__test/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drop: true })
    });
    if (!res.ok) throw new Error("drop");
  });
  await context.setOffline(true);
}

async function goOnline(page, context) {
  await context.setOffline(false);
  await page.evaluate(async function () {
    const res = await fetch("/__test/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drop: false })
    });
    if (!res.ok) throw new Error("undrop");
  });
}

async function main() {
  checkStatic();
  if (failures.length) return;

  const site = await listen(serveFile);
  const probe = await listen(function (req, res) {
    res.writeHead(200, {
      "content-type": "text/plain",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    });
    res.end("relay-probe");
  });
  const base = "http://127.0.0.1:" + site.address().port;
  const probeUrl = "http://127.0.0.1:" + probe.address().port + "/probe";
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const logs = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on("pageerror", function (err) { logs.push("PAGE " + err.message); });
    page.on("console", function (msg) {
      if (msg.type() === "error") logs.push("CONSOLE " + msg.text());
    });

    await page.goto(base + "/#/game/azul", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h2.title");
    assert((await page.locator("h2.title").innerText()) === "Azul", "game title");
    await page.waitForFunction(function () { return navigator.serviceWorker.controller; });
    await page.waitForSelector("html[data-game-cached='azul']");
    await page.waitForFunction(function () {
      const img = document.querySelector("#setup-photo img");
      return img && img.complete && img.naturalWidth > 0;
    });
    assert((await page.locator("#pc-text").innerText()).includes("5 factory"), "2p setup chip");
    await page.locator('.pc-btn[data-count="3"]').click();
    assert((await page.locator("#pc-text").innerText()).includes("7 factory"), "3p setup chip");
    assert(await page.locator(".essential-links").count() > 0, "essential links");
    assert(await page.locator("#teach-link").count() === 1, "teach link");

    await page.evaluate(async function () {
      const cache = await caches.open("bgquick-v1");
      await cache.put(new Request(location.origin + "/stale-marker.txt"), new Response("old"));
    });

    const probeText = await page.evaluate(async function (url) {
      const res = await fetch(url);
      return res.text();
    }, probeUrl);
    assert(probeText === "relay-probe", "cross-origin probe was swallowed");
    const pdfStatus = await page.evaluate(async function () {
      const res = await fetch(new URL("rulebooks/money.pdf", location.href).href);
      return res.status;
    });
    assert(pdfStatus === 200, "pdf fetch status " + pdfStatus);

    await page.locator("#save-offline").click();
    await page.waitForFunction(function () {
      return (document.getElementById("save-offline").textContent || "").indexOf("Saved for offline") !== -1;
    });

    let dump = await cacheDump(page);
    let all = urlsOf(dump);
    assert(!all.some(function (url) { return url.includes("/probe") || /\.pdf($|\?)/i.test(url) || url.includes("workers.dev"); }), "cached a PDF or cross-origin URL: " + all.filter(function (url) { return /\.pdf|probe|workers\.dev/.test(url); }).join(" "));
    assert(all.some(function (url) { return url.endsWith("/setup-photos/azul.json"); }), "setup json cached");
    assert(all.some(function (url) { return url.endsWith("/setup-photos/azul.webp"); }), "setup photo cached");
    assert(all.some(function (url) { return url.endsWith("/rulebooks/index/azul.json"); }), "rulebook index cached by save");
    assert(dump["bgquick-v1"] && dump["bgquick-v1"].length === 1, "stale cache still present before activate of the next version");

    await goOffline(page, context);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h2.title");
    assert((await page.locator("h2.title").innerText()) === "Azul", "offline game title");
    await page.waitForFunction(function () {
      const img = document.querySelector("#setup-photo img");
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.locator('.pc-btn[data-count="4"]').click();
    assert((await page.locator("#pc-text").innerText()).includes("9 factory"), "offline player chip");
    await page.locator("#teach-link").click();
    await page.waitForFunction(function () {
      var title = document.querySelector("h2.title");
      return title && title.innerText === "Teach it";
    });
    assert((await page.locator("h2.title").innerText()) === "Teach it", "offline teach page");
    assert((await page.locator("#teach-script").innerText()).includes("palace wall"), "offline teach script");
    await page.locator("a.home").click();
    await page.waitForSelector("#search");
    await page.locator("#search").fill("zzzqqq-no-game");
    await page.waitForSelector(".empty-note");
    assert((await page.locator(".empty-note").innerText()).includes("No games match"), "offline empty search");
    await page.locator("#search").fill("Azul");
    await page.waitForFunction(function () {
      return document.querySelector("#game-grid").innerText.indexOf("Azul") !== -1;
    });
    await page.locator('#game-grid a[href="#/game/azul"]').click();
    await page.waitForSelector("h2.title");
    assert((await page.locator("h2.title").innerText()) === "Azul", "offline return to game");

    await goOnline(page, context);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("html[data-game-cached='azul']");
    assert((await page.locator('meta[name="bgq-build"]').getAttribute("content")) === "build-1", "build before update");

    const bumped = await page.evaluate(async function (url) {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: "build-2" }) });
      return res.ok;
    }, base + "/__test/config");
    assert(bumped, "version bump request");
    await page.evaluate(function () { return navigator.serviceWorker.getRegistration().then(function (reg) { return reg.update(); }); });
    await page.waitForSelector("#app-update:not([hidden])");
    assert((await page.locator('meta[name="bgq-build"]').getAttribute("content")) === "build-1", "game page did not reload on its own");
    // The list link in the bar is hidden on a game page; the header mark returns to All Games.
    await page.locator("a.header-home-link").click();
    await page.waitForFunction(function () {
      const meta = document.querySelector('meta[name="bgq-build"]');
      return meta && meta.content === "build-2";
    });
    await page.waitForSelector("#search");

    await page.goto(base + "/#/game/azul", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h2.title");
    await page.waitForFunction(function () { return navigator.serviceWorker.controller; });
    const bumpedAgain = await page.evaluate(async function (url) {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: "build-3" }) });
    }, base + "/__test/config");
    void bumpedAgain;
    await page.evaluate(function () { return navigator.serviceWorker.getRegistration().then(function (reg) { return reg.update(); }); });
    await page.waitForSelector("#app-update:not([hidden])");
    assert((await page.locator('meta[name="bgq-build"]').getAttribute("content")) === "build-2", "still on the open game while the update waits");
    await page.locator("#app-update-refresh").click();
    await page.waitForFunction(function () {
      const meta = document.querySelector('meta[name="bgq-build"]');
      return meta && meta.content === "build-3";
    });

    dump = await cacheDump(page);
    const names = Object.keys(dump);
    assert(!names.includes("bgquick-v1"), "old bgquick-v1 cache removed on activate: " + names.join(","));
    assert(!names.some(function (name) { return name === "bgquick-shell-build-1" || name === "bgquick-shell-build-2"; }), "previous shell caches removed: " + names.join(","));
    assert(names.includes("bgquick-shell-build-3"), "current shell cache: " + names.join(","));
    assert(urlsOf(dump).some(function (url) { return url.endsWith("/setup-photos/azul.json"); }), "setup json survived the shell update");

    await goOffline(page, context);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () {
      const img = document.querySelector("#setup-photo img");
      return img && img.complete && img.naturalWidth > 0;
    });
    assert((await page.locator("h2.title").innerText()) === "Azul", "offline after update");

    await page.evaluate(async function () {
      const names = await caches.keys();
      for (const name of names) {
        if (name.indexOf("bgquick-shell") !== 0) continue;
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const path = new URL(req.url).pathname;
          if (path.endsWith("/") || path.endsWith("/index.html")) await cache.delete(req);
        }
      }
    });
    const offlineResponse = await page.goto(base + "/no-such-page", { waitUntil: "domcontentloaded" });
    assert(offlineResponse !== null, "offline navigation produced no response");
    assert((await page.locator("h1").innerText()) === "You're offline", "offline fallback page");
    await context.close();

    config.drop = false;
    config.version = "evict-1";
    config.imageCap = 2;
    const evictContext = await browser.newContext();
    const evictPage = await evictContext.newPage();
    evictPage.setDefaultTimeout(45000);
    await evictPage.goto(base + "/evict-test.html", { waitUntil: "domcontentloaded" });
    await evictPage.waitForFunction(function () { return navigator.serviceWorker.controller; });
    await evictPage.evaluate(async function () {
      const urls = ["covers/azul.webp", "covers/wingspan.webp", "covers/catan.webp", "covers/chess.webp"];
      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url);
      }
    });
    const imageCount = await evictPage.evaluate(async function () {
      const cache = await caches.open("bgquick-images");
      return (await cache.keys()).length;
    });
    assert(imageCount > 0 && imageCount <= 2, "image cache cap, got " + imageCount);
    await evictContext.close();
  } catch (err) {
    failures.push(err && err.stack ? err.stack : String(err));
  } finally {
    if (failures.length && logs.length) console.log(logs.slice(0, 40).join("\n"));
    await browser.close();
    site.close();
    probe.close();
  }
}

main().then(function () {
  if (failures.length) {
    console.error(failures.join("\n\n"));
    process.exit(1);
  }
  console.log("pwa offline checks passed");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
