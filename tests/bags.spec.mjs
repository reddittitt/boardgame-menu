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

async function pickBag(page, name) {
  const trigger = page.locator("#bag-pack");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const picker = page.locator("#bag-picker");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: name, exact: true }).click();
  await expect(picker).toBeHidden();
}

async function swipeRow(locator, direction) {
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

async function holdSwipe(locator, direction, distance) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing row");
  const y = box.y + box.height / 2;
  const startX = box.x + Math.min(box.width * 0.42, box.width - 64);
  const page = locator.page();
  await page.mouse.move(startX, y);
  await page.mouse.down();
  const endX = startX + (direction === "left" ? -distance : distance);
  await page.mouse.move(endX, y, { steps: 12 });
  return { page: page, startX: startX, y: y };
}

async function releaseShort(held, direction) {
  const back = held.startX + (direction === "left" ? -28 : 28);
  await held.page.mouse.move(back, held.y, { steps: 6 });
  await held.page.mouse.up();
}

function rgbOf(color) {
  return String(color || "").replace(/\s+/g, "");
}

test.beforeEach(async function ({ page }) {
  await blockLiveWrites(page);
});

test("public visitors do not see bags", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bags", exact: true })).toHaveCount(0);
  await expect(page.getByText("Pack in bag")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pack in bag" })).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
  await expect(page.getByText("Small bag")).toHaveCount(0);
  await expect(page.getByText("Free carry")).toHaveCount(0);
  await expect(page.locator(".bag-add-input")).toHaveCount(0);

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
  await expect(page.locator("#bag-picker")).toHaveCount(0);
  await expect(page.getByText("Pack in bag")).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
  await expect(page.getByText("Free carry")).toHaveCount(0);
  await expect(page.locator(".bag-add-input")).toHaveCount(0);
});

test("owner can pack a game in one bag and manage both bags", async function ({ page }, testInfo) {
  await unlock(page);
  await page.goto("/");
  await expect(page.locator("header a.header-bags")).toHaveText("Bags");
  await expect(page.locator(".all-games-bar a.bags-entry")).toHaveText("Bags");

  await page.goto("/#/game/wingspan");
  await expect(page.locator(".title")).toContainText("Wingspan");
  const pack = page.locator(".essential-links #bag-pack");
  await expect(pack).toBeVisible();
  await expect(pack).toHaveText("Pack in bag");
  await expect(page.locator(".actions #bag-pack, .bag-pack")).toHaveCount(0);
  await expect(page.locator("#bag-picker")).toBeHidden();
  const rulebook = page.locator(".essential-links a.essential-link").first();
  const packBox = await metrics(pack);
  const linkBox = await metrics(rulebook);
  expect(packBox.height).toBe(linkBox.height);
  expect(packBox.width).toBe(linkBox.width);
  expect(packBox.height).toBeGreaterThanOrEqual(44);
  expect(packBox.fontSize).toBe(linkBox.fontSize);

  await pack.click();
  const picker = page.locator("#bag-picker");
  await expect(picker).toBeVisible();
  await expect(pack).toHaveAttribute("aria-expanded", "true");
  await expect(picker.getByRole("button", { name: "Big bag", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Small bag", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Free carry", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Not packed", exact: true })).toBeVisible();
  const freeOption = await metrics(picker.getByRole("button", { name: "Free carry", exact: true }));
  expect(freeOption.height).toBeGreaterThanOrEqual(44);
  expect(parseFloat(freeOption.fontSize)).toBeGreaterThanOrEqual(16);
  await picker.getByRole("button", { name: "Big bag", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(page.locator("#bag-label")).toHaveText("Big bag");
  await expect(page.locator("#bag-label")).toHaveClass(/bag-label--big/);

  await pack.click();
  await expect(picker.getByRole("button", { name: "Big bag", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(picker.getByRole("button", { name: "Small bag", exact: true })).toHaveAttribute("aria-pressed", "false");
  await picker.getByRole("button", { name: "Small bag", exact: true }).click();
  await expect(page.locator("#bag-label")).toHaveText("Small bag");
  await expect(page.locator("#bag-label")).toHaveClass(/bag-label--small/);
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags") || "{}");
  });
  expect(stored.games.wingspan).toBe("small");
  expect(Object.keys(stored.games)).toEqual(["wingspan"]);

  await page.goto("/#/game/azul");
  await expect(page.locator(".title")).toContainText("Azul");
  await pickBag(page, "Big bag");
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

  await expect(page.locator(".bag-card--free h3")).toHaveText("Free carry");
  await expect(page.locator(".bag-card--free .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--free")).toContainText("Nothing carried.");
  await expect(page.getByRole("button", { name: /Remove |Move / })).toHaveCount(0);
  await expect(small.locator(".bag-game-actions")).toHaveCount(0);
  const clearSmall = await metrics(small.getByRole("button", { name: "Clear bag" }));
  expect(clearSmall.height).toBeGreaterThanOrEqual(44);

  await small.getByRole("button", { name: "Actions for Wingspan" }).click();
  const moveSheet = page.locator("#bag-move-sheet");
  await expect(moveSheet).toBeVisible();
  await expect(moveSheet.getByRole("button", { name: "Big bag", exact: true })).toBeVisible();
  await expect(moveSheet.getByRole("button", { name: "Free carry", exact: true })).toBeVisible();
  await expect(moveSheet.getByRole("button", { name: "Small bag", exact: true })).toHaveCount(0);
  await moveSheet.getByRole("button", { name: "Big bag", exact: true }).click();
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
  await pickBag(page, "Small bag");
  await page.locator("header a.header-bags").click();
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("1 game");
  await page.locator(".bag-card--small").getByRole("button", { name: "Actions for Wingspan" }).click();
  await page.locator("#bag-move-sheet").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator("#bag-toast")).toContainText("Removed Wingspan");
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");

  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);

  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.goto("/#/game/azul");
    await expect(page.locator("#bag-pack")).toBeVisible();
    await page.locator(".essential-links").screenshot({ path: dir + "/bags-phone-pack.png" });
    await page.locator("#bag-pack").click();
    await expect(page.locator("#bag-picker")).toBeVisible();
    await page.locator("#bag-picker").screenshot({ path: dir + "/bags-phone-picker.png" });
    await page.locator("#bag-picker").getByRole("button", { name: "Big bag", exact: true }).click();
    await expect(page.locator("#bag-label")).toBeVisible();
    await page.locator(".detail-head").screenshot({ path: dir + "/bags-phone-label.png" });
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
  await pickBag(page, "Small bag");
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

function bagFile(obj, sha) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      sha: sha,
      encoding: "base64",
      content: Buffer.from(JSON.stringify(obj)).toString("base64")
    })
  };
}

function decodePut(postData) {
  const body = JSON.parse(postData || "{}");
  return {
    body: body,
    json: JSON.parse(Buffer.from(body.content, "base64").toString("utf8"))
  };
}

async function mockGithub(page, onBags) {
  await page.route("https://api.github.com/**", async function (route) {
    const req = route.request();
    expect(req.url()).not.toContain(TOKEN.token);
    if (!req.url().includes("/repos/reddittitt/bgquick-storage/contents/bags.json")) {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    expect(req.headers().authorization).toBe("Bearer " + TOKEN.token);
    if (req.method() === "PUT") expect(req.postData() || "").not.toContain(TOKEN.token);
    await onBags(route, req);
  });
}

async function waitForBagSyncSettled(page) {
  await page.waitForFunction(function () {
    var state = document.documentElement.getAttribute("data-bag-sync");
    return state === "local" || state === "synced";
  });
}

test("a set link does nothing for a public visitor", async function ({ page }) {
  let writes = 0;
  page.on("request", function (req) {
    if (req.method() === "PUT") writes += 1;
  });
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big" } }));
  });
  await page.goto("/#/bags?big=azul,root&small=&free=wingspan");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("#bag-set-sheet")).toHaveCount(0);
  await expect(page.getByText("Replace Big bag")).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
  await expect(page.getByText("Small bag")).toHaveCount(0);
  await expect(page.getByText("Free carry")).toHaveCount(0);
  await expect(page.locator(".bag-add-input")).toHaveCount(0);
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags"));
  });
  expect(stored.games).toEqual({ wingspan: "big" });
  expect(await page.evaluate(function () {
    return document.documentElement.getAttribute("data-bag-sync");
  })).toBeNull();
  expect(writes).toBe(0);
  expect(page.url()).not.toContain(TOKEN.token);
});

test("set link confirms before replacing bags", async function ({ page }, testInfo) {
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { azul: "big", wingspan: "small" } }));
  });
  await page.goto("/#/");
  await page.goto("/#/bags?big=azul,root,missing-game&small=");
  const sheet = page.locator("#bag-set-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-bag-set-for="big"]')).toHaveText("Replace Big bag with these 2 games?");
  await expect(sheet.locator('[data-bag-set-bag="big"] [data-bag-set-found]')).toHaveText(["Azul", "Root"]);
  await expect(sheet.locator('[data-bag-set-missing="missing-game"]')).toContainText("not found");
  await expect(sheet.locator('[data-bag-set-missing="missing-game"]')).toContainText("missing-game");
  await expect(sheet.locator('[data-bag-set-for="small"]')).toHaveText("Replace Small bag with these 0 games?");
  await expect(sheet.getByText("The bag will be empty.")).toBeVisible();
  const before = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(before).toEqual({ azul: "big", wingspan: "small" });
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);
  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: dir + "/bags-set-sheet.png", animations: "disabled" });
  }

  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator("#bag-set-sheet")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/bags$/);
  expect(new URL(page.url()).hash).toBe("#/bags");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText(["Azul", "Root"]);
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--small")).toContainText("Nothing packed.");
  const after = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(after).toEqual({ azul: "big", root: "big" });
  expect(after["missing-game"]).toBeUndefined();

  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/bags$/);
  expect(new URL(page.url()).hash).toBe("#/bags");
  await expect(page.locator("#bag-set-sheet")).toHaveCount(0);
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("2 games");
});

test("set link cancel leaves both bags unchanged", async function ({ page }) {
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { azul: "big" } }));
  });
  await page.goto("/#/bags?small=wingspan");
  const sheet = page.locator("#bag-set-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-bag-set-for="small"]')).toHaveText("Replace Small bag with this 1 game?");
  await expect(sheet.locator('[data-bag-set-found="wingspan"]')).toHaveText("Wingspan");
  await expect(sheet.locator('[data-bag-set-for="big"]')).toHaveCount(0);
  const before = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(before).toEqual({ azul: "big" });

  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("#bag-set-sheet")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/bags$/);
  expect(new URL(page.url()).hash).toBe("#/bags");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Azul");
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");
  const after = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(after).toEqual({ azul: "big" });
});

test("a writable token syncs bags.json and shows Synced", async function ({ page }, testInfo) {
  const puts = [];
  await mockGithub(page, async function (route, req) {
    if (req.method() === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not Found" }) });
      return;
    }
    if (req.method() === "PUT") {
      const decoded = decodePut(req.postData());
      expect(decoded.body.message).toBe("Update bags");
      expect(decoded.body.sha).toBeUndefined();
      puts.push(decoded.json);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "sha-created" } })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await unlock(page);
  await page.goto("/#/game/wingspan");
  await waitForBagSyncSettled(page);
  expect(puts).toHaveLength(0);
  await pickBag(page, "Small bag");
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "synced";
  });
  expect(puts).toHaveLength(1);
  expect(puts[0].v).toBe(1);
  expect(puts[0].games.wingspan.bag).toBe("small");
  expect(page.url()).not.toContain(TOKEN.token);
  await page.locator("header a.header-bags").click();
  await expect(page.locator("#bag-sync-note")).toHaveText("Synced. A game is in one location at a time.");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Wingspan");
  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.screenshot({ path: dir + "/bags-synced.png", animations: "disabled" });
  }
});

test("a read-only token keeps bags on this device", async function ({ page }) {
  let puts = 0;
  await mockGithub(page, async function (route, req) {
    if (req.method() === "GET") {
      await route.fulfill(bagFile({ v: 1, games: {} }, "sha-ro"));
      return;
    }
    if (req.method() === "PUT") {
      puts += 1;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "Resource not accessible by personal access token" })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await unlock(page);
  await page.goto("/#/game/azul");
  await waitForBagSyncSettled(page);
  expect(puts).toBe(0);
  const denied = page.waitForResponse(function (res) {
    return res.url().indexOf("/contents/bags.json") !== -1 && res.request().method() === "PUT" && res.status() === 403;
  });
  await pickBag(page, "Big bag");
  await denied;
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "local";
  });
  expect(puts).toBe(1);
  expect(await page.evaluate(function () {
    return document.documentElement.getAttribute("data-bag-sync");
  })).toBe("local");
  await page.locator("header a.header-bags").click();
  await expect(page.locator("#bag-sync-note")).toHaveText("On this device only. A game is in one location at a time.");
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags"));
  });
  expect(stored.games.azul).toBe("big");
  expect(page.url()).not.toContain(TOKEN.token);
});

test("a 409 on bags.json is retried and the newest change wins", async function ({ page }) {
  let gets = 0;
  const puts = [];
  await mockGithub(page, async function (route, req) {
    if (req.method() === "GET") {
      gets += 1;
      if (gets === 1) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not Found" }) });
        return;
      }
      if (gets === 2) {
        await route.fulfill(bagFile({ v: 1, games: { azul: { bag: "big", at: 5000 } } }, "sha-old"));
        return;
      }
      await route.fulfill(bagFile({
        v: 1,
        games: {
          azul: { bag: "small", at: 9999999999999 },
          root: { bag: "big", at: 9999999999999 }
        }
      }, "sha-new"));
      return;
    }
    if (req.method() === "PUT") {
      const decoded = decodePut(req.postData());
      puts.push({ sha: decoded.body.sha || "", json: decoded.json });
      if (puts.length === 1) {
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "Conflict" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "sha-written" } })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await unlock(page);
  await page.goto("/#/game/wingspan");
  await waitForBagSyncSettled(page);
  expect(gets).toBe(1);
  expect(puts).toHaveLength(0);
  await pickBag(page, "Small bag");
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "synced";
  });
  expect(gets).toBe(3);
  expect(puts).toHaveLength(2);
  expect(puts[0].sha).toBe("sha-old");
  expect(puts[1].sha).toBe("sha-new");
  expect(puts[1].json.games.wingspan.bag).toBe("small");
  expect(puts[1].json.games.wingspan.at).toBeLessThan(9999999999999);
  expect(puts[1].json.games.azul).toEqual({ bag: "small", at: 9999999999999 });
  expect(puts[1].json.games.root).toEqual({ bag: "big", at: 9999999999999 });
  expect(page.url()).not.toContain(TOKEN.token);
  await page.locator("header a.header-bags").click();
  await expect(page.locator("#bag-sync-note")).toHaveText("Synced. A game is in one location at a time.");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Root");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText(["Azul", "Wingspan"]);
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored).toEqual({ azul: "small", root: "big", wingspan: "small" });
});

test("another repository never calls GitHub for bags", async function ({ page }) {
  const hits = [];
  page.on("request", function (req) {
    if (req.url().indexOf("api.github.com") !== -1) hits.push(req.method() + " " + req.url());
  });
  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
    localStorage.setItem("bgqBags", JSON.stringify({ games: { azul: "big" } }));
  }, {
    owner: "someoneelse",
    repo: "not-storage",
    token: "bgq_test_token_not_a_real_secret_01"
  });
  await page.goto("/#/bags");
  await waitForBagSyncSettled(page);
  await expect(page.locator("#bag-sync-note")).toHaveText("On this device only. A game is in one location at a time.");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Azul");
  await page.locator(".bag-card--big").getByRole("button", { name: "Actions for Azul" }).click();
  await page.locator("#bag-move-sheet").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("0 games");
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "local";
  });
  expect(hits).toEqual([]);
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored.azul).toBeUndefined();
  expect(page.url()).not.toContain("bgq_test_token");
});

test("free carry is a third location and old bag data still loads", async function ({ page }) {
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big", azul: "small" } }));
  });
  await page.goto("/#/bags");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Azul");
  await expect(page.locator(".bag-card--free .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--free")).toContainText("Nothing carried.");

  await page.goto("/#/game/wingspan");
  await pickBag(page, "Free carry");
  await expect(page.locator("#bag-label")).toHaveText("Free carry");
  await expect(page.locator("#bag-label")).toHaveClass(/bag-label--free/);
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored).toEqual({ azul: "small", wingspan: "free" });

  await page.locator("header a.header-bags").click();
  await expect(page.locator(".bag-card--free a.bag-game-link")).toHaveText("Wingspan");
  await expect(page.locator(".bag-card--free .bag-count")).toHaveText("1 game");
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Azul");
  const colors = await page.evaluate(function () {
    return ["big", "small", "free"].map(function (id) {
      return getComputedStyle(document.querySelector(".bag-card--" + id)).borderLeftColor;
    });
  });
  expect(colors[2]).not.toBe(colors[0]);
  expect(colors[2]).not.toBe(colors[1]);
  expect(colors[0]).not.toBe(colors[1]);

  page.once("dialog", function (dialog) {
    expect(dialog.message()).toContain("Clear Free carry");
    return dialog.accept();
  });
  await page.locator(".bag-card--free").getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".bag-card--free .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Azul");
});

test("typing a game name adds it and moves it when it is already packed", async function ({ page }) {
  await unlock(page);
  await page.goto("/#/bags");
  const bigInput = page.locator("#bag-add-big");
  const fontSize = await bigInput.evaluate(function (el) {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(fontSize).toBeGreaterThanOrEqual(16);
  await bigInput.fill("air, land & sea");
  const air = page.locator("#bag-add-list-big").getByRole("option", { name: "Air, Land & Sea: Critters at War" });
  await expect(air).toBeVisible();
  await air.click();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Air, Land & Sea: Critters at War");
  await expect(page.locator("#bag-add-big")).toHaveValue("");

  await page.locator("#bag-add-small").fill("BRASS: birmingham");
  await page.locator("#bag-add-list-small").getByRole("option", { name: "Brass: Birmingham", exact: true }).click();
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Brass: Birmingham");

  await page.locator("#bag-add-big").fill("brass birmingham");
  await page.locator("#bag-add-list-big").getByRole("option", { name: "Brass: Birmingham", exact: true }).click();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText([
    "Air, Land & Sea: Critters at War",
    "Brass: Birmingham"
  ]);
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored["brass-birmingham"]).toBe("big");
  expect(stored["air-land-and-sea-critters-at-war"]).toBe("big");
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(false);
});

test("swiping a row removes with undo or moves to another location", async function ({ page }) {
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big", azul: "small", root: "free" } }));
  });
  await page.goto("/#/bags");
  const bigRow = page.locator(".bag-card--big .bag-swipe");
  await expect(bigRow).toBeVisible();
  const touch = await bigRow.evaluate(function (el) {
    return {
      row: getComputedStyle(el).touchAction,
      link: getComputedStyle(el.querySelector("a")).touchAction
    };
  });
  expect(touch.row).toBe("pan-y");
  expect(touch.link).toBe("pan-y");

  await bigRow.locator("a").click();
  await expect(page).toHaveURL(/\/game\/wingspan/);
  await page.locator("header a.header-bags").click();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");

  const row = page.locator(".bag-card--big .bag-swipe");
  const box = await row.boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 36, box.y + box.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");

  await swipeRow(row, "left");
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("0 games");
  await expect(page.locator("#bag-toast")).toContainText("Removed Wingspan");
  await page.locator("#bag-toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");
  await expect(page.locator("#bag-toast")).toHaveCount(0);

  await swipeRow(page.locator(".bag-card--small .bag-swipe"), "right");
  const sheet = page.locator("#bag-move-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Big bag", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Free carry", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Small bag", exact: true })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Free carry", exact: true }).click();
  await expect(page.locator(".bag-card--free a.bag-game-link")).toHaveText(["Azul", "Root"]);
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored).toEqual({ azul: "free", root: "free", wingspan: "big" });

  const held = page.locator(".bag-card--big .bag-swipe");
  const heldBox = await held.boundingBox();
  await page.mouse.move(heldBox.x + 40, heldBox.y + heldBox.height / 2);
  await page.mouse.down();
  await expect(page.locator("#bag-move-sheet")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("#bag-move-sheet").getByRole("button", { name: "Remove", exact: true })).toBeVisible();
  await page.locator("#bag-move-sheet").getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("#bag-move-sheet")).toHaveCount(0);
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");
});

test("swipe reveal shows the action and a short drag does nothing", async function ({ page }, testInfo) {
  const live = [];
  page.on("request", function (req) {
    const url = req.url();
    if (url.indexOf("script.google.com") !== -1 || url.indexOf("script.googleusercontent.com") !== -1 || /\/exec(\?|$)/.test(url)) {
      live.push(req.method() + " " + url);
    }
  });
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({
      games: { "air-land-and-sea-critters-at-war": "big", azul: "small", root: "free" }
    }));
  });
  await page.goto("/#/bags");
  const row = page.locator(".bag-card--big .bag-swipe");
  const game = page.locator(".bag-card--big .bag-game");
  const gameName = "Air, Land & Sea: Critters at War";
  await expect(row).toBeVisible();
  await expect(row.locator("a")).toHaveText(gameName);
  await expect(game.locator(".bag-swipe-reveal")).toHaveCount(2);

  async function bandState(selector) {
    return game.locator(selector).evaluate(function (el) {
      var style = getComputedStyle(el);
      var gameBox = el.parentElement.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var label = el.querySelector(".bag-swipe-label");
      var labelBox = label ? label.getBoundingClientRect() : null;
      var icon = el.querySelector(".bag-swipe-icon");
      var iconStyle = icon ? getComputedStyle(icon) : null;
      return {
        text: el.textContent || "",
        bg: style.backgroundColor,
        color: style.color,
        visibility: style.visibility,
        width: Math.round(box.width),
        leftGap: Math.round(box.left - gameBox.left),
        rightGap: Math.round(gameBox.right - box.right),
        labelInside: !labelBox || (labelBox.left >= box.left - 1 && labelBox.right <= box.right + 1),
        svg: el.querySelector("svg") ? el.querySelector("svg").outerHTML : "",
        iconTransform: iconStyle ? iconStyle.transform : "",
        iconOutline: iconStyle ? iconStyle.outlineWidth : ""
      };
    });
  }

  const shortLeft = await holdSwipe(row, "left", 36);
  await expect(game).toHaveClass(/bag-game--swipe-left/);
  await expect(game).not.toHaveClass(/bag-game--swipe-commit/);
  await expect(game).not.toHaveClass(/bag-game--swipe-right/);
  let remove = await bandState(".bag-swipe-reveal--remove");
  let move = await bandState(".bag-swipe-reveal--move");
  expect(remove.visibility).toBe("visible");
  expect(move.visibility).toBe("hidden");
  expect(remove.text).toContain("Remove");
  expect(remove.svg).toContain("<svg");
  expect(remove.svg).not.toMatch(/https?:/);
  expect(rgbOf(remove.bg)).toBe("rgb(137,77,77)");
  expect(rgbOf(remove.color)).toBe("rgb(255,255,255)");
  expect(remove.rightGap).toBeLessThanOrEqual(2);
  expect(remove.leftGap).toBeGreaterThan(40);
  expect(remove.width).toBeGreaterThan(20);
  expect(remove.width).toBeLessThan(56);
  await shortLeft.page.mouse.up();
  await expect(game).not.toHaveClass(/bag-game--swipe-left/);
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText(gameName);
  await expect(page.locator("#bag-toast")).toHaveCount(0);
  await expect(page.locator("#bag-move-sheet")).toHaveCount(0);

  const shortRight = await holdSwipe(row, "right", 36);
  await expect(game).toHaveClass(/bag-game--swipe-right/);
  await expect(game).not.toHaveClass(/bag-game--swipe-commit/);
  await expect(game).not.toHaveClass(/bag-game--swipe-left/);
  move = await bandState(".bag-swipe-reveal--move");
  remove = await bandState(".bag-swipe-reveal--remove");
  expect(move.visibility).toBe("visible");
  expect(remove.visibility).toBe("hidden");
  expect(move.text).toContain("Move");
  expect(move.svg).toContain("<svg");
  expect(move.svg).not.toMatch(/https?:/);
  expect(rgbOf(move.bg)).toBe("rgb(58,95,143)");
  expect(rgbOf(move.color)).toBe("rgb(255,255,255)");
  expect(move.leftGap).toBeLessThanOrEqual(2);
  expect(move.rightGap).toBeGreaterThan(40);
  expect(move.width).toBeGreaterThan(20);
  expect(move.width).toBeLessThan(56);
  await shortRight.page.mouse.up();
  await expect(game).not.toHaveClass(/bag-game--swipe-right/);
  await expect(page.locator("#bag-move-sheet")).toHaveCount(0);
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText(gameName);

  const fullLeft = await holdSwipe(row, "left", 120);
  await expect(game).toHaveClass(/bag-game--swipe-commit/);
  await expect(game).toHaveClass(/bag-game--swipe-left/);
  remove = await bandState(".bag-swipe-reveal--remove");
  expect(rgbOf(remove.bg)).toBe("rgb(185,28,28)");
  expect(remove.labelInside).toBe(true);
  expect(remove.iconTransform).not.toBe("none");
  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: dir + "/bags_swipe_remove_phone.png", animations: "disabled" });
  }
  await releaseShort(fullLeft, "left");
  await expect(game).not.toHaveClass(/bag-game--swipe-left/);
  await expect(page.locator("#bag-toast")).toHaveCount(0);
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText(gameName);

  const fullRight = await holdSwipe(row, "right", 120);
  await expect(game).toHaveClass(/bag-game--swipe-commit/);
  await expect(game).toHaveClass(/bag-game--swipe-right/);
  move = await bandState(".bag-swipe-reveal--move");
  expect(rgbOf(move.bg)).toBe("rgb(29,78,216)");
  expect(move.labelInside).toBe(true);
  expect(move.iconTransform).not.toBe("none");
  if (testInfo.project.name === "phone") {
    const dir = "/opt/cursor/artifacts";
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: dir + "/bags_swipe_move_phone.png", animations: "disabled" });
  }
  await releaseShort(fullRight, "right");
  await expect(page.locator("#bag-move-sheet")).toHaveCount(0);
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText(gameName);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(function () {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  const reduced = await holdSwipe(row, "left", 90);
  await expect(game).toHaveClass(/bag-game--swipe-commit/);
  remove = await bandState(".bag-swipe-reveal--remove");
  expect(rgbOf(remove.bg)).toBe("rgb(185,28,28)");
  expect(rgbOf(remove.color)).toBe("rgb(255,255,255)");
  expect(remove.iconTransform === "none" || remove.iconTransform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  expect(parseFloat(remove.iconOutline)).toBeGreaterThanOrEqual(2);
  await releaseShort(reduced, "left");
  await expect(page.locator("#bag-toast")).toHaveCount(0);

  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored).toEqual({
    "air-land-and-sea-critters-at-war": "big",
    azul: "small",
    root: "free"
  });
  expect(live).toEqual([]);
});

test("a set link can replace free carry", async function ({ page }) {
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({
      games: { azul: "big", wingspan: "small", root: "free" }
    }));
  });
  await page.goto("/#/bags?big=azul&free=azul,wingspan");
  const sheet = page.locator("#bag-set-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-bag-set-for="free"]')).toHaveText("Replace Free carry with these 2 games?");
  await expect(sheet.locator('[data-bag-set-bag="free"] [data-bag-set-found]')).toHaveText(["Azul", "Wingspan"]);
  await expect(sheet.locator('[data-bag-set-for="big"]')).toHaveText("Replace Big bag with these 0 games?");
  await expect(sheet.getByText("The bag will be empty.")).toBeVisible();
  await expect(sheet.locator('[data-bag-set-for="small"]')).toHaveCount(0);
  const before = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(before).toEqual({ azul: "big", wingspan: "small", root: "free" });
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/#\/bags$/);
  expect(new URL(page.url()).hash).toBe("#/bags");
  await expect(page.locator(".bag-card--free a.bag-game-link")).toHaveText(["Azul", "Wingspan"]);
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("0 games");
  await expect(page.locator(".bag-card--small .bag-count")).toHaveText("0 games");
  const stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem("bgqBags")).games;
  });
  expect(stored).toEqual({ azul: "free", wingspan: "free" });

  await page.goto("/#/bags?free=");
  await expect(page.locator('[data-bag-set-for="free"]')).toHaveText("Replace Free carry with these 0 games?");
  await expect(page.getByText("Nothing will be carried.")).toBeVisible();
  await page.locator("#bag-set-sheet").getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(".bag-card--free .bag-count")).toHaveText("0 games");
  await expect(page).toHaveURL(/#\/bags$/);
});

test("free carry syncs through bags.json and old files still merge", async function ({ page }) {
  const puts = [];
  await mockGithub(page, async function (route, req) {
    if (req.method() === "GET") {
      await route.fulfill(bagFile({
        v: 1,
        games: {
          azul: { bag: "small", at: 40 },
          catan: "free"
        }
      }, "sha-free"));
      return;
    }
    if (req.method() === "PUT") {
      puts.push(decodePut(req.postData()).json);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "sha-free-next" } })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await unlock(page);
  await page.addInitScript(function () {
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big" } }));
  });
  await page.goto("/#/bags");
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "synced";
  });
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");
  await expect(page.locator(".bag-card--small a.bag-game-link")).toHaveText("Azul");
  await expect(page.locator(".bag-card--free a.bag-game-link")).toHaveText("Catan");
  await page.goto("/#/game/root");
  await pickBag(page, "Free carry");
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "synced";
  });
  const last = puts[puts.length - 1];
  expect(last.v).toBe(1);
  expect(last.games.root.bag).toBe("free");
  expect(last.games.wingspan.bag).toBe("big");
  expect(last.games.azul.bag).toBe("small");
  expect(last.games.catan.bag).toBe("free");
  expect(page.url()).not.toContain(TOKEN.token);
});
