import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const NAMES = {
  azul: "Azul",
  jaipur: "Jaipur",
  patchwork: "Patchwork",
  codenames: "Codenames",
  kingdomino: "Kingdomino"
};

async function openNight(page, hash) {
  await page.goto("/#" + (hash || "/night"));
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  await expect(page.locator("#gn-fit")).not.toHaveText("");
}

async function addGame(page, query, name) {
  await page.getByLabel("Add a game").fill(query);
  await page.getByRole("button", { name: "Add " + name, exact: true }).click();
}

function nominee(page, slug) {
  return page.locator('#gn-nominee-list [data-remove="' + slug + '"]');
}

test("entry points, tonight's context, and the shared link", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.locator("header")).toContainText("Game night");
  await page.getByRole("link", { name: "What should we play?" }).click();
  await expect(page).toHaveURL(/#\/night/);
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  await expect(page.locator("#gn-page")).not.toContainText("reddittitt");
  await expect(page.locator("#gn-page")).toContainText("there is no server");

  const searchSize = await page.getByLabel("Add a game").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(searchSize).toBeGreaterThanOrEqual(16);
  const chip = page.getByRole("button", { name: "4 players", exact: true });
  const chipBox = await chip.boundingBox();
  expect(chipBox.height).toBeGreaterThanOrEqual(44);
  await chip.click();
  const paint = await chip.evaluate((el) => {
    const before = getComputedStyle(el, "::before");
    return {
      text: el.textContent,
      color: getComputedStyle(el).color,
      background: before.backgroundColor,
      content: before.content
    };
  });
  expect(paint.text).toBe("4");
  expect(paint.color).toBe("rgb(255, 255, 255)");
  expect(paint.background).toContain("0, 122, 255");
  expect(String(paint.content)).not.toMatch(/✓|✔|check/i);

  await page.getByRole("button", { name: "30 to 60 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Kids present: yes", exact: true }).click();
  await expect(page.locator("#gn-kids-note")).toHaveText(
    "No minimum age is stored for these games, and BoardGameGeek minimum ages are not in this catalog, so Kids present does not hide any games."
  );
  const withKids = await page.locator("#gn-fit").innerText();
  await page.getByRole("button", { name: "Kids present: no", exact: true }).click();
  await expect(page.locator("#gn-kids-note")).toBeHidden();
  await expect(page.locator("#gn-fit")).toHaveText(withKids);

  await page.getByRole("button", { name: "Weight from Light", exact: true }).click();
  await page.getByRole("button", { name: "Weight up to Light", exact: true }).click();
  await expect(page.locator("#gn-weight-summary")).toHaveText("Light");
  await page.getByLabel("Add a game").fill("john company");
  await expect(page.locator("#gn-results").getByRole("button", { name: "Add John Company: Second Edition" })).toBeVisible();
  await expect(page.locator("#gn-results li", { hasText: "John Company: Second Edition" })).toContainText("Outside tonight");
  await page.getByLabel("Add a game").fill("azul");
  const azulRow = page.locator("#gn-results li").filter({
    has: page.getByRole("button", { name: "Add Azul", exact: true })
  });
  await expect(azulRow).toBeVisible();
  await expect(azulRow).not.toContainText("Outside tonight");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto("/#/game/azul");
  await expect(page.locator("h2.title")).toHaveText("Azul");
  await page.locator("header").getByRole("link", { name: "Game night" }).click();
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
});

test("nominating, suggest, poll text, and the shareable URL", async ({ page }) => {
  await openNight(page, "/night?players=4&time=30-60");
  await page.getByRole("button", { name: "Suggest some" }).click();
  const suggested = page.locator("#gn-nominee-list [data-remove]");
  const count = await suggested.count();
  expect(count).toBeGreaterThanOrEqual(4);
  expect(count).toBeLessThanOrEqual(8);
  const slugs = await suggested.evaluateAll((els) => els.map((el) => el.getAttribute("data-remove")));
  const fitting = await page.evaluate((list) => list.every((slug) => window.BGQuickNight.fitsGame(slug)), slugs);
  expect(fitting).toBe(true);
  await expect(page).toHaveURL(/games=/);

  await page.getByRole("button", { name: "Clear nominees" }).click();
  await expect(suggested).toHaveCount(0);
  await addGame(page, "azul", "Azul");
  await addGame(page, "jaipur", "Jaipur");
  await expect(nominee(page, "azul")).toHaveCount(1);
  await expect(nominee(page, "jaipur")).toHaveCount(1);
  await page.getByRole("button", { name: "Copy as poll" }).click();
  const poll = await page.locator("#gn-poll-out").evaluate((el) => el.textContent);
  expect(poll).toBe("Azul\nJaipur");
  expect(poll.split("\n")).toEqual(["Azul", "Jaipur"]);

  await page.getByRole("button", { name: "Copy link" }).click();
  const shared = await page.locator("#gn-share-url").innerText();
  expect(shared).toContain("#/night");
  expect(shared).toContain("azul");
  expect(shared).toContain("jaipur");
  expect(shared).toContain("players=4");

  await page.reload();
  await expect(nominee(page, "azul")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "4 players", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.locator("header").getByRole("link", { name: "Game night" }).click();
  await expect(nominee(page, "azul")).toHaveCount(1);

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.locator("#gn-nominee-list")).toContainText("No nominees yet");
  await expect(page).toHaveURL(/#\/night\/?$/);
});

test("a shared URL restores context and skips unknown games", async ({ page }) => {
  await openNight(page, "/night?players=4&time=30-60&kids=1&w0=light&w1=medium&games=azul,jaipur,not-a-real-game");
  await expect(page.getByRole("button", { name: "4 players", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "30 to 60 minutes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Kids present: yes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Weight from Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Weight up to Medium", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#gn-weight-summary")).toHaveText("Light to Medium");
  await expect(nominee(page, "azul")).toHaveCount(1);
  await expect(nominee(page, "jaipur")).toHaveCount(1);
  await expect(page.locator("#gn-dropped")).toHaveText("1 game in that link is not in the catalog.");
  await expect(page.locator("#gn-kids-note")).toContainText("does not hide any games");
});

test("kids present uses a stored minimum age and leaves unknown games in", async ({ page }) => {
  await page.goto("/?fixture=night-age#/night?players=4");
  await expect.poll(async () => {
    const input = page.getByLabel("Add a game");
    if (await input.count() !== 1) return 0;
    await input.fill("Night Teen");
    return page.getByRole("button", { name: "Add Night Teen Only" }).count();
  }).toBe(1);
  await page.getByLabel("Add a game").fill("");
  const before = Number((await page.locator("#gn-fit").innerText()).match(/(\d+)/)[1]);
  await page.getByRole("button", { name: "Kids present: yes", exact: true }).click();
  await expect(page.locator("#gn-kids-note")).toHaveText(
    "Games with a listed minimum age of 12 or older are hidden. Games with no age listed stay in the list."
  );
  const after = Number((await page.locator("#gn-fit").innerText()).match(/(\d+)/)[1]);
  expect(after).toBe(before - 1);
  await page.getByLabel("Add a game").fill("Night Teen");
  await expect(page.locator("#gn-results li", { hasText: "Night Teen Only" })).toContainText("Outside tonight");
  await page.getByLabel("Add a game").fill("Night Kid");
  await expect(page.locator("#gn-results li", { hasText: "Night Kid Ok" })).not.toContainText("Outside tonight");
});

test("quick pick links to the game and Teach it", async ({ page }) => {
  await openNight(page, "/night?players=2&time=30-60");
  await page.getByRole("button", { name: "Quick pick" }).click();
  const card = page.locator(".gn-result");
  await expect(card.locator("#gn-winner-name")).toBeVisible();
  const slug = await card.getAttribute("data-slug");
  expect(await page.evaluate((value) => window.BGQuickNight.fitsGame(value), slug)).toBe(true);
  await expect(card.getByRole("link", { name: "Game page" })).toHaveAttribute("href", "/game/" + slug + "/");
  await expect(card.getByRole("link", { name: "Teach it" })).toHaveAttribute("href", "/game/" + slug + "/#/teach");
  const title = await card.locator("#gn-winner-name").innerText();
  await card.getByRole("link", { name: "Teach it" }).click();
  await expect(page.locator("h2.title")).toHaveText("Teach it");
  await expect(page.locator(".byline")).toHaveText(title);
});

test("spin the wheel is fair, can re-spin, and can drop the winner", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openNight(page, "/night?games=azul");
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.locator("#gn-panel")).toContainText("at least two nominees");

  await openNight(page, "/night?games=azul,jaipur,codenames");
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.locator("#gn-wheel-status")).toContainText("same chance");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  const first = await page.locator("#gn-wheel-wrap").getAttribute("data-winner");
  expect(["azul", "jaipur", "codenames"]).toContain(first);
  await expect(page.locator("#gn-winner-name")).toHaveText(NAMES[first]);
  await expect(page.locator(".gn-result").getByRole("link", { name: "Teach it" })).toHaveAttribute("href", "/game/" + first + "/#/teach");
  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-spinning", "false");

  await page.getByRole("button", { name: "Spin again", exact: true }).click();
  const second = await page.locator("#gn-wheel-wrap").getAttribute("data-winner");
  expect(["azul", "jaipur", "codenames"]).toContain(second);

  await page.getByRole("button", { name: "Remove winner and spin again" }).click();
  await expect(nominee(page, second)).toHaveCount(0);
  const left = await page.locator("#gn-nominee-list [data-remove]").evaluateAll((els) => els.map((el) => el.getAttribute("data-remove")));
  expect(left).toHaveLength(2);
  const third = await page.locator("#gn-wheel-wrap").getAttribute("data-winner");
  expect(left).toContain(third);
});

test("the wheel animates when motion is allowed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one animation pass");
  await openNight(page, "/night?games=azul,jaipur,codenames");
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-spinning", "true");
  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-spinning", "false", { timeout: 8000 });
  const winner = await page.locator("#gn-wheel-wrap").getAttribute("data-winner");
  expect(["azul", "jaipur", "codenames"]).toContain(winner);
  await expect(page.locator("#gn-winner-name")).toHaveText(NAMES[winner]);
});

test("pass-the-phone vote hides ballots and uses a Borda count", async ({ page }) => {
  await openNight(page, "/night?players=2&games=azul,patchwork");
  await page.getByRole("button", { name: "Pass-the-phone vote" }).click();
  await expect(page.locator("#gn-panel")).toContainText("Ties break on first-place votes");
  await expect(page.locator("#gn-voter-count")).toHaveText("2");
  await page.getByRole("button", { name: "Start vote" }).click();
  const cover = page.locator("#gn-cover");
  await expect(cover).toBeVisible();
  await expect(cover).toContainText("Player 1");
  await expect(cover).not.toContainText("Azul");
  await page.getByRole("button", { name: "Player 1 is ready" }).click();
  await page.getByRole("button", { name: "Rank Azul" }).click();
  await page.getByRole("button", { name: "Rank Patchwork" }).click();
  await page.getByRole("button", { name: "Submit ranking" }).click();
  await expect(page.locator("#gn-ballot")).toHaveCount(0);
  await expect(page.locator("#gn-cover")).toBeVisible();
  await expect(page.locator("#gn-cover")).not.toContainText("Azul");
  await expect(page.locator("#gn-cover")).toContainText("Player 2");
  await page.getByRole("button", { name: "Player 2 is ready" }).click();
  await page.getByRole("button", { name: "Rank Azul" }).click();
  await page.getByRole("button", { name: "Rank Patchwork" }).click();
  await page.getByRole("button", { name: "Submit ranking" }).click();
  await expect(page.locator("#gn-winner-name")).toHaveText("Azul");
  await expect(page.locator(".gn-result").getByRole("link", { name: "Game page" })).toHaveAttribute("href", "/game/azul/");
  await expect(page.locator(".gn-result").getByRole("link", { name: "Teach it" })).toHaveAttribute("href", "/game/azul/#/teach");
  await expect(page.locator(".gn-tally")).toContainText("Azul");

  await page.getByRole("button", { name: "Decide another way" }).click();
  await page.getByRole("button", { name: "Pass-the-phone vote" }).click();
  await page.getByRole("button", { name: "Top 3 points" }).click();
  await page.getByRole("button", { name: "Start vote" }).click();
  await page.getByRole("button", { name: "Player 1 is ready" }).click();
  await page.locator(".gn-slot").filter({ hasText: "3 points" }).getByRole("button", { name: "Azul", exact: true }).click();
  await page.getByRole("button", { name: "Submit points" }).click();
  await page.getByRole("button", { name: "Player 2 is ready" }).click();
  await page.locator(".gn-slot").filter({ hasText: "3 points" }).getByRole("button", { name: "Azul", exact: true }).click();
  await page.getByRole("button", { name: "Submit points" }).click();
  await expect(page.locator("#gn-winner-name")).toHaveText("Azul");
});

test("veto rounds strike games until one remains", async ({ page }) => {
  await openNight(page, "/night?players=2&games=azul,jaipur,codenames");
  await page.getByRole("button", { name: "Veto rounds" }).click();
  await expect(page.locator("#gn-turn")).toHaveText("Player 1 strikes one game.");
  await page.getByRole("button", { name: "Strike Jaipur" }).click();
  await expect(page.locator("#gn-turn")).toHaveText("Player 2 strikes one game.");
  await expect(page.getByRole("button", { name: "Strike Jaipur" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo last strike" }).click();
  await expect(page.getByRole("button", { name: "Strike Jaipur" })).toBeVisible();
  await page.getByRole("button", { name: "Strike Jaipur" }).click();
  await page.getByRole("button", { name: "Strike Codenames" }).click();
  await expect(page.locator("#gn-winner-name")).toHaveText("Azul");
  await expect(page.locator(".gn-why")).toContainText("vetoes");
  await expect(page.locator(".gn-result").getByRole("link", { name: "Teach it" })).toHaveAttribute("href", "/game/azul/#/teach");
});

test("bracket plays head to head until a winner", async ({ page }) => {
  await openNight(page, "/night?games=azul,jaipur,codenames");
  await page.getByRole("button", { name: "Bracket" }).click();
  await expect(page.locator("#gn-panel")).toContainText("bye");
  await page.locator("#gn-panel .gn-choice").first().click();
  await expect(page.locator("#gn-panel")).toContainText("Final");
  await page.locator("#gn-panel .gn-choice").first().click();
  const name = await page.locator("#gn-winner-name").innerText();
  expect(["Azul", "Jaipur", "Codenames"]).toContain(name);
  const slug = await page.locator(".gn-result").getAttribute("data-slug");
  await expect(page.locator(".gn-result").getByRole("link", { name: "Game page" })).toHaveAttribute("href", "/game/" + slug + "/");
  await expect(page.locator(".gn-result").getByRole("link", { name: "Teach it" })).toHaveAttribute("href", "/game/" + slug + "/#/teach");
  await expect(page.locator(".gn-why")).toContainText("bracket");
});

test("picker math stays fair", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one math pass");
  await openNight(page, "/night");
  const result = await page.evaluate(() => {
    const N = window.BGQuickNight;
    const problems = [];
    function check(cond, message) {
      if (!cond) problems.push(message);
    }
    check(N.suggestCount(0) === 0, "suggest 0");
    check(N.suggestCount(3, function () { return 0; }) === 3, "suggest 3");
    check(N.suggestCount(10, function () { return 0; }) === 4, "suggest min");
    check(N.suggestCount(10, function () { return 4; }) === 8, "suggest max");
    check(N.pollText(["Azul", "Jaipur"]) === "Azul\nJaipur", "poll");
    check(N.recordedMinAge({ weight: 2, year: 2018 }) === null, "no invented age");
    check(N.recordedMinAge({ bggMinAge: "8" }) === 8, "bgg age");
    check(N.kidsAllows({ minAge: 14 }, true, false) === true, "no ages in catalog");
    check(N.kidsAllows({ minAge: 14 }, true, true) === false, "hide 14");
    check(N.kidsAllows({ minAge: 8 }, true, true) === true, "keep 8");
    const sorted = N.sortByLongestSincePlayed([
      { slug: "new", name: "New", bggPlays: { lastPlayed: "2026-11-01" } },
      { slug: "old", name: "Old", bggPlays: { lastPlayed: "2020-01-01" } },
      { slug: "never", name: "Never" }
    ]).map(function (game) { return game.slug; });
    check(sorted.join(",") === "never,old,new", "longest since played " + sorted.join(","));
    const untouched = N.sortByLongestSincePlayed([
      { slug: "a", name: "A" },
      { slug: "b", name: "B" }
    ]).map(function (game) { return game.slug; });
    check(untouched.join(",") === "a,b", "sort hook is idle without plays");
    const points = N.bordaWinner([
      { scores: { a: 2, b: 1 }, places: { a: 1, b: 2 } },
      { scores: { a: 2, b: 1 }, places: { a: 1, b: 2 } }
    ], ["a", "b"], function () { return 0; });
    check(points.slug === "a" && !points.note, "higher total");
    const firsts = N.bordaWinner([
      { scores: { a: 4, b: 2 }, places: { a: 1, b: 2 } },
      { scores: { a: 0, b: 2 }, places: { b: 2 } }
    ], ["a", "b"], function () { return 0; });
    check(firsts.slug === "a" && /first-place/.test(firsts.note), "first place tie break");
    const seconds = N.bordaWinner([
      { scores: { a: 4, b: 4 }, places: { a: 2, b: 2 } },
      { scores: { a: 4, b: 4 }, places: { a: 2, b: 3 } }
    ], ["a", "b"], function () { return 0; });
    check(seconds.slug === "a" && /second-place/.test(seconds.note), "second place tie break");
    let aWins = 0;
    let bWins = 0;
    for (let i = 0; i < 200; i += 1) {
      const tied = N.bordaWinner([
        { scores: { a: 1, b: 1 }, places: { a: 1, b: 2 } },
        { scores: { a: 1, b: 1 }, places: { a: 2, b: 1 } }
      ], ["a", "b"]);
      check(tied.randomTie === true, "random tie flag");
      if (tied.slug === "a") aWins += 1;
      else bWins += 1;
    }
    check(aWins > 40 && bWins > 40, "random tie split " + aWins + " " + bWins);
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 800; i += 1) buckets[N.randomIndex(8)] += 1;
    check(buckets.every(function (n) { return n > 40; }), "wheel fairness " + buckets.join(","));
    function center(index, n) { return -90 + (index + 0.5) * (360 / n); }
    [2, 3, 4, 8].forEach(function (n) {
      for (let index = 0; index < n; index += 1) {
        const rot = N.landingRotation(index, n, -20, index % 2 ? 0 : 5);
        const mod = (((center(index, n) + rot) % 360) + 360) % 360;
        const diff = Math.min(Math.abs(mod - 270), 360 - Math.abs(mod - 270));
        check(diff < 0.001, "landing " + n + " " + index);
      }
    });
    return problems;
  });
  expect(result).toEqual([]);
});

test("everyone picks a weighted wheel and can pass the list by link", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  async function shot(name) {
    if (testInfo.project.name !== "phone") return;
    await page.screenshot({ path: path.join(dir, name + ".png") });
  }

  await openNight(page, "/night");
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await page.getByRole("button", { name: "Everyone picks" }).click();
  const nameSize = await page.locator("#gn-player-name").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(nameSize).toBeGreaterThanOrEqual(16);
  await expect(page.getByRole("button", { name: "2 picks", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator("#gn-player-name").fill("Sam");
  await page.getByRole("button", { name: "Add name" }).click();
  await page.locator("#gn-player-name").fill("Jo");
  await page.getByRole("button", { name: "Add name" }).click();
  await page.locator("#gn-panel").scrollIntoViewIfNeeded();
  await shot("game-night-phone-everyone-names");
  await page.getByRole("button", { name: "Start passing the phone" }).click();
  await expect(page.locator("#gn-cover")).toContainText("Sam");
  await expect(page.locator("#gn-cover")).not.toContainText("Azul");
  await page.getByRole("button", { name: "Sam is ready" }).click();
  const sheet = page.locator("#gn-pick-sheet");
  await sheet.locator("#gn-pick-search").fill("azul");
  await sheet.getByRole("button", { name: "Pick Azul", exact: true }).click();
  await shot("game-night-phone-everyone-pick");
  await sheet.locator("#gn-pick-search").fill("jaipur");
  await sheet.getByRole("button", { name: "Pick Jaipur", exact: true }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#gn-cover")).toContainText("Jo");
  await expect(page.locator("#gn-cover")).not.toContainText("Azul");
  await shot("game-night-phone-everyone-pass");
  await page.getByRole("button", { name: "Jo is ready" }).click();
  await sheet.locator("#gn-pick-search").fill("azul");
  await sheet.getByRole("button", { name: "Pick Azul", exact: true }).click();
  await sheet.locator("#gn-pick-search").fill("codenames");
  await sheet.getByRole("button", { name: "Pick Codenames", exact: true }).click();
  await sheet.getByRole("button", { name: "Done" }).click();

  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-weights", "2,1,1");
  await expect(page.locator("#gn-dup")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#gn-nominee-list")).toContainText("Picked by Sam, Jo");
  const shared = decodeURIComponent(page.url());
  expect(shared).toContain("Sam");
  expect(shared).toContain("Jo");
  expect(shared).toContain("azul");
  await page.locator("#gn-wheel-wrap").scrollIntoViewIfNeeded();
  await shot("game-night-phone-everyone-wheel");

  await page.getByRole("button", { name: "Duplicates count extra" }).click();
  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-weights", "1,1,1");
  await page.getByRole("button", { name: "Duplicates count extra" }).click();
  await expect(page.locator("#gn-wheel-wrap")).toHaveAttribute("data-weights", "2,1,1");

  await page.getByRole("button", { name: "Spin", exact: true }).click();
  const winner = await page.locator("#gn-wheel-wrap").getAttribute("data-winner");
  expect(["azul", "jaipur", "codenames"]).toContain(winner);
  await expect(page.locator("#gn-winner-name")).toBeVisible();

  const href = page.url();
  await page.reload();
  await expect(page.locator("#gn-nominee-list")).toContainText("Picked by Sam, Jo");
  await page.goto(href);
  await page.getByRole("button", { name: "Veto rounds" }).click();
  await expect(page.getByRole("button", { name: "Strike Azul" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Strike Jaipur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Strike Codenames" })).toBeVisible();

  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await page.getByRole("button", { name: "Add my picks" }).click();
  await page.locator("#gn-player-name").fill("Alex");
  await page.getByRole("button", { name: "Next" }).click();
  await sheet.locator("#gn-pick-search").fill("patchwork");
  await sheet.getByRole("button", { name: "Pick Patchwork", exact: true }).click();
  await sheet.locator("#gn-pick-search").fill("kingdomino");
  await sheet.getByRole("button", { name: "Pick Kingdomino", exact: true }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#gn-nominee-list")).toContainText("Picked by Alex");
  expect(decodeURIComponent(page.url())).toContain("Alex");
  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem("bgq_night_names") || "[]"));
  expect(remembered).toEqual(expect.arrayContaining(["Sam", "Jo", "Alex"]));
});

test("phone screenshots of each mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone screenshots only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dir = "/opt/cursor/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  async function shot(name) {
    await page.screenshot({ path: path.join(dir, name + ".png") });
  }
  await openNight(page, "/night?players=4&time=60-120&kids=1&games=azul,jaipur,codenames,kingdomino");
  await shot("game-night-phone-context");
  await page.locator("#gn-nominee-list").scrollIntoViewIfNeeded();
  await shot("game-night-phone-nominees");

  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.locator("#gn-winner-name")).toBeVisible();
  await page.locator("#gn-wheel-wrap").scrollIntoViewIfNeeded();
  await shot("game-night-phone-wheel");

  await openNight(page, "/night?players=4&games=azul,jaipur,codenames,kingdomino");
  await page.getByRole("button", { name: "Pass-the-phone vote" }).click();
  await page.getByRole("button", { name: "Start vote" }).click();
  await page.getByRole("button", { name: "Player 1 is ready" }).click();
  await page.getByRole("button", { name: "Rank Azul" }).click();
  await page.locator("#gn-ballot").scrollIntoViewIfNeeded();
  await shot("game-night-phone-vote");
  for (const name of ["Jaipur", "Codenames", "Kingdomino"]) {
    await page.getByRole("button", { name: "Rank " + name }).click();
  }
  await page.getByRole("button", { name: "Submit ranking" }).click();
  await expect(page.locator("#gn-cover")).toBeVisible();
  await shot("game-night-phone-pass");

  await openNight(page, "/night?players=4&games=azul,jaipur,codenames,kingdomino");
  await page.getByRole("button", { name: "Veto rounds" }).click();
  await page.locator("#gn-panel").scrollIntoViewIfNeeded();
  await shot("game-night-phone-veto");

  await openNight(page, "/night?players=4&games=azul,jaipur,codenames,kingdomino");
  await page.getByRole("button", { name: "Bracket" }).click();
  await page.locator("#gn-panel").scrollIntoViewIfNeeded();
  await shot("game-night-phone-bracket");

  await openNight(page, "/night?players=4&time=30-60");
  await page.getByRole("button", { name: "Quick pick" }).click();
  await expect(page.locator("#gn-winner-name")).toBeVisible();
  await page.locator(".gn-result").scrollIntoViewIfNeeded();
  await shot("game-night-phone-quick");
});

test("game night works offline and the worker still skips other origins", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one offline pass");
  await page.goto("/#/night?players=4");
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  const swText = await page.evaluate(async () => {
    const res = await fetch("./sw.js");
    return res.text();
  });
  expect(swText).toContain("url.origin !== self.location.origin");
  expect(swText.indexOf("url.origin !== self.location.origin")).toBeLessThan(swText.indexOf("respondWith"));
  expect(swText).toContain('VERSION = "2026.11.21.2"');

  await page.waitForFunction(async () => {
    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) return false;
    const cache = await caches.open("bgquick-shell-2026.11.21.2");
    const keys = await cache.keys();
    const urls = keys.map((req) => req.url);
    return urls.some((url) => /index\.html/.test(url)) && urls.some((url) => /game-night\.js/.test(url));
  });

  await context.setOffline(true);
  const cross = await page.evaluate(async () => {
    try {
      const res = await fetch("https://example.com/bgquick-probe");
      const text = await res.text();
      return { failed: false, status: res.status, looksLikeApp: text.includes("Board Game Quick") };
    } catch (err) {
      return { failed: true, name: err.name };
    }
  });
  expect(cross.failed).toBe(true);

  await page.goto("/#/night?players=4&time=30-60");
  await expect(page.locator("h2.title")).toHaveText("What should we play?");
  await page.getByRole("button", { name: "Suggest some" }).click();
  const count = await page.locator("#gn-nominee-list [data-remove]").count();
  expect(count).toBeGreaterThanOrEqual(4);
  expect(count).toBeLessThanOrEqual(8);
  await page.getByRole("button", { name: "Quick pick" }).click();
  await expect(page.locator("#gn-winner-name")).toBeVisible();
  await expect(page.locator(".gn-result").getByRole("link", { name: "Teach it" })).toBeVisible();
});
