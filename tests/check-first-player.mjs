/* Every first-player line must be on the rulebook page it cites. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "first-player.json"), "utf8"));
const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
}

/* Same hyphen-join as scripts/extract-first-player.mjs pageBlob. */
function pageBlob(slug, pageNum) {
  const file = path.join(root, "rulebooks/index", slug + ".json");
  check(slug + " has an index", fs.existsSync(file));
  if (!fs.existsSync(file)) return "";
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  const page = (index.pages || []).find((item) => item.page === pageNum);
  check(slug + " page " + pageNum, !!page);
  if (!page) return "";
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
  return parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

const slugs = Object.keys(rules);
check("at least one sourced rule", slugs.length > 0);
slugs.forEach((slug) => {
  const row = rules[slug];
  check(slug + " text", typeof row.text === "string" && row.text.trim().length > 10);
  check(slug + " query", typeof row.query === "string" && row.query.trim().length > 5);
  check(slug + " page number", Number.isInteger(row.page) && row.page >= 1);
  check(slug + " not a win condition", !/\bfirst player to\b/i.test(row.text));
  const blob = pageBlob(slug, row.page);
  const bare = String(row.text).replace(/[.!?]+$/, "").toLowerCase();
  check(slug + " text is on the page", blob.includes(bare));
  check(slug + " query is on the page", blob.includes(String(row.query).toLowerCase()));
});

console.log("first player rules " + slugs.length);
if (failures.length) {
  console.error(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ok first player rules");
