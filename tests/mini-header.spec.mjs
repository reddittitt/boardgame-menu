import { expect, test } from "@playwright/test";

async function blockLiveWrites(page) {
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
    if (/script\.google(usercontent)?\.com/i.test(req.url()) || /\/exec(?:\?|$)/.test(req.url())) live.push(req.method() + " " + req.url());
  });
  await blockLiveWrites(page);
  page._livePosts = live;
});

test.afterEach(async function ({ page }) {
  expect(page._livePosts || []).toEqual([]);
});

test("the mini header appears after the action row and opens Teach it", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page.locator("#mini-bar")).toBeHidden();
  await scrollPastActions(page);
  const bar = page.locator("#mini-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".mini-bar-name")).toHaveText("Azul");
  await expect(bar.getByRole("link", { name: "Rulebook", exact: true })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Teach it", exact: true })).toBeVisible();
  await expect(bar).not.toContainText("Pack");
  await expect(bar).not.toContainText("Bags");

  const top = await bar.evaluate(function (el) {
    var header = document.querySelector("header");
    return {
      bar: Math.round(el.getBoundingClientRect().top),
      headerBottom: Math.round(header.getBoundingClientRect().bottom)
    };
  });
  expect(Math.abs(top.bar - top.headerBottom)).toBeLessThanOrEqual(2);

  await page.evaluate(function () {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("scroll"));
  });
  await expect(bar).toBeHidden();

  await scrollPastActions(page);
  await expect(bar).toBeVisible();
  await bar.getByRole("link", { name: "Teach it", exact: true }).click();
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  await expect(page.locator("#mini-bar")).toHaveCount(0);
});
