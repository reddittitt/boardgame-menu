#!/usr/bin/env node
/* Fail when slugs collide, drift, or a stub is missing its title and og tags.
   Run: node scripts/check-game-slugs.mjs */
import fs from "fs";
import path from "path";
import { catalogFromNames, loadCatalog, pageUrl, pagesDir, readIndex, slugify, stubHtml } from "./game-slugs.mjs";

let failed = 0;
function fail(message) {
  failed += 1;
  console.error(message);
}

try {
  catalogFromNames(["Root", "Root"]);
  fail("duplicate slugs were accepted");
} catch (err) {
  if (!/duplicate slugs/.test(String(err && err.message))) fail("duplicate check threw the wrong error: " + err);
}

const expected = {
  "Root": "root",
  "The Crew: The Quest for Planet Nine": "the-crew-the-quest-for-planet-nine",
  "The Crew: Mission Deep Sea": "the-crew-mission-deep-sea",
  "The Crew: Journey to the Ends of the Earth": "the-crew-journey-to-the-ends-of-the-earth",
  "Kinfire Delve: Vainglory's Grotto": "kinfire-delve-vainglorys-grotto",
  "Brass: Birmingham": "brass-birmingham",
  "Air, Land & Sea: Critters at War": "air-land-and-sea-critters-at-war"
};
for (const [name, slug] of Object.entries(expected)) {
  if (slugify(name) !== slug) fail(name + " slugified to " + slugify(name) + ", expected " + slug);
}

const games = loadCatalog(readIndex());
const bySlug = new Map(games.map(function (entry) { return [entry.slug, entry]; }));
if (!bySlug.has("root") || !bySlug.has("kinfire-delve-vainglorys-grotto")) {
  fail("sample games missing from the catalog");
}

if (!fs.existsSync(pagesDir)) fail("game/ was not generated");
const dirs = fs.existsSync(pagesDir)
  ? fs.readdirSync(pagesDir).filter(function (name) {
    return fs.statSync(path.join(pagesDir, name)).isDirectory();
  })
  : [];
for (const entry of games) {
  const file = path.join(pagesDir, entry.slug, "index.html");
  if (!fs.existsSync(file)) {
    fail("missing stub " + entry.slug);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const fresh = stubHtml(entry);
  if (html !== fresh) fail("stub out of date: " + entry.slug);
  if (html.indexOf("<title>" + entry.name.replace(/&/g, "&amp;") ) !== 0 && !html.includes("<title>")) {
    fail("stub has no title: " + entry.slug);
  }
  if (!html.includes('property="og:title" content="' + entry.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"')) {
    fail("og:title missing for " + entry.slug);
  }
  if (!html.includes('rel="canonical" href="' + pageUrl(entry.slug) + '"')) fail("canonical missing for " + entry.slug);
  if (!html.includes('property="og:url" content="' + pageUrl(entry.slug) + '"')) fail("og:url missing for " + entry.slug);
  if (/\bowner\b/i.test(html)) fail("owner name on " + entry.slug);
}
for (const dir of dirs) {
  if (!bySlug.has(dir)) fail("extra game page: " + dir);
}
if (dirs.length !== games.length) fail("page count " + dirs.length + " != games " + games.length);

const app = readIndex();
if (!app.includes("function pathGameSlug(")) fail("app does not read /game/<slug>/");
if (!app.includes("function canonicalGameUrl(")) fail("app does not build canonical game URLs");
const sw = fs.readFileSync(path.join(pagesDir, "..", "sw.js"), "utf8");
if (!sw.includes('var VERSION = "2026.11.20.7";')) fail("sw.js VERSION was not bumped");
if (sw.includes("./game/root/index.html")) fail("sw.js precaches a game stub");

if (failed) {
  console.error(failed + " slug check(s) failed");
  process.exit(1);
}
console.log("game slugs ok (" + games.length + " pages, no duplicates)");
