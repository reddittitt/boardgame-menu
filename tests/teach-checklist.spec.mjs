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

test("teach steps tick, persist, and reset", async function ({ page }) {
  await page.goto("/game/7-wonders-duel/#/teach");
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  const ticks = page.locator("#teach-script .teach-tick");
  const total = await ticks.count();
  expect(total).toBeGreaterThan(1);
  await expect(page.locator("#teach-progress")).toHaveText("0/" + total + " taught");
  await ticks.nth(0).click();
  await ticks.nth(2).click();
  await expect(page.locator("#teach-progress")).toHaveText("2/" + total + " taught");
  await expect(ticks.nth(0)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("#teach-progress")).toHaveText("2/" + total + " taught");
  const stored = await page.evaluate(function () {
    return sessionStorage.getItem("bgq_teach_checks");
  });
  expect(stored).toContain("7-wonders-duel");
  await page.locator("#teach-reset").click();
  await expect(page.locator("#teach-progress")).toHaveText("0/" + total + " taught");
  await expect(page.locator("#teach-script .teach-tick[aria-pressed='true']")).toHaveCount(0);
});

test("phone screenshot of the teach checklist", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/game/7-wonders-duel/#/teach");
  const ticks = page.locator("#teach-script .teach-tick");
  await ticks.nth(0).click();
  const total = await ticks.count();
  await expect(page.locator("#teach-progress")).toHaveText("1/" + total + " taught");
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(".teach-page").screenshot({ path: dir + "/teach_checklist_phone.png" });
});
