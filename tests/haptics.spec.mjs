import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const TOKEN = {
  owner: "reddittitt",
  repo: "bgquick-storage",
  token: "bgq_test_token_not_a_real_secret_01"
};

async function blockLive(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function stubVibrate(page) {
  await page.addInitScript(function () {
    window.__vibes = [];
    navigator.vibrate = function (ms) {
      window.__vibes.push(ms);
      return true;
    };
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
  await stubVibrate(page);
  page._live = live;
});

test.afterEach(async function ({ page }) {
  expect(page._live || []).toEqual([]);
});

async function vibes(page) {
  return page.evaluate(function () { return window.__vibes.slice(); });
}

test("a pack, a swipe, and a first-player pick vibrate", async function ({ page }) {
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
  }, TOKEN);
  await page.goto("/#/");
  await page.getByLabel("Search games").fill("azul");
  await page.waitForTimeout(400);
  const row = page.locator('.catalog-swipe-row[data-pack-slug="azul"]');
  await row.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  const box = await row.boundingBox();
  const y = box.y + box.height / 2;
  const x = box.x + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 110, y, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("#bag-picker")).toBeVisible();
  expect(await vibes(page)).toEqual([10]);
  await page.locator("#bag-picker").getByRole("button", { name: "Small bag", exact: true }).click();
  expect(await vibes(page)).toEqual([10, 10]);

  await page.goto("/game/azul/");
  await page.locator("#first-player-open").click();
  const pad = page.locator("#first-player-pad");
  await pad.click({ position: { x: 40, y: 40 } });
  await pad.click({ position: { x: 120, y: 80 } });
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
  expect(await vibes(page)).toEqual([10]);
});

test("reduced motion skips the vibration", async function ({ page }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/azul/");
  await page.locator("#first-player-open").click();
  const pad = page.locator("#first-player-pad");
  await pad.click({ position: { x: 40, y: 40 } });
  await pad.click({ position: { x: 140, y: 70 } });
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
  expect(await vibes(page)).toEqual([]);
});
