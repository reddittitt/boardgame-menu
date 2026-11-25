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

const PUBLISHED_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbypC0DWIPjsGqwegeym0YKgoNk3XEPzRNZezCqLpJPMXztktWuuC9VqWlQpxYcRNvDuWg/exec";

async function fulfillGameDays(route, endpoint) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "data/game-days.json"), "utf8"));
  data.endpoint = endpoint;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(data)
  });
}

async function installMock(page) {
  await page.route("**/data/game-days.json", async function (route) {
    await fulfillGameDays(route, execUrl);
  });
}

async function installClosedMock(page) {
  await page.route("**/data/game-days.json", async function (route) {
    await fulfillGameDays(route, "");
  });
}

async function installPublishedEndpointMock(page, seen) {
  await page.route("**/data/game-days.json", async function (route) {
    await fulfillGameDays(route, PUBLISHED_ENDPOINT);
  });
  await page.route("**/macros/s/*/exec**", async function (route) {
    const req = route.request();
    const url = new URL(req.url());
    seen.method = req.method();
    seen.event = url.searchParams.get("event") || "";
    seen.href = url.origin + url.pathname;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ ok: true, eventId: "2026-11-21", rsvps: [], food: [] })
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

test("closed page shows the next Saturday and keeps the location private", async function ({ page }, testInfo) {
  await installClosedMock(page);
  await page.goto(ON);
  await expect(page.locator("#gd-date")).toHaveText("Saturday, November 21, 2026");
  await expect(page.locator("#gd-time")).toHaveText("3:00–9:00 PM");
  await expect(page.locator("#gd-location")).toHaveText("Location shared after you RSVP");
  await expect(page.getByText("CRPC", { exact: true })).toHaveCount(0);
  await expect(page.locator("#gd-closed")).toHaveText("RSVPs aren't open yet.");
  await expect(page.getByRole("button", { name: "Save RSVP" })).toHaveCount(0);
  await expect(page.locator('input[type="email"], input[type="tel"]')).toHaveCount(0);
  await expect(page.getByLabel(/phone|email/i)).toHaveCount(0);
  await expect(page.locator("#gd-tables-soon")).toHaveText("Table sign-ups open soon");
  await expect(page.locator("#food-drinks")).toContainText("about 2 per person");
  await expect(page.locator("#food-drinks")).toContainText("Waiting on RSVPs");
  await expect(page.locator("#gd-play")).toContainText("All Games filters");

  const selectSize = await page.locator("#gd-date-select").evaluate(function (el) {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(selectSize).toBeGreaterThanOrEqual(16);

  if (testInfo.project.name === "phone") {
    await page.locator("#gd-tables").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, "game-day-tables-empty-phone.png") });
  }

  await page.getByLabel("Date").selectOption("2026-12-19");
  await expect(page.locator("#gd-date")).toHaveText("Saturday, December 19, 2026");
  await expect(page.getByText("Third Saturday. The 26th is Christmas weekend.")).toBeVisible();

  await page.getByRole("link", { name: "Group games" }).click();
  await waitForList(page);
  await expect(page).toHaveURL(/collection=group/);
  await expect(page.locator('.collection-filter button[data-collection="group"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#search-count")).toContainText("group");
});

test("published endpoint opens RSVPs and loads event 2026-11-21 from a mocked fetch", async function ({ page }, testInfo) {
  const seen = { method: "", event: "", href: "" };
  await installPublishedEndpointMock(page, seen);
  await page.goto(ON);
  await expect(page.locator("#gd-form")).toBeVisible();
  await expect(page.locator("#gd-closed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save RSVP" })).toBeVisible();
  await expect(page.locator("#gd-location")).toHaveText("Location shared after you RSVP");
  await expect(page.locator("#food-drinks")).toContainText("Waiting on RSVPs");
  await expect(page.locator("#gd-tables-soon")).toHaveText("Table sign-ups open soon");
  await expect(page.locator("#gd-nominate")).toHaveCount(0);
  await expect.poll(function () { return seen.method; }).toBe("GET");
  expect(seen.event).toBe("2026-11-21");
  expect(seen.href).toBe(PUBLISHED_ENDPOINT);
  if (testInfo.project.name === "phone") {
    await page.screenshot({ path: path.join(artifacts, "game-day-rsvps-open-phone.png"), fullPage: true });
  }
});

test("home and header link to Game Day", async function ({ page }, testInfo) {
  await page.route("**/macros/s/*/exec**", async function (route) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ ok: true, eventId: "2026-11-21", rsvps: [], food: [] })
    });
  });
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
  await expect(page.locator("#gd-form")).toBeVisible();

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

test("tables can be nominated, joined, marked full, and flagged for a teacher", async function ({ page, browser }, testInfo) {
  await installMock(page);
  await page.goto(ON);
  await expect(page.locator("#gd-nominate")).toBeVisible();
  await expect(page.locator("#gd-tables-soon")).toHaveCount(0);

  const nominate = page.locator("#gd-nominate");
  await nominate.getByLabel("Your first name").fill("Riley");
  await nominate.locator("#gd-game").fill("Catan");
  await nominate.getByLabel("Start time").selectOption("16:00");
  await nominate.getByLabel("Seats").fill("4");
  await nominate.getByRole("button", { name: "Can teach", exact: true }).click();
  await nominate.getByRole("button", { name: "Nominate table" }).click();

  const openTable = page.locator(".gd-table").filter({ hasText: "Catan" });
  await expect(openTable).toContainText("1 / 4 seats");
  await expect(openTable).toContainText("Riley");
  await expect(openTable).toContainText("Can teach");
  await expect(openTable.locator(".gd-badge")).toHaveCount(0);

  if (testInfo.project.name === "phone") {
    await openTable.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, "game-day-tables-open-phone.png") });
  }

  const again = page.locator("#gd-nominate");
  await again.getByLabel("Your first name").fill("Alex");
  await again.locator("#gd-game").fill("Azul");
  await again.getByLabel("Start time").selectOption("15:00");
  await again.getByLabel("Seats").fill("2");
  await again.getByRole("button", { name: "Played before", exact: true }).click();
  await again.getByRole("button", { name: "Nominate table" }).click();

  const needsTeacher = page.locator(".gd-table").filter({ hasText: "Azul" });
  await expect(needsTeacher).toContainText("1 / 2 seats");
  await expect(needsTeacher).toContainText("Alex");
  await expect(needsTeacher.locator(".gd-badge")).toHaveText("Needs a teacher");

  if (testInfo.project.name === "phone") {
    await needsTeacher.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, "game-day-tables-needs-teacher-phone.png") });
  }

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await installMock(page2);
  await page2.goto(ON);
  const join = page2.locator(".gd-table").filter({ hasText: "Azul" }).locator(".gd-join");
  await expect(join).toBeVisible();
  await join.getByLabel("Your first name").fill("Sam");
  await join.getByRole("button", { name: "New to it", exact: true }).click();
  await join.getByRole("button", { name: "Join table" }).click();
  const full = page2.locator(".gd-table").filter({ hasText: "Azul" });
  await expect(full).toContainText("Full · 2 / 2 seats");
  await expect(full.getByRole("button", { name: "Join table" })).toHaveCount(0);
  await expect(full.locator(".gd-badge")).toHaveText("Needs a teacher");
  await expect(page2.locator(".gd-table").filter({ hasText: "Catan" }).locator(".gd-badge")).toHaveCount(0);

  if (testInfo.project.name === "phone") {
    await full.scrollIntoViewIfNeeded();
    await page2.screenshot({ path: path.join(artifacts, "game-day-tables-full-phone.png") });
  }

  await page2.getByRole("button", { name: "Leave table" }).click();
  await expect(page2.locator(".gd-table").filter({ hasText: "Azul" })).toContainText("1 / 2 seats");
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

function execFulfillHeaders() {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  };
}

async function installNominateMock(page, onPost) {
  const live = [];
  page.on("request", function (req) {
    if (/script\.google(usercontent)?\.com/i.test(req.url())) live.push(req.method() + " " + req.url());
  });
  await page.route(/script\.google(usercontent)?\.com/i, function (route) {
    return route.abort();
  });
  await page.route("**/data/game-days.json", async function (route) {
    await fulfillGameDays(route, execUrl);
  });
  await page.route(function (url) {
    return url.href.indexOf(execUrl) === 0;
  }, async function (route) {
    const req = route.request();
    if (/script\.google(usercontent)?\.com/i.test(req.url())) {
      await route.abort();
      return;
    }
    if (req.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: execFulfillHeaders(),
        body: JSON.stringify({ ok: true, eventId: "2026-11-21", rsvps: [], food: [], tables: [] })
      });
      return;
    }
    if (req.method() === "POST") {
      let body = {};
      try { body = JSON.parse(req.postData() || "{}"); }
      catch (err) { body = {}; }
      await onPost(route, body);
      return;
    }
    await route.abort();
  });
  return live;
}

async function fillNominate(page) {
  const nominate = page.locator("#gd-nominate");
  await expect(nominate).toBeVisible();
  await nominate.getByLabel("Your first name").fill("Riley");
  await nominate.locator("#gd-game").fill("Catan");
  await nominate.getByLabel("Start time").selectOption("16:00");
  await nominate.getByLabel("Seats").fill("4");
  await nominate.getByRole("button", { name: "Can teach", exact: true }).click();
  return nominate;
}

async function expectInViewport(locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const view = locator.page().viewportSize();
  expect(box).toBeTruthy();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
}

function tableSnapshot(body) {
  return {
    ok: true,
    eventId: body.eventId || "2026-11-21",
    rsvps: [],
    food: [],
    tables: [{
      id: body.id,
      game: body.game,
      startTime: body.startTime,
      seats: body.seats,
      players: [{ id: body.playerId, name: body.name, experience: body.experience }]
    }]
  };
}

test("nominate posts the table, then shows the card without an error", async function ({ page }, testInfo) {
  let posted = null;
  const live = await installNominateMock(page, async function (route, body) {
    posted = body;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: execFulfillHeaders(),
      body: JSON.stringify(tableSnapshot(body))
    });
  });
  await page.goto(ON);
  const nominate = await fillNominate(page);
  await nominate.getByRole("button", { name: "Nominate table" }).click();

  await expect(page.locator(".gd-table").filter({ hasText: "Catan" })).toBeVisible();
  await expect(page.locator("#gd-tables-status")).toHaveText("Table added");
  await expect(page.locator("#gd-error")).toBeHidden();
  await expect(page.locator("#gd-tables-error")).toBeHidden();
  expect(posted).toMatchObject({
    op: "nominate",
    eventId: "2026-11-21",
    name: "Riley",
    game: "Catan",
    startTime: "16:00",
    seats: 4,
    experience: "teach"
  });
  expect(posted.id).toMatch(/^[a-f0-9]{32}$/);
  expect(posted.playerId).toMatch(/^[a-f0-9]{32}$/);
  expect(live).toEqual([]);

  if (testInfo.project.name === "phone") {
    await page.evaluate(function () {
      var status = document.getElementById("gd-tables-status");
      var header = document.querySelector("header");
      if (!status) return;
      var headerH = header ? header.getBoundingClientRect().height : 0;
      var top = status.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo(0, Math.max(0, top));
    });
    await page.screenshot({ path: path.join(artifacts, "game-day-nominate-success-phone.png") });
  }
});

test("a failed nominate keeps the form and shows the error in view", async function ({ page }, testInfo) {
  const live = await installNominateMock(page, async function (route) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: execFulfillHeaders(),
      body: JSON.stringify({ ok: false, error: "Something went wrong. Try again." })
    });
  });
  await page.goto(ON);
  const nominate = await fillNominate(page);
  await nominate.getByRole("button", { name: "Nominate table" }).click();

  const alert = page.locator("#gd-tables-error");
  await expect(alert).toHaveText("Something went wrong. Try again.");
  await expect(page.locator("#gd-error")).toHaveText("Something went wrong. Try again.");
  await expectInViewport(alert);
  await expect(nominate.getByLabel("Your first name")).toHaveValue("Riley");
  await expect(nominate.locator("#gd-game")).toHaveValue("Catan");
  await expect(nominate.getByLabel("Start time")).toHaveValue("16:00");
  await expect(nominate.getByLabel("Seats")).toHaveValue("4");
  await expect(nominate.getByRole("button", { name: "Can teach", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(nominate.getByRole("button", { name: "Nominate table" })).toBeEnabled();
  await expect(page.locator(".gd-table")).toHaveCount(0);
  expect(live).toEqual([]);

  if (testInfo.project.name === "phone") {
    await page.screenshot({ path: path.join(artifacts, "game-day-nominate-error-phone.png") });
  }
});

test("the update toast sits at the bottom and a nominate click still posts", async function ({ page }) {
  let posted = null;
  const dialogs = [];
  page.on("dialog", async function (dialog) {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  const live = await installNominateMock(page, async function (route, body) {
    posted = body;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: execFulfillHeaders(),
      body: JSON.stringify(tableSnapshot(body))
    });
  });
  await page.goto(ON);
  const nominate = await fillNominate(page);
  await page.evaluate(function () { window.__gdBoot = "stay"; });
  await page.evaluate(function () {
    document.getElementById("app-update").hidden = false;
  });
  await expect(page.locator("html")).toHaveClass(/gd-update-open/);

  const hit = await page.evaluate(function () {
    var button = document.querySelector("#gd-nominate button[type=submit]");
    button.scrollIntoView({ block: "end", inline: "nearest" });
    var rect = button.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var top = document.elementsFromPoint(x, y)[0];
    var toast = document.getElementById("app-update").getBoundingClientRect();
    return {
      x: x,
      y: y,
      topIsButton: top === button,
      topId: top ? top.id : "",
      topTag: top ? top.tagName : "",
      buttonBottom: rect.bottom,
      toastTop: toast.top,
      viewHeight: window.innerHeight
    };
  });
  if (!hit.topIsButton) throw new Error("nominate button covered: " + JSON.stringify(hit));
  expect(hit.toastTop).toBeGreaterThan(hit.viewHeight * 0.5);
  expect(hit.buttonBottom).toBeLessThanOrEqual(hit.toastTop + 1);

  await page.mouse.click(hit.x, hit.y);
  await expect.poll(function () { return posted && posted.op; }).toBe("nominate");
  expect(posted).toMatchObject({
    op: "nominate",
    name: "Riley",
    game: "Catan",
    startTime: "16:00",
    seats: 4,
    experience: "teach"
  });
  expect(await page.evaluate(function () { return window.__gdBoot; })).toBe("stay");
  expect(dialogs).toEqual([]);
  expect(live).toEqual([]);
  await expect(nominate).toBeVisible();
});
