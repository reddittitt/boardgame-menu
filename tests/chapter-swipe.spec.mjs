import { expect, test } from "@playwright/test";

async function blockLiveWrites(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function drag(page, locator, dx, dy) {
  await locator.evaluate(function (el) {
    var header = document.querySelector("header");
    var pager = document.getElementById("chapter-pager");
    var top = (header ? header.offsetHeight : 0) + (pager && !pager.hidden ? pager.offsetHeight : 0) + 28;
    var y = el.getBoundingClientRect().top + window.scrollY - top;
    window.scrollTo(0, Math.max(0, y));
  });
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing drag target");
  const view = page.viewportSize() || { width: 1280, height: 800 };
  const travel = Math.min(Math.abs(dx), view.width - 40);
  const visibleLeft = Math.max(box.x, 12);
  const visibleRight = Math.min(box.x + box.width, view.width - 12);
  const startX = dx < 0 ? visibleRight - 8 : visibleLeft + 8;
  const y = Math.min(Math.max(box.y + 24, 80), view.height - 40);
  const endX = Math.max(8, Math.min(view.width - 8, dx < 0 ? startX - travel : startX + travel));
  const endY = Math.max(8, Math.min(view.height - 8, y + dy));
  const hit = await page.evaluate(function (point) {
    var el = document.elementFromPoint(point.x, point.y);
    return el ? el.className + " " + (el.id || "") : "";
  }, { x: startX, y: y });
  if (/chapter-dot|chapter-pager|pc-btn|exp-chip/.test(String(hit))) {
    throw new Error("drag started on " + hit);
  }
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 16 });
  await page.mouse.up();
}

function currentChapter(page) {
  return page.locator("#chapter-pager [aria-current='true']");
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

test("swipe and dots move between the chapters that have text", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await expect(page.locator("#chapter-pager")).toBeVisible();
  await expect(page.locator("#chapter-pager .chapter-dot")).toHaveCount(3);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");
  await expect(page.locator("#setup-chapter")).toBeVisible();
  await expect(page.locator("#turn-chapter")).toBeHidden();
  await expect(page.locator("#end-chapter")).toBeHidden();

  await drag(page, page.locator("#setup-chapter .rule-body"), -180, 8);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "On your turn");
  await expect(page.locator("#turn-chapter")).toBeVisible();
  await expect(page.locator("#setup-chapter")).toBeHidden();
  await expect(page.locator("#chapter-deck")).toHaveAttribute("data-chapter-dir", "next");

  await drag(page, page.locator("#turn-chapter .rule-body"), 180, 4);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");

  await page.locator('#chapter-pager [aria-label="End of the game"]').click();
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "End of the game");
  await expect(page.locator("#end-chapter")).toBeVisible();
  await expect(page.locator("#turn-chapter")).toBeHidden();
});

test("an empty chapter is left out of the pager", async function ({ page }) {
  await page.goto("/?fixture=swipe-gap#/game/swipe-gap");
  await expect(page.locator("h2.title")).toHaveText("Swipe Gap");
  await expect(page.locator("#turn-chapter")).toBeHidden();
  await expect(page.locator("#chapter-pager .chapter-dot")).toHaveCount(2);
  await expect(page.locator('#chapter-pager [aria-label="On your turn"]')).toHaveCount(0);
  await drag(page, page.locator("#setup-chapter .rule-body"), -160, 0);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "End of the game");
  await expect(page.locator("#end-chapter")).toBeVisible();
});

test("vertical scroll, chips, the rulebook, and bag rows keep their own gestures", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");
  const before = await page.evaluate(function () { return window.scrollY; });
  await page.mouse.wheel(0, 480);
  await expect.poll(function () { return page.evaluate(function () { return window.scrollY; }); }).toBeGreaterThan(before + 40);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");

  await page.evaluate(function () { window.scrollTo(0, 0); });
  await drag(page, page.locator("#setup-chapter .rule-body"), 8, 160);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");

  const chip = page.locator(".pc-btn").first();
  await chip.scrollIntoViewIfNeeded();
  const chipBox = await chip.boundingBox();
  await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(chipBox.x + chipBox.width / 2 - 140, chipBox.y + chipBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");

  await page.getByRole("link", { name: "Rulebook", exact: true }).click();
  await expect(page.locator("#rulebook-viewer")).toBeVisible();
  await drag(page, page.locator("#rulebook-viewer"), -180, 0);
  await expect(page.locator("#rulebook-viewer")).toBeVisible();
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "Set up");
  await page.locator("#rulebook-viewer-close").click();
  await expect(page.locator("#rulebook-viewer")).toBeHidden();

  await page.addInitScript(function (saved) {
    localStorage.setItem("bgqStorage", JSON.stringify(saved));
    localStorage.setItem("bgqBags", JSON.stringify({ games: { wingspan: "big" } }));
  }, {
    owner: "reddittitt",
    repo: "bgquick-storage",
    token: "bgq_test_token_not_a_real_secret_01"
  });
  await page.goto("/#/bags");
  const row = page.locator(".bag-card--big .bag-swipe");
  await expect(row).toBeVisible();
  await expect(page.locator("#chapter-pager")).toHaveCount(0);
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45 - 140, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("#bag-toast")).toContainText("Removed Wingspan");
  await expect(page.locator(".bag-card--big .bag-count")).toHaveText("0 games");
});

test("reduced motion still changes chapter without a slide", async function ({ page }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game/azul/");
  await drag(page, page.locator("#setup-chapter .rule-body"), -180, 0);
  await expect(currentChapter(page)).toHaveAttribute("aria-label", "On your turn");
  await expect(page.locator("#chapter-deck")).not.toHaveAttribute("data-chapter-dir", "next");
  const anim = await page.locator("#turn-chapter").evaluate(function (el) {
    return getComputedStyle(el).animationName;
  });
  expect(anim).toBe("none");
});
