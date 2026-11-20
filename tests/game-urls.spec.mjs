import { expect, test } from "@playwright/test";

async function bootGame(page) {
  await expect(page.locator("#games-json")).toHaveCount(1);
  await expect(page.locator("h2.title")).toBeVisible();
}

test("old ?game= links still open the game", async ({ page }) => {
  await page.goto("/?game=Root");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Root");
  const rootUrl = new URL(page.url());
  expect(rootUrl.search).toBe("");
  expect(rootUrl.hash).toBe("#/game/root?action=quicksetup");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bgquick.com/game/root/");

  await page.goto("/?game=Brass%3A%20Birmingham");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Brass: Birmingham");
  const brass = new URL(page.url());
  expect(brass.search).toBe("");
  expect(brass.hash).toBe("#/game/brass-birmingham?action=quicksetup");

  await page.goto("/index.html?game=Azul&players=3");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Azul");
  const azul = new URL(page.url());
  expect(azul.pathname).toMatch(/\/index\.html$/);
  expect(azul.search).toBe("");
  expect(azul.hash).toBe("#/game/azul?action=quicksetup&players=3");
  await expect(page.locator("#pc-text")).toContainText("7 factory");
});

test("clean /game/<slug>/ links open the game and share that URL", async ({ page }) => {
  await page.goto("/game/root/");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Root");
  const loaded = new URL(page.url());
  expect(loaded.pathname).toBe("/game/root/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bgquick.com/game/root/");
  await expect(page).toHaveTitle("Root · Board Game Quick");

  const copied = await page.evaluate(async () => {
    let value = "";
    window.alert = function () {};
    window.prompt = function (_label, text) { value = text || value; return text; };
    const share = function (data) { value = data && data.url || value; return Promise.resolve(); };
    try { Object.defineProperty(navigator, "share", { configurable: true, value: share }); }
    catch (err) { try { navigator.share = share; } catch (e2) {} }
    if (!navigator.clipboard) navigator.clipboard = {};
    navigator.clipboard.writeText = function (text) { value = text; return Promise.resolve(); };
    document.getElementById("share").click();
    await new Promise(function (resolve) { setTimeout(resolve, 30); });
    return value;
  });
  expect(copied).toBe(loaded.origin + "/game/root/");

  await page.goto("/#/");
  await page.locator('#game-grid a[href="/game/azul/"]').click();
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page).toHaveURL(/\/game\/azul\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bgquick.com/game/azul/");

  await page.locator("#teach-link").click();
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  await expect(page).toHaveURL(/\/game\/azul\/#\/teach/);
  await page.locator("a.back-link").click();
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page).toHaveURL(/\/game\/azul\/$/);
});

test("phone deep links open a game from a clean URL and from ?game=", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone project");
  await page.goto("/game/root/");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Root");
  const box = await page.locator("h2.title").boundingBox();
  expect(box).toBeTruthy();
  expect(box.y).toBeGreaterThan(0);
  expect(box.y).toBeLessThan(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bgquick.com/game/root/");

  await page.goto("/?game=Heat%20Pedal%20to%20the%20Metal");
  await bootGame(page);
  await expect(page.locator("h2.title")).toHaveText("Heat: Pedal to the Metal");
  const heat = new URL(page.url());
  expect(heat.search).toBe("");
  expect(heat.hash).toBe("#/game/heat-pedal-to-the-metal?action=quicksetup");
  const phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(phoneOverflow).toBeLessThanOrEqual(1);
});
