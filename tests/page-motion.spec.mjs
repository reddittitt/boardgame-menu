import { expect, test } from "@playwright/test";

async function blockLiveWrites(page) {
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

test.beforeEach(async function ({ page }) {
  const live = [];
  page.on("request", function (req) {
    if (/script\.google(usercontent)?\.com/i.test(req.url()) || /\/exec(?:\?|$)/.test(req.url())) live.push(req.method() + " " + req.url());
  });
  await blockLiveWrites(page);
  await page.addInitScript(function () {
    window.__motions = [];
    function note() {
      var app = document.getElementById("app");
      if (!app) return;
      var motion = app.getAttribute("data-page-motion");
      var animated = app.querySelector(".detail, .search-bar, .grid");
      if (motion && animated) window.__motions.push("arrive:" + getComputedStyle(animated).animationName);
      var leaving = document.querySelector(".detail.is-leaving");
      if (leaving) window.__motions.push("leave:" + getComputedStyle(leaving).animationName);
    }
    var obs = new MutationObserver(note);
    document.addEventListener("DOMContentLoaded", function () {
      obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-page-motion", "class"] });
    });
  });
  page._livePosts = live;
});

test.afterEach(async function ({ page }) {
  expect(page._livePosts || []).toEqual([]);
});

test("a game slides in from the catalog and back out", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await page.locator('a.card[href="/game/azul/"]').click();
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page.locator("html")).toHaveAttribute("data-page-arrived", "in");
  const motions = await page.evaluate(function () { return window.__motions || []; });
  expect(motions.join(" ")).toContain("bgqSlideIn");

  await page.locator("a.back-link").first().click();
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-page-arrived", "back");
  const after = await page.evaluate(function () { return (window.__motions || []).join(" "); });
  expect(after).toContain("bgqSlideOut");
  expect(after).toContain("bgqSlideBack");
});

test("buttons scale while pressed", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  const button = page.locator("#themeToggle");
  await button.hover();
  await page.mouse.down();
  const pressed = await button.evaluate(function (el) { return getComputedStyle(el).transform; });
  await page.mouse.up();
  expect(pressed).not.toBe("none");
  expect(pressed).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
});

test("reduced motion keeps the page change and skips the slide", async function ({ page }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('a.card[href="/game/azul/"]').click();
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page.locator("html")).toHaveAttribute("data-page-arrived", "in");
  const anim = await page.locator("#app .detail").evaluate(function (el) {
    return getComputedStyle(el).animationName;
  });
  expect(anim).toBe("none");
  const button = page.locator("#themeToggle");
  await button.hover();
  await page.mouse.down();
  const pressed = await button.evaluate(function (el) { return getComputedStyle(el).transform; });
  await page.mouse.up();
  expect(pressed === "none" || pressed === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

  await page.locator("a.back-link").first().click();
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-page-arrived", "back");
  const backAnim = await page.locator("#search").evaluate(function (el) {
    return getComputedStyle(el).animationName;
  });
  expect(backAnim).toBe("none");
});
