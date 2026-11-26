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

async function slugsOf(page, selector) {
  return page.locator(selector).evaluateAll(function (els) {
    return els.map(function (el) { return el.getAttribute("data-slug"); });
  });
}

async function openTonight(page) {
  await page.locator("#play-tonight-open").click();
  await expect(page.locator("#play-tonight-dialog")).toBeVisible();
  return page.locator("#play-tonight");
}

test("home suggests about five games and each opens its page", async function ({ page }) {
  await page.goto("/#/");
  const tonight = await openTonight(page);
  await expect(tonight.getByRole("heading", { name: "What should we play?" })).toBeVisible();
  await expect(page.locator("#play-tonight-note")).toHaveText("Pick a player count and a time.");
  await expect(page.locator("#play-tonight-list a")).toHaveCount(0);

  await tonight.getByRole("button", { name: "Tonight, 2 players", exact: true }).click();
  await expect(page.locator("#play-tonight-list a")).toHaveCount(0);
  await tonight.getByRole("button", { name: "Tonight, under 30 minutes", exact: true }).click();
  await expect(page.locator("#play-tonight-list a")).toHaveCount(5);

  const slugs = await slugsOf(page, "#play-tonight-list a");
  const fitting = await page.evaluate(function (list) {
    return list.every(function (slug) { return window.BGQuickPlayTonight.fits(slug); });
  }, slugs);
  expect(fitting).toBe(true);
  const hrefs = await page.locator("#play-tonight-list a").evaluateAll(function (els) {
    return els.map(function (el) { return el.getAttribute("href"); });
  });
  hrefs.forEach(function (href, index) {
    expect(href).toBe("/game/" + slugs[index] + "/");
  });

  await tonight.getByRole("button", { name: "Tonight, light weight", exact: true }).click();
  await expect(page.locator("#play-tonight-list a")).toHaveCount(5);
  const light = await slugsOf(page, "#play-tonight-list a");
  expect(await page.evaluate(function (list) {
    return list.every(function (slug) { return window.BGQuickPlayTonight.fits(slug); });
  }, light)).toBe(true);

  await tonight.getByRole("button", { name: /Tonight, Cody.s games/ }).click();
  const owned = await slugsOf(page, "#play-tonight-list a");
  expect(owned.length).toBeGreaterThan(0);
  expect(owned.length).toBeLessThanOrEqual(5);
  expect(await page.evaluate(function (list) {
    return list.every(function (slug) { return window.BGQuickPlayTonight.fits(slug); });
  }, owned)).toBe(true);

  const before = owned.join(",");
  let changed = false;
  for (let i = 0; i < 3; i += 1) {
    await page.locator("#play-tonight-shuffle").click();
    const after = (await slugsOf(page, "#play-tonight-list a")).join(",");
    expect(await page.locator("#play-tonight-list a").count()).toBeGreaterThan(0);
    if (after !== before) { changed = true; break; }
  }
  expect(changed).toBe(true);

  const link = page.locator("#play-tonight-list a").first();
  const name = await link.locator(".play-tonight-name").innerText();
  await link.click();
  await expect(page.locator("h2.title")).toHaveText(name);
});

test("game night uses the same five-game shuffle", async function ({ page }) {
  await page.goto("/#/night");
  await expect(page.locator("#gn-picks-note")).toHaveText("Pick a player count and a time.");
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await expect(page.locator("#gn-picks-list a")).toHaveCount(5);
  const slugs = await slugsOf(page, "#gn-picks-list a");
  expect(await page.evaluate(function (list) {
    return list.every(function (slug) { return window.BGQuickNight.fitsGame(slug); });
  }, slugs)).toBe(true);

  const before = slugs.join(",");
  let changed = false;
  for (let i = 0; i < 3; i += 1) {
    await page.locator("#gn-shuffle").click();
    const after = (await slugsOf(page, "#gn-picks-list a")).join(",");
    if (after !== before) { changed = true; break; }
  }
  expect(changed).toBe(true);

  await page.getByRole("button", { name: "Weight from Light", exact: true }).click();
  await page.getByRole("button", { name: "Weight up to Light", exact: true }).click();
  await page.getByRole("button", { name: /Cody.s games/ }).click();
  const narrowed = await slugsOf(page, "#gn-picks-list a");
  expect(narrowed.length).toBeGreaterThan(0);
  expect(narrowed.length).toBeLessThanOrEqual(5);
  expect(await page.evaluate(function (list) {
    return list.every(function (slug) { return window.BGQuickNight.fitsGame(slug); });
  }, narrowed)).toBe(true);

  const link = page.locator("#gn-picks-list a").first();
  const name = await link.locator(".gn-name").innerText();
  await link.click();
  await expect(page.locator("h2.title")).toHaveText(name);
});

test("packed games lead the list only after unlock", async function ({ page }) {
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({
      games: { patchwork: "big", kingdomino: "small", gloomhaven: "free" }
    }));
  });
  await page.goto("/#/");
  const tonight = await openTonight(page);
  await tonight.getByRole("button", { name: "Tonight, 2 players", exact: true }).click();
  await tonight.getByRole("button", { name: "Tonight, under 30 minutes", exact: true }).click();
  await expect(page.locator("#play-tonight-list .play-tonight-packed")).toHaveCount(0);
  await expect(page.locator("#play-tonight")).not.toContainText("Big bag");

  await page.evaluate(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
  }, TOKEN);
  await page.reload();
  await expect(page.locator("header a.header-bags")).toBeVisible();
  await openTonight(page);
  const homeFlags = await page.locator("#play-tonight-list li").evaluateAll(function (els) {
    return els.map(function (el) { return !!el.querySelector(".play-tonight-packed"); });
  });
  const homeSplit = homeFlags.indexOf(false);
  expect(homeFlags.filter(Boolean).length).toBeGreaterThan(0);
  expect(homeSplit).toBe(homeFlags.filter(Boolean).length);
  const homeSlugs = await slugsOf(page, "#play-tonight-list a");
  expect(homeSlugs.slice(0, homeSplit).sort()).toEqual(["kingdomino", "patchwork"]);
  expect(homeSlugs).not.toContain("gloomhaven");

  await page.goto("/#/night?players=2&time=under30");
  await expect(page.locator("#gn-picks-list a")).toHaveCount(5);
  const nightFlags = await page.locator("#gn-picks-list li").evaluateAll(function (els) {
    return els.map(function (el) { return !!el.querySelector(".gn-packed"); });
  });
  const nightSplit = nightFlags.indexOf(false);
  expect(nightSplit).toBe(nightFlags.filter(Boolean).length);
  const nightSlugs = await slugsOf(page, "#gn-picks-list a");
  expect(nightSlugs.slice(0, nightSplit).sort()).toEqual(["kingdomino", "patchwork"]);
});

test("weight choices toggle independently and stay for the session", async function ({ page }) {
  await page.goto("/#/");
  const tonight = await openTonight(page);
  await tonight.getByRole("button", { name: "Tonight, 2 players", exact: true }).click();
  await tonight.getByRole("button", { name: "Tonight, under 30 minutes", exact: true }).click();
  const light = tonight.getByRole("button", { name: "Tonight, light weight", exact: true });
  const medium = tonight.getByRole("button", { name: "Tonight, medium weight", exact: true });
  const mid = tonight.getByRole("button", { name: "Tonight, medium-light weight", exact: true });
  await light.click();
  await medium.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect(medium).toHaveAttribute("aria-pressed", "true");
  await expect(mid).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(function () {
    return JSON.parse(sessionStorage.getItem("bgq_play_tonight")).weight;
  })).toEqual(["light", "medium"]);

  async function fits(slug) {
    return page.evaluate(function (name) {
      return window.BGQuickPlayTonight.fits(name);
    }, slug);
  }
  expect(await fits("codenames")).toBe(true);
  expect(await fits("turing-machine")).toBe(true);
  expect(await fits("hive-pocket")).toBe(false);

  const shown = await page.locator("#play-tonight-list .play-tonight-meta").allInnerTexts();
  expect(shown.length).toBeGreaterThan(0);
  shown.forEach(function (text) {
    expect(["Light", "Medium"]).toContain(text.split("·").pop().trim());
  });

  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "false");
  await expect(medium).toHaveAttribute("aria-pressed", "true");
  expect(await fits("codenames")).toBe(false);
  expect(await fits("turing-machine")).toBe(true);
  expect(await fits("hive-pocket")).toBe(false);

  await medium.click();
  await expect(medium).toHaveAttribute("aria-pressed", "false");
  expect(await fits("codenames")).toBe(true);
  expect(await fits("turing-machine")).toBe(true);
  expect(await fits("hive-pocket")).toBe(true);

  await light.click();
  await medium.click();
  await page.locator("#play-tonight-close").click();
  await page.reload();
  await openTonight(page);
  await expect(page.getByRole("button", { name: "Tonight, light weight", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Tonight, medium weight", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Tonight, 2 players", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Tonight, under 30 minutes", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await fits("hive-pocket")).toBe(false);
  expect(await fits("codenames")).toBe(true);
});

test("phone screenshots of what should we play", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/#/");
  const tonight = await openTonight(page);
  await tonight.getByRole("button", { name: "Tonight, 4 players", exact: true }).click();
  await tonight.getByRole("button", { name: "Tonight, 30 to 60 minutes", exact: true }).click();
  await expect(page.locator("#play-tonight-list a")).toHaveCount(5);
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator("#play-tonight-dialog").screenshot({ path: dir + "/play_tonight_home_phone.png" });
  await tonight.getByRole("button", { name: "Tonight, light weight", exact: true }).click();
  await tonight.getByRole("button", { name: "Tonight, medium weight", exact: true }).click();
  await expect(tonight.getByRole("button", { name: "Tonight, light weight", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(tonight.getByRole("button", { name: "Tonight, medium weight", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#play-tonight-list a").first()).toBeVisible();
  await page.locator("#play-tonight-dialog").screenshot({ path: dir + "/play_tonight_weights_phone.png" });
  await page.goto("/#/night?players=4&time=30-60");
  await expect(page.locator("#gn-picks-list a")).toHaveCount(5);
  await page.locator("#gn-picks").screenshot({ path: dir + "/play_tonight_night_phone.png" });
});
