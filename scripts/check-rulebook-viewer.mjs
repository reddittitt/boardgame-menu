// Opens every rulebook the site links, the same way the in-app viewer does:
// pdf.js 3.11.174, worker from cdnjs, Dropbox share links rewritten to
// dl.dropboxusercontent.com, getDocument({ url, disableAutoFetch, rangeChunkSize }).
//
//   node scripts/check-rulebook-viewer.mjs
//   node scripts/check-rulebook-viewer.mjs --limit 20
//
// Writes scripts/rulebook-viewer-report.json

import fs from "fs";
import puppeteer from "/tmp/pdfcheck/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const ORIGIN = process.env.RULEBOOK_ORIGIN || "http://127.0.0.1:8765";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const raw = html.slice(html.indexOf('<script id="games-json"'));
const data = JSON.parse(raw.slice(raw.indexOf(">") + 1, raw.indexOf("</script>")));

function readable(url) {
  return String(url || "").replace(/^https:\/\/www\.dropbox\.com\//i, "https://dl.dropboxusercontent.com/");
}
function isPdfPath(url) {
  try {
    return /\.pdf$/i.test(new URL(url, ORIGIN).pathname || "");
  } catch (err) {
    return false;
  }
}

const books = [];
const seen = new Set();
function add(slug, where, value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return;
  let absolute = rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) absolute = rawUrl;
  else if (rawUrl.startsWith("/")) absolute = ORIGIN + rawUrl;
  else if (/rulebooks\//i.test(rawUrl)) absolute = ORIGIN + "/" + rawUrl.replace(/^\.\//, "");
  else absolute = ORIGIN + "/rulebooks/" + rawUrl.replace(/\.pdf$/i, "") + ".pdf";
  const key = readable(absolute.split("#")[0]);
  if (seen.has(key)) {
    const row = books.find((item) => item.url === key);
    if (row) row.usedBy.push(slug + ":" + where);
    return;
  }
  seen.add(key);
  books.push({
    url: key,
    original: absolute.split("#")[0],
    directPdf: isPdfPath(absolute),
    usedBy: [slug + ":" + where]
  });
}
function walk(node, slug, path) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, slug, path + "[" + i + "]"));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "rulebook" && typeof value === "string") add(slug, path + ".rulebook", value);
    else if ((key === "url" || key === "renderUrl") && typeof value === "string" && /\.pdf($|\?|#)/i.test(value)) {
      add(slug, path + "." + key, value);
    } else walk(value, slug, path + "." + key);
  }
}
for (const [slug, game] of Object.entries(data.enrich || {})) walk(game, slug, slug);

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : books.length;
const queue = books.slice(0, limit);
let previous = [];
for (const path of ["/tmp/rulebook-viewer-report.json", new URL("./rulebook-viewer-report.json", import.meta.url)]) {
  try {
    previous = JSON.parse(fs.readFileSync(path, "utf8")).results || [];
    if (previous.length) break;
  } catch (err) {}
}
const done = new Map(previous.filter((item) => item && item.url && item.ok).map((item) => [item.url, item]));
const reportPath = "/tmp/rulebook-viewer-report.json";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  protocolTimeout: 120000,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const pages = [];
for (let i = 0; i < 4; i++) {
  const page = await browser.newPage();
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" });
  await page.waitForFunction(() => window.pdfjsLib);
  await page.evaluate(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  });
  pages.push(page);
}

async function check(url, page) {
  return page.evaluate(async (target) => {
    const started = Date.now();
    try {
      const lib = window.pdfjsLib;
      const task = lib.getDocument({ url: target, disableAutoFetch: true, rangeChunkSize: 65536 });
      const pdf = await Promise.race([
        task.promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 45000))
      ]);
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.15 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const pages = pdf.numPages;
      await pdf.destroy();
      return { ok: true, pages, ms: Date.now() - started };
    } catch (err) {
      const message = String((err && (err.message || err.name)) || err);
      let reason = "pdf.js";
      if (/timeout/i.test(message)) reason = "timeout";
      else if (/failed to fetch|networkerror|cors|load failed/i.test(message)) reason = "CORS or network";
      else if (/\b403\b/.test(message)) reason = "HTTP 403";
      else if (/\b404\b/.test(message)) reason = "HTTP 404";
      else if (/invalid pdf|missing pdf header|stream must have data/i.test(message)) reason = "non-PDF or HTML";
      else if (/worker|font|cmap/i.test(message)) reason = "font or worker";
      return { ok: false, reason, detail: message.slice(0, 300), ms: Date.now() - started };
    }
  }, url);
}

const results = [];
let cursor = 0;
async function run(page) {
  while (cursor < queue.length) {
    const index = cursor++;
    const book = queue[index];
    if (done.has(book.url)) {
      results[index] = { ...book, ...done.get(book.url), usedBy: book.usedBy };
      continue;
    }
    if (!book.directPdf) {
      results[index] = { ...book, ok: false, reason: "viewer ignores it", detail: "The path does not end in .pdf, so the viewer opens an iframe instead of drawing the file." };
      console.log("SKIP", book.url);
      continue;
    }
    let outcome;
    try {
      outcome = await Promise.race([
        check(book.url, page),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 50000))
      ]);
    } catch (err) {
      outcome = { ok: false, reason: "timeout", detail: String(err.message || err) };
      try { await page.close(); } catch (closeErr) {}
      page = await browser.newPage();
      await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
      await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" });
      await page.waitForFunction(() => window.pdfjsLib);
      await page.evaluate(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      });
    }
    results[index] = { ...book, ...outcome };
    console.log((outcome.ok ? "OK" : "FAIL") + " " + (outcome.reason || outcome.pages + "p") + " " + book.usedBy[0]);
    if ((index + 1) % 20 === 0) {
      fs.writeFileSync(reportPath, JSON.stringify({ checked: results.filter(Boolean).length, results: results.filter(Boolean) }, null, 2));
    }
  }
}
await Promise.all(pages.map((page) => run(page)));
await browser.close();
const failed = results.filter((item) => item && !item.ok);
const summary = {};
for (const item of failed) summary[item.reason] = (summary[item.reason] || 0) + 1;
const report = { checked: results.length, failed: failed.length, summary, results };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checked: report.checked, failed: report.failed, summary }, null, 2));
