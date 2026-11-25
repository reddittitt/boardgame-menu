/* Pull a sourced first-player line from rulebook indexes and existing rules.
   Reads derived JSON only. Never opens a PDF. Writes first-player.json. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const open = html.indexOf(">", html.indexOf('<script id="games-json"')) + 1;
const RAW = JSON.parse(html.slice(open, html.indexOf("</script>", open)));

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[:'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const indexDir = path.join(root, "rulebooks/index");
const indexSlugs = new Set(
  fs.readdirSync(indexDir).filter((name) => name.endsWith(".json") && name !== "manifest.json").map((name) => name.replace(/\.json$/, ""))
);

function loadIndex(slug) {
  if (!indexSlugs.has(slug)) return null;
  return JSON.parse(fs.readFileSync(path.join(indexDir, slug + ".json"), "utf8"));
}

function cleanLine(line) {
  return String(line || "").replace(/\u0007/g, "").replace(/\s+/g, " ").trim();
}

function pageBlob(page) {
  const parts = [];
  (page.lines || []).forEach((line) => {
    let text = String(line || "").replace(/\u0007/g, "").trim();
    if (!text) return;
    if (parts.length && /[A-Za-z]-$/.test(parts[parts.length - 1]) && /^[a-z]/.test(text)) {
      parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1) + text;
      return;
    }
    parts.push(text);
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function rawBlob(page) {
  return (page.lines || []).map(cleanLine).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

const PLAYER = /\b(?:first|starting)\s+players?\b/i;
const PATTERNS = [
  /The (?:player|person) who [^.]{8,280}?\./gi,
  /(?:Give|Hand) the (?:first|starting) player (?:token|marker|card) [^.]{0,140}?\./gi,
  /(?:Randomly )?(?:choose|determine|select|pick) (?:a|the )?(?:first|starting) player\b[^.]{0,220}?\./gi,
  /Players? (?:choose|determine|select|pick|decide) (?:a |the |who )[^.]{0,140}?\./gi,
  /The (?:first|starting) player is [^.]{8,160}?\./gi,
  /[^.]{8,90}\bis the (?:first|starting) player\b[^.]{0,50}?\./gi,
  /[^.]{0,50}\b(?:youngest|oldest) (?:player|person)\b[^.]{0,90}?\./gi,
  /[^.]{0,40}\b(?:first|starting) player\b[^.]{0,50}?\bat random\b[^.]{0,40}?\./gi,
  /[^.]{0,40}\brandomly\b[^.]{0,80}?\b(?:first|starting) player\b[^.]{0,80}?\./gi,
  /method of your choos[^.]{0,100}?\./gi,
  /any way you (?:like|wish|want|choose)[^.]{0,80}?\./gi,
  /favorite house rule[^.]{0,80}?\./gi
];

function selects(text) {
  return /randomly|most recently|youngest|oldest|highest roll|any way you|method of your|house rule|(?:choose|select|pick) (?:a |the )?(?:first|starting) player|determine (?:a |the )?(?:first|starting) player|(?:first|starting) player is (?:the|whoever|chosen|selected|determined)|is the (?:first|starting) player|give the (?:first|starting) player (?:token|marker)/i.test(text);
}

function rejected(text) {
  if (!PLAYER.test(text)) return true;
  if (/\b(?:first|starting)\s+player\s+to\b/i.test(text)) return true;
  if (/\b(?:pass|passes|passed|passing)\s+the\s+(?:first|starting)\s+player\b/i.test(text)) return true;
  if (/\bclockwise\b/i.test(text)) return true;
  if (/\b(?:wins?|victory points?)\b/i.test(text) && !/randomly|most recently|youngest|oldest/i.test(text)) return true;
  if (/starting player["”']?\s+action/i.test(text)) return true;
  if (/^The (?:first|starting) player is(?: the)?\.?$/i.test(text)) return true;
  if (/\bis at\.?$/i.test(text)) return true;
  if (/\bfirst player randomly (?:draws|places|takes|plays)\b/i.test(text)) return true;
  if (/select a first\.?$/i.test(text)) return true;
  if (/previous game is|the winner is/i.test(text)) return true;
  if (((text.match(/[“”"]/g) || []).length) % 2 === 1) return true;
  if (/\b(?:them|the|face|give|must|players['’]?|starting)\.$/i.test(text)) return true;
  if ((text.match(/\b[A-Z]\b/g) || []).length > 4) return true;
  if (/[|]{1}|bb\)|�/.test(text)) return true;
  return false;
}

function tidy(match) {
  let text = match.replace(/\u0007/g, "").replace(/\s+/g, " ").trim();
  text = text.replace(/^(?:[\d]+[.)]\s*)+/, "");
  text = text.replace(/^[^A-Za-z]+/, "");
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    const hit = sentences.map((s) => s.trim()).find((s) => selects(s) && PLAYER.test(s));
    if (hit) text = hit;
  }
  const cut = text.search(/(?:The (?:player|person|last player) who|The (?:player|person) with|The (?:first|starting) player is|(?:Randomly |Players? )?(?:choose|determine|select|pick|give|hand)\b|(?:youngest|oldest) (?:player|person)|method of your|any way you|favorite house rule)/i);
  if (cut > 0) text = text.slice(cut).trim();
  const parts = text.split(/\s+and then\s+/i);
  if (parts.length > 1 && selects(parts[0]) && PLAYER.test(parts[0])) {
    text = parts[0].replace(/[,;]\s*$/, "").trim();
  }
  text = text.replace(/^(?:and|or|then)\s+/i, "");
  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  if (closes > opens) text = text.replace(/\)+(?=\.?$)/, "").trim();
  if (opens > closes) text = text.replace(/\(+$/g, "").trim();
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text && !/[.!?]$/.test(text)) text += ".";
  return text;
}

function anchored(text) {
  return /^(?:The |Each |Players |Randomly |Choose |Determine |Select |Pick |Give |A |An |Whoever |You |Player who )/i.test(text);
}

function exactQuery(raw, sentence) {
  const words = sentence.replace(/[“”"()[\]]/g, "").split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
  const hay = raw.toLowerCase();
  for (let size = Math.min(7, words.length); size >= 3; size -= 1) {
    for (let i = 0; i + size <= words.length; i += 1) {
      const window = words.slice(i, i + size).join(" ");
      if (!/first|starting|player|random|recently|youngest|oldest|house rule|method of/i.test(window)) continue;
      const at = hay.indexOf(window.toLowerCase());
      if (at < 0) continue;
      return raw.slice(at, at + window.length);
    }
  }
  return "";
}

function fromIndex(slug) {
  const index = loadIndex(slug);
  if (!index) return null;
  let best = null;
  (index.pages || []).forEach((page) => {
    const blob = pageBlob(page);
    const raw = rawBlob(page);
    if (!blob || !PLAYER.test(blob)) return;
    PATTERNS.forEach((pattern) => {
      pattern.lastIndex = 0;
      const found = blob.match(pattern) || [];
      found.forEach((match) => consider(match, blob, raw, page.page));
    });
    (page.lines || []).forEach((line) => {
      const plain = cleanLine(line);
      if (!plain || plain.length > 220 || !PLAYER.test(plain)) return;
      consider(plain, blob, raw, page.page);
    });
    function consider(match, blobText, rawText, pageNum) {
      const text = tidy(match);
      const bare = text.replace(/[.!?]$/, "");
      if (!text || bare.length < 16 || text.length > 240) return;
      if (!selects(text) || rejected(text) || !anchored(text)) return;
      const open = (text.match(/\(/g) || []).length;
      const close = (text.match(/\)/g) || []).length;
      if (open !== close) return;
      if (!blobText.toLowerCase().includes(bare.toLowerCase())) return;
      const query = exactQuery(rawText, bare);
      if (!query || query.length < 8) return;
      const direct = /randomly|most recently|youngest|oldest|highest roll|any way you|method of your|house rule/i.test(text);
      const words = text.split(/\s+/).length;
      const score = (direct ? 8 : 3) + (words >= 8 ? 3 : 0) + (words <= 4 ? -2 : 0);
      const row = { text, page: pageNum, query, from: "index", score };
      if (!best || row.score > best.score || (row.score === best.score && row.text.length > best.text.length)) best = row;
    }
  });
  if (!best) return null;
  delete best.score;
  return best;
}

function walkRules(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkRules(item, out));
    return;
  }
  if (typeof value !== "object") return;
  if (value.text && value.source && value.source.page && value.source.query) out.push(value);
  ["bullets", "details", "items"].forEach((key) => {
    if (value[key]) walkRules(value[key], out);
  });
  Object.keys(value).forEach((key) => {
    if (key === "source" || key === "text" || key === "lead" || key === "bullets" || key === "details") return;
    if (value[key] && typeof value[key] === "object") walkRules(value[key], out);
  });
}

function fromRules(game, slug) {
  const index = loadIndex(slug);
  if (!index || !game) return null;
  const pages = {};
  (index.pages || []).forEach((page) => { pages[page.page] = rawBlob(page).toLowerCase(); });
  const items = [];
  ["quickStart", "playerCountSetup", "setupByPlayerCount", "setupVariants", "firstGameSetup", "teachingScript", "startingResources"].forEach((key) => {
    walkRules(game[key], items);
  });
  let best = null;
  items.forEach((item) => {
    const lead = String(item.lead || "").trim();
    const text = String(item.text || "").replace(/\s+/g, " ").trim();
    const line = (lead + " " + text).trim();
    if (!PLAYER.test(text) || !selects(text) || rejected(text) || !anchored(text)) return;
    if (text.length < 12 || text.length > 240) return;
    const page = parseInt(item.source.page, 10);
    const query = String(item.source.query || "").trim();
    if (!page || page < 1 || !query) return;
    const blob = pages[page];
    if (!blob || !blob.includes(query.toLowerCase())) return;
    const score = (/randomly|most recently|youngest|oldest/i.test(line) ? 5 : 3) + (/first player|starting player/i.test(lead) ? 1 : 0);
    const row = { text, page, query, from: "rules", score };
    if (!best || row.score > best.score || (row.score === best.score && row.text.length < best.text.length)) best = row;
  });
  if (!best) return null;
  delete best.score;
  return best;
}

const owners = RAW.ownersByBggId || {};
function inCollection(game) {
  if (!game) return false;
  if (game.mine === true || game.group === true) return true;
  const id = String(game.bggId || "");
  if (id && Array.isArray(owners[id]) && owners[id].length) return true;
  if (id === "13" && Array.isArray(owners["152959"]) && owners["152959"].length) return true;
  return false;
}

const games = RAW.names.map((name) => {
  const slug = slugify(name);
  return Object.assign({ name, slug }, RAW.enrich[slug] || {});
});
games.sort((a, b) => Number(inCollection(b)) - Number(inCollection(a)) || a.name.localeCompare(b.name));

const out = {};
let collectionHit = 0;
let collectionTotal = 0;
games.forEach((game) => {
  const collection = inCollection(game);
  if (collection) collectionTotal += 1;
  const row = fromRules(game, game.slug) || fromIndex(game.slug);
  if (!row) return;
  out[game.slug] = row;
  if (collection) collectionHit += 1;
});

const dest = path.join(root, "first-player.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
const total = Object.keys(out).length;
console.log(JSON.stringify({ total, collectionHit, collectionTotal, catalog: games.length }, null, 2));
