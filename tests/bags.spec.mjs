import { expect, test } from "@playwright/test";
import fs from "fs";

test.use({ serviceWorkers: "block" });

const TOKEN = {
  owner: "reddittitt",
  repo: "bgquick-storage",
  token: "bgq_test_token_not_a_real_secret_01"
};

async function blockLiveWrites(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function unlock(page) {
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
  }, TOKEN);
}

async function metrics(locator) {
  return locator.evaluate(function (el) {
    var rect = el.getBoundingClientRect();
    var style = getComputedStyle(el);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fontSize: style.fontSize,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom
    };
  });
}

test.beforeEach(async function ({ page }) {
  await blockLiveWrites(page);
});

test("public visitors do not see bags", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bags", exact: true })).toHaveCount(0);
  await expect(page.getByText("Pack in bag")).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
  await expect(page.getByText("Small bag")).toHaveCount(0);

  await page.goto("/#/bags");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("heading", { name: "Bags" })).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);

  await page.evaluate(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big", azul: "small" } }));
  });
  await page.goto("/#/game/wingspan");
  await expect(page.locator(".title")).toContainText("Wingspan");
  await expect(page.locator("#bag-pack")).toHaveCount(0);
  await expect(page.locator("#bag-label")).toHaveCount(0);
  await expect(page.getByText("Pack in bag")).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
});

test("owner can pack a game in one bag and manage both bags", async function ({ page }, testInfo) {
  await unlock(page);
  await page.goto("/");
  await expect(page.locator("header a.header-bags")).toHaveText("Bags");
  await expect(page.locator(".all-games-bar a.bags-entry")).toHaveText("Bags");

  await page.goto("/#/game/wingspan");
  await expect(page.locator(".title")).toContainText("Wingspan");
  const pack = page.locator("#bag-pack");
  await expect(pack).toBeVisible();
  await expect(pack.getByRole("button", { name: "Big bag" })).toBeVisible();
  await expect(pack.getByRole("button", { name: "Small bag" })).toBeVisible();
  await expect(pack.getByRole("button", { name: "Not packed" })).toBeVisible();
  await expect(page.locator(".bag-pack input, .bag-pack select, .bags-page input, .bags-page select")).toHaveCount(0);

  const share = await metrics(page.locator("#share"));
  const save = await metrics(page.locator("#save-offline"));
  const bigBtn = await metrics(pack.getByRole("button", { name: "Big bag" }));
  const smallBtn = await metrics(pack.getByRole("button", { name: "Small bag" }));
  const noneBtn = await metrics(pack.getByRole("button", { name: "Not packed" }));
  expect(bigBtn).toEqual(share);
  expect(smallBtn).toEqual(share);
  expect(noneBtn).toEqual(share);
  expect(save.height).toBe(share.height);
  expect(save.width).toBe(share.width);

  await pack.getByRole("button", { name: "Big bag" }).click();
  await expect(pack.getByRole("button", { name: "Big bag" })).toHaveAttribute("aria-pressed", "true");
  await expect(pack.getByRole("button", { name: "Small bag" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#bag-label")).toHaveText("Big bag");
  await expect(page.locator("#bag-label")).toHaveClass(/bag-label--big/);

  await pack.getByRole("button", { name: "Small bag" }).click();
  await expect(page.locator("#bag-label")).toHaveText("Small bag");
  await expect(page.locator("#bag-label")).toHaveClass(/bag-label--small/);
  await expect(pack.getByRole("button", { name: "Big bag" })).toHaveAttribute("aria-pressed", "false");
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags") || "{}");
  });
  expect(stored.games.wingspan).toBe("small");
  expect(Object.keys(stored.games)).toEqual(["wingspan"]);

  await page.goto("/#/game/azul");
  await expect(page.locator(".title")).toContainText("Azul");
  await page.locator("#bag-pack").getByRole("button", { name: "Big bag" }).click();
  await expect(page.locator("#bag-label")).toHaveText("Big bag");

  await page.locator("header a.header-bags").click();
  await expect(page.locator("h2.title")).toHaveText("Bags");
  await expect(page).toHaveTitle("Bags · Board Game Quick");
  const big = page.locator(".bag-card--big");
  const small = page.locator(".bag-card--small");
  await expect(big.locator("h3")).toHaveText("Big bag");
  await expect(small.locator("h3")).toHaveText("Small bag");
  await expect(big.locator(".bag-count")).toHaveText("1 game");
  await expect(small.locator(".bag-count")).toHaveText("1 game");
  await expect(big.locator("a.bag-game-link")).toHaveText("Azul");
  await expect(big.locator("a.bag-game-link")).toHaveAttribute("href", "/game/azul/");
  await expect(small.locator("a.bag-game-link")).toHaveText("Wingspan");

  const remove = await metrics(small.getByRole("button", { name: "Remove Wingspan" }));
  const move = await metrics(small.getByRole("button", { name: "Move Wingspan to Big bag" }));
  const clearSmall = await metrics(small.getByRole("button", { name: "Clear bag" }));
  expect(remove.height).toBe(share.height);
  expect(move.height).toBe(share.height);
  expect(clearSmall.height).toBe(share.height);
  expect(remove.width).toBe(move.width);
  expect(move.width).toBe(clearSmall.width);

  await small.getByRole("button", { name: "Move Wingspan to Big bag" }).click();
  await expect(big.locator(".bag-count")).toHaveText("2 games");
  await expect(small.locator(".bag-count")).toHaveText("0 games");
  await expect(small.getByText("Nothing packed.")).toBeVisible();
  await expect(small.getByRole("button", { name: "Clear bag" })).toBeDisabled();
  await expect(big.locator("a.bag-game-link")).toHaveText(["Azul", "Wingspan"]);

  page.once("dialog", function (dialog) {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Clear Big bag");
    return dialog.dismiss();
  });
  await big.getByRole("button", { name: "Clear bag" }).click();
  await expect(big.locator(".bag-count")).toHaveText("2 games");

  page.once("dialog", function (dialog) {
    expect(dialog.message()).toContain("Clear Big bag");
    return dialog.accept();
  });
  await big.getByRole("button", { name: "Clear bag" }).click();
  await expect(big.locator(".bag-count")).toHaveText("0 games");
  await expect(big.getByText("Nothing packed.")).toBeVisible();
  await expect(small.locator(".bag-count")).toHaveText("0 games");

  await page.goto("/#/game/wingspan");
  await page.locator("#bag-pack").getByRole("button", { name: "Small bag" }).click();
  await page.locator("header a.header-bags").click();
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("1 game");
  await page.locator(".bag-card--small").getByRole("button", { name: "Remove Wingspan" }).click();
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");

  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);

  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.goto("/#/game/azul");
    await page.locator("#bag-pack").getByRole("button", { name: "Big bag" }).click();
    await expect(page.locator("#bag-label")).toBeVisible();
    await page.locator(".detail-head").screenshot({ path: dir + "/bags-phone-label.png" });
    await page.locator("#bag-pack").screenshot({ path: dir + "/bags-phone-pack.png" });
    await page.locator("header a.header-bags").click();
    await expect(page.locator(".bag-card--big")).toBeVisible();
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.screenshot({ path: dir + "/bags-phone-list.png", animations: "disabled" });
  }

  await page.evaluate(function () { localStorage.removeItem("bgqStorage"); });
  await page.goto("/#/game/azul");
  await expect(page.locator("#bag-pack")).toHaveCount(0);
  await expect(page.locator("#bag-label")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bags", exact: true })).toHaveCount(0);
  await page.goto("/#/bags");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.getByText("Big bag")).toHaveCount(0);
});

test("Bags in the header leaves a game page", async function ({ page }) {
  await unlock(page);
  await page.goto("/#/game/azul");
  await expect(page.locator(".title")).toContainText("Azul");
  await page.locator("#bag-pack").getByRole("button", { name: "Small bag" }).click();
  const card = page.locator('a.card[href="/game/azul/"]');
  await page.goto("/");
  await card.click();
  await expect(page).toHaveURL(/\/game\/azul\/?/);
  await expect(page.locator("#bag-label")).toHaveText("Small bag");
  await page.locator("header a.header-bags").click();
  await expect(page).toHaveURL(/#\/bags$/);
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Azul");
  await expect(page.locator("header a.header-bags")).toHaveAttribute("aria-current", "page");
});
