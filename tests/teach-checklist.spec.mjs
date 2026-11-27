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
  await blockLive(page);
  page._live = live;
});

test.afterEach(async function ({ page }) {
  expect(page._live || []).toEqual([]);
});

test("teach steps tick, persist, and reset", async function ({ page }) {
  await page.goto("/game/7-wonders-duel/#/teach");
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  const ticks = page.locator("#teach-script .teach-tick");
  const total = await ticks.count();
  expect(total).toBeGreaterThan(1);
  await expect(page.locator("#teach-progress")).toHaveText("0/" + total + " taught");
  await ticks.nth(0).click();
  await ticks.nth(2).click();
  await expect(page.locator("#teach-progress")).toHaveText("2/" + total + " taught");
  await expect(ticks.nth(0)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("#teach-progress")).toHaveText("2/" + total + " taught");
  const stored = await page.evaluate(function () {
    return sessionStorage.getItem("bgq_teach_checks");
  });
  expect(stored).toContain("7-wonders-duel");
  await page.locator("#teach-reset").click();
  await expect(page.locator("#teach-progress")).toHaveText("0/" + total + " taught");
  await expect(page.locator("#teach-script .teach-tick[aria-pressed='true']")).toHaveCount(0);
});

test("phone screenshot of the teach checklist", async function ({ page }, testInfo) {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.goto("/game/7-wonders-duel/#/teach");
  const ticks = page.locator("#teach-script .teach-tick");
  await ticks.nth(0).click();
  const total = await ticks.count();
  await expect(page.locator("#teach-progress")).toHaveText("1/" + total + " taught");
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(".teach-page").screenshot({ path: dir + "/teach_checklist_phone.png" });
});

const PHONE_TEACH_PAGES = [
  ["/game/seti/#/teach", "teach_seti_phone.png"],
  ["/game/cartographers/#/teach", "teach_cartographers_phone.png"],
  ["/game/7-wonders-duel/#/teach", "teach_7_wonders_duel_phone.png"]
];

test("teach steps stay readable at phone width", async function ({ page }, testInfo) {
  await page.setViewportSize({ width: 390, height: 844 });
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < PHONE_TEACH_PAGES.length; i++) {
    const url = PHONE_TEACH_PAGES[i][0];
    const file = PHONE_TEACH_PAGES[i][1];
    await page.goto(url);
    await expect(page.locator("h2.title")).toHaveText("Teach it");
    await expect(page.locator("#teach-script .teach-step").first()).toBeVisible();
    const report = await page.evaluate(function () {
      var steps = Array.prototype.slice.call(document.querySelectorAll("#teach-script .teach-step"));
      var leads = Array.prototype.slice.call(document.querySelectorAll("#teach-script .rule-lead"));
      var badSteps = [];
      steps.forEach(function (step, index) {
        var kids = Array.prototype.slice.call(step.children);
        var tick = kids[0] && kids[0].classList.contains("teach-tick");
        var body = kids[1] && kids[1].classList.contains("teach-step-body");
        if (kids.length !== 2 || !tick || !body) {
          badSteps.push({ index: index, count: kids.length, tick: !!tick, body: !!body });
        }
      });
      var first = leads[0] ? leads[0].getBoundingClientRect() : null;
      var tallLeads = [];
      leads.forEach(function (lead, index) {
        var style = window.getComputedStyle(lead);
        var line = parseFloat(style.lineHeight);
        if (!line || line !== line) {
          var font = parseFloat(style.fontSize) || 16;
          line = font * 1.2;
        }
        var height = lead.getBoundingClientRect().height;
        if (height >= line * 2.5) {
          tallLeads.push({ index: index, text: lead.textContent, height: height, line: line });
        }
      });
      var view = document.documentElement.clientWidth;
      var sticking = 0;
      Array.prototype.forEach.call(document.querySelectorAll("#teach-script .teach-step, #teach-script .teach-step-body, #teach-script .rule-lead, #teach-script .rule-list, #teach-script .rulebook-ref"), function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && (rect.right > view + 1 || rect.left < -1)) sticking += 1;
      });
      return {
        steps: steps.length,
        badSteps: badSteps,
        firstText: first ? leads[0].textContent : "",
        firstWidth: first ? first.width : 0,
        tallLeads: tallLeads,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        sticking: sticking
      };
    });
    expect(report.steps, url).toBeGreaterThan(1);
    expect(report.badSteps, url).toEqual([]);
    // "Goal" is about 38px at the 16px phone size. 32px still rejects the crushed 11–14px column.
    expect(report.firstWidth, url + " " + report.firstText).toBeGreaterThanOrEqual(32);
    expect(report.tallLeads, url).toEqual([]);
    expect(report.docOverflow, url).toBeLessThanOrEqual(1);
    expect(report.bodyOverflow, url).toBeLessThanOrEqual(1);
    expect(report.sticking, url).toBe(0);
    if (testInfo.project.name === "phone") {
      await page.locator(".teach-page").screenshot({ path: dir + "/" + file });
    }
  }
});
