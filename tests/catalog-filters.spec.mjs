import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

async function waitForList(page) {
  await page.waitForFunction(() => {
    const count = document.getElementById("search-count");
    const grid = document.getElementById("game-grid");
    if (!count || !grid) return false;
    const match = (count.textContent || "").match(/^(\d+)/);
    if (!match) return false;
    const shown = Number(match[1]);
    const cards = grid.querySelectorAll("a.card").length;
    const empty = grid.querySelector(".empty-note");
    return empty ? shown === 0 : cards === shown;
  });
}

async function openFilters(page) {
  const toggle = page.locator("#filter-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.locator("#catalog-filter-panel")).toBeVisible();
}

function card(page, slug) {
  return page.locator('a.card[href="/game/' + slug + '/"]');
}

test.beforeEach(async ({ page }) => {
  await page.goto("/#/");
  await waitForList(page);
});

test("player, time, and weight chips filter the list and combine with search", async ({ page }) => {
  await expect(page.locator("#search-count")).toHaveText("780 games");
  await expect(page.locator("#catalog-filter-panel")).toBeHidden();
  const searchSize = await page.locator("#search").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(searchSize).toBeGreaterThanOrEqual(16);

  await openFilters(page);
  const chipSize = await page.locator('.filter-chip[data-value="2"]').evaluate((el) => {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(chipSize).toBeGreaterThanOrEqual(16);

  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toContainText("of 780");
  await expect(card(page, "patchwork")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "flip-7")).toHaveCount(0);
  await expect(page.locator("#filter-summary")).toHaveText("2 players");
  await expect(page).toHaveURL(/players=2/);

  const selected = page.locator('.filter-chip[data-facet="players"][data-value="2"]');
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const paint = await selected.evaluate((el) => {
    const before = getComputedStyle(el, "::before");
    return {
      text: el.textContent,
      color: getComputedStyle(el).color,
      background: before.backgroundColor,
      content: before.content,
    };
  });
  expect(paint.text).toBe("2");
  expect(paint.color).toBe("rgb(255, 255, 255)");
  expect(paint.background).toContain("0, 122, 255");
  expect(paint.content).not.toMatch(/✓|✔|check/i);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await waitForList(page);
  await expect(selected).toHaveAttribute("aria-pressed", "false");
  await expect(card(page, "patchwork")).toHaveCount(0);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "7-wonders")).toHaveCount(1);

  await page.getByRole("button", { name: "Best at this player count", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#filter-summary")).toHaveText("Best at 4");
  await expect(card(page, "7-wonders")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await page.getByRole("button", { name: "7 or more players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "codenames")).toHaveCount(1);
  await expect(card(page, "flip-7")).toHaveCount(0);
  await expect(card(page, "cascadia")).toHaveCount(0);

  await page.getByRole("button", { name: "Best at this player count", exact: true }).click();
  await page.getByRole("button", { name: "7 or more players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "codenames")).toHaveCount(1);
  await expect(card(page, "patchwork")).toHaveCount(1);
  await expect(card(page, "jaipur")).toHaveCount(0);
  await expect(card(page, "azul")).toHaveCount(0);

  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "30 to 60 minutes", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "jaipur")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "codenames")).toHaveCount(0);
  await expect(card(page, "marvel-villainous")).toHaveCount(1);

  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "marvel-villainous")).toHaveCount(1);
  await page.getByRole("button", { name: "30 to 60 minutes", exact: true }).click();
  await page.getByRole("button", { name: "60 to 120 minutes", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "marvel-villainous")).toHaveCount(0);
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "marvel-villainous")).toHaveCount(1);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await page.getByRole("button", { name: "60 to 120 minutes", exact: true }).click();
  await page.getByRole("button", { name: "2 hours or more", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "john-company-second-edition")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);

  await page.getByRole("button", { name: "2 hours or more", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "7-wonders")).toHaveCount(0);
  await expect(card(page, "chess")).toHaveCount(0);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(0);

  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await page.getByRole("button", { name: "Medium-light weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "7-wonders")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);

  await page.getByRole("button", { name: "Medium-light weight", exact: true }).click();
  await page.getByRole("button", { name: "Medium-heavy weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "chess")).toHaveCount(1);
  await expect(card(page, "john-company-second-edition")).toHaveCount(0);
  await expect(card(page, "spirit-island")).toHaveCount(0);

  await page.getByRole("button", { name: "Medium-heavy weight", exact: true }).click();
  await page.getByRole("button", { name: "Heavy weight", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toContainText("of 780");
  await expect(card(page, "john-company-second-edition")).toHaveCount(1);
  await expect(card(page, "spirit-island")).toHaveCount(1);
  await expect(card(page, "chess")).toHaveCount(0);

  await page.getByRole("button", { name: "Heavy weight", exact: true }).click();
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "patchwork")).toHaveCount(1);
  await expect(card(page, "codenames")).toHaveCount(1);
  await expect(card(page, "kingdomino")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);

  await page.getByLabel("Search games").fill("azul");
  await waitForList(page);
  await expect(card(page, "azul")).toHaveCount(0);
  await expect(card(page, "patchwork")).toHaveCount(0);
  await expect(page.locator("#search-count")).toHaveText("0 of 780 games");

  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "codenames")).toHaveCount(0);

  await page.getByLabel("Search games").fill("houdini");
  await waitForList(page);
  await expect(card(page, "unmatched")).toHaveCount(1);

  await page.locator("#search-clear").click();
  await waitForList(page);
  await expect(page.getByLabel("Search games")).toHaveValue("");
  await expect(card(page, "unmatched")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(page).not.toHaveURL(/q=/);

  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.locator("#catalog-clear").click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("780 games");
  await expect(page.locator("#catalog-clear")).toBeHidden();
  await expect(page).not.toHaveURL(/players=|time=|weight=|best=|who=|q=/);
  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(1);
});

test("Any keeps games that are missing a value, and a note counts the ones a filter hides", async ({ page }) => {
  await expect(page.locator("#filter-hidden")).toBeHidden();
  await expect(page.locator('.filter-chip[data-facet="players"][data-value=""]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.filter-chip[data-facet="time"][data-value=""]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.filter-chip[data-facet="weight"][data-value=""]')).toHaveAttribute("aria-pressed", "true");

  await openFilters(page);
  const any = page.getByRole("button", { name: "Any player count", exact: true });
  const anyBox = await any.boundingBox();
  expect(anyBox.height).toBeGreaterThanOrEqual(44);
  const anySize = await any.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(anySize).toBeGreaterThanOrEqual(16);

  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(1);
  await expect(card(page, "jenga-maker")).toHaveCount(1);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(1);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "suburbia")).toHaveCount(0);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(page.locator("#filter-hidden")).toHaveText("1 game hidden (no player count)");
  await expect(any).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/players=4/);
  await expect(page).not.toHaveURL(/hidden=/);

  await any.click();
  await waitForList(page);
  await expect(any).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(page.locator("#filter-hidden")).toBeHidden();
  await expect(page).not.toHaveURL(/players=/);

  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(0);
  await expect(card(page, "jenga-maker")).toHaveCount(0);
  await expect(card(page, "suburbia")).toHaveCount(0);
  await expect(page.locator("#filter-hidden")).toHaveText("2 games hidden (no play time)");

  await page.getByRole("button", { name: "Any play time", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(0);
  await expect(card(page, "azul")).toHaveCount(1);
  await expect(card(page, "suburbia")).toHaveCount(0);
  await expect(page.locator("#filter-hidden")).toHaveText("24 games hidden (no weight)");

  await page.getByLabel("Search games").fill("sea salt");
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("0 of 780 games");
  await expect(page.locator("#filter-hidden")).toHaveText("2 games hidden (no weight)");
  await expect(page.locator("#filter-hidden")).not.toContainText(/Cody|Zeek|Tim|John|Ryan|Andrew/);

  await page.locator("#search-clear").click();
  await page.getByRole("button", { name: "Any weight", exact: true }).click();
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#filter-hidden")).toHaveText("12 games hidden (no play time or weight)");
  await expect(page.locator("#filter-summary")).toHaveText("2 players · Under 30 min · Light");

  await page.getByRole("button", { name: "Cody’s games", exact: true }).click();
  await waitForList(page);
  const note = page.locator("#filter-hidden");
  await expect(note).toHaveText("7 games hidden (no weight)");
  await expect(note).not.toContainText(/Cody|Zeek|Tim|John|Ryan|Andrew/);
  await expect(page.locator("#game-grid")).not.toContainText(/Cody|Zeek|Tim|John|Ryan|Andrew/);
  await expect(page).toHaveURL(/players=2/);
  await expect(page).toHaveURL(/time=under30/);
  await expect(page).toHaveURL(/weight=light/);
  await expect(page).toHaveURL(/who=cody/);

  await page.reload();
  await waitForList(page);
  await expect(page.locator("#filter-summary")).toHaveText("2 players · Under 30 min · Light · Cody");
  await expect(note).toHaveText("7 games hidden (no weight)");
  await expect(page.locator("#filter-hidden")).not.toContainText(/Cody|Zeek|Tim|John|Ryan|Andrew/);
});

test("missing fields stay listed until that filter is on", async ({ page }) => {
  await openFilters(page);
  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(1);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(1);

  await page.getByRole("button", { name: "60 to 120 minutes", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(0);

  await page.getByRole("button", { name: "60 to 120 minutes", exact: true }).click();
  await page.getByRole("button", { name: "3 players", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "suburbia")).toHaveCount(0);
  await expect(card(page, "guess-in-10-animal-planet")).toHaveCount(1);

  await page.getByRole("button", { name: "Best at this player count", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "suburbia")).toHaveCount(1);
  await expect(page.locator("#filter-hidden")).toHaveText("53 games hidden (no best player count)");

  await page.getByRole("button", { name: "3 players", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(0);
  await expect(card(page, "azul")).toHaveCount(1);
});

test("filters survive a game page and a direct link", async ({ page }) => {
  await openFilters(page);
  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await waitForList(page);
  await card(page, "7-wonders").click();
  await expect(page.locator("h2.title")).toHaveText("7 Wonders");
  await expect(page.getByRole("link", { name: "Teach it" })).toBeVisible();
  await page.getByRole("link", { name: "Teach it" }).click();
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  await page.locator(".back-link").first().click();
  await expect(page.locator("h2.title")).toHaveText("7 Wonders");
  await page.locator(".back-link").first().click();
  await waitForList(page);
  await expect(page).toHaveURL(/players=4/);
  await expect(page.locator("#filter-summary")).toHaveText("4 players");
  await expect(card(page, "7-wonders")).toHaveCount(1);
  await expect(card(page, "patchwork")).toHaveCount(0);

  await page.reload();
  await waitForList(page);
  await expect(page.locator("#filter-summary")).toHaveText("4 players");
  await expect(card(page, "patchwork")).toHaveCount(0);

  await page.goto("/#/?players=2&time=under30&weight=light&q=king");
  await waitForList(page);
  await expect(page.getByLabel("Search games")).toHaveValue("king");
  await expect(card(page, "kingdomino")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);
});

test("the filter row stays in the viewport width", async ({ page }, testInfo) => {
  await openFilters(page);
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Medium-light weight", exact: true }).click();
  await waitForList(page);
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  const gridTop = await page.locator("#game-grid").evaluate((el) => el.getBoundingClientRect().top);
  if (testInfo.project.name === "phone") {
    await page.locator("#filter-toggle").click();
    await expect(page.locator("#catalog-filter-panel")).toBeHidden();
    const collapsedTop = await page.locator("#game-grid").evaluate((el) => el.getBoundingClientRect().top);
    expect(collapsedTop).toBeLessThan(460);
    expect(collapsedTop).toBeLessThan(gridTop);
  }
});

test("phone screenshots of Any and the hidden-count note", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await openFilters(page);
  await page.screenshot({ path: path.join(dir, "filters-any-phone.png") });
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await page.getByRole("button", { name: "Under 30 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#filter-hidden")).toHaveText("12 games hidden (no play time or weight)");
  await page.locator("#filter-hidden").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(dir, "filters-hidden-note-phone.png") });
  await page.locator("#filter-toggle").click();
  await expect(page.locator("#catalog-filter-panel")).toBeHidden();
  await page.screenshot({ path: path.join(dir, "filters-hidden-summary-phone.png") });
});

test("phone filter screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  const dir = path.join(process.cwd(), "test-results", "filter-screens");
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, "filters-phone-collapsed.png") });
  await openFilters(page);
  await page.screenshot({ path: path.join(dir, "filters-phone-open.png") });
  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await page.getByRole("button", { name: "30 to 60 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Light weight", exact: true }).click();
  await waitForList(page);
  await page.screenshot({ path: path.join(dir, "filters-phone-selected.png") });
  await page.locator("#filter-toggle").click();
  await page.screenshot({ path: path.join(dir, "filters-phone-summary.png") });
});

test("offline list still filters and the worker skips other origins", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one offline pass");
  const swText = await page.evaluate(async () => {
    const res = await fetch("./sw.js");
    return res.text();
  });
  expect(swText).toContain("url.origin !== self.location.origin");
  expect(swText).toContain('VERSION = "2026.11.21.32"');

  await page.waitForFunction(async () => {
    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) return false;
    const cache = await caches.open("bgquick-shell-2026.11.21.32");
    const keys = await cache.keys();
    return keys.some((req) => /index\.html/.test(req.url));
  });

  await context.setOffline(true);
  const cross = await page.evaluate(async () => {
    try {
      const res = await fetch("https://example.com/bgquick-probe");
      const text = await res.text();
      return { failed: false, status: res.status, type: res.type, looksLikeApp: text.includes("Board Game Quick") };
    } catch (err) {
      return { failed: true, name: err.name };
    }
  });
  expect(cross.failed).toBe(true);

  await page.reload();
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("780 games");
  await openFilters(page);
  await page.getByRole("button", { name: "2 players", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toContainText("of 780");
  await expect(card(page, "patchwork")).toHaveCount(1);
  await expect(card(page, "flip-7")).toHaveCount(0);
  await page.getByLabel("Search games").fill("patch");
  await waitForList(page);
  await expect(card(page, "patchwork")).toHaveCount(1);
  await expect(card(page, "azul")).toHaveCount(0);
});
