import { expect, test } from "@playwright/test";
import fs from "fs";

async function openGame(page, slug, title) {
  await page.goto("/#/game/" + slug);
  await expect(page.locator(".title")).toContainText(title);
  await page.waitForSelector("#char-controls .char-chip");
}

test("villain and leader chips open a text aid and close again", async ({ page }, testInfo) => {
  await openGame(page, "marvel-villainous", "Marvel Villainous");
  await expect(page.locator("#character-aids")).toHaveCount(0);
  const hela = page.locator("#char-controls .char-chip", { hasText: "Hela" });
  await hela.click();
  const aid = page.locator("#character-aids");
  await expect(aid).toBeVisible();
  await expect(aid).toContainText("Hela");
  await expect(aid).toContainText("Odin's Vault");
  await expect(aid).toContainText("Text version");
  await expect(aid).not.toContainText("Cody");
  await expect(hela).toHaveAttribute("data-active", "true");

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await aid.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/marvel-hela-phone.png", fullPage: false });
  }

  await hela.click();
  await expect(page.locator("#character-aids")).toHaveCount(0);
  await expect(hela).toHaveAttribute("aria-pressed", "false");

  await openGame(page, "arcs", "Arcs");
  await expect(page.locator("#character-aids")).toHaveCount(0);
  const mystic = page.locator("#char-controls .char-chip", { hasText: "Mystic" });
  await mystic.click();
  await expect(page.locator("#character-aids")).toContainText("Psionic");
  await expect(page.locator("#character-aids")).toContainText("page 21");
  const elder = page.locator("#char-controls .char-chip", { hasText: "Elder" });
  await elder.click();
  await expect(page.locator(".character-aid")).toHaveCount(2);

  if (testInfo.project.name === "phone") {
    await page.locator("#char-controls").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/arcs-leaders-phone.png", fullPage: false });
  }

  await page.goto("/#/game/dune-imperium-uprising");
  await expect(page.locator(".title")).toContainText("Dune");
  await expect(page.locator("#char-controls")).toHaveCount(0);

  await openGame(page, "star-wars-villainous", "Star Wars Villainous");
  await page.locator("#char-controls .char-chip", { hasText: "Darth Vader" }).click();
  await expect(page.locator("#character-aids")).toContainText("6 Ambition");
  await expect(page.locator("#character-aids")).toContainText("Emperor's Throne Room");
});
