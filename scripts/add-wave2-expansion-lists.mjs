/* Add BoardGameGeek component lists for collection expansions that do not
   have one yet. Counts are copied from the wiki lines. Nothing is calculated.
   Run: node scripts/add-wave2-expansion-lists.mjs
   Pass --dry-run to print the report without writing components.json. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { norm, wikiToLines } from "./extract-components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = "/tmp/bgg-wave2-wiki.json";
const reportPath = "/tmp/bgg-wave2-report.json";
const dry = process.argv.includes("--dry-run");
const STOP = new Set("the a an of and for expansion pack promo mini edition module card cards game".split(" "));

function loadCatalog() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const match = html.match(/<script id="games-json"[^>]*>([\s\S]*?)<\/script>/);
  return JSON.parse(match[1]);
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && word.length > 2 && !STOP.has(word));
}

function nameScore(expName, bggName) {
  const wanted = tokens(expName);
  const have = new Set(tokens(bggName));
  if (!wanted.length || !have.size) return 0;
  const hits = wanted.filter((word) => have.has(word));
  if (!hits.length) return 0;
  if (hits.length >= 2) return hits.length + 2;
  if (hits[0].length >= 5) return 2;
  return 0;
}

function quoted(count, line) {
  const text = norm(line);
  const token = norm(count);
  if (!token || !/\d/.test(token)) return false;
  return text.includes(token);
}

function cleanItems(found) {
  const items = [];
  const seen = new Set();
  (found.items || []).forEach((item) => {
    const count = norm(item.count);
    const name = norm(item.name);
    const line = (item.lines && item.lines[0]) || "";
    if (!count || !name || !quoted(count, line)) return;
    if (name.length > 220) return;
    if (/\b(you|your|must|should|please|example)\b/i.test(name)) return;
    const key = count.toLowerCase() + "|" + name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ count: count, name: name, lines: item.lines.map(norm) });
  });
  return items;
}

const COUNT_LINE = /^(\d{1,4}(?:\s*[×xX])?)\s+(.+)$/;
const HEADING = /^(?:featured\s+)?(?:game\s+)?components\b|^box contents\b|^contents\b|^component list\b|^in the box\b/i;
const STOP_HEAD = /^(?:faq|microbadges?|errata|editions?|links|images|videos|files|awards|online play|external links?)\b/i;
const CATEGORY = /^(?:cardboard|cardstock|cards|wood|wooden|plastic|metal|other|new components|components for .+|tokens|dice)\s*:?\s*$/i;

function subtitleFrom(heading) {
  const text = String(heading || "").replace(/:$/, "").trim();
  const match = text.match(/^contents?\s*\((.+)\)\s*$/i);
  return match ? match[1].replace(/:$/, "").trim() : "";
}

function parseCountLine(raw) {
  const original = norm(raw).replace(/^[-*•–—]\s+/, "");
  const probe = original.replace(/\.$/, "");
  const match = probe.match(COUNT_LINE) || probe.match(/^(\d{1,4})([A-Za-z].+)$/);
  if (!match) return null;
  const name = norm(match[2]).replace(/[.:]+$/, "");
  if (name.length < 2 || name.length > 220) return null;
  if (/^(vp|points?)$/i.test(name)) return null;
  if (/\b(you|your|must|should|please|once per|when you|if you|lurk|await you)\b/i.test(name)) return null;
  if ((name.match(/[.!?]/g) || []).length > 0) return null;
  return { count: match[1].replace(/\s+/g, ""), name: name, lines: [original] };
}

/* Quote rows from a Components / Contents heading. Edition headings such as
   "Contents (Mayfair 4th Edition):" stay separate so the longer list wins. */
export function extractQuoted(html) {
  const lines = wikiToLines(html);
  const starts = [];
  lines.forEach((line, index) => {
    const bare = norm(line).replace(/^[-*•–—]\s+/, "");
    if (!bare || bare.length > 60) return;
    if (/table of contents/i.test(bare)) return;
    if (HEADING.test(bare)) starts.push(index);
  });
  let best = null;
  starts.forEach((start) => {
    const items = [];
    const seen = new Set();
    let gap = 0;
    const heading = norm(lines[start]).replace(/^[-*•–—]\s+/, "");
    for (let i = start + 1; i < lines.length; i++) {
      const bare = norm(lines[i]).replace(/^[-*•–—]\s+/, "");
      if (!bare) continue;
      if (HEADING.test(bare) && bare.length <= 60) break;
      if (STOP_HEAD.test(bare)) break;
      if (CATEGORY.test(bare)) {
        gap = 0;
        continue;
      }
      const item = parseCountLine(lines[i]);
      if (!item) {
        const bulleted = /^[-*•–—]/.test(norm(lines[i]));
        if (items.length && !bulleted) gap += 1;
        if (gap >= 3) break;
        continue;
      }
      const key = item.count.toLowerCase() + "|" + item.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
      gap = 0;
    }
    if (items.length && (!best || items.length >= best.items.length)) {
      best = { items: items, subtitle: subtitleFrom(heading) };
    }
  });
  return best;
}

function overlapsBase(items, base) {
  const names = new Set((base || []).map((item) => norm(item.name).toLowerCase()));
  if (!names.size || !items.length) return 0;
  const same = items.filter((item) => names.has(item.name.toLowerCase())).length;
  return same / items.length;
}

async function fetchOne(id, cache) {
  if (cache[id] && cache[id].wiki != null) return cache[id];
  const url = "https://api.geekdo.com/api/geekitems?objectid=" + id + "&objecttype=thing&nosession=1";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("BGG " + id + " HTTP " + res.status);
  const data = await res.json();
  const item = data.item || {};
  const record = {
    name: String(item.name || item.primaryname || ""),
    wiki: String(item.wiki || "")
  };
  cache[id] = record;
  return record;
}

async function mapPool(list, limit, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      await worker(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, run));
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(cachePath, "utf8")); }
  catch (err) { return {}; }
}

async function main() {
  const catalog = loadCatalog();
  const enrich = catalog.enrich;
  const components = JSON.parse(fs.readFileSync(path.join(root, "components.json"), "utf8"));
  const original = JSON.parse(fs.readFileSync(path.join(root, "components.json"), "utf8"));
  // Drop lists this script added on an earlier run so a re-run can replace them.
  // Lists already on HEAD stay. HEAD is read below when git is available.
  let head = null;
  try {
    const { execSync } = await import("child_process");
    head = JSON.parse(execSync("git show HEAD:components.json", { encoding: "utf8" }));
  } catch (err) {
    head = original;
  }
  Object.keys(components).forEach((slug) => {
    if (!head[slug]) return;
    components[slug].expansions = head[slug].expansions
      ? JSON.parse(JSON.stringify(head[slug].expansions))
      : undefined;
  });
  const guides = JSON.parse(fs.readFileSync(path.join(root, "expansion-guides.json"), "utf8"));
  const jobs = [];
  Object.keys(enrich).forEach((slug) => {
    const game = enrich[slug];
    if (!game || game.mine !== true) return;
    const entry = components[slug];
    if (!entry || !Array.isArray(entry.items) || entry.items.length < 2) return;
    (game.expansions || []).forEach((exp) => {
      const name = String(exp.name || "").trim();
      if (!name) return;
      const have = entry.expansions && entry.expansions[name] && entry.expansions[name].items && entry.expansions[name].items.length;
      if (have) return;
      let id = String(exp.bggId || "").replace(/\D/g, "");
      if (!id && guides[slug] && guides[slug].expansions && guides[slug].expansions[name]) {
        const url = String(guides[slug].expansions[name].sourceUrl || "");
        const match = url.match(/boardgameexpansion\/(\d+)/);
        if (match) id = match[1];
      }
      if (!id) return;
      jobs.push({ slug, name, id });
    });
  });

  const cache = readCache();
  const ids = [...new Set(jobs.map((job) => job.id))];
  await mapPool(ids, 4, async (id) => {
    try {
      await fetchOne(id, cache);
      process.stdout.write(".");
    } catch (err) {
      console.error("\n" + String(err.message || err));
    }
  });
  process.stdout.write("\n");
  fs.writeFileSync(cachePath, JSON.stringify(cache));

  const byId = new Map();
  jobs.forEach((job) => {
    if (!byId.has(job.id)) byId.set(job.id, []);
    byId.get(job.id).push(job);
  });

  const added = [];
  const skipped = [];
  jobs.forEach((job) => {
    const page = cache[job.id];
    if (!page || !page.wiki) {
      skipped.push({ ...job, reason: "no wiki" });
      return;
    }
    const score = nameScore(job.name, page.name);
    const rivals = (byId.get(job.id) || []).map((other) => ({
      name: other.name,
      slug: other.slug,
      score: nameScore(other.name, page.name)
    }));
    const best = rivals.reduce((max, rival) => Math.max(max, rival.score), 0);
    if (score < 2 || score < best) {
      skipped.push({ ...job, reason: "name mismatch", bggName: page.name, score, rivals });
      return;
    }
    const tied = rivals.filter((rival) => rival.score === score && !(rival.slug === job.slug && rival.name === job.name));
    if (tied.length) {
      skipped.push({ ...job, reason: "shared bgg id", bggName: page.name, score, rivals });
      return;
    }
    const sameIdOwner = Object.entries((components[job.slug] && components[job.slug].expansions) || {})
      .filter(([, block]) => block && String(block.bggId || "") === job.id);
    if (sameIdOwner.length) {
      skipped.push({ ...job, reason: "bgg id already used", bggName: page.name, owner: sameIdOwner.map(([name]) => name) });
      return;
    }
    const found = extractQuoted(page.wiki);
    if (!found) {
      skipped.push({ ...job, reason: "no component section", bggName: page.name });
      return;
    }
    const items = cleanItems(found);
    if (!items.length || (items.length === 1 && items[0].name.length < 12)) {
      skipped.push({ ...job, reason: "no quoted component rows", bggName: page.name, raw: (found.items || []).length });
      return;
    }
    const overlap = overlapsBase(items, components[job.slug].items);
    if (overlap >= 0.7) {
      skipped.push({ ...job, reason: "overlaps base list", bggName: page.name, overlap, n: items.length });
      return;
    }
    if (!components[job.slug].expansions) components[job.slug].expansions = {};
    components[job.slug].expansions[job.name] = {
      source: "bgg",
      label: found.subtitle ? "BoardGameGeek · " + found.subtitle : "BoardGameGeek",
      origin: "",
      page: null,
      bggId: job.id,
      items: items.map((item) => ({
        count: item.count,
        name: item.name,
        lines: item.lines,
        expansion: [job.name]
      }))
    };
    added.push({
      slug: job.slug,
      name: job.name,
      bggId: job.id,
      bggName: page.name,
      label: found.subtitle ? "BoardGameGeek · " + found.subtitle : "BoardGameGeek",
      n: items.length,
      sample: items.slice(0, 3).map((item) => item.count + " " + item.name)
    });
  });

  if (!dry) fs.writeFileSync(path.join(root, "components.json"), JSON.stringify(components) + "\n");
  const report = { added, skipped };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    jobs: jobs.length,
    added: added.length,
    skipped: skipped.length,
    byReason: skipped.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1;
      return acc;
    }, {})
  }, null, 2));
  added.forEach((row) => {
    console.log("ADD", row.slug, "|", row.name, "|", row.n, "|", row.bggName);
    row.sample.forEach((line) => console.log("   ", line));
  });
  skipped.forEach((row) => {
    console.log("SKIP", row.reason, row.slug, "|", row.name, row.bggName ? "| " + row.bggName : "");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
