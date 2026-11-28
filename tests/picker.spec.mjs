import { expect, test } from "@playwright/test";

const ARTIFACTS = "/opt/cursor/artifacts";

async function blockLive(page) {
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function clickHeart(page, name) {
  const button = page.getByRole("button", { name: name, exact: true });
  await button.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  await button.click();
}

test.beforeEach(async function ({ page }) {
  await blockLive(page);
});

test("opening the picker defaults to Cody", async function ({ page }) {
  await page.goto("/#/pick");
  await expect(page.locator("h2.title")).toHaveText("Find a game to play");
  await expect(page.locator("#pick-lead")).toHaveText(
    "Browse the collection and heart the games you'd like to try. You can copy a link to send the list back."
  );
  await expect(page).toHaveURL(/#\/pick\?who=cody$/);
  await expect(page.getByRole("button", { name: "Cody\u2019s games" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "4 players", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#pick-count")).toHaveText("No games on your list yet");
});

test("a search-string owner link becomes the hash picker", async function ({ page }) {
  await page.goto("/?pick&owner=cody");
  await expect(page).toHaveURL(/#\/pick\?who=cody$/);
  await expect(page).not.toHaveURL(/owner=/);
  await expect(page.locator("h2.title")).toHaveText("Find a game to play");
});

test("whose games is a union and changes the list", async function ({ page }) {
  await page.goto("/#/pick?who=cody");
  const codyCount = await page.locator(".pick-card").count();
  expect(codyCount).toBeGreaterThan(100);
  await expect(page.locator('[data-pick-slug="gloomhaven"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Zeek\u2019s games" }).click();
  await expect(page).toHaveURL(/who=cody(?:%2C|,)zeek/);
  await expect(page.locator('[data-pick-slug="gloomhaven"]')).toHaveCount(1);
  const both = await page.locator(".pick-card").count();
  expect(both).toBeGreaterThan(codyCount);
});

test("player, time, difficulty, and kind chips filter and survive reload", async function ({ page }) {
  await page.goto("/#/pick?who=cody");
  const all = await page.locator(".pick-card").count();
  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await expect(page).toHaveURL(/players=4/);
  const atFour = await page.locator(".pick-card").count();
  expect(atFour).toBeGreaterThan(0);
  expect(atFour).toBeLessThan(all);
  await page.reload();
  await expect(page.getByRole("button", { name: "4 players", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pick-card")).toHaveCount(atFour);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await expect(page).not.toHaveURL(/players=/);
  await page.getByRole("button", { name: "About an hour, 30 to 60 minutes", exact: true }).click();
  await expect(page).toHaveURL(/time=30-60/);
  const hour = await page.locator(".pick-card").count();
  expect(hour).toBeGreaterThan(0);
  expect(hour).toBeLessThan(all);
  await page.reload();
  await expect(page.getByRole("button", { name: "About an hour, 30 to 60 minutes", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Any play time", exact: true }).click();
  await page.getByRole("button", { name: "Easy", exact: true }).click();
  await expect(page).toHaveURL(/difficulty=easy/);
  await expect(page.locator('[data-pick-slug="azul"]')).toBeVisible();
  const easy = await page.locator(".pick-card").count();
  await page.getByRole("button", { name: "Heavy", exact: true }).click();
  await expect(page).toHaveURL(/difficulty=heavy/);
  await expect(page.locator('[data-pick-slug="azul"]')).toHaveCount(0);
  expect(await page.locator(".pick-card").count()).not.toBe(easy);
  await page.getByRole("button", { name: "Medium", exact: true }).click();
  await expect(page).toHaveURL(/difficulty=medium/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Medium", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Any difficulty", exact: true }).click();
  await page.getByRole("button", { name: "Card game", exact: true }).click();
  await expect(page).toHaveURL(/kind=card/);
  await expect(page.locator('[data-pick-slug="jaipur"]')).toBeVisible();
  await expect(page.locator('[data-pick-slug="azul"]')).toHaveCount(0);
  const cards = await page.locator(".pick-card").count();
  await page.reload();
  await expect(page.getByRole("button", { name: "Card game", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pick-card")).toHaveCount(cards);
  await expect(page.locator("#pick-hidden")).toContainText(/games? hidden/);
});

test("a sourced card shows the cover, blurb, kind, and difficulty", async function ({ page }) {
  await page.goto("/#/pick?who=cody");
  const card = page.locator('[data-pick-slug="azul"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".pick-name")).toHaveText("Azul");
  await expect(card.locator(".pick-blurb")).toContainText("palace wall");
  await expect(card.locator(".pick-meta")).toContainText("Puzzle / tile");
  await expect(card.locator(".pick-meta")).toContainText("Easy");
  await expect(card.locator(".pick-meta")).toContainText(/\d+\u2013?\d* min/);
  await expect(card.locator(".pick-meta")).toContainText("2");
  await expect(card.locator("img")).toHaveAttribute("src", /azul/);
  await expect(card.locator("a.pick-card-link")).toHaveAttribute("href", /\/game\/azul\//);
  const jaipur = page.locator('[data-pick-slug="jaipur"]');
  await expect(jaipur.locator(".pick-meta")).toContainText("Card game");
  await expect(jaipur.locator(".pick-meta")).toContainText("Two-player duel");
});

test("hearts, the shortlist, and the copied link", async function ({ page }) {
  await page.goto("/#/pick?who=cody");
  await clickHeart(page, "Save Azul to your list");
  await clickHeart(page, "Save Jaipur to your list");
  await expect(page.getByRole("button", { name: "Remove Azul from your list" })).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate(function () { return localStorage.getItem("bgq_picker_picks"); });
  expect(JSON.parse(stored)).toEqual(["azul", "jaipur"]);
  await expect(page).toHaveURL(/picks=azul(?:%2C|,)jaipur/);

  await page.getByRole("button", { name: "4 players", exact: true }).click();
  await page.getByRole("button", { name: "Your list", exact: true }).click();
  await expect(page.locator(".pick-name")).toHaveText(["Azul", "Jaipur"]);
  await expect(page.locator("#pick-count")).toHaveText("2 games you'd like");

  await page.getByRole("button", { name: "Copy link" }).click();
  const shared = await page.locator("#pick-share-url").innerText();
  expect(shared).toContain("#/pick?");
  expect(shared).toContain("who=cody");
  expect(shared).toContain("azul");
  expect(shared).toContain("jaipur");
  expect(shared).not.toContain("players=");
  await expect(page.locator("#pick-share-status")).toHaveText(/Link copied\.|Select the link below and copy it\./);
  await expect(page.locator("#pick-footer")).not.toContainText("Cody");

  const fresh = await page.context().browser().newContext();
  const page2 = await fresh.newPage();
  await blockLive(page2);
  await page2.addInitScript(function () {
    localStorage.setItem("bgq_picker_picks", JSON.stringify(["catan"]));
  });
  await page2.goto(shared);
  await expect(page2.locator("h2.title")).toHaveText("Find a game to play");
  await expect(page2.locator(".pick-name")).toHaveText(["Azul", "Jaipur"]);
  const kept = await page2.evaluate(function () { return localStorage.getItem("bgq_picker_picks"); });
  expect(kept).toContain("catan");
  expect(kept).not.toContain("azul");
  await fresh.close();
});

test("the home bar opens the picker", async function ({ page }) {
  await page.goto("/#/");
  const link = page.getByRole("link", { name: "New to games? Find one to play" });
  await expect(link).toBeVisible();
  const size = await link.evaluate(function (el) { return parseFloat(getComputedStyle(el).fontSize); });
  expect(size).toBeGreaterThanOrEqual(16);
  await link.click();
  await expect(page).toHaveURL(/#\/pick\?who=cody/);
  await expect(page.locator("h2.title")).toHaveText("Find a game to play");
  await expect(page.locator("a.pick-entry")).toHaveAttribute("aria-current", "page");
});

test("a game page follows a picker link in the app", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await page.locator("a.pick-entry").evaluate(function (el) { el.click(); });
  await expect(page).toHaveURL(/\/#\/pick/);
  await expect(page).not.toHaveURL(/\/game\/azul/);
  await expect(page.locator("h2.title")).toHaveText("Find a game to play");
});

test("the phone page has no horizontal overflow and a visible footer", async function ({ page }, testInfo) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/pick?who=cody");
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  const wrapped = await page.locator(".pick-chips").evaluateAll(function (rows) {
    return rows.every(function (el) { return el.scrollWidth <= el.clientWidth + 1; });
  });
  expect(wrapped).toBe(true);
  const chip = await page.getByRole("button", { name: "4 players", exact: true }).boundingBox();
  expect(chip.height).toBeGreaterThanOrEqual(44);
  expect(chip.width).toBeGreaterThanOrEqual(44);
  const heart = page.locator(".pick-heart").first();
  await heart.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
  const heartBox = await heart.boundingBox();
  expect(heartBox.height).toBeGreaterThanOrEqual(44);
  expect(heartBox.width).toBeGreaterThanOrEqual(44);
  const footer = await page.locator("#pick-footer").boundingBox();
  expect(footer.y).toBeGreaterThan(500);
  expect(footer.y + footer.height).toBeLessThanOrEqual(844 + 1);
  await expect(page.locator("#pick-footer")).toBeVisible();

  if (testInfo.project.name === "phone") {
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.screenshot({ path: ARTIFACTS + "/picker-filters-phone.png" });
    const card = page.locator('[data-pick-slug="azul"]');
    await card.evaluate(function (el) { el.scrollIntoView({ block: "center" }); });
    await card.screenshot({ path: ARTIFACTS + "/picker-card-phone.png" });
    await clickHeart(page, "Save Azul to your list");
    await page.getByRole("button", { name: "Your list", exact: true }).click();
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.screenshot({ path: ARTIFACTS + "/picker-shortlist-phone.png" });
  }
});

test("the longest blurb is fully visible at 390px", async function ({ page }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/pick?who=cody");
  await expect(page.locator(".pick-blurb").first()).toBeVisible();
  const measured = await page.evaluate(function () {
    function measure(el) {
      var style = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim(),
        scroll: el.scrollHeight,
        client: el.clientHeight,
        lineClamp: style.getPropertyValue("-webkit-line-clamp"),
        textOverflow: style.textOverflow,
        overflowY: style.overflowY,
        maxHeight: style.maxHeight
      };
    }
    var blurbs = Array.prototype.slice.call(document.querySelectorAll(".pick-blurb"));
    blurbs.sort(function (a, b) {
      return (b.textContent || "").length - (a.textContent || "").length;
    });
    var blurb = blurbs[0];
    var card = blurb.closest(".pick-card");
    return {
      blurb: measure(blurb),
      name: measure(card.querySelector(".pick-name")),
      meta: measure(card.querySelector(".pick-meta"))
    };
  });
  expect(measured.blurb.text.length).toBeGreaterThan(80);
  expect(measured.blurb.scroll).toBeLessThanOrEqual(measured.blurb.client);
  expect(measured.blurb.lineClamp === "none" || measured.blurb.lineClamp === "").toBe(true);
  expect(measured.blurb.textOverflow).not.toBe("ellipsis");
  expect(measured.blurb.overflowY).not.toBe("hidden");
  expect(measured.blurb.maxHeight).toBe("none");
  for (const part of [measured.name, measured.meta]) {
    expect(part.scroll).toBeLessThanOrEqual(part.client);
    expect(part.lineClamp === "none" || part.lineClamp === "").toBe(true);
    expect(part.textOverflow).not.toBe("ellipsis");
    expect(part.maxHeight).toBe("none");
  }
  const heart = await page.locator(".pick-heart").first().boundingBox();
  expect(heart.height).toBeGreaterThanOrEqual(44);
  expect(heart.width).toBeGreaterThanOrEqual(44);
});

test("a locked visit has no pack or bags controls in the picker", async function ({ page }) {
  await page.goto("/#/pick?who=cody");
  await expect(page.locator("#pick-page .bag-swipe, #pick-page .bag-pack, #pick-page [data-pack-slug], #pick-page #bag-pack")).toHaveCount(0);
  const text = await page.locator("#pick-page").innerText();
  expect(text).not.toMatch(/\bPack\b/);
  expect(text).not.toMatch(/\bBags\b/);
  await expect(page.locator(".all-games-bar a.bags-entry")).toHaveCount(0);
});
