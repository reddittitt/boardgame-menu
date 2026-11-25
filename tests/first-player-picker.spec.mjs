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
  await page.addInitScript(function () {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = function (array) {
      window.__bgqRandomCalls = (window.__bgqRandomCalls || 0) + 1;
      return orig(array);
    };
  });
  await blockLive(page);
  page._live = live;
});

test.afterEach(async function ({ page }) {
  expect(page._live || []).toEqual([]);
});

async function placeTaps(page) {
  const pad = page.locator("#first-player-pad");
  await pad.click({ position: { x: 48, y: 48 } });
  await pad.click({ position: { x: 140, y: 90 } });
  await pad.click({ position: { x: 220, y: 70 } });
  await expect(page.locator(".fp-finger")).toHaveCount(3);
}

test("desktop taps pick one player at random", async function ({ page }) {
  await page.goto("/#/");
  await page.locator("#play-tonight-open").click();
  await page.locator("#play-tonight-pick").click();
  await expect(page.locator("#first-player-picker")).toBeVisible();
  await expect(page.locator("#first-player-alt")).toBeHidden();
  await placeTaps(page);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  const calls = await page.evaluate(function () { return window.__bgqRandomCalls || 0; });
  expect(calls).toBeGreaterThan(0);
});

test("the game page offers the rule as an alternative", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(page.locator("#first-player-rule")).toContainText("Portugal");
  await page.locator("#first-player-open").click();
  await expect(page.locator("#first-player-alt")).toContainText("Or use the game's rule:");
  await expect(page.locator("#first-player-alt")).toContainText("Portugal");
  await placeTaps(page);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
});

test("several fingers on the screen can be the pick", async function ({ page }) {
  await page.goto("/game/wingspan/");
  await page.locator("#first-player-open").click();
  await page.locator("#first-player-pad").evaluate(function (pad) {
    function fire(type, id, x, y) {
      var box = pad.getBoundingClientRect();
      pad.dispatchEvent(new PointerEvent(type, {
        pointerId: id,
        clientX: box.left + x,
        clientY: box.top + y,
        pointerType: "touch",
        bubbles: true
      }));
    }
    fire("pointerdown", 4, 50, 60);
    fire("pointerdown", 5, 150, 100);
    fire("pointerdown", 6, 230, 80);
  });
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
});

test("phone screenshot of the first player picker", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/game/azul/");
  await expect(page.locator("#first-player-rule")).toBeVisible();
  await page.locator("#first-player-open").click();
  await placeTaps(page);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toBeVisible();
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator("#first-player-picker").screenshot({ path: dir + "/first_player_picker_phone.png" });
});
