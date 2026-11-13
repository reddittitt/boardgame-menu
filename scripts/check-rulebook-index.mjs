#!/usr/bin/env node
/* Sample each searchable game's index against the PDF the viewer opens.

   Picks up to three lines from different pages and checks that the viewer's
   text layer contains that line once on that page. A searchable game with no
   index fails. Image-only books should be marked rulebookSearchable false
   instead of carrying an index the viewer cannot highlight.

   node scripts/check-rulebook-index.mjs
   node scripts/check-rulebook-index.mjs azul root
*/
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
let pdfjs;
try {
  pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
} catch (err) {
  pdfjs = require("/tmp/pdfjs/node_modules/pdfjs-dist/legacy/build/pdf.js");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("function foldSearchChar");
const end = html.indexOf("var rulebookViewerToken");
if (start < 0 || end < start) throw new Error("could not find the viewer search functions");
const sandbox = { Math, String, Object, isFinite, Number };
vm.createContext(sandbox);
vm.runInContext(html.slice(start, end) + "\nthis.api = { searchMatchRanges, textRunsFromItems };", sandbox);
const api = sandbox.api;

function slugify(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[:'"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const raw = html.slice(html.indexOf('<script id="games-json"'));
const data = JSON.parse(raw.slice(raw.indexOf(">") + 1, raw.indexOf("</script>")));
const names = new Map();
for (const name of data.names || []) names.set(slugify(name), name);

const only = new Set(process.argv.slice(2));
const games = [];
for (const [slug, game] of Object.entries(data.enrich || {})) {
  if (game.rulebookSearchable !== true) continue;
  if (only.size && !only.has(slug)) continue;
  games.push({ slug, game });
}

function viewerSource(slug, game) {
  const value = String(game.rulebook || "").trim();
  if (/^https?:\/\//i.test(value)) return { kind: "url", value };
  const fileSlug = value.replace(/\.pdf$/i, "") || slug;
  return { kind: "file", value: path.join(root, "rulebooks", fileSlug + ".pdf") };
}

const cacheDir = "/tmp/rulebook-index-check";
fs.mkdirSync(cacheDir, { recursive: true });

async function pdfBytes(slug, game) {
  const source = viewerSource(slug, game);
  if (source.kind === "file") {
    if (!fs.existsSync(source.value)) throw new Error("missing local PDF " + source.value);
    return fs.readFileSync(source.value);
  }
  const cache = path.join(cacheDir, slug + ".pdf");
  if (!fs.existsSync(cache) || fs.statSync(cache).size < 1000) {
    const res = await fetch(source.value, { headers: { "User-Agent": "bgquick-rulebook-index/1.0", Accept: "application/pdf,*/*" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("response was not a PDF");
    fs.writeFileSync(cache, buf);
  }
  return fs.readFileSync(cache);
}

function candidateLines(lines) {
  const out = [];
  for (const item of lines || []) {
    const text = String(item).replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
    if (text.length < 24 || text.length > 140) continue;
    if (/[^\u0000-\u007e\u00a0-\u024f]/.test(text)) continue;
    const words = text.split(" ").filter((word) => /^[A-Za-z]{3,}/.test(word));
    if (words.length < 4) continue;
    out.push(text);
    if (out.length >= 5) break;
  }
  return out;
}

function samples(index) {
  const pages = (index.pages || []).filter((page) => candidateLines(page.lines).length);
  if (!pages.length) return [];
  const picks = [pages[0], pages[Math.floor(pages.length / 2)], pages[pages.length - 1]];
  const seen = new Set();
  const out = [];
  for (const page of picks) {
    if (seen.has(page.page)) continue;
    seen.add(page.page);
    const queries = candidateLines(page.lines);
    if (!queries.length) continue;
    out.push({ page: page.page, queries });
  }
  return out;
}

const failures = [];
let checked = 0;
for (const { slug, game } of games) {
  const indexPath = path.join(root, "rulebooks", "index", slug + ".json");
  if (!fs.existsSync(indexPath)) {
    failures.push({ slug, error: "searchable but no index" });
    continue;
  }
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const lines = samples(index);
  if (!lines.length) {
    failures.push({ slug, error: "index has no plain sentences to sample" });
    continue;
  }
  let bytes;
  try {
    bytes = await pdfBytes(slug, game);
  } catch (err) {
    failures.push({ slug, error: "could not open viewer PDF: " + err.message });
    continue;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  for (const sample of lines) {
    checked += 1;
    if (sample.page < 1 || sample.page > doc.numPages) {
      failures.push({ slug, page: sample.page, query: sample.query, error: "page out of range" });
      continue;
    }
    const page = await doc.getPage(sample.page);
    const content = await page.getTextContent();
    const built = api.textRunsFromItems(content.items);
    const hit = sample.queries.some((query) => api.searchMatchRanges(built.raw, query).ranges.length);
    if (!hit) {
      failures.push({ slug, page: sample.page, query: sample.queries[0], error: "none of the sampled index lines are on that page of the viewer PDF" });
    }
  }
  process.stdout.write(slug + " ok\n");
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(failures.length + " failure(s), " + checked + " lines checked, " + games.length + " searchable games");
  process.exit(1);
}
console.log("rulebook index ok (" + games.length + " games, " + checked + " lines)");
