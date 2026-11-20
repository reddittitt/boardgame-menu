/* Generate static /game/<slug>/ pages for GitHub Pages.

   The public slug is the game id already used by the app (slugify of the
   name in index.html). Slugs are stable: this script does not invent a second
   spelling. A collision or an id that is not a URL slug fails the build.

   Run: node scripts/build-game-pages.mjs
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(root, "data", "game-slugs.json");
const pagesRoot = path.join(root, "game");

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[:'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function publicSlug(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("game id is not a stable URL slug: " + id);
  }
  return id;
}

export function gamesFromHtml(html) {
  const match = String(html).match(/<script id="games-json" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("games-json block missing");
  const data = JSON.parse(match[1]);
  const names = Array.isArray(data.names) ? data.names : [];
  const byId = new Map();
  const collisions = [];
  names.forEach(function (name) {
    const id = slugify(name);
    if (byId.has(id)) collisions.push(id + " (" + byId.get(id) + " / " + name + ")");
    else byId.set(id, name);
  });
  if (collisions.length) {
    throw new Error("slug collision:\n" + collisions.join("\n"));
  }
  return byId;
}

export function slugMap(games) {
  const slugs = {};
  Array.from(games.keys()).sort().forEach(function (id) {
    slugs[id] = publicSlug(id);
  });
  return slugs;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

export function stubHtml(slug, name) {
  const safeSlug = escapeHtml(slug);
  const safeName = escapeHtml(name);
  return `<!doctype html>
<html lang="en" data-game="${safeSlug}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${safeName} · Board Game Quick</title>
<link rel="canonical" href="https://bgquick.com/game/${safeSlug}/">
<meta name="theme-color" content="#0b63ff">
<base href="../../">
<!-- bgq-game-stub -->
</head>
<body>
<p><a href="?game=${safeSlug}">${safeName}</a></p>
<script>
(function () {
  var shell = new URL("index.html", document.baseURI).href;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", shell, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText && xhr.responseText.indexOf("games-json") !== -1) {
      document.open();
      document.write(xhr.responseText);
      document.close();
      return;
    }
  } catch (err) {}
  location.replace(new URL("?game=${safeSlug}", document.baseURI).href);
})();
</script>
</body>
</html>
`;
}

function writePages(games) {
  fs.mkdirSync(pagesRoot, { recursive: true });
  const keep = new Set();
  games.forEach(function (name, id) {
    const slug = publicSlug(id);
    keep.add(slug);
    const dir = path.join(pagesRoot, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), stubHtml(slug, name));
  });
  fs.readdirSync(pagesRoot, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isDirectory() || keep.has(entry.name)) return;
    fs.rmSync(path.join(pagesRoot, entry.name), { recursive: true, force: true });
  });
}

function writeMap(slugs) {
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  const body = JSON.stringify({ count: Object.keys(slugs).length, slugs: slugs }, null, 2) + "\n";
  fs.writeFileSync(mapPath, body);
}

export function build(html) {
  const games = gamesFromHtml(html);
  const slugs = slugMap(games);
  const values = Object.values(slugs);
  if (new Set(values).size !== values.length) throw new Error("public slug collision");
  writeMap(slugs);
  writePages(games);
  return slugs;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const slugs = build(html);
  console.log("wrote " + Object.keys(slugs).length + " game pages");
}
