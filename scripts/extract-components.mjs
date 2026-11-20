/* Build components.json from rulebook text already in the repo.
   Counts are copied from those lines. Nothing is calculated.
   BoardGameGeek wiki box contents is only used when a rulebook list is not there.
   Run: node scripts/extract-components.mjs
   Pass --no-bgg to skip the network fallback. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = "/tmp/bgg-component-wiki.json";
const outPath = path.join(root, "components.json");

const VERBS = new Set("place shuffle take give put set roll draw choose select remove return assemble match sort create reveal deal keep have play score add use fill separate arrange write see collect discard pass move build pay gain lose win".split(" "));
const START_RE = /^(?:game\s+)?components?\b|^box contents\b|^component list\b|^what['’]s in (?:the )?box\b|^in the box\b|^contents\s*:?\s*$/i;
const STOP_RE = /^(?:set[\s-]?up|game\s*setup|player setup|global components|preparation|preparing|object of|overview|game\s*play|gameplay|how to play|playing the game|your turn|a turn|sequence of play|introduction|goal of|getting started|you will need|not included|also (?:needed|required)|table of contents|assembly|rules of play|playing|the goal|object)\b/i;
const WIKI_STOP_RE = /^(?:faq|microbadges?|rules corrections|errata|list of|online play|external links?|awards|official links|more information|images|photos|videos|files|forums|links|related games|honors)\b/i;
const COUNT_RE = /^(\d{1,4}(?:\s*[×xX])?|[Aa]n?)\s+(.+)$/;
const STEP_RE = /^\d+\s*[.)]\s+/;
const BAD_NAME_RE = /\b(you|your|must|should|while|when|then|this|that|these|those|receive[sd]?|allows?|please|shown|discovering|continuous|example|each player)\b/i;
const SINGLE_OK = /^(boards?|bags?|dice?|robbers?|pawns?|meeples?|rulebooks?|scorepads?|glossar(?:y|ies)|pouches?|appendices|appendix|scorebooks?|helpsheets?|rules|rule\s*books?|resin|twigs?|pebbles?)$/i;
const FRAGMENT = /^(petting|reptile|animal|sponsor|large|bird|special|empty|occupied|front|back)$/i;

export function slugify(name) {
  return String(name || "").toLowerCase()
    .replace(/[:'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function norm(text) {
  return String(text || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

function isStartHeading(line) {
  const text = norm(line);
  if (!text || text.length > 48) return false;
  if (/table of contents/i.test(text)) return false;
  if (/^components?:\s*\d/i.test(text)) return false;
  return START_RE.test(text);
}

function isStopHeading(line) {
  const text = norm(line);
  if (!text || text.length > 60) return false;
  if (isStartHeading(text)) return false;
  return STOP_RE.test(text);
}

function parenDepthDelta(text) {
  const open = (text.match(/\(/g) || []).length;
  const close = (text.match(/\)/g) || []).length;
  return open - close;
}

function outsideSplit(text, pattern) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && text.slice(i).search(pattern) === 0) {
      const match = text.slice(i).match(pattern);
      if (i > start) parts.push(text.slice(start, i));
      start = i + match[0].length;
      i = start - 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function rejectName(name) {
  const text = norm(name).replace(/[.:]+$/, "");
  if (text.length < 2 || text.length > 320) return true;
  const words = text.split(" ");
  if (words.length > 40) return true;
  if (/^(front|back|empty|occupied|kiosk|pavilion|token|card back|of each|each|per|set|and|or|the|points?|pts|minutes?|mins?|players?|ages?|years?|pages?)$/i.test(text)) return true;
  if (/https?:|www\.|©|copyright/i.test(text)) return true;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (letters < 3) return true;
  return false;
}

function rejectStep(line, name) {
  if (STEP_RE.test(line)) return true;
  const first = norm(name).split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  if (/^\d+\s+[A-Z]/.test(line) && VERBS.has(first)) return true;
  return false;
}

function pieceFrom(text) {
  let line = norm(text);
  if (!line || line.length > 320 || STEP_RE.test(line)) return null;
  line = line.replace(/[.:]+$/, "");
  if (/[.!?]/.test(line)) return null;
  if (/^(A|AN)\s+[A-Z\s]+$/.test(line)) return null;
  const match = line.match(COUNT_RE);
  if (!match) return null;
  const count = match[1];
  const name = norm(match[2]).replace(/[.:]+$/, "");
  if (rejectName(name) || rejectStep(line, name) || BAD_NAME_RE.test(name)) return null;
  if (/^[Aa]n?$/.test(count)) {
    const words = name.split(" ");
    if (words.length > 4 || /\bby\b/i.test(name)) return null;
    if (words.some((word) => word.replace(/[^A-Za-z]/g, "").length < 3)) return null;
  }
  const numeric = parseInt(count, 10);
  if (numeric >= 1900 && numeric <= 2035) return null;
  if (numeric > 2000) return null;
  const words = name.split(" ");
  const tinyCaps = words.filter((word) => /^[A-Z]{1,4}$/.test(word) && !/^(I|II|III|IV|VP|XP)$/.test(word));
  if (tinyCaps.length >= 2) return null;
  return { count: count, name: name };
}

function keepItem(item) {
  const bare = item.name.replace(/\s*\([^)]*\)/g, "").trim();
  const words = bare.split(" ").filter(Boolean);
  if (words.length === 1 && FRAGMENT.test(words[0])) return false;
  if (words.length === 1 && !/s$/i.test(words[0]) && !SINGLE_OK.test(words[0]) && !/^[A-Z][a-z]{3,}$/.test(words[0])) return false;
  return !suspicious(item);
}

/* A line is one component, a comma list, or two counts written side by side. */
export function itemsFromLine(line) {
  const text = norm(line);
  if (!text || text.length > 340) return [];
  if (/^(front|back|empty|occupied|kiosk|pavilion|token|card back)$/i.test(text)) return [];
  const commaParts = outsideSplit(text, /,\s+(?=(?:\d{1,4}(?:\s*[×xX])?|[Aa]n?)\s+)/);
  let pieces = commaParts;
  if (pieces.length === 1 && !/including|[:]| \band\b| \bor\b| \bwith\b| \bper\b/i.test(text)) {
    const sideBySide = outsideSplit(text, /\s+(?=\d{1,4}(?:\s*[×xX])?\s+[A-Za-z])/);
    if (sideBySide.length > 1 && sideBySide.every((part) => pieceFrom(part))) pieces = sideBySide;
  }
  if (pieces.length > 1) {
    const parsed = pieces.map(pieceFrom).filter(Boolean);
    if (parsed.length === pieces.length) {
      return parsed.map((item) => ({ count: item.count, name: item.name, lines: [text] }));
    }
  }
  const one = pieceFrom(text);
  return one ? [{ count: one.count, name: one.name, lines: [text] }] : [];
}

function attachNote(item, note) {
  const text = norm(note);
  if (text.length > 80 && !/\d/.test(text)) return;
  if (/\b(french|spanish|german|italian|translator|copyright)\b/i.test(text)) return;
  const extra = text.replace(/^\(|\)$/g, "");
  if (!extra) return;
  if (item.name.indexOf(extra) === -1) item.name = norm(item.name + " (" + extra + ")");
  item.lines.push(text);
}

function sectionItems(lines) {
  const items = [];
  let pending = [];
  let open = 0;
  let previous = "";
  lines.forEach((raw) => {
    const line = norm(raw);
    if (!line) return;
    if (/^\(/.test(line) || open > 0) {
      if (items.length) attachNote(items[items.length - 1], line);
      else pending.push(line);
      open = Math.max(0, open + parenDepthDelta(line));
      previous = line;
      return;
    }
    const parsed = itemsFromLine(line);
    if (!parsed.length) {
      const last = items[items.length - 1];
      const fresh = last && last.lines[last.lines.length - 1] === previous;
      const bare = last ? last.name.replace(/\s*\([^)]*\)/g, "").trim() : "";
      const lastWord = bare.split(" ").pop() || "";
      if (fresh && /^(and|or|the|of|per|&)$/i.test(lastWord)) {
        last.name = norm(last.name + " " + line).replace(/[.:]+$/, "");
        last.lines.push(line);
        previous = line;
      } else if (fresh && /^(cards?|tiles?|tokens?|cubes?|meeples?|markers?|pieces?|boards?|bags?|dice|enclosures?|workers?|counters?|coins?|barrels?|stands?)$/i.test(line) && !/^(cards?|tiles?|tokens?|cubes?|meeples?|markers?|pieces?|boards?|bags?|dice|enclosures?|workers?|counters?|coins?|barrels?|stands?)$/i.test(lastWord)) {
        last.name = norm(last.name + " " + line);
        last.lines.push(line);
      }
      previous = line;
      return;
    }
    parsed.forEach((item, index) => {
      if (index === 0 && pending.length) {
        pending.forEach(function (note) { attachNote(item, note); });
        pending = [];
      }
      items.push(item);
    });
    open = Math.max(0, open + parenDepthDelta(line));
    previous = line;
  });
  const seen = new Set();
  return items.filter((item) => {
    if (rejectName(item.name) || !keepItem(item)) return false;
    const key = item.count.toLowerCase() + "|" + item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suspicious(item) {
  const singles = item.name.split(/\s+/).filter((word) => /^[A-Za-z]$/.test(word)).length;
  return BAD_NAME_RE.test(item.name) || /\b(page|pts|points|rather|tweaking)\b/i.test(item.name) || singles >= 2 || /^in\s/i.test(item.name);
}

function acceptable(items, early) {
  const bar = early ? 3 : 5;
  if (items.length < bar || items.length > 60) return false;
  const digits = items.filter((item) => /\d/.test(item.count)).length;
  if (digits < 2) return false;
  const bad = items.filter(suspicious).length;
  if (bad / items.length > 0.15) return false;
  return true;
}

export function extractFromPages(pages) {
  const list = Array.isArray(pages) ? pages : [];
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const lines = (list[i].lines || []).map(norm).filter(Boolean);
    const at = lines.findIndex(isStartHeading);
    if (at < 0) continue;
    const early = i <= 10;
    const before = lines.slice(0, at).filter((line) => itemsFromLine(line).length || /^\(/.test(line));
    const collected = before.slice();
    let stopped = false;
    let gap = 0;
    let usefulCount = before.filter((line) => itemsFromLine(line).length > 0).length;
    function take(line) {
      if (isStopHeading(line) || isStartHeading(line)) {
        stopped = true;
        return;
      }
      const useful = itemsFromLine(line).length > 0 || /^\(/.test(line);
      if (useful) {
        gap = 0;
        if (itemsFromLine(line).length > 0) usefulCount += 1;
      } else if (usefulCount >= 1) {
        gap += 1;
      }
      collected.push(line);
      if (usefulCount >= 1 && gap >= 6) stopped = true;
    }
    lines.slice(at + 1).forEach((line) => {
      if (!stopped) take(line);
    });
    lines.slice(at + 1).forEach((line) => {
      if (collected.indexOf(line) !== -1) return;
      if (/^\d{1,4}\s*[×xX]\s+\S/.test(line) || /^\d{1,4}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(line)) collected.push(line);
    });
    if (!stopped && list[i + 1]) {
      const next = (list[i + 1].lines || []).map(norm).filter(Boolean);
      const head = next[0] || "";
      const subhead = head.length > 0 && head.length <= 40 && !isStopHeading(head) && !isStartHeading(head) && !COUNT_RE.test(head);
      const soon = next.slice(1, 5).some((line) => itemsFromLine(line).length);
      const continues = !isStopHeading(head) && !isStartHeading(head) && (itemsFromLine(head).length || (subhead && soon));
      if (continues) {
        next.forEach((line) => {
          if (!stopped) take(line);
        });
      }
    }
    const items = sectionItems(collected);
    if (!acceptable(items, early)) continue;
    const found = { page: list[i].page, items: items };
    if (!best || (early && items.length > best.items.length)) best = found;
    if (early) return found;
  }
  return best;
}

export function loadCatalog() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const match = html.match(/<script id="games-json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("games-json missing");
  const raw = JSON.parse(match[1]);
  return (raw.names || []).map((name) => {
    const slug = slugify(name);
    const extra = (raw.enrich && raw.enrich[slug]) || {};
    return {
      name: name,
      slug: slug,
      mine: extra.mine === true,
      bggId: String(extra.bggId || "").replace(/\D/g, ""),
      year: extra.year || ""
    };
  });
}

function readPages(file) {
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data || !Array.isArray(data.pages)) return null;
  return data.pages;
}

export function extractRulebook(slug) {
  const indexFile = path.join(root, "rulebooks", "index", slug + ".json");
  const ocrFile = path.join(root, "rulebooks", "ocr", slug + ".json");
  const indexPages = readPages(indexFile);
  const fromIndex = indexPages ? extractFromPages(indexPages) : null;
  if (fromIndex) {
    return {
      source: "rulebook",
      label: "Rulebook",
      origin: path.relative(root, indexFile),
      page: fromIndex.page,
      items: fromIndex.items
    };
  }
  const ocrPages = readPages(ocrFile);
  const fromOcr = ocrPages ? extractFromPages(ocrPages) : null;
  if (fromOcr) {
    return {
      source: "rulebook",
      label: "Rulebook",
      origin: path.relative(root, ocrFile),
      page: fromOcr.page,
      items: fromOcr.items
    };
  }
  return null;
}

export function wikiToLines(html) {
  let text = String(html || "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h\d|tr|ul|ol|table)>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "\n- ");
  text = text.replace(/<(strong|b|h\d)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", times: "×", ndash: "–", mdash: "—", hellip: "…", bull: "•", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", eacute: "é", egrave: "è", aacute: "á", uuml: "ü", ouml: "ö", auml: "ä", ntilde: "ñ", ccedil: "ç" };
  text = text.replace(/&([a-z]+);/gi, (match, name) => Object.prototype.hasOwnProperty.call(named, name.toLowerCase()) ? named[name.toLowerCase()] : match);
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return text.split("\n").map(norm).filter(Boolean);
}

export function extractWiki(html) {
  const lines = wikiToLines(html);
  const starts = [];
  lines.forEach((line, index) => {
    const bare = line.replace(/^[-*•–—]\s+/, "");
    if (bare.length > 48) return;
    if (START_RE.test(bare)) starts.push(index);
  });
  let best = null;
  starts.forEach((start) => {
    const items = [];
    let subtitle = "";
    for (let i = start + 1; i < lines.length; i++) {
      let line = lines[i];
      if (WIKI_STOP_RE.test(line.replace(/^[-*•–—]\s+/, ""))) break;
      if (items.length >= 3 && !/^[-*•–—]/.test(line) && /\b(editions?|printings?)\b/i.test(line) && line.length < 70) break;
      if (line.length > 240 && !COUNT_RE.test(line.replace(/^[-*•–—]\s+/, ""))) {
        if (items.length) break;
        continue;
      }
      const bullet = /^[-*•–—]\s+/.test(line);
      line = line.replace(/^[-*•–—]\s+/, "");
      if (!bullet && /:$/.test(line) && line.length < 50 && !COUNT_RE.test(line)) continue;
      if (!bullet && !COUNT_RE.test(line)) {
        if (!subtitle && items.length === 0 && line.length < 70 && /\b(editions?|printings?)\b/i.test(line)) {
          subtitle = line.replace(/:$/, "");
          continue;
        }
        if (items.length && line.length > 80) break;
        continue;
      }
      itemsFromLine(line).forEach((item) => items.push(item));
      if (items.length > 70) break;
    }
    const unique = [];
    const seen = new Set();
    items.forEach((item) => {
      const key = item.count.toLowerCase() + "|" + item.name.toLowerCase();
      if (seen.has(key) || rejectName(item.name)) return;
      seen.add(key);
      unique.push(item);
    });
    if (unique.length >= 3 && (!best || unique.length > best.items.length)) {
      best = { items: unique, subtitle: subtitle };
    }
  });
  return best;
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(cachePath, "utf8")); }
  catch (err) { return {}; }
}

async function fetchWiki(id, cache) {
  if (cache[id]) return cache[id];
  const url = "https://api.geekdo.com/api/geekitems?objectid=" + id + "&objecttype=thing&nosession=1";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("BGG " + id + " HTTP " + res.status);
  const data = await res.json();
  const wiki = (data.item && data.item.wiki) || "";
  cache[id] = wiki;
  return wiki;
}

async function mapPool(list, limit, worker) {
  const out = new Array(list.length);
  let cursor = 0;
  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, run));
  return out;
}

function record(entry) {
  return {
    source: entry.source,
    label: entry.label,
    origin: entry.origin || "",
    page: entry.page || null,
    bggId: entry.bggId || "",
    items: entry.items.map((item) => ({
      count: item.count,
      name: item.name,
      lines: item.lines
    }))
  };
}

async function main() {
  const noBgg = process.argv.includes("--no-bgg");
  const games = loadCatalog();
  const ordered = games.filter((game) => game.mine).concat(games.filter((game) => !game.mine));
  const result = {};
  const missing = [];
  ordered.forEach((game) => {
    const found = extractRulebook(game.slug);
    if (found) result[game.slug] = record(found);
    else missing.push(game);
  });
  if (!noBgg && missing.length) {
    const cache = readCache();
    const need = missing.filter((game) => game.bggId);
    await mapPool(need, 6, async (game) => {
      try {
        const wiki = await fetchWiki(game.bggId, cache);
        const found = extractWiki(wiki);
        if (!found) return;
        result[game.slug] = record({
          source: "bgg",
          label: found.subtitle ? "BoardGameGeek · " + found.subtitle : "BoardGameGeek",
          bggId: game.bggId,
          items: found.items
        });
      } catch (err) {
        console.error(String(err.message || err));
      }
    });
    fs.writeFileSync(cachePath, JSON.stringify(cache));
  }
  const payload = {};
  ordered.forEach((game) => {
    if (result[game.slug]) payload[game.slug] = result[game.slug];
  });
  fs.writeFileSync(outPath, JSON.stringify(payload) + "\n");
  const mineSlugs = new Set(games.filter((game) => game.mine).map((game) => game.slug));
  const slugs = Object.keys(payload);
  const mineHits = slugs.filter((slug) => mineSlugs.has(slug));
  const mineRule = mineHits.filter((slug) => payload[slug].source === "rulebook").length;
  const mineBgg = mineHits.filter((slug) => payload[slug].source === "bgg").length;
  const otherHits = slugs.filter((slug) => !mineSlugs.has(slug));
  const otherRule = otherHits.filter((slug) => payload[slug].source === "rulebook").length;
  const otherBgg = otherHits.filter((slug) => payload[slug].source === "bgg").length;
  const summary = {
    games: games.length,
    mine: mineSlugs.size,
    withChecklist: slugs.length,
    collection: mineHits.length,
    collectionRulebook: mineRule,
    collectionBgg: mineBgg,
    collectionNone: mineSlugs.size - mineHits.length,
    others: otherHits.length,
    othersRulebook: otherRule,
    othersBgg: otherBgg,
    othersNone: games.length - mineSlugs.size - otherHits.length
  };
  console.log(JSON.stringify(summary, null, 2));
  const none = games.filter((game) => game.mine && !payload[game.slug]).map((game) => game.name);
  console.log("collection without checklist: " + none.join("; "));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
