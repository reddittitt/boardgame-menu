import { expect, test } from "@playwright/test";
import fs from "fs";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

const TOKEN = {
  owner: "reddittitt",
  repo: "bgquick-storage",
  token: "bgq_test_token_not_a_real_secret_01"
};

const ARTIFACTS = "/opt/cursor/artifacts";

async function blockLiveWrites(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function swipeRow(locator, direction) {
  await locator.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing row");
  const y = box.y + box.height / 2;
  const startX = box.x + Math.min(box.width * 0.45, box.width - 56);
  const delta = Math.max(96, Math.min(140, box.width * 0.5));
  const endX = direction === "left" ? startX - delta : Math.min(startX + delta, box.x + box.width - 8);
  const page = locator.page();
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "bag covers are checked at 390px");
  const live = [];
  page.on("request", function (req) {
    const url = req.url();
    if (/script\.google(usercontent)?\.com/i.test(url) || /\/exec(?:\?|$)/.test(url)) {
      live.push(req.method() + " " + url);
    }
  });
  page._livePosts = live;
  await blockLiveWrites(page);
});

test.afterEach(async function ({ page }) {
  expect(page._livePosts || []).toEqual([]);
});

test("without unlock there is no bags ui", async function ({ page }) {
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({
      games: { azul: "big", wingspan: "big", root: "big" }
    }));
  });
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bags", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pack in bag" })).toHaveCount(0);
  await expect(page.getByText("Pack in bag")).toHaveCount(0);
  await expect(page.locator(".bags-page, .bag-cover, .bag-game, #bag-picker, #pack-night, .bag-add-input")).toHaveCount(0);

  await page.goto("/#/bags");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("heading", { name: "Bags", exact: true })).toHaveCount(0);
  await expect(page.locator(".bag-cover, .bags-page")).toHaveCount(0);

  await page.goto("/#/game/azul");
  await expect(page.locator(".title")).toContainText("Azul");
  await expect(page.locator("#bag-pack")).toHaveCount(0);
  await expect(page.locator("#bag-picker")).toHaveCount(0);
  await expect(page.locator(".bag-cover")).toHaveCount(0);
});

test("bag lists show cover thumbnails at 390px", async function ({ page }) {
  test.setTimeout(90000);
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
    localStorage.setItem("bgqBags", JSON.stringify({
      games: {
        azul: "big",
        wingspan: "big",
        root: "big",
        "air-land-and-sea-critters-at-war": "big"
      }
    }));
  }, TOKEN);
  await page.route("**/covers/root.webp", function (route) { return route.abort(); });

  await page.goto("/?unlock");
  await expect(page.getByRole("heading", { name: "Private storage" })).toBeVisible();
  await expect(page.locator("header a.header-bags")).toBeVisible();
  await page.locator("header a.header-bags").click();
  await expect(page).toHaveURL(/#\/bags$/);
  await expect(page.locator("h2.title")).toHaveText("Bags");

  const big = page.locator(".bag-card--big");
  await expect(big.locator(".bag-game")).toHaveCount(4);
  await expect(big.locator(".bag-game-name")).toHaveText([
    "Air, Land & Sea: Critters at War",
    "Azul",
    "Root",
    "Wingspan"
  ]);
  await expect(page.locator('[data-bag-cover="root"]')).toHaveClass(/bag-cover--empty/);
  await expect.poll(async function () {
    return page.locator(".bag-card--big .bag-cover img").evaluateAll(function (imgs) {
      return imgs.length > 0 && imgs.every(function (img) { return img.complete && img.naturalWidth > 0; });
    });
  }).toBe(true);

  const covers = await page.locator(".bag-card--big .bag-cover").evaluateAll(function (els) {
    return els.map(function (el) {
      var rect = el.getBoundingClientRect();
      var img = el.querySelector("img");
      var row = el.closest(".bag-swipe");
      return {
        slug: el.getAttribute("data-bag-cover"),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        empty: el.classList.contains("bag-cover--empty"),
        letter: getComputedStyle(el, "::before").content,
        loading: img ? img.getAttribute("loading") : "",
        decoding: img ? img.getAttribute("decoding") : "",
        alt: img ? img.getAttribute("alt") : null,
        src: img ? img.getAttribute("src") : "",
        natural: img ? img.naturalWidth : 0,
        rowOverflow: row ? row.scrollWidth - row.clientWidth : 0
      };
    });
  });
  expect(covers.map(function (row) { return row.slug; })).toEqual([
    "air-land-and-sea-critters-at-war",
    "azul",
    "root",
    "wingspan"
  ]);
  const width = covers[0].w;
  const height = covers[0].h;
  expect(width).toBeGreaterThanOrEqual(40);
  expect(width).toBeLessThanOrEqual(48);
  expect(height).toBeGreaterThanOrEqual(40);
  expect(height).toBeLessThanOrEqual(48);
  covers.forEach(function (row) {
    expect(row.w).toBe(width);
    expect(row.h).toBe(height);
    expect(row.rowOverflow).toBeLessThanOrEqual(1);
  });
  const azul = covers.find(function (row) { return row.slug === "azul"; });
  const root = covers.find(function (row) { return row.slug === "root"; });
  const wingspan = covers.find(function (row) { return row.slug === "wingspan"; });
  expect(azul.empty).toBe(false);
  expect(azul.loading).toBe("lazy");
  expect(azul.decoding).toBe("async");
  expect(azul.alt).toBe("");
  expect(azul.src).toContain("/covers/azul.webp");
  expect(azul.natural).toBeGreaterThan(0);
  expect(wingspan.loading).toBe("lazy");
  expect(wingspan.decoding).toBe("async");
  expect(wingspan.alt).toBe("");
  expect(wingspan.src).toContain("/covers/wingspan.webp");
  expect(root.empty).toBe(true);
  expect(root.alt).toBe(null);
  expect(root.letter).toBe('"R"');

  const scroll = await page.evaluate(function () {
    return {
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      scrolling: document.scrollingElement ? document.scrollingElement.scrollWidth : 0
    };
  });
  expect(scroll.doc).toBeLessThanOrEqual(390);
  expect(scroll.body).toBeLessThanOrEqual(390);
  expect(scroll.scrolling).toBeLessThanOrEqual(390);

  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: ARTIFACTS + "/bag-covers-phone.png", fullPage: true });

  const pack = page.locator("#bag-pack");
  await expect(pack).toHaveCount(0);
  await big.locator(".bag-game-link").nth(1).click();
  await expect(page).toHaveURL(/\/game\/azul\/?$/);
  await expect(page.locator("#bag-pack")).toBeVisible();
  await page.locator("#bag-pack").click();
  const picker = page.locator("#bag-picker");
  await expect(picker).toBeVisible();
  await expect(picker.locator(".bag-cover, .bag-game")).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Big bag", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Big bag", exact: true }).click();
  await expect(picker).toBeHidden();

  await page.locator("header a.header-bags").click();
  await expect(page.locator("h2.title")).toHaveText("Bags");
  await page.getByRole("button", { name: "Actions for Wingspan" }).click();
  const sheet = page.locator("#bag-move-sheet");
  await expect(sheet).toBeVisible();
  const move = sheet.getByRole("button", { name: "Small bag", exact: true });
  const moveBox = await move.boundingBox();
  expect(moveBox.height).toBeGreaterThanOrEqual(44);
  await move.click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator(".bag-card--small .bag-game-name")).toHaveText("Wingspan");
  await expect(page.locator('.bag-card--small [data-bag-cover="wingspan"] img')).toHaveAttribute("loading", "lazy");

  const rootRow = page.locator('.bag-card--big .bag-swipe[data-bag-slug="root"]');
  await expect(rootRow).toBeVisible();
  await swipeRow(rootRow, "left");
  await expect(page.locator("#bag-toast")).toContainText("Removed");
  await expect(page.locator('.bag-swipe[data-bag-slug="root"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator('.bag-card--big [data-bag-cover="root"]')).toHaveClass(/bag-cover--empty/);

  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags") || "{}");
  });
  expect(stored.games.azul).toBe("big");
  expect(stored.games.wingspan).toBe("small");
  expect(stored.games.root).toBe("big");
  expect(stored.games["air-land-and-sea-critters-at-war"]).toBe("big");
  expect(stored.covers).toBeUndefined();
  Object.keys(stored.games).forEach(function (slug) {
    expect(typeof stored.games[slug]).toBe("string");
  });

  await page.goto("/#/night");
  await page.getByLabel("Add a game", { exact: true }).fill("azul");
  await page.getByRole("button", { name: "Add Azul", exact: true }).click();
  await page.getByLabel("Add a game", { exact: true }).fill("wingspan");
  await page.getByRole("button", { name: "Add Wingspan", exact: true }).click();
  await page.locator("#gn-pack").click();
  const night = page.locator("#pack-night");
  await expect(night).toBeVisible();
  await expect(night.locator('[data-pack-game="azul"] .bag-cover img')).toHaveAttribute("loading", "lazy");
  await expect(night.locator('[data-pack-game="wingspan"] .bag-cover img')).toHaveAttribute("src", /wingspan\.webp/);
  await expect(night.locator('[data-pack-game="azul"] h3')).toHaveText("Azul");
  const nightCovers = await night.locator(".bag-cover").evaluateAll(function (els) {
    return els.map(function (el) {
      var rect = el.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    });
  });
  expect(nightCovers.length).toBeGreaterThanOrEqual(2);
  nightCovers.forEach(function (box) {
    expect(box.w).toBe(width);
    expect(box.h).toBe(height);
  });
  const nightScroll = await page.evaluate(function () {
    return document.documentElement.scrollWidth;
  });
  expect(nightScroll).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ARTIFACTS + "/bag-covers-pack-picker.png" });
});
