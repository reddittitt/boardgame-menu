import { expect, test } from "@playwright/test";
import fs from "fs";

async function openRoot(page, query) {
  const q = query ? "?" + query : "";
  await page.goto("/#/game/root" + q);
  await expect(page.locator(".title")).toContainText("Root");
  await page.waitForFunction(function () {
    return document.querySelector("#put-it-away") && document.querySelector("#piece-check");
  });
}

test("Root put-away and components follow Riverfolk and factions", async ({ page }, testInfo) => {
  await openRoot(page, "players=4");
  const putAway = page.locator("#put-it-away");
  await expect(putAway).toBeVisible();
  await expect(putAway).toContainText("Put it away");
  await expect(putAway).not.toContainText("Riverfolk Expansion");
  await expect(putAway).toContainText("Marquise de Cat warriors");

  // Turn Riverfolk on via chip
  const riverfolk = page.locator("#exp-controls .exp-chip", { hasText: "Riverfolk Expansion" });
  await riverfolk.click();
  await expect(page).toHaveURL(/exps=Riverfolk/);
  await expect(putAway).toContainText("Riverfolk Expansion");
  await expect(putAway).toContainText("Stored in the base box");
  await expect(putAway.locator(".showing-for-text")).toContainText("Riverfolk");

  const pieces = page.locator("#piece-check");
  await pieces.locator("summary").click();
  await expect(pieces).toContainText("Lizard Cult warriors");

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/root-putaway-with-riverfolk.png", fullPage: false });
  }

  // Select two base factions — hide unselected faction packing lines
  await page.locator("#char-controls .char-chip", { hasText: "Marquise de Cat" }).click();
  await page.locator("#char-controls .char-chip", { hasText: "Eyrie Dynasties" }).click();
  await expect(putAway.locator(".showing-for-text")).toContainText("Marquise de Cat");
  await expect(putAway).toContainText("Marquise de Cat warriors");
  await expect(putAway).toContainText("Eyrie Dynasties warriors");
  await expect(putAway).not.toContainText("Woodland Alliance warriors");
  await expect(putAway).not.toContainText("Lizard Cult warriors");

  if (testInfo.project.name === "phone") {
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/root-putaway-two-factions.png", fullPage: false });
  }

  // Without Riverfolk again
  await riverfolk.click();
  await expect(putAway).not.toContainText("Riverfolk Expansion");
  if (testInfo.project.name === "phone") {
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/root-putaway-no-riverfolk.png", fullPage: false });
  }

  // Show everything restores hidden faction lines
  await putAway.locator("[data-show-all-toggle]").click();
  await expect(putAway).toContainText("Woodland Alliance warriors");
});

test("Wingspan put-away appends Europe expansion components", async ({ page }, testInfo) => {
  await page.goto("/#/game/wingspan?players=4");
  await expect(page.locator(".title")).toContainText("Wingspan");
  await page.waitForFunction(function () { return document.querySelector("#put-it-away"); });
  const putAway = page.locator("#put-it-away");
  await expect(putAway).not.toContainText("Europe Expansion");

  await page.locator("#exp-controls .exp-chip", { hasText: "Europe Expansion" }).click();
  await expect(putAway).toContainText("Europe Expansion");
  await expect(putAway).toContainText("bird cards");
  await expect(putAway.locator(".showing-for-text")).toContainText("Europe");

  const pieces = page.locator("#piece-check");
  await pieces.locator("summary").click();
  await expect(pieces).toContainText("Europe Expansion");

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/wingspan-putaway-europe.png", fullPage: false });
  }
});

test("selection stays in the game URL", async ({ page }) => {
  await openRoot(page, "players=3&exps=Riverfolk%20Expansion&chars=Marquise%20de%20Cat&chars=Eyrie%20Dynasties");
  await expect(page.locator("#exp-controls .exp-chip", { hasText: "Riverfolk Expansion" })).toHaveAttribute("data-active", "true");
  await expect(page.locator("#char-controls .char-chip", { hasText: "Marquise de Cat" })).toHaveAttribute("data-active", "true");
  await expect(page.locator("#put-it-away .showing-for-text")).toContainText("3 players");
  await expect(page.locator("#put-it-away")).toContainText("Riverfolk Expansion");
});

test("Ark Nova put-away adds Marine Worlds from the BoardGameGeek list", async ({ page }, testInfo) => {
  await page.goto("/#/game/ark-nova?players=3");
  await expect(page.locator(".title")).toContainText("Ark Nova");
  await page.waitForFunction(function () { return document.querySelector("#put-it-away"); });
  const putAway = page.locator("#put-it-away");
  await expect(putAway).not.toContainText("Marine Aquarium");

  await page.locator("#exp-controls .exp-chip", { hasText: "Marine Worlds" }).click();
  await expect(page).toHaveURL(/exps=Marine/);
  await expect(putAway).toContainText("Marine Worlds");
  await expect(putAway).toContainText("Marine Aquarium");
  await expect(putAway).toContainText("Stored in the base box");
  await expect(putAway.locator(".showing-for-text")).toContainText("Marine Worlds");

  const pieces = page.locator("#piece-check");
  await pieces.locator("summary").click();
  await expect(pieces).toContainText("Marine Aquarium");
  await expect(pieces).toContainText("From BoardGameGeek.");

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await putAway.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/ark-nova-putaway-marine-worlds.png", fullPage: false });
  }
});

test("Scout hides the two-player setup line until Show everything", async ({ page }, testInfo) => {
  await page.goto("/#/game/scout?players=4");
  await expect(page.locator(".title")).toContainText("Scout");
  const setup = page.locator("#setup-chapter");
  await expect(setup).toBeVisible();
  await expect(setup).toContainText("Play a number of rounds");
  await expect(setup).not.toContainText("Scout and Show is not used");

  await setup.locator("[data-show-all-toggle]").click();
  await expect(setup).toContainText("Scout and Show is not used");
  await expect(setup.locator(".showing-for-text")).toContainText("Showing everything");

  if (testInfo.project.name === "phone") {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await setup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/opt/cursor/artifacts/scout-show-everything.png", fullPage: false });
  }

  await setup.locator("[data-show-all-toggle]").click();
  await expect(setup).not.toContainText("Scout and Show is not used");
  await expect(setup).toContainText("Play a number of rounds");
});

test("pathname game URL applies expansion selection", async ({ page }) => {
  await page.goto("/game/root/?exps=Riverfolk%20Expansion");
  await expect(page.locator(".title")).toContainText("Root");
  await page.waitForFunction(function () { return document.querySelector("#put-it-away"); });
  await expect(page.locator("#exp-controls .exp-chip", { hasText: "Riverfolk Expansion" })).toHaveAttribute("data-active", "true");
  await expect(page.locator("#put-it-away")).toContainText("Riverfolk Expansion");
  await page.reload();
  await expect(page.locator(".title")).toContainText("Root");
  await page.waitForFunction(function () { return document.querySelector("#put-it-away"); });
  await expect(page.locator("#exp-controls .exp-chip", { hasText: "Riverfolk Expansion" })).toHaveAttribute("data-active", "true");
  await expect(page.locator("#put-it-away")).toContainText("Riverfolk Expansion");
});
