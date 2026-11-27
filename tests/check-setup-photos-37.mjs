/* Setup photos added in this batch, and the two how-to-play videos that were not added.
   node tests/check-setup-photos-37.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, ok) {
  if (!ok) failures.push(name);
  console.log((ok ? "ok " : "FAIL ") + name);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const open = html.indexOf(">", html.indexOf('<script id="games-json"')) + 1;
const games = JSON.parse(html.slice(open, html.indexOf("</script>", open)));
const owners = ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"];

const bgg = {
  "ostia-mariner-edition": {
    count: "4",
    credit: "Photo: MoreCheesePlease on BoardGameGeek",
    href: "https://boardgamegeek.com/image/9762791/ostia-mariner-edition"
  },
  cartographers: {
    count: "1",
    credit: "Photo: DefinitelyDeWitt on BoardGameGeek",
    href: "https://boardgamegeek.com/image/8182206/cartographers"
  }
};
const official = ["archduke", "camel-up-the-card-game", "wingspan-pocket"];

function photoOf(meta) {
  return meta.src ? meta : (meta.byCount && Object.values(meta.byCount)[0]);
}

for (const [slug, expect] of Object.entries(bgg)) {
  const metaPath = path.join(root, "setup-photos", slug + ".json");
  const imagePath = path.join(root, "setup-photos", slug + ".webp");
  check(slug + " json", fs.existsSync(metaPath));
  check(slug + " webp", fs.existsSync(imagePath) && fs.statSync(imagePath).size > 8000);
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const photo = meta.byCount && meta.byCount[expect.count];
  const blob = JSON.stringify(meta);
  check(slug + " gated to " + expect.count, photo && photo.src === slug + ".webp");
  check(slug + " credit", photo && photo.credit === expect.credit && String(photo.alt || "").includes(expect.credit));
  check(slug + " href", photo && photo.href === expect.href);
  check(slug + " names nobody", owners.every((name) => !new RegExp("\\b" + name + "\\b").test(blob)));
}

for (const slug of official) {
  const metaPath = path.join(root, "setup-photos", slug + ".json");
  const imagePath = path.join(root, "setup-photos", slug + ".webp");
  check(slug + " json", fs.existsSync(metaPath));
  check(slug + " webp", fs.existsSync(imagePath) && fs.statSync(imagePath).size > 8000);
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const photo = photoOf(meta);
  const blob = JSON.stringify(meta);
  check(slug + " src", photo && photo.src === slug + ".webp");
  check(slug + " alt names the diagram", String(photo.alt || "").startsWith("Setup diagram from the "));
  check(slug + " has no link", !meta.href && !photo.href && !/https?:/i.test(blob));
  check(slug + " names nobody", owners.every((name) => !new RegExp("\\b" + name + "\\b").test(blob)));
}

for (const slug of ["magic-maze-pocket", "winnie-the-pooh-serious-detective"]) {
  const video = games.enrich[slug] && games.enrich[slug].howToPlayVideo;
  const url = video && video.url;
  check(slug + " how-to-play left unset", !url);
}

if (failures.length) {
  console.error(failures.length + " failed");
  process.exit(1);
}
