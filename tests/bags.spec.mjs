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
  await page.goto("/#/bags?big=azul,root&small=");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("#bag-set-sheet")).toHaveCount(0);
  await expect(page.getByText("Replace Big bag")).toHaveCount(0);
  await expect(page.getByText("Big bag")).toHaveCount(0);
  await expect(page.getByText("Small bag")).toHaveCount(0);
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
  await page.locator("#bag-pack").getByRole("button", { name: "Small bag" }).click();
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "synced";
  });
  expect(puts).toHaveLength(1);
  expect(puts[0].v).toBe(1);
  expect(puts[0].games.wingspan.bag).toBe("small");
  expect(page.url()).not.toContain(TOKEN.token);
  await page.locator("header a.header-bags").click();
  await expect(page.locator("#bag-sync-note")).toHaveText("Synced. A game is in one bag at a time.");
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
  await page.locator("#bag-pack").getByRole("button", { name: "Big bag" }).click();
  await denied;
  await page.waitForFunction(function () {
    return document.documentElement.getAttribute("data-bag-sync") === "local";
  });
  expect(puts).toBe(1);
  expect(await page.evaluate(function () {
    return document.documentElement.getAttribute("data-bag-sync");
  })).toBe("local");
  await page.locator("header a.header-bags").click();
  await expect(page.locator("#bag-sync-note")).toHaveText("On this device only. A game is in one bag at a time.");
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
  await page.locator("#bag-pack").getByRole("button", { name: "Small bag" }).click();
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
  await expect(page.locator("#bag-sync-note")).toHaveText("Synced. A game is in one bag at a time.");
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
  await expect(page.locator("#bag-sync-note")).toHaveText("On this device only. A game is in one bag at a time.");
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Azul");
  await page.locator(".bag-card--big").getByRole("button", { name: "Remove Azul" }).click();
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
