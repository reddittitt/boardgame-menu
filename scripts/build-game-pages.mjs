#!/usr/bin/env node
/* Write game/<slug>/index.html for every menu game.
   Run: node scripts/build-game-pages.mjs
   Fails before writing anything when two games share a slug. */
import fs from "fs";
import path from "path";
import { catalogFromNames, loadGamesJson, pagesDir, readIndex, stubHtml } from "./game-slugs.mjs";

const data = loadGamesJson(readIndex());
const games = catalogFromNames(data.names, data.enrich);
fs.mkdirSync(pagesDir, { recursive: true });

const keep = new Set(games.map(function (entry) { return entry.slug; }));
for (const name of fs.readdirSync(pagesDir)) {
  const dir = path.join(pagesDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (keep.has(name)) continue;
  fs.rmSync(dir, { recursive: true, force: true });
}

for (const entry of games) {
  const dir = path.join(pagesDir, entry.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), stubHtml(entry));
}

console.log("wrote " + games.length + " game pages");
