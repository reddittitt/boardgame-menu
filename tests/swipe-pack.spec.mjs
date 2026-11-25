import { expect, test } from "@playwright/test";
import fs from "fs";

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

async function unlock(page) {
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
  }, TOKEN);
}

test("public visitors do not get swipe to pack", async function ({ page }) {
  await page.goto("/#/");
  await expect(page.locator(".catalog-swipe")).toHaveCount(0);
  await expect(page.locator("#bag-picker")).toHaveCount(0);
  await page.getByLabel("Search games").fill("azul");
  await expect(page.locator('a.card[href="/game/azul/"]')).toBeVisible();
});

test("a sideways swipe opens the bag picker and a vertical drag does not", async function ({ page }) {
  await unlock(page);
  await page.goto("/#/");
  await page.getByLabel("Search games").fill("azul");
  const row = page.locator('.catalog-swipe-row[data-pack-slug="azul"]');
  await expect(row).toBeVisible();
  await page.waitForTimeout(400);
  await row.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  const box = await row.boundingBox();
  const y = box.y + box.height / 2;
  const x = box.x + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y + 90, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#bag-picker")).toHaveCount(0);
  await expect(page.locator(".catalog-swipe.bag-game--swipe-commit")).toHaveCount(0);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y, { steps: 12 });
  const game = row.locator("xpath=..");
  await expect(game).toHaveClass(/bag-game--swipe-right/);
  await expect(game.locator(".bag-swipe-reveal--move")).toBeVisible();
  await expect(game.locator(".bag-swipe-label").first()).toHaveText("Pack");
  await page.mouse.up();
  const picker = page.locator("#bag-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: "Big bag", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Small bag", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Free carry", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Not packed", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Small bag", exact: true }).click();
  await expect(picker).toBeHidden();
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags") || "{}").games;
  });
  expect(stored.azul).toBe("small");
  await expect(page).toHaveURL(/#\//);
});

test("phone screenshot of a pack swipe", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await unlock(page);
  await page.goto("/#/");
  await page.getByLabel("Search games").fill("wingspan");
  const row = page.locator('.catalog-swipe-row[data-pack-slug="wingspan"]');
  await expect(row).toBeVisible();
  await page.waitForTimeout(400);
  await row.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  const box = await row.boundingBox();
  const y = box.y + box.height / 2;
  const x = box.x + 24;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y, { steps: 8 });
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: dir + "/swipe_pack_phone.png" });
  await page.mouse.up();
  await expect(page.locator("#bag-picker")).toBeVisible();
});
