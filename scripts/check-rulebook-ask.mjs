#!/usr/bin/env node
/* Every Ask-the-rulebook sentence must be copied from its page, not rebuilt. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("/* rulebook-ask:start */");
const end = html.indexOf("/* rulebook-ask:end */");
if (start < 0 || end < 0) {
  console.error("rulebook ask markers were not found in index.html");
  process.exit(1);
}
const sandbox = { Math, String, Object, isFinite, Number, parseInt, RegExp };
vm.createContext(sandbox);
vm.runInContext(
  html.slice(start, end) + "\nthis.askBuildPassages = askBuildPassages;\nthis.askFold = askFold;",
  sandbox
);

const indexDir = path.join(root, "rulebooks", "index");
const files = fs.readdirSync(indexDir).filter(function (name) { return name.endsWith(".json"); });
let sentences = 0;
let failed = 0;
files.forEach(function (name) {
  const index = JSON.parse(fs.readFileSync(path.join(indexDir, name), "utf8"));
  const blobs = {};
  (index.pages || []).forEach(function (page) {
    blobs[page.page] = sandbox.askFold((page.lines || []).join("\n"));
  });
  sandbox.askBuildPassages(index).forEach(function (doc) {
    sentences += 1;
    const text = sandbox.askFold(doc.text);
    if (text.indexOf("[p.") !== -1) {
      failed += 1;
      console.error("FAIL", name, "p" + doc.page, "contains [p.]:", doc.text);
      return;
    }
    const blob = blobs[doc.page] || "";
    if (blob.indexOf(text) === -1) {
      failed += 1;
      console.error("FAIL", name, "p" + doc.page, "not a contiguous substring:", doc.text);
    }
  });
});

if (failed) {
  console.error("rulebook ask check failed (" + failed + " sentences, " + sentences + " checked)");
  process.exit(1);
}
console.log("rulebook ask ok (" + sentences + " sentences, " + files.length + " games)");
