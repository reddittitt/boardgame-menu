import { expect, test } from "@playwright/test";

const ORDER = [
  ["azul", "Azul"],
  ["wingspan", "Wingspan"],
  ["patchwork", "Patchwork"],
  ["jaipur", "Jaipur"],
  ["codenames", "Codenames"],
  ["kingdomino", "Kingdomino"]
];

async function blockLiveWrites(page) {
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function openGame(page, slug, name) {
  await page.locator("#search").fill(slug.replace(/-/g, " "));
  const card = page.locator('a.card[href="/game/' + slug + '/"]');
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator("h2.title")).toHaveText(name);
  await page.locator("a.back-link").first().click();
  await expect(page.locator("#search")).toBeVisible();
}

test.beforeEach(async function ({ page }) {
  const live = [];
  page.on("request", function (req) {
    if (/script\.google(usercontent)?\.com/i.test(req.url()) || /\/exec(?:\?|$)/.test(req.url())) live.push(req.method() + " " + req.url());
  });
  await blockLiveWrites(page);
  page._livePosts = live;
});

test.afterEach(async function ({ page }) {
  expect(page._livePosts || []).toEqual([]);
});

test("home keeps the last five opened games and can clear them", async function ({ page }) {
  await page.goto("/");
  await page.evaluate(function () {
    localStorage.setItem("bgq_recent", JSON.stringify([{ slug: "root", name: "Old", cover: "nope" }]));
  });
  await page.reload();
  await expect(page.locator("#recently-opened")).toBeVisible();
  await expect(page.locator(".recent-chip")).toHaveCount(1);
  await expect(page.locator(".recent-chip")).toContainText("Root");

  for (var i = 0; i < ORDER.length; i++) await openGame(page, ORDER[i][0], ORDER[i][1]);

  await page.reload();
  await expect(page.locator("#search")).toBeVisible();
  const chips = page.locator(".recent-chip");
  await expect(chips).toHaveCount(5);
  await expect(chips.nth(0)).toContainText("Kingdomino");
  await expect(chips.nth(1)).toContainText("Codenames");
  await expect(chips.nth(4)).toContainText("Wingspan");
  await expect(page.locator("#recently-opened")).not.toContainText("Azul");
  await expect(page.locator("#recently-opened")).not.toContainText("Root");
  const stored = await page.evaluate(function () { return localStorage.getItem("bgq_recent"); });
  expect(JSON.parse(stored)).toEqual(["kingdomino", "codenames", "jaipur", "patchwork", "wingspan"]);

  await chips.nth(2).click();
  await expect(page.locator("h2.title")).toHaveText("Jaipur");
  await page.locator("a.back-link").first().click();
  await expect(page.locator(".recent-chip").first()).toContainText("Jaipur");

  await page.getByRole("button", { name: "Clear recent", exact: true }).click();
  await expect(page.locator("#recently-opened")).toBeHidden();
  expect(await page.evaluate(function () { return localStorage.getItem("bgq_recent"); })).toBeNull();
  await page.reload();
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator("#recently-opened")).toBeHidden();
});
