// Confirms every Rulebook chip's highlight box sits on the query in the PDF
// text layer. It runs the same fold, match, and highlightBoxes functions as
// index.html, then checks that the middle of each matched glyph falls inside
// a focus box. A query that matches more than once after hyphen folding
// fails, so a line-break hyphen cannot make the chip highlight a second
// sentence. No page is rasterized; the text layer is the position the
// viewer paints.
//
//   node scripts/audit-rulebook-highlights.mjs
//   node scripts/audit-rulebook-highlights.mjs root azul

import fs from "fs";
import vm from "vm";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let pdfjs;
try {
  pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
} catch (err) {
  pdfjs = require("/tmp/pdfjs/node_modules/pdfjs-dist/legacy/build/pdf.js");
}

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("function foldSearchChar");
const end = html.indexOf("var rulebookViewerToken");
if (start < 0 || end < start) throw new Error("could not find highlight functions in index.html");
const source = html.slice(start, end);
const sandbox = { Math, String, Object, isFinite, Number };
vm.createContext(sandbox);
vm.runInContext(source + "\nthis.api = { foldSearchText, searchMatchRanges, snippetFocusIndex, textRunsFromItems, highlightBoxes };", sandbox);
const api = sandbox.api;

function slugify(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[:'"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function chipsFromHtml(file) {
  const raw = file.slice(file.indexOf('<script id="games-json"'));
  const json = raw.slice(raw.indexOf(">") + 1, raw.indexOf("</script>"));
  const data = JSON.parse(json);
  const out = [];
  function walk(node, slug, rulebook) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, slug, rulebook));
      return;
    }
    const src = node.source;
    if (src && src.page && src.query) {
      out.push({
        slug,
        rulebook,
        page: parseInt(src.page, 10),
        query: String(src.query),
        snippet: src.snippet ? String(src.snippet) : ""
      });
    }
    Object.values(node).forEach((value) => walk(value, slug, rulebook));
  }
  for (const name of data.names || []) {
    const slug = slugify(name);
    const game = (data.enrich || {})[slug];
    if (!game) continue;
    walk(game, slug, game.rulebook || slug);
  }
  return out;
}

function rulebookFileUrl(rulebook, slug) {
  const value = String(rulebook || "").trim();
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https:\/\/www\.dropbox\.com\//i, "https://dl.dropboxusercontent.com/");
  }
  return "";
}

async function pdfPath(slug, rulebook) {
  const local = "rulebooks/" + String(rulebook || slug).replace(/\.pdf$/, "") + ".pdf";
  if (fs.existsSync(local)) return local;
  const url = rulebookFileUrl(rulebook, slug);
  if (!url) return "";
  const cache = "/tmp/rulebook-audit/" + slug + ".pdf";
  if (!fs.existsSync(cache)) {
    fs.mkdirSync("/tmp/rulebook-audit", { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(slug + " HTTP " + res.status);
    fs.writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
  }
  return cache;
}

function overlapsFocus(box, x, y) {
  const pad = 2;
  return x >= box.left - pad && x <= box.left + box.width + pad && y >= box.top - pad && y <= box.top + box.height + pad;
}

function glyphPoint(run, range, viewport) {
  const item = run.item;
  const len = run.text.length || 1;
  const localStart = Math.max(range.start, run.start) - run.start;
  const localEnd = Math.min(range.end, run.end) - run.start;
  if (localEnd <= localStart) return null;
  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const dirX = transform[0];
  const dirY = transform[1];
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const origin = viewport.convertToViewportPoint(transform[4], transform[5]);
  const along = viewport.convertToViewportPoint(
    transform[4] + (item.width || 0) * dirX / dirLen,
    transform[5] + (item.width || 0) * dirY / dirLen
  );
  const mid = (localStart + localEnd) / 2 / len;
  const x = origin[0] + (along[0] - origin[0]) * mid;
  const y = origin[1] + (along[1] - origin[1]) * mid;
  const span = Math.hypot(along[0] - origin[0], along[1] - origin[1]) || 1;
  const ux = (along[0] - origin[0]) / span;
  const uy = (along[1] - origin[1]) / span;
  const fontHeight = (item.height || 8) * viewport.scale;
  return { x: x + uy * fontHeight * 0.35, y: y - ux * fontHeight * 0.35, fontHeight };
}

const only = new Set(process.argv.slice(2));
const chips = chipsFromHtml(html).filter((chip) => !only.size || only.has(chip.slug));
const bySlug = new Map();
for (const chip of chips) {
  if (!bySlug.has(chip.slug)) bySlug.set(chip.slug, []);
  bySlug.get(chip.slug).push(chip);
}

const failures = [];
let checked = 0;
for (const [slug, list] of bySlug) {
  const file = await pdfPath(slug, list[0].rulebook);
  if (!file) {
    console.log(slug + ": no local PDF, skipped " + list.length);
    failures.push({ slug, error: "no local PDF" });
    continue;
  }
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pageCache = new Map();
  async function pageOf(n) {
    if (!pageCache.has(n)) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      pageCache.set(n, { viewport: page.getViewport({ scale: 1 }), built: api.textRunsFromItems(tc.items), styles: tc.styles });
    }
    return pageCache.get(n);
  }
  let ok = 0;
  for (const chip of list) {
    checked += 1;
    if (!chip.page || chip.page > doc.numPages) {
      failures.push({ slug, page: chip.page, query: chip.query, error: "page out of range" });
      continue;
    }
    const { viewport, built, styles } = await pageOf(chip.page);
    const found = api.searchMatchRanges(built.raw, chip.query);
    if (!found.ranges.length) {
      failures.push({ slug, page: chip.page, query: chip.query, error: "query not on that page" });
      continue;
    }
    if (found.ranges.length > 1) {
      failures.push({
        slug,
        page: chip.page,
        query: chip.query,
        error: "query matches more than once on that page",
        matches: found.ranges.length
      });
      continue;
    }
    let focus = chip.snippet ? api.snippetFocusIndex(built.raw, found.ranges, chip.snippet) : 0;
    if (focus < 0 || focus >= found.ranges.length) focus = 0;
    const boxes = api.highlightBoxes(built.runs, found.ranges, focus, viewport, styles).filter((box) => box.focus);
    const range = found.ranges[focus];
    const points = [];
    built.runs.forEach((run) => {
      if (run.end <= range.start || run.start >= range.end) return;
      const point = glyphPoint(run, range, viewport);
      if (point) points.push(point);
    });
    const missed = points.filter((point) => !boxes.some((box) => overlapsFocus(box, point.x, point.y)));
    const huge = boxes.some((box) => box.height > 80 && points[0] && box.height > points[0].fontHeight * 8);
    if (!points.length || missed.length || !boxes.length || huge) {
      failures.push({
        slug,
        page: chip.page,
        query: chip.query,
        error: !boxes.length ? "no focus box" : (huge ? "box covers far more than the line" : "glyph outside the focus box"),
        missed: missed.length,
        points: points.length,
        boxes: boxes.length
      });
    } else ok += 1;
  }
  console.log(slug + ": " + ok + "/" + list.length + " chips sit on the query");
  await doc.destroy();
}

console.log("checked " + checked + ", failures " + failures.length);
if (failures.length) {
  console.log(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
