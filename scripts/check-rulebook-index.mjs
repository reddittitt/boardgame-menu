#!/usr/bin/env node
/* Sample each searchable game's index against the PDF the viewer opens.

   Picks up to three pages and checks that the viewer's text layer contains
   one of that page's index lines. Whitespace, hyphens, and punctuation are
   folded first, so a line the text layer joins differently still counts.
   Print, legal, and contents lines are skipped. A searchable game with no
   index fails. An upstream fetch that fails is a warning. Image-only books
   should be marked rulebookSearchable false.

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
vm.runInContext(html.slice(start, end) + "\nthis.api = { searchMatchRanges, textRunsFromItems, foldSearchText };", sandbox);
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

function isPrintArtifact(text) {
  if (/[\u0000-\u001f]/.test(text)) return true;
  if (/\.(?:indd|pdf|ai|psd)\b/i.test(text)) return true;
  if (/\b(?:lpi|cmyk|icc|rgb|pms)\b/i.test(text)) return true;
  if (/color profile|output intent|prepress|process color|notes to printer/i.test(text)) return true;
  if (/©|copyright|all rights reserved|may be reproduced|may not be reproduced|registered trademark|trademark of/i.test(text)) return true;
  if (/approved for ages|formula guide|color swatch/i.test(text)) return true;
  if (/years of age|not suitable for children|not a toy|not intended for|age requirement|small parts/i.test(text)) return true;
  if (/\.{4,}/.test(text)) return true;
  if (/\s\.\s*\d{1,3}\s*$/.test(text)) return true;
  if (/reprint\s+\d{4}|rules?\s+en\b/i.test(text)) return true;
  if (/[A-Za-z0-9]+_[A-Za-z0-9].*\d/.test(text)) return true;
  const tokens = text.split(" ").filter(Boolean);
  const letters = tokens.filter((token) => /^[A-Za-z]+$/.test(token));
  const singles = letters.filter((token) => token.length === 1).length;
  if (letters.length >= 4 && singles / letters.length >= 0.35) return true;
  if (/(?:[A-Za-z] ){3,}[A-Za-z]/.test(text)) return true;
  return false;
}

function compact(raw) {
  const folded = api.foldSearchText(String(raw || "")).folded;
  return folded.replace(/[^a-z0-9]+/g, "");
}

function candidateLines(lines) {
  const out = [];
  for (const item of lines || []) {
    const raw = String(item);
    if (isPrintArtifact(raw)) continue;
    const text = raw.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
    if (isPrintArtifact(text)) continue;
    if (text.length < 24 || text.length > 140) continue;
    if (/[^\u0000-\u007e\u00a0-\u024f]/.test(text)) continue;
    const words = text.split(" ").filter((word) => /^[A-Za-z]{3,}/.test(word));
    if (words.length < 4) continue;
    out.push(text);
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
const warnings = [];
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
    const message = err.message || String(err);
    if (/^HTTP |response was not a PDF/.test(message)) {
      warnings.push({ slug, error: "upstream fetch failed: " + message });
    } else {
      failures.push({ slug, error: "could not open viewer PDF: " + message });
    }
    continue;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  let confirmed = 0;
  for (const sample of lines) {
    if (sample.page < 1 || sample.page > doc.numPages) {
      failures.push({ slug, page: sample.page, query: sample.queries[0], error: "page out of range" });
      continue;
    }
    const page = await doc.getPage(sample.page);
    const content = await page.getTextContent();
    const built = api.textRunsFromItems(content.items);
    const letters = (built.raw.match(/[A-Za-z]/g) || []).length;
    if (letters < 40) continue;
    checked += 1;
    const pageText = compact(built.raw);
    const hit = sample.queries.some((query) => pageText.includes(compact(query)));
    if (!hit) {
      failures.push({ slug, page: sample.page, query: sample.queries[0], error: "none of the sampled index lines are on that page of the viewer PDF" });
    } else {
      confirmed += 1;
    }
  }
  if (!confirmed && !failures.some((failure) => failure.slug === slug)) {
    failures.push({ slug, error: "viewer pages have no text layer to match the index" });
  }
  process.stdout.write(slug + " ok\n");
}

for (const warning of warnings) {
  console.warn("warning: " + warning.slug + ": " + warning.error);
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(failures.length + " failure(s), " + checked + " lines checked, " + games.length + " searchable games");
  process.exit(1);
}
const warningNote = warnings.length ? ", " + warnings.length + " upstream warning(s)" : "";
console.log("rulebook index ok (" + games.length + " games, " + checked + " lines" + warningNote + ")");
