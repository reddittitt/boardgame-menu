import { expect, test } from "@playwright/test";
import fs from "fs";

test.use({ serviceWorkers: "block" });

async function blockLive(page) {
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

test("a sourced game shows its first player line and rulebook chip", async function ({ page }) {
  await page.goto("/game/azul/");
  const line = page.locator("#first-player-rule");
  await expect(line).toBeVisible();
  await expect(line).toContainText("First player");
  await expect(line).toContainText("most recently visited Portugal");
  const chip = line.locator("a.rulebook-ref");
  await expect(chip).toHaveText("Rulebook");
  await expect(chip).toHaveAttribute("data-page", "2");
  const query = await chip.getAttribute("data-query");
  expect(String(query).toLowerCase()).toContain("portugal");
  const href = await chip.getAttribute("href");
  expect(href).toContain("#page=2");
});

test("a game with no sourced rule shows nothing", async function ({ page }) {
  await page.goto("/game/patchwork/");
  await expect(page.locator("h2.title")).toHaveText("Patchwork");
  await expect(page.locator("#first-player-rule")).toHaveCount(0);
  await expect(page.locator("#first-player-slot")).toBeEmpty();
});

test("phone screenshot of a first player line", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/game/wingspan/");
  const line = page.locator("#first-player-rule");
  await expect(line).toContainText("Randomly select the first player");
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(".detail-head").screenshot({ path: dir + "/first_player_rule_phone.png" });
});
