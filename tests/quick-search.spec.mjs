import { expect, test } from "@playwright/test";
import fs from "fs";

test.use({ serviceWorkers: "block" });

async function blockLive(page) {
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function scrollPastActions(page) {
  await page.evaluate(async function () {
    var links = document.querySelector(".essential-links");
    var header = document.querySelector("header");
    var i;
    for (i = 0; i < 24; i++) {
      var line = header ? header.getBoundingClientRect().bottom : 0;
      if (links.getBoundingClientRect().bottom <= line + 1) return;
      window.scrollBy(0, 180);
      await new Promise(function (resolve) { requestAnimationFrame(resolve); });
    }
  });
}

test.beforeEach(async function ({ page }) {
  const live = [];
  page.on("request", function (req) {
    const url = req.url();
    if (/script\.google(usercontent)?\.com/i.test(url) || /\/exec(?:\?|$)/.test(url)) {
      live.push(req.method() + " " + url);
    }
  });
  await blockLive(page);
  page._live = live;
});

test.afterEach(async function ({ page }) {
  expect(page._live || []).toEqual([]);
});

test("the home header jumps to a game by name", async function ({ page }) {
  await page.goto("/#/");
  await page.locator("header #quick-search-open").click();
  const dialog = page.locator("#quick-search");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Type a game name").fill("azul");
  const azul = dialog.getByRole("option", { name: "Azul", exact: true });
  await expect(azul).toBeVisible();
  await expect(dialog.getByRole("option", { name: "Azul Duel", exact: true })).toBeVisible();
  await azul.click();
  await expect(page).toHaveURL(/\/game\/azul\/$/);
  await expect(page.locator("h2.title")).toHaveText("Azul");
});

test("the sticky mini header searches too", async function ({ page }) {
  await page.goto("/game/wingspan/");
  await expect(page.locator("#mini-bar")).toBeHidden();
  await scrollPastActions(page);
  const bar = page.locator("#mini-bar");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Jump to a game" }).click();
  const dialog = page.locator("#quick-search");
  await dialog.getByLabel("Type a game name").fill("patch");
  await dialog.getByRole("option", { name: "Patchwork", exact: true }).click();
  await expect(page.locator("h2.title")).toHaveText("Patchwork");
});

test("arrow keys move through the typeahead", async function ({ page }) {
  await page.goto("/#/");
  await page.locator("header #quick-search-open").click();
  const input = page.locator("#quick-search-input");
  await input.fill("catan");
  await input.press("ArrowDown");
  await expect(page.locator("#quick-search-results a[aria-selected='true']")).toHaveCount(1);
  await input.press("Enter");
  await expect(page.locator("h2.title")).toContainText("Catan");
});

test("phone screenshot of quick search", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/#/");
  await page.locator("header #quick-search-open").click();
  await page.locator("#quick-search-input").fill("wing");
  await expect(page.locator("#quick-search-results a").first()).toBeVisible();
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator("#quick-search").screenshot({ path: dir + "/quick_search_phone.png" });
});
