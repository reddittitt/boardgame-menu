import { expect, test } from "@playwright/test";

test("collection game shows a stored-in-the-box expansion guide", async ({ page }, testInfo) => {
  await page.goto("/#/game/7-wonders-duel");
  await expect(page.locator("h2.title")).toHaveText("7 Wonders Duel");
  const guide = page.locator("#expansion-guide");
  await expect(guide).toBeVisible();
  await expect(guide.locator("summary")).toContainText("Expansion guide");
  const summaryHeight = await guide.locator("summary").evaluate((el) => el.getBoundingClientRect().height);
  expect(summaryHeight).toBeGreaterThanOrEqual(44);
  await guide.locator("summary").click();
  await expect(guide).toContainText("Stored in the base box.");
  await expect(guide).toContainText("Pantheon");
  await expect(guide).toContainText("each god having its own power");
  await expect(guide).toContainText("Agora");
  await expect(guide.locator(".expansion-guide-card").first()).toContainText("Rules changes");
  await expect(guide).not.toContainText("View on publisher site");
  if (testInfo.project.name === "phone") {
    await guide.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "/opt/cursor/artifacts/expansion-guide-phone.png",
      fullPage: false
    });
  }
});

test("a base game outside the collection does not claim the base box", async ({ page }) => {
  await page.goto("/#/game/7-wonders");
  const guide = page.locator("#expansion-guide");
  await expect(guide).toBeVisible();
  await guide.locator("summary").click();
  await expect(guide).toContainText("Cities");
  await expect(guide).toContainText("Adds an 8th player");
  await expect(guide).not.toContainText("Stored in the base box.");
});

test("a game without expansions has no guide", async ({ page }) => {
  await page.goto("/#/game/chess");
  await expect(page.locator("h2.title")).toHaveText("Chess");
  await expect(page.locator("#expansion-guide")).toHaveCount(0);
});
