import { expect, test } from "@playwright/test";

const TOKEN = {
  owner: "reddittitt",
  repo: "bgquick-storage",
  token: "bgq_test_token_not_a_real_secret_01"
};

async function blockLiveWrites(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function unlock(page) {
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
  }, TOKEN);
}

async function addGame(page, query, name) {
  await page.getByLabel("Add a game", { exact: true }).fill(query);
  await page.getByRole("button", { name: "Add " + name, exact: true }).click();
}

test.beforeEach(async function ({ page }) {
  const live = [];
  page.on("request", function (req) {
    const url = req.url();
    if (/script\.google(usercontent)?\.com/i.test(url)) live.push(req.method() + " " + url);
    if (req.method() === "POST" && /\/exec(?:\?|$)/.test(url)) live.push(req.method() + " " + url);
  });
  await blockLiveWrites(page);
  page._livePosts = live;
});

test.afterEach(async function ({ page }) {
  expect(page._livePosts || []).toEqual([]);
});

test("public visitors do not see pack for game night", async function ({ page }) {
  await page.goto("/#/night");
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  await addGame(page, "azul", "Azul");
  await expect(page.locator("#gn-pack")).toHaveCount(0);
  await expect(page.locator("#pack-night")).toHaveCount(0);
  await expect(page.locator("#gn-page")).not.toContainText("Pack for game night");
  await expect(page.locator("#gn-page")).not.toContainText("Big bag");
  await expect(page.locator("#gn-page")).not.toContainText("Free carry");
});

test("packing tonight's games sets the bag and saves same-origin pages", async function ({ page }) {
  await unlock(page);
  await page.goto("/#/night");
  await expect(page.locator("#gn-pack")).toBeHidden();
  await addGame(page, "azul", "Azul");
  await addGame(page, "wingspan", "Wingspan");
  await expect(page.locator("#gn-pack")).toBeVisible();
  await page.locator("#gn-pack").click();
  const sheet = page.locator("#pack-night");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-pack-game="azul"] .pack-night-where')).toHaveText("Not packed");
  await expect(sheet.locator('[data-pack-game="wingspan"] .pack-night-where')).toHaveText("Not packed");

  await sheet.locator('[data-pack-game="azul"]').getByRole("button", { name: "Big bag", exact: true }).click();
  await sheet.locator('[data-pack-game="wingspan"]').getByRole("button", { name: "Free carry", exact: true }).click();
  await expect(sheet.locator('[data-pack-game="azul"] .pack-night-where')).toHaveText("Big bag");
  await expect(sheet.locator('[data-pack-game="wingspan"] .pack-night-where')).toHaveText("Free carry");
  await expect(sheet.locator('[data-pack-game="azul"] button[data-pack-bag="big"]')).toHaveAttribute("aria-pressed", "true");

  const games = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(games.azul).toBe("big");
  expect(games.wingspan).toBe("free");

  await expect.poll(async function () {
    return page.evaluate(async function () {
      var names = await caches.keys();
      var urls = [];
      for (var i = 0; i < names.length; i++) {
        var cache = await caches.open(names[i]);
        var keys = await cache.keys();
        keys.forEach(function (req) { urls.push(req.url); });
      }
      var origin = location.origin;
      return {
        azul: urls.some(function (url) { return url.indexOf("/game/azul/") !== -1; }),
        wingspan: urls.some(function (url) { return url.indexOf("/game/wingspan/") !== -1; }),
        foreign: urls.filter(function (url) { return url.indexOf(origin) !== 0; }),
        pdfs: urls.filter(function (url) { return /\.pdf($|\?)/i.test(url); })
      };
    });
  }, { timeout: 20000 }).toEqual({ azul: true, wingspan: true, foreign: [], pdfs: [] });

  await sheet.locator('[data-pack-game="wingspan"]').getByRole("button", { name: "Not packed", exact: true }).click();
  await expect(sheet.locator('[data-pack-game="wingspan"] .pack-night-where')).toHaveText("Not packed");
  const after = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(after.wingspan).toBeUndefined();
  expect(after.azul).toBe("big");

  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet).toHaveCount(0);

  const sw = await page.evaluate(async function () {
    var res = await fetch("./sw.js");
    return res.text();
  });
  const fetchAt = sw.indexOf('addEventListener("fetch"');
  const originAt = sw.indexOf("url.origin !== self.location.origin", fetchAt);
  const respondAt = sw.indexOf("respondWith", fetchAt);
  expect(fetchAt).toBeGreaterThan(0);
  expect(originAt).toBeGreaterThan(fetchAt);
  expect(respondAt).toBeGreaterThan(originAt);
});
