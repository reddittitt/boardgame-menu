import { expect, test } from "@playwright/test";
import fs from "fs";

test("component checklist stays on this device", async ({ page }) => {
  await page.goto("/#/game/cascadia");
  const section = page.locator("#piece-check");
  await expect(section).toBeVisible();
  expect(await section.evaluate(function (el) { return el.open; })).toBe(false);
  await expect(section.locator("summary")).toContainText("Components");
  await expect(section.locator(".piece-source")).toHaveText("From the rulebook, page 3.");

  await section.locator("summary").click();
  const row = section.locator(".piece-row").filter({ hasText: "including 25 Keystone" });
  await expect(row.locator(".piece-count")).toHaveText("85");
  const box = row.locator(".piece-box");
  const boxSize = await box.evaluate(function (el) {
    const style = getComputedStyle(el);
    return { w: parseFloat(style.width), h: parseFloat(style.height) };
  });
  expect(boxSize.w).toBeGreaterThanOrEqual(44);
  expect(boxSize.h).toBeGreaterThanOrEqual(44);
  await box.click();
  await expect(box).toHaveAttribute("aria-pressed", "true");

  const missing = row.locator(".piece-missing");
  await missing.click();
  const note = row.locator(".piece-note");
  await expect(note).toBeVisible();
  const noteSize = await note.evaluate(function (el) { return parseFloat(getComputedStyle(el).fontSize); });
  expect(noteSize).toBeGreaterThanOrEqual(16);
  await note.fill("one tile torn");
  await expect(missing).toHaveAttribute("aria-pressed", "true");
  if (test.info().project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/components-phone.png", fullPage: false });
  }

  await page.reload();
  await expect(section).toBeVisible();
  await section.locator("summary").click();
  await expect(box).toHaveAttribute("aria-pressed", "true");
  await expect(note).toHaveValue("one tile torn");
  await expect(section.locator(".piece-progress")).toHaveText("1 of 7");

  const reset = section.locator(".piece-reset");
  await reset.click();
  await expect(reset).toHaveText("Clear checks?");
  await reset.click();
  await expect(box).toHaveAttribute("aria-pressed", "false");
  await expect(note).toBeHidden();
  await expect(section.locator(".piece-progress")).toHaveText("0 of 7");

  const stored = await page.evaluate(function () { return localStorage.getItem("bgqPieces:cascadia"); });
  expect(stored).toContain('"checked":{}');
});

test("a game with no component source has no checklist", async ({ page }) => {
  await page.goto("/#/game/sky-team");
  await expect(page.locator(".title")).toContainText("Sky Team");
  await page.waitForFunction(function () { return document.querySelector(".detail-body"); });
  await expect(page.locator("#piece-check")).toHaveCount(0);
  await expect(page.locator("[data-piece-jump]")).toHaveCount(0);
});

test("BoardGameGeek lists are labeled", async ({ page }) => {
  await page.goto("/#/game/azul");
  const section = page.locator("#piece-check");
  await expect(section.locator(".piece-source")).toHaveText("From BoardGameGeek.");
  await section.locator("summary").click();
  await expect(section.locator(".piece-row").first().locator(".piece-count")).toHaveText("100");
  await expect(page.locator("[data-piece-jump]")).toHaveText("Components");
});
