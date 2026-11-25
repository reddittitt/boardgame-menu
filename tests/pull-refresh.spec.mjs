import { expect, test } from "@playwright/test";

async function blockLiveWrites(page) {
  await page.route("https://api.github.com/**", function (route) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

async function standalone(page) {
  await page.addInitScript(function () {
    var orig = window.matchMedia.bind(window);
    window.matchMedia = function (query) {
      if (String(query).indexOf("display-mode: standalone") !== -1) {
        return {
          matches: true,
          media: String(query),
          addListener: function () {},
          removeListener: function () {},
          addEventListener: function () {},
          removeEventListener: function () {},
          dispatchEvent: function () { return false; }
        };
      }
      return orig(query);
    };
  });
}

async function pull(page, dx, dy, release) {
  const view = page.viewportSize() || { width: 390, height: 844 };
  const x = Math.round(view.width / 2);
  const y = Math.min(view.height - 180, 460);
  await page.evaluate(function (gesture) {
    var target = document.elementFromPoint(gesture.x, gesture.y) || document.body;
    function fire(type, px, py, buttons) {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: "touch",
        clientX: px,
        clientY: py,
        button: 0,
        buttons: buttons
      }));
    }
    fire("pointerdown", gesture.x, gesture.y, 1);
    fire("pointermove", gesture.x + gesture.dx / 2, gesture.y + gesture.dy / 2, 1);
    fire("pointermove", gesture.x + gesture.dx, gesture.y + gesture.dy, 1);
    if (gesture.release) fire("pointerup", gesture.x + gesture.dx, gesture.y + gesture.dy, 0);
  }, { x: x, y: y, dx: dx, dy: dy, release: !!release });
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

test("the update toast says to tap to reload", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  const button = page.locator("#app-update-refresh");
  await expect(button).toHaveText("Updated, tap to reload");
  await expect(page.locator("#app-update")).toBeHidden();
  const box = await button.evaluate(function (el) {
    var style = getComputedStyle(el.parentElement);
    return { position: style.position, bottom: style.bottom };
  });
  expect(box.position).toBe("fixed");
  expect(box.bottom).not.toBe("auto");
  await page.evaluate(function () { window.__boot = "still-here"; });
  await page.evaluate(function () {
    var banner = document.getElementById("app-update");
    banner.hidden = false;
  });
  await button.click();
  await page.waitForFunction(function () { return window.__boot !== "still-here"; });
  await expect(page.locator("#search")).toBeVisible();
});

test("standalone pull at the top reloads, and other pulls do not", async function ({ page }) {
  await standalone(page);
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator("html")).toBeVisible();
  await page.evaluate(function () { window.__boot = "home"; });

  await pull(page, 160, 40, true);
  await expect(page.locator("#pull-refresh")).toBeHidden();
  expect(await page.evaluate(function () { return window.__boot; })).toBe("home");

  await page.mouse.wheel(0, 400);
  await expect.poll(function () { return page.evaluate(function () { return window.scrollY; }); }).toBeGreaterThan(40);
  await pull(page, 0, 140, true);
  await expect(page.locator("#pull-refresh")).toBeHidden();
  expect(await page.evaluate(function () { return window.__boot; })).toBe("home");

  await page.evaluate(function () { window.scrollTo(0, 0); });
  await pull(page, 0, 120, false);
  await expect(page.locator("#pull-refresh")).toHaveText("Release to refresh");
  await page.evaluate(function () {
    document.body.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "touch",
      button: 0,
      buttons: 0,
      clientX: 10,
      clientY: 10
    }));
  });
  await page.waitForFunction(function () { return window.__boot !== "home"; });
  await expect(page.locator("#search")).toBeVisible();
});

test("a browser tab does not pull to refresh", async function ({ page }) {
  await page.goto("/");
  await expect(page.locator("#search")).toBeVisible();
  await page.evaluate(function () { window.__boot = "tab"; });
  await pull(page, 0, 140, true);
  await expect(page.locator("#pull-refresh")).toBeHidden();
  expect(await page.evaluate(function () { return window.__boot; })).toBe("tab");
});

test("pull does not start on a bag row, a chip, or the rulebook", async function ({ page }) {
  await standalone(page);
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
  await page.evaluate(function () { window.__boot = "bags"; window.scrollTo(0, 0); });
  await row.evaluate(function (el) {
    var rect = el.getBoundingClientRect();
    var x = rect.left + 40;
    var y = rect.top + rect.height / 2;
    function fire(type, py, buttons) {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 8, pointerType: "touch",
        clientX: x, clientY: py, button: 0, buttons: buttons
      }));
    }
    fire("pointerdown", y, 1);
    fire("pointermove", y + 130, 1);
    fire("pointerup", y + 130, 0);
  });
  await expect(page.locator("#pull-refresh")).toBeHidden();
  await expect(page.locator(".bag-card--big a.bag-game-link")).toHaveText("Wingspan");
  expect(await page.evaluate(function () { return window.__boot; })).toBe("bags");

  await page.goto("/game/azul/");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await page.evaluate(function () { window.__boot = "azul"; window.scrollTo(0, 0); });
  const chip = page.locator("#table-bar .pc-btn").first();
  await expect(chip).toBeVisible();
  await chip.evaluate(function (el) {
    var rect = el.getBoundingClientRect();
    function fire(type, py, buttons) {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch",
        clientX: rect.left + rect.width / 2, clientY: py, button: 0, buttons: buttons
      }));
    }
    fire("pointerdown", rect.top + rect.height / 2, 1);
    fire("pointermove", rect.top + rect.height / 2 + 120, 1);
    fire("pointerup", rect.top + rect.height / 2 + 120, 0);
  });
  await expect(page.locator("#pull-refresh")).toBeHidden();
  await page.getByRole("link", { name: "Rulebook", exact: true }).click();
  await expect(page.locator("#rulebook-viewer")).toBeVisible();
  await page.locator("#rulebook-viewer").evaluate(function (el) {
    var rect = el.getBoundingClientRect();
    function fire(type, py, buttons) {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 10, pointerType: "touch",
        clientX: rect.left + 40, clientY: py, button: 0, buttons: buttons
      }));
    }
    fire("pointerdown", rect.top + 80, 1);
    fire("pointermove", rect.top + 210, 1);
    fire("pointerup", rect.top + 210, 0);
  });
  await expect(page.locator("#pull-refresh")).toBeHidden();
  await expect(page.locator("#rulebook-viewer")).toBeVisible();
  expect(await page.evaluate(function () { return window.__boot; })).toBe("azul");
});
