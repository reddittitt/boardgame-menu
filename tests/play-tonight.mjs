/* Ranking for What should we play? Packed games stay in front. */
import "../game-night.js";

const { tonightPicks } = globalThis.BGQuickNight;
const failures = [];
function assert(cond, message) {
  if (!cond) failures.push(message);
}

function zero() { return 0; }

const games = ["a", "b", "c", "d", "e", "f", "g"].map(function (slug) {
  return { slug: slug, name: slug };
});

const ranked = tonightPicks(games, { b: true, e: true }, zero);
assert(ranked.length === 5, "five picks when more fit");
assert(ranked[0].slug === "b" || ranked[0].slug === "e", "first is packed");
assert(ranked[1].slug === "b" || ranked[1].slug === "e", "second is packed");
assert(ranked[0].slug !== ranked[1].slug, "packed games are not repeated");
assert(ranked.slice(2).every(function (game) { return game.slug !== "b" && game.slug !== "e"; }), "unpacked follow packed");

const open = tonightPicks(games, {}, zero);
assert(open.length === 5, "five picks with no bags");
assert(open.every(function (game) { return games.some(function (item) { return item.slug === game.slug; }); }), "picks come from the list");

const short = tonightPicks(games.slice(0, 2), { a: true }, zero);
assert(short.length === 2, "fewer than five returns every match");
assert(short[0].slug === "a", "the only packed game is first");

const none = tonightPicks([], { a: true }, zero);
assert(none.length === 0, "nothing fits");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ok play tonight picks");
