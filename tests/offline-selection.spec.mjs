import { expect, test } from "@playwright/test";
import fs from "fs";

test("selection still works after an offline reload", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" && testInfo.project.name !== "phone", "offline pass");
  await page.goto("/game/root/?players=4");
  await expect(page.locator("h2.title")).toHaveText("Root");
  await expect(page.locator("#offline-flag")).toBeHidden();
  await page.waitForFunction(function () {
    return navigator.serviceWorker && navigator.serviceWorker.controller;
  });
  await page.waitForFunction(async function () {
    const names = await caches.keys();
    const shell = names.find(function (name) { return name.indexOf("bgquick-shell-") === 0; });
    if (!shell) return false;
    const cache = await caches.open(shell);
    const urls = (await cache.keys()).map(function (req) { return req.url; });
    return urls.some(function (url) { return url.endsWith("/selection.mjs"); })
      && urls.some(function (url) { return url.endsWith("/components.json"); })
      && urls.some(function (url) { return url.endsWith("/expansion-guides.json"); })
      && urls.some(function (url) { return url.endsWith("/index.html"); });
  });
  await page.waitForFunction(async function () {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const urls = (await cache.keys()).map(function (req) { return req.url; });
      if (urls.some(function (url) { return /\/game\/(?!root(?:\/|$))[^/]+\/?$/.test(new URL(url).pathname); })) return true;
    }
    return false;
  }, null, { timeout: 30000 });
  await page.waitForSelector("#put-it-away");

  await context.setOffline(true);
  await expect(page.locator("#offline-flag")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("h2.title")).toHaveText("Root");
  await expect(page.locator("#offline-flag")).toBeVisible();
  await expect(page.locator("#offline-flag")).toHaveText("Offline");
  await page.waitForSelector("#put-it-away");

  const putAway = page.locator("#put-it-away");
  await expect(putAway.locator(".showing-for-text")).toContainText("4 players");
  await expect(putAway).not.toContainText("Riverfolk Expansion");
  await page.locator("#exp-controls .exp-chip", { hasText: "Riverfolk Expansion" }).click();
  await expect(page).toHaveURL(/exps=Riverfolk/);
  await expect(putAway).toContainText("Riverfolk Expansion");
  await expect(putAway.locator(".showing-for-text")).toContainText("Riverfolk");
  await page.locator('.pc-btn[data-count="2"]').first().click();
  await expect(putAway.locator(".showing-for-text")).toContainText("2 players");

  const offlineFiles = await page.evaluate(async function () {
    async function one(path, needle) {
      const res = await fetch(path);
      const text = await res.text();
      return { status: res.status, hit: text.indexOf(needle) !== -1, bytes: text.length };
    }
    return {
      selection: await one("./selection.mjs", "function matchesSelection"),
      components: await one("./components.json", "\"root\""),
      guide: await one("./expansion-guides.json", "{")
    };
  });
  expect(offlineFiles.selection).toMatchObject({ status: 200, hit: true });
  expect(offlineFiles.components.status).toBe(200);
  expect(offlineFiles.components.bytes).toBeGreaterThan(1000);
  expect(offlineFiles.guide.status).toBe(200);
  expect(offlineFiles.guide.bytes).toBeGreaterThan(1000);

  const cross = await page.evaluate(async function () {
    try {
      await fetch("https://example.com/bgquick-probe");
      return false;
    } catch (err) {
      return true;
    }
  });
  expect(cross).toBe(true);

  const pdfs = await page.evaluate(async function () {
    const names = await caches.keys();
    const found = [];
    for (const name of names) {
      const cache = await caches.open(name);
      const urls = (await cache.keys()).map(function (req) { return req.url; });
      urls.forEach(function (url) {
        if (/\.pdf($|\?)/i.test(url) || url.indexOf("example.com") !== -1) found.push(url);
      });
    }
    return found;
  });
  expect(pdfs).toEqual([]);

  const detailText = await page.locator("article.detail").innerText();
  ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"].forEach(function (name) {
    expect(detailText).not.toContain(name);
  });

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/offline-selection-phone.png" });
  }
});
