import { expect, test } from "@playwright/test";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createBackend } from "./gameday-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ON = "/game-day.html?on=2026-11-20";
const artifacts = "/opt/cursor/artifacts";

let backend;
let server;
let execUrl;

function listen() {
  const seen = { options: 0, types: [] };
  const srv = http.createServer(function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const cors = {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    };
    if (req.method === "OPTIONS") {
      seen.options += 1;
      res.writeHead(405, cors);
      res.end();
      return;
    }
    if (req.method === "GET" && url.pathname === "/exec") {
      res.writeHead(200, cors);
      res.end(JSON.stringify(backend.get(url.searchParams.get("event") || "")));
      return;
    }
    if (req.method === "POST" && url.pathname === "/exec") {
      seen.types.push(req.headers["content-type"] || "");
      let raw = "";
      req.on("data", function (chunk) { raw += chunk; });
      req.on("end", function () {
        res.writeHead(200, cors);
        res.end(JSON.stringify(backend.handlePost({ postData: { contents: raw } })));
      });
      return;
    }
    res.writeHead(404, cors);
    res.end(JSON.stringify({ ok: false, error: "Missing." }));
  });
  srv.seen = seen;
  return new Promise(function (resolve) {
    srv.listen(0, "127.0.0.1", function () { resolve(srv); });
  });
}

async function installMock(page) {
  await page.route("**/data/game-days.json", async function (route) {
    const data = JSON.parse(fs.readFileSync(path.join(root, "data/game-days.json"), "utf8"));
    data.endpoint = execUrl;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(data)
    });
  });
}

async function waitForList(page) {
  await page.waitForFunction(function () {
    const count = document.getElementById("search-count");
    const grid = document.getElementById("game-grid");
    if (!count || !grid) return false;
    const match = (count.textContent || "").match(/^(\d+)/);
    if (!match) return false;
    const shown = Number(match[1]);
    const cards = grid.querySelectorAll("a.card").length;
    const empty = grid.querySelector(".empty-note");
    return empty ? shown === 0 : cards === shown;
  });
}

test.beforeAll(async function () {
  backend = createBackend();
  server = await listen();
  execUrl = "http://127.0.0.1:" + server.address().port + "/exec";
  fs.mkdirSync(artifacts, { recursive: true });
});

test.afterAll(async function () {
  if (server) await new Promise(function (resolve) { server.close(resolve); });
});

test.beforeEach(function () {
  backend.reset();
  server.seen.options = 0;
  server.seen.types = [];
});

test("closed page shows the next Saturday and keeps the location private", async function ({ page }) {
  await page.goto(ON);
  await expect(page.locator("#gd-date")).toHaveText("Saturday, November 28, 2026");
  await expect(page.locator("#gd-time")).toHaveText("3:00–9:00 PM");
  await expect(page.locator("#gd-location")).toHaveText("Location shared after you RSVP");
  await expect(page.getByText("CRPC", { exact: true })).toHaveCount(0);
  await expect(page.locator("#gd-closed")).toHaveText("RSVPs aren't open yet.");
  await expect(page.getByRole("button", { name: "Save RSVP" })).toHaveCount(0);
  await expect(page.locator('input[type="email"], input[type="tel"]')).toHaveCount(0);
  await expect(page.getByLabel(/phone|email/i)).toHaveCount(0);
  await expect(page.locator("#food-drinks")).toContainText("about 2 per person");
  await expect(page.locator("#food-drinks")).toContainText("Waiting on RSVPs");
  await expect(page.locator("#gd-play")).toContainText("All Games filters");

  const selectSize = await page.locator("#gd-date-select").evaluate(function (el) {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(selectSize).toBeGreaterThanOrEqual(16);

  await page.getByLabel("Date").selectOption("2026-12-19");
  await expect(page.locator("#gd-date")).toHaveText("Saturday, December 19, 2026");
  await expect(page.getByText("Third Saturday. The 26th is Christmas weekend.")).toBeVisible();

  await page.getByRole("link", { name: "Group games" }).click();
  await waitForList(page);
  await expect(page).toHaveURL(/collection=group/);
  await expect(page.locator('.collection-filter button[data-collection="group"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#search-count")).toContainText("group");
});

test("home and header link to Game Day", async function ({ page }, testInfo) {
  await page.goto("/#/");
  await waitForList(page);
  await expect(page.getByRole("link", { name: "Game Day", exact: true })).toBeVisible();
  await expect(page.locator(".game-day-entry")).toContainText("3–9 PM");
  await expect(page.locator(".game-day-entry")).toContainText("RSVP");
  if (testInfo.project.name === "phone") {
    await page.screenshot({ path: path.join(artifacts, "game-day-home-phone.png") });
  }
  await page.locator(".game-day-entry").click();
  await expect(page).toHaveURL(/game-day\.html/);
  await expect(page.locator(".gd-kicker")).toHaveText("Monthly Game Day");

  await page.goto("/#/game/azul");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page.getByRole("link", { name: "Game Day", exact: true })).toBeVisible();
});

test("a family can RSVP, edit, and sign up for food", async function ({ page, browser }, testInfo) {
  await installMock(page);
  await page.goto(ON);
  await expect(page.locator("#gd-form")).toBeVisible();
  await page.waitForFunction(function () {
    return navigator.serviceWorker && navigator.serviceWorker.controller;
  });

  const going = page.getByRole("button", { name: "Going", exact: true });
  const paint = await going.evaluate(function (el) {
    const before = getComputedStyle(el, "::before");
    return {
      text: el.textContent,
      color: getComputedStyle(el).color,
      background: before.backgroundColor,
      content: before.content
    };
  });
  expect(paint.text).toBe("Going");
  expect(paint.color).toBe("rgb(255, 255, 255)");
  expect(paint.background).toContain("0, 122, 255");
  expect(paint.content).not.toMatch(/✓|✔|check/i);

  const familySize = await page.getByLabel("Family name").evaluate(function (el) {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(familySize).toBeGreaterThanOrEqual(16);

  await page.getByLabel("Family name").fill("The Garcias");
  await page.getByLabel("Adults").fill("10");
  await page.getByLabel("Kids").fill("10");
  await page.getByLabel("Note").fill("We'll bring a game");
  await page.getByRole("button", { name: "Save RSVP" }).click();
  await expect(page.locator("#gd-totals")).toHaveText("1 family going · 10 adults · 10 kids · 20 people");
  await expect(page.locator("#gd-location")).toHaveText("CRPC");
  await expect(page.locator("#gd-list")).toContainText("The Garcias");
  await expect(page.locator("#gd-list")).toContainText("Your RSVP");
  await expect(page.locator("#gd-list")).toContainText("We'll bring a game");
  await expect(page.locator("#food-drinks")).toContainText("about 2 per person, so ~30 cans");
  await expect(page.locator("#food-snacks")).toContainText("4 bags for 15 people");
  await expect(page.locator("#gd-food-intro")).toContainText("about 15 people");

  const drinks = page.locator("#food-drinks");
  await drinks.getByLabel("Your name").fill("The Garcias");
  await drinks.getByLabel("What you're bringing").fill("seltzer");
  await drinks.getByLabel("How many cans?").fill("12");
  await drinks.getByRole("button", { name: "I'll bring this" }).click();
  await expect(drinks).toContainText("The Garcias — seltzer, 12 cans");
  await expect(drinks).toContainText("Still needed: ~18 cans");
  await expect(page.locator("#gd-unclaimed")).toContainText("Snacks");
  await expect(page.locator("#gd-unclaimed")).not.toContainText("Drinks");
  await expect(page.locator("#gd-short")).toHaveText("Still short: Drinks (~18 cans)");
  await expect(page.locator("body")).not.toContainText(/@|555-|street|avenue/i);

  if (testInfo.project.name === "phone") {
    const overflow = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(artifacts, "game-day-phone.png"), fullPage: true });
  }

  const leak = await page.evaluate(async function (family) {
    const key = localStorage.getItem("bgq-gameday-key") || "";
    if (document.documentElement.innerHTML.includes(key)) return "edit key is in the page";
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (new URL(req.url).origin !== location.origin) return "cached cross-origin " + req.url;
        if (req.url.includes("/exec")) return "cached exec " + req.url;
        const res = await cache.match(req);
        const text = await res.text();
        if (text.includes(family) || (key && text.includes(key))) return "cached rsvp in " + req.url;
      }
    }
    return "";
  }, "The Garcias");
  expect(leak).toBe("");
  expect(server.seen.options).toBe(0);
  expect(server.seen.types.length).toBeGreaterThan(0);
  expect(server.seen.types.every(function (type) { return /text\/plain/i.test(type); })).toBe(true);

  await page.getByLabel("Adults").fill("8");
  await page.getByRole("button", { name: "Update RSVP" }).click();
  await expect(page.locator("#gd-totals")).toHaveText("1 family going · 8 adults · 10 kids · 18 people");
  await expect(page.locator("#gd-list")).toContainText("The Garcias");
  await expect(page.locator("#food-drinks")).toContainText("Still needed: ~14 cans");

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await installMock(page2);
  await page2.goto(ON);
  await expect(page2.locator("#gd-list")).toContainText("The Garcias");
  await expect(page2.locator("#gd-location")).toHaveText("Location shared after you RSVP");
  await expect(page2.getByText("CRPC", { exact: true })).toHaveCount(0);
  await expect(page2.getByText("Your RSVP")).toHaveCount(0);
  await expect(page2.locator("#food-drinks")).toContainText("seltzer");
  await other.close();
});

test("contact details are rejected and a decline is not a headcount", async function ({ page }) {
  await installMock(page);
  await page.goto(ON);
  await expect(page.locator("#gd-form")).toBeVisible();
  await page.getByLabel("Family name").fill("Pat a@example.com");
  await page.getByLabel("Adults").fill("2");
  await page.getByRole("button", { name: "Save RSVP" }).click();
  await expect(page.locator("#gd-error")).toHaveText("Leave out email addresses.");
  await expect(page.locator("#gd-list")).toHaveCount(0);

  await page.getByLabel("Family name").fill("The Ngs");
  await page.getByLabel("Note").fill("Text 555-123-4567");
  await page.getByRole("button", { name: "Save RSVP" }).click();
  await expect(page.locator("#gd-error")).toHaveText("Leave out phone numbers.");

  await page.getByLabel("Note").fill("");
  await page.getByLabel("Adults").fill("4");
  await page.getByLabel("Kids").fill("1");
  await page.getByRole("button", { name: "Can't make it", exact: true }).click();
  await page.getByRole("button", { name: "Save RSVP" }).click();
  await expect(page.locator("#gd-location")).toHaveText("CRPC");
  await expect(page.locator("#gd-totals")).toHaveText("0 families going · 0 adults · 0 kids · 0 people");
  await expect(page.locator("#gd-list")).toContainText("The Ngs");
  await expect(page.locator("#gd-list")).toContainText("Can't make it");
  await expect(page.locator("#food-snacks")).toContainText("Waiting on RSVPs");
});
