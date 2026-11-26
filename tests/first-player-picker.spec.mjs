import { expect, test } from "@playwright/test";
import fs from "fs";

test.use({ serviceWorkers: "block" });

async function blockLive(page) {
  await page.route("**/*script.google.com/**", function (route) { return route.abort(); });
  await page.route("**/*script.googleusercontent.com/**", function (route) { return route.abort(); });
}

test.beforeEach(async function ({ page }) {
  const live = [];
  page.on("request", function (req) {
    const url = req.url();
    if (/script\.google(usercontent)?\.com/i.test(url) || /\/exec(?:\?|$)/.test(url)) {
      live.push(req.method() + " " + url);
    }
  });
  await page.addInitScript(function () {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = function (array) {
      window.__bgqRandomCalls = (window.__bgqRandomCalls || 0) + 1;
      return orig(array);
    };
  });
  await blockLive(page);
  page._live = live;
});

test.afterEach(async function ({ page }) {
  expect(page._live || []).toEqual([]);
});

async function placeTaps(page) {
  const pad = page.locator("#first-player-pad");
  await pad.click({ position: { x: 48, y: 48 } });
  await pad.click({ position: { x: 140, y: 90 } });
  await pad.click({ position: { x: 220, y: 70 } });
  await expect(page.locator(".fp-finger")).toHaveCount(3);
}

test("desktop taps pick one player at random", async function ({ page }) {
  await page.goto("/#/");
  await page.locator("#play-tonight-open").click();
  await page.locator("#play-tonight-pick").click();
  await expect(page.locator("#first-player-picker")).toBeVisible();
  await expect(page.locator("#first-player-alt")).toBeHidden();
  await placeTaps(page);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  const calls = await page.evaluate(function () { return window.__bgqRandomCalls || 0; });
  expect(calls).toBeGreaterThan(0);
});

test("the game page offers the rule as an alternative", async function ({ page }) {
  await page.goto("/game/azul/");
  await expect(page.locator("#first-player-rule")).toContainText("Portugal");
  await page.locator("#first-player-open").click();
  await expect(page.locator("#first-player-alt")).toContainText("Or use the game's rule:");
  await expect(page.locator("#first-player-alt")).toContainText("Portugal");
  await placeTaps(page);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
});

test("several fingers on the screen can be the pick", async function ({ page }) {
  await page.goto("/game/wingspan/");
  await page.locator("#first-player-open").click();
  await page.locator("#first-player-pad").evaluate(function (pad) {
    function fire(type, id, x, y) {
      var box = pad.getBoundingClientRect();
      pad.dispatchEvent(new PointerEvent(type, {
        pointerId: id,
        clientX: box.left + x,
        clientY: box.top + y,
        pointerType: "touch",
        bubbles: true
      }));
    }
    fire("pointerdown", 4, 50, 60);
    fire("pointerdown", 5, 150, 100);
    fire("pointerdown", 6, 230, 80);
  });
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  await page.locator("#first-player-go").click();
  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
});

async function readScale(page) {
  return page.evaluate(function () {
    var viewport = window.visualViewport;
    return {
      scale: viewport ? viewport.scale : 1,
      width: document.documentElement.clientWidth
    };
  });
}

async function pressFingers(page, points) {
  const client = await page.context().newCDPSession(page);
  const active = [];
  for (let i = 0; i < points.length; i += 1) {
    active.push(points[i]);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: active.map(function (point) {
        return { x: point.x, y: point.y, id: point.id };
      })
    });
  }
  return {
    move: async function (next) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: next.map(function (point) {
          return { x: point.x, y: point.y, id: point.id };
        })
      });
    },
    cancel: async function () {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: active.map(function (point) {
          return { x: point.x, y: point.y, id: point.id };
        })
      });
    }
  };
}

test("three fingers on a phone pick a player without zooming", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone size only");
  await page.addInitScript(function () {
    window.__vibes = [];
    navigator.vibrate = function (ms) {
      window.__vibes.push(ms);
      return true;
    };
  });
  await page.goto("/game/azul/");
  await expect(page.locator("#first-player-rule")).toBeVisible();
  await page.locator("#first-player-open").click();
  const picker = page.locator("#first-player-picker");
  await expect(picker).toBeVisible();
  await expect(page.locator("#first-player-pad")).toHaveText("");

  const mounted = await page.evaluate(function () {
    const pickerEl = document.getElementById("first-player-picker");
    function read(el) {
      const style = getComputedStyle(el);
      return {
        userSelect: style.userSelect,
        webkitUserSelect: style.getPropertyValue("-webkit-user-select").trim(),
        touchAction: style.touchAction
      };
    }
    const box = pickerEl.getBoundingClientRect();
    return {
      parentIsBody: pickerEl.parentElement === document.body,
      width: box.width,
      height: box.height,
      innerWidth: window.visualViewport ? window.visualViewport.width : window.innerWidth,
      innerHeight: window.visualViewport ? window.visualViewport.height : window.innerHeight,
      picker: read(pickerEl),
      title: read(pickerEl.querySelector("h2")),
      help: read(pickerEl.querySelector(".fp-help")),
      button: read(pickerEl.querySelector("button")),
      pad: read(document.getElementById("first-player-pad"))
    };
  });
  expect(mounted.parentIsBody).toBe(true);
  expect(mounted.width).toBeGreaterThanOrEqual(mounted.innerWidth - 1);
  expect(mounted.height).toBeGreaterThanOrEqual(mounted.innerHeight - 1);
  ["picker", "title", "help", "button", "pad"].forEach(function (key) {
    expect(mounted[key].userSelect).toBe("none");
    expect(mounted[key].webkitUserSelect).toBe("none");
  });
  const calloutCss = await page.locator("style").evaluateAll(function (sheets) {
    return sheets.map(function (sheet) { return sheet.textContent || ""; }).join("\n");
  });
  expect(calloutCss).toContain(".fp-picker,\n  .fp-picker *");
  expect(calloutCss).toContain("-webkit-touch-callout:none");
  expect(mounted.pad.touchAction).toBe("none");
  expect(mounted.picker.touchAction).toBe("none");

  const blocked = await page.evaluate(function () {
    const pad = document.getElementById("first-player-pad");
    const pickerEl = document.getElementById("first-player-picker");
    const touch = new Touch({
      identifier: 41,
      target: pad,
      clientX: 48,
      clientY: 280,
      radiusX: 8,
      radiusY: 8,
      force: 1
    });
    const start = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch]
    });
    pad.dispatchEvent(start);
    const move = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch]
    });
    pad.dispatchEvent(move);
    const end = new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch]
    });
    pad.dispatchEvent(end);
    const gesture = new Event("gesturestart", { bubbles: true, cancelable: true });
    pickerEl.dispatchEvent(gesture);
    const change = new Event("gesturechange", { bubbles: true, cancelable: true });
    pickerEl.dispatchEvent(change);
    return {
      start: start.defaultPrevented,
      move: move.defaultPrevented,
      gesture: gesture.defaultPrevented,
      change: change.defaultPrevented,
      fingers: document.querySelectorAll(".fp-finger").length
    };
  });
  expect(blocked.start).toBe(true);
  expect(blocked.move).toBe(true);
  expect(blocked.gesture).toBe(true);
  expect(blocked.change).toBe(true);
  expect(blocked.fingers).toBe(0);

  const before = await readScale(page);
  const fingers = [
    { x: 80, y: 360, id: 1 },
    { x: 190, y: 500, id: 2 },
    { x: 300, y: 640, id: 3 }
  ];
  const touch = await pressFingers(page, fingers);
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  await touch.move([
    { x: 36, y: 260, id: 1 },
    { x: 190, y: 500, id: 2 },
    { x: 350, y: 720, id: 3 }
  ]);
  const after = await readScale(page);
  expect(after.scale).toBe(before.scale);
  expect(after.scale).toBe(1);
  expect(after.width).toBe(before.width);
  expect(await page.evaluate(function () {
    const sel = window.getSelection();
    return sel ? String(sel) : "";
  })).toBe("");

  await expect(page.locator(".fp-finger--winner")).toHaveCount(1);
  await expect(page.locator(".fp-finger")).toHaveCount(3);
  const winnerStyle = await page.locator(".fp-finger--winner").evaluate(function (el) {
    const style = getComputedStyle(el);
    return {
      userSelect: style.userSelect,
      webkitUserSelect: style.getPropertyValue("-webkit-user-select").trim()
    };
  });
  expect(winnerStyle.userSelect).toBe("none");
  expect(winnerStyle.webkitUserSelect).toBe("none");
  expect(await page.evaluate(function () { return window.__vibes.slice(); })).toEqual([10]);

  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await picker.screenshot({ path: dir + "/first_player_picker_phone.png" });
});
