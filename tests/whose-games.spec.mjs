import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const PEOPLE = ["Cody", "Zeek", "Tim", "John", "Ryan", "Andrew"];

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

function leadingCount(text) {
  const match = String(text || "").match(/^(\d+)/);
  return match ? Number(match[1]) : -1;
}

test("whose games is a union filter and stays off the game page", async ({ page }) => {
  await page.goto("/#/");
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("780 games");

  await page.locator('.collection-filter button[data-collection="mine"]').click();
  await waitForList(page);
  const myGames = leadingCount(await page.locator("#search-count").innerText());
  expect(myGames).toBe(184);

  await page.locator('.collection-filter button[data-collection="all"]').click();
  await waitForList(page);
  await openFilters(page);

  for (const name of PEOPLE) {
    const chip = page.getByRole("button", { name: name + "’s games", exact: true });
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    const size = await chip.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  }

  await page.getByRole("button", { name: "Zeek’s games", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("72 of 780 games");
  await expect(page.locator("#filter-summary")).toHaveText("Zeek");
  await expect(page).toHaveURL(/who=zeek/);
  await expect(card(page, "60-second-city")).toHaveCount(1);
  await expect(card(page, "hive")).toHaveCount(1);
  await expect(card(page, "catan")).toHaveCount(1);
  await expect(card(page, "7-wonders")).toHaveCount(1);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(0);
  await expect(card(page, "hive-pocket")).toHaveCount(0);

  await page.getByRole("button", { name: "Cody’s games", exact: true }).click();
  await waitForList(page);
  await expect(page).toHaveURL(/who=cody(?:%2C|,)zeek/);
  await expect(page.locator("#filter-summary")).toHaveText("Cody or Zeek");
  const union = leadingCount(await page.locator("#search-count").innerText());
  expect(union).toBeGreaterThan(72);
  expect(union).toBeGreaterThan(myGames);
  await expect(card(page, "60-second-city")).toHaveCount(1);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(1);
  await expect(card(page, "catan")).toHaveCount(1);
  await expect(card(page, "7-wonders")).toHaveCount(1);

  await page.getByRole("button", { name: "Zeek’s games", exact: true }).click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("184 of 780 games");
  await expect(card(page, "60-second-city")).toHaveCount(0);
  await expect(card(page, "7-wonders")).toHaveCount(0);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(1);
  await expect(card(page, "hive-pocket")).toHaveCount(1);
  await expect(card(page, "catan")).toHaveCount(1);

  await page.locator("#catalog-clear").click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toHaveText("780 games");
  await expect(page).not.toHaveURL(/who=/);

  await page.locator('.collection-filter button[data-collection="group"]').click();
  await waitForList(page);
  await expect(page.locator("#search-count")).toContainText("group");
  await expect(card(page, "60-second-city")).toHaveCount(1);
  await page.locator('.collection-filter button[data-collection="all"]').click();
  await waitForList(page);

  await page.goto("/#/?who=zeek,tim");
  await waitForList(page);
  await expect(page.locator("#filter-summary")).toHaveText("Zeek or Tim");
  await expect(card(page, "60-second-city")).toHaveCount(1);
  await expect(card(page, "bohnanza")).toHaveCount(1);
  await expect(card(page, "sea-salt-and-paper")).toHaveCount(0);

  await card(page, "60-second-city").click();
  await expect(page.locator("h2.title")).toHaveText("60 Second City");
  await expect(page.locator(".detail")).toContainText("2");
  await expect(page.locator(".detail")).toContainText("2021");
  await expect(page.locator(".detail")).not.toContainText("Owned by");
  await expect(page.locator(".detail")).not.toContainText("Zeek");
  await expect(page.locator(".detail")).not.toContainText("Cody");
});

test("game night suggest and the shared link use whose games", async ({ page }) => {
  await page.goto("/#/night");
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  await expect(page.getByRole("button", { name: "Zeek’s games", exact: true })).toBeVisible();
  const chip = page.getByRole("button", { name: "Zeek’s games", exact: true });
  const box = await chip.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);

  await chip.click();
  await expect(page).toHaveURL(/who=zeek/);
  await expect(page.locator("#gn-fit")).toContainText("72 games fit");

  await page.locator("#gn-search").fill("sea salt");
  const salt = page.locator("#gn-results li").filter({ has: page.locator('[data-add="sea-salt-and-paper"]') });
  await expect(salt).toContainText("Outside tonight");
  await page.locator("#gn-search").fill("60 second");
  const city = page.locator("#gn-results li").filter({ hasText: "60 Second City" });
  await expect(city).toBeVisible();
  await expect(city).not.toContainText("Outside tonight");

  await page.getByRole("button", { name: "Suggest some" }).click();
  const slugs = await page.locator("#gn-nominee-list [data-remove]").evaluateAll((els) => els.map((el) => el.getAttribute("data-remove")));
  expect(slugs.length).toBeGreaterThanOrEqual(4);
  const fitting = await page.evaluate((list) => list.every((slug) => window.BGQuickNight.fitsGame(slug)), slugs);
  expect(fitting).toBe(true);
  expect(slugs).not.toContain("sea-salt-and-paper");
  expect(slugs).not.toContain("hive-pocket");

  await page.getByRole("button", { name: "Copy link" }).click();
  const shared = await page.locator("#gn-share-url").innerText();
  expect(shared).toContain("who=zeek");
  expect(shared).toContain("#/night");

  await page.getByRole("button", { name: "Cody’s games", exact: true }).click();
  await expect(page).toHaveURL(/who=cody(?:%2C|,)zeek/);
  await page.locator("#gn-search").fill("sea salt");
  const saltOwned = page.locator("#gn-results li").filter({ has: page.locator('[data-add="sea-salt-and-paper"]') });
  await expect(saltOwned).not.toContainText("Outside tonight");
});

test("phone screenshots of whose games", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });

  await page.goto("/#/");
  await waitForList(page);
  await openFilters(page);
  await page.screenshot({ path: path.join(dir, "whose-games-phone-filters.png") });
  await page.getByRole("button", { name: "Zeek’s games", exact: true }).click();
  await page.getByRole("button", { name: "Tim’s games", exact: true }).click();
  await waitForList(page);
  await page.screenshot({ path: path.join(dir, "whose-games-phone-union.png") });

  await page.goto("/#/game/60-second-city");
  await expect(page.locator("h2.title")).toHaveText("60 Second City");
  await page.screenshot({ path: path.join(dir, "whose-games-phone-page.png") });

  await page.goto("/#/night?who=zeek");
  await expect(page.locator("#gn-fit")).toContainText("72 games fit");
  await page.locator("#gn-who-label").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(dir, "whose-games-phone-night.png") });
});
