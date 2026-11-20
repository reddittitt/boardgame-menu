/* Stable game slugs and the static /game/<slug>/ pages.
   Slugs are the ids the app already uses: slugify(name), same rules as index.html.
   They are lowercase and hyphenated, and they do not change when a title is edited
   unless that edit changes the id the menu already routes on. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const SITE = "https://bgquick.com";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const pagesDir = path.join(root, "game");

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[:'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function loadGamesJson(html) {
  const marker = '<script id="games-json"';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("games-json script was not found");
  const open = html.indexOf(">", start);
  const close = html.indexOf("</script>", open);
  if (open < 0 || close < 0) throw new Error("games-json script was not closed");
  return JSON.parse(html.slice(open + 1, close));
}

/* Names are the menu. Two names that slugify to one id are a hard failure. */
export function catalogFromNames(names, enrich) {
  const games = [];
  const seen = new Map();
  const duplicates = [];
  for (const name of names || []) {
    const slug = slugify(name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("slug is not a stable lowercase id: " + JSON.stringify(name) + " -> " + slug);
    }
    if (seen.has(slug)) {
      duplicates.push(slug + " (" + seen.get(slug) + " and " + name + ")");
      continue;
    }
    seen.set(slug, name);
    const game = enrich && enrich[slug] ? enrich[slug] : {};
    games.push({ slug, name, game });
  }
  if (duplicates.length) {
    throw new Error("duplicate slugs:\n" + duplicates.join("\n"));
  }
  return games;
}

export function loadCatalog(html) {
  const data = typeof html === "string" ? loadGamesJson(html) : html;
  return catalogFromNames(data.names || [], data.enrich || {});
}

export function blurb(entry) {
  const bits = [];
  const players = entry.game && entry.game.players ? String(entry.game.players).trim() : "";
  const time = entry.game && entry.game.time ? String(entry.game.time).trim() : "";
  if (players) bits.push(players + " players");
  if (time) bits.push(/\bmin\b/i.test(time) ? time : time + " min");
  if (!bits.length) return entry.name + " on Board Game Quick.";
  return entry.name + ". " + bits.join(", ") + ".";
}

export function ogImage(entry) {
  const game = entry.game || {};
  const cover = String(game.coverUrl || game.cover || "").trim();
  if (/^https?:\/\//i.test(cover)) return cover;
  if (cover && cover.indexOf("..") === -1) return SITE + "/" + cover.replace(/^\//, "");
  return SITE + "/covers/" + entry.slug + ".webp";
}

export function pageUrl(slug) {
  return SITE + "/game/" + slug + "/";
}

function bootScript() {
  return [
    "(function () {",
    "  var shell = new URL(\"../../index.html\", window.location.href);",
    "  var root = new URL(\"../../\", window.location.href).href;",
    "  fetch(shell.href, { credentials: \"same-origin\" }).then(function (res) {",
    "    if (!res.ok) throw new Error(\"shell\");",
    "    return res.text();",
    "  }).then(function (html) {",
    "    /* Point shell assets at the site root. A <base> tag would also retarget #/ links. */",
    "    [\"./favicon.png\", \"./manifest.json\", \"./icons/\", \"./logo.png\", \"./game-night.css\", \"./game-night.js\", \"./game-day.html\", \"./sw.js\"].forEach(function (rel) {",
    "      html = html.split(rel).join(root + rel.slice(2));",
    "    });",
    "    document.open();",
    "    document.write(html);",
    "    document.close();",
    "  }).catch(function () {",
    "    var note = document.getElementById(\"game-boot-note\");",
    "    if (note) note.textContent = \"You're offline. Open Board Game Quick once while you have a connection.\";",
    "  });",
    "})();"
  ].join("\n");
}

export function stubHtml(entry) {
  const title = entry.name + " · Board Game Quick";
  const description = blurb(entry);
  const image = ogImage(entry);
  const url = pageUrl(entry.slug);
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">",
    "<title>" + escapeHtml(title) + "</title>",
    "<link rel=\"canonical\" href=\"" + escapeHtml(url) + "\">",
    "<meta name=\"description\" content=\"" + escapeHtml(description) + "\">",
    "<meta property=\"og:type\" content=\"website\">",
    "<meta property=\"og:site_name\" content=\"Board Game Quick\">",
    "<meta property=\"og:title\" content=\"" + escapeHtml(entry.name) + "\">",
    "<meta property=\"og:description\" content=\"" + escapeHtml(description) + "\">",
    "<meta property=\"og:url\" content=\"" + escapeHtml(url) + "\">",
    "<meta property=\"og:image\" content=\"" + escapeHtml(image) + "\">",
    "<meta name=\"twitter:card\" content=\"summary_large_image\">",
    "<meta name=\"theme-color\" content=\"#0b63ff\">",
    "<link rel=\"icon\" href=\"../../favicon.png\">",
    "<link rel=\"manifest\" href=\"../../manifest.json\">",
    "</head>",
    "<body data-game=\"" + escapeHtml(entry.slug) + "\">",
    "<p id=\"game-boot-note\">Loading " + escapeHtml(entry.name) + "…</p>",
    "<script>",
    bootScript(),
    "</script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function readIndex() {
  return fs.readFileSync(path.join(root, "index.html"), "utf8");
}
