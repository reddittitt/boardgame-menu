# Board Game Quick — architecture audit

Live site: [bgquick.com](http://bgquick.com/). This note is a snapshot of `main` plus the Brass: Birmingham sample in this branch. Counts below were taken from `index.html` before that sample edit, except where called out.

## How the site is built

One static GitHub Pages site. `CNAME` is `bgquick.com`. There is no build step.

`index.html` is the whole app:

- A `<script id="games-json" type="application/json">` blob holds the data.
- `names` is the collection list (105 titles). Order in the file does not matter; the grid sorts by name.
- `enrich` is a map keyed by slug. At load, each name is slugified and merged with `enrich[slug]`. Missing enrich becomes an empty shell, which is how several titles render as `players: "*"`.
- Four enrich keys are not in `names`, so they never appear: `forbidden-island`, `kingdomino-origins`, `radlands`, `the-two-towers-trick-taking-game`.

Slug rules, in `slugify`: lower case, strip `:'"`, turn `&` into `and`, everything else that is not `a-z0-9` becomes a single hyphen. `Brass: Birmingham` and `brass-birmingham` both become `brass-birmingham`.

### Fields the detail view actually reads

| Field | What the page does with it |
| --- | --- |
| `players`, `time`, `year` | Meta line. `weight` and `bggRating` / `bggRank` also render if they are numbers. Almost no game sets them. |
| `quickStart` | "Quick Set Up". Opens by default when non-empty. |
| `setupByPlayerCount` | Object keyed by count (`"2"`, `"3"`, `"4"`). Renders as buttons. If present, it replaces `playerCountSetup` on screen. Nothing used this field before the Brass sample. |
| `playerCountSetup` | Fallback paragraph when there is no `setupByPlayerCount`. |
| `startingResources`, `turnStructure`, `endGameScoring`, `commonMistakes`, `remindersText` | One collapsed `<details>` each. Newlines become `<br>`. |
| `rulesGlossary[]` | `{term, desc}`. Any non-empty array shows "Quick Rules Glossary", including the 104 games whose only entries are blank. |
| `components[]` | Optional bullet list. Unused. |
| `playerAids[]` | `{label, file}` left in the data for some games. The detail view does not render it. |
| `expansions[]` | `{name, quickStart, reminders, rulebook, youtube, bggId, cover}`. Cover and rulebook fall back to `covers/{game}--{expansion-slug}` and `rulebooks/{game}--{expansion-slug}.pdf`. |
| `bggId` | Cover links to `boardgamegeek.com/boardgame/{id}`. The BG Stats button targets `bgstats://…?gameId={id}`. |
| `youtube` | "How to Play Video". Omitted href if empty, but the button still renders. |
| `cover` / `coverUrl` | Explicit path, else `covers/{slug}.webp`. |
| `rulebook` | Explicit path or absolute URL, else `rulebooks/{slug}.pdf`. The click handler HEAD-checks same-origin PDFs and alerts if they are missing. |
| `themeColor` | Overrides `--accent` for that game. Unused. |

Personal notes are an always-visible box on each game. They auto-save in `localStorage` under `notes_` plus the slug, and they stay on that browser. There is no account. The last eight games viewed are also in `localStorage` only.

### Routing

- Grid links are `#/game/{slug}`. Those hash URLs render.
- `?game=` is the NFC-friendly entry the README advertises. Before this branch it did not paint. `location.replace("#/game/…")` keeps the query string, `render()` saw `?game=` on every pass, and the detail view never ran. The page stayed on the empty `<div id="app">`. This branch strips the query with `history.replaceState` and then renders. `Brass: Birmingham`, `brass-birmingham`, and mixed case all land on the same page.
- `?action=` is copied onto the hash. `renderDetail` accepts it and then ignores it. It does not open or scroll to a section.
- Share copies `location.href` after that replacement, so a shared link is the hash URL, not the original `?game=` URL.
- There is no path route. GitHub Pages will not serve `/g/brass-birmingham` until a real file or a `404.html` fallback exists.

### Assets

| Folder | Role |
| --- | --- |
| `covers/` | Box art. Default lookup is `{slug}.webp` only. |
| `rulebooks/` | PDFs. Default lookup is `{slug}.pdf`. |
| `player-aids/` | Two Moonrakers PDFs. The Heat entry points at `aids/heat-*.pdf`, which is not this folder. |
| `reminders/` | Empty except `.gitkeep`. The UI no longer reads it; reminders are the `remindersText` field. A `reminders` URL is still computed and unused. |

`sw.js` is registered and the file is not in the repo, so the console warning is expected and nothing is cached. There is no web manifest. The README still mentions `game-menu.html` and `.nojekyll`; neither is in the repo. Jekyll is harmless today because no file starts with `_`.

## What already fits a phone on the table

- Slugifying is forgiving of colons and spaces, so a tag can store the name printed on the box. The `?game=` handoff itself was broken (see Routing) and is fixed in this branch. Hash links from the grid already worked.
- The page is one file, so a tag that hits the network once can show setup without a second request, apart from the cover, fonts, and a PDF.
- Sections are collapsed `<details>`, which is the right shape for a refresh mid-game: open the one rule you forgot.
- Player-count buttons already exist. They were just waiting on data.
- The rulebook button fails softly when the PDF was never uploaded.
- Theme, recent games, and table notes survive a refresh.
- Search is instant because the catalog is local.

## Recommendations, in the order they help at the table

1. **Accuracy pass, one game at a time, from the rulebook you already host.** This is the highest-leverage work. About 43 of 105 titles have almost no setup text, and a lot of the text that does exist is generic ("core play is card selection"). Brass: Birmingham was the worst of the long entries: the reminders contradicted the Roxley rulebook on loans, overbuilding, pottery, and scoring. Do not regenerate the whole blob in one go. Spot-check each rewrite against that game's PDF the way this sample was checked.

2. **Sticky section jumps on the detail page.** Setup, player count, turn, scoring, mistakes, glossary. Five links under the title, stuck under the header. `?action=scoring` should open that `<details>` and scroll to it. The query param is already parsed.

3. **Short stable URLs for tags.** Keep `?game=` working. Add `/g/{slug}` via a tiny `404.html` that redirects to `/?game={slug}` (GitHub Pages serves `404.html` for unknown paths). Tags can then be `https://bgquick.com/g/brass-birmingham`. Do this before printing tags, so the printed URL never has to change.

4. **Make offline real, or stop registering a worker.** Add `sw.js` plus a manifest, and cache `index.html`, the logo, and the covers for games that were opened. Prefetch that game's PDF only after the first visit; the rulebooks are large (Brass is about 6.5 MB). A missing worker is worse than no registration, because it looks like offline was finished.

5. **Split data out of `index.html` only when editing hurts.** The file is ~180 KB. That is fine for GitHub Pages. It is awkward because a one-game edit is a noisy diff inside a 4,000-line HTML file, and `JSON.parse` of a hand-edited blob is one trailing comma away from a blank page. Next step, when a second rewrite lands: `data/games/{slug}.json` assembled by a small script into the same blob the page already parses. Do not rewrite the renderer to fetch 105 files.

6. **BGG collection sync as a checklist, not a scraper that overwrites text.** `codybumpus` should drive "which titles are missing" and "which `bggId` is wrong". It should not fill `quickStart`. Player counts, year, and BGG id are the fields worth syncing. Rules text stays hand-written. 41 titles have no `bggId`, so the cover badge says "No BGG link" and BG Stats has nothing to open.

7. **Asset report in CI or a one-shot script.** Today, roughly: 38 names have no cover file, Quacks has a `.jpg` while the fallback asks for `.webp`, 55 names have no matching PDF, and Heat's rulebook file is `heat-pedal-to-the-medal.pdf` while the entry asks for `heat-pedal-to-the-metal.pdf`. Heat's how-to link is `watch?v=XXXXX`, and the Heavy Rain link is `YYYYY`. Empty glossary pairs and empty player-aid rows should not render.

8. **BG Stats on a phone vs a laptop.** The button's `href` is the website, but the click handler always `preventDefault`s and navigates to `bgstats://`. On a phone with the app, that is what you want. In a desktop browser the click does nothing useful. Try the app scheme, and if it does not open, fall through to `https://bgstats.app/bgg/{id}`.

9. **Table-side polish, after the above.** Larger tap targets on `<summary>`, open Quick Set Up and Turn Structure by default, and a "back to top" after the glossary. The four themes can stay. Do not restyle the page as part of content work.

## Risks

- **One file, one parse.** A JSON error in any game blanks the whole site. There is no per-game isolation until the data is split.
- **Unreviewed rules text.** The long entries were not written from the books. Several shorter ones are the same paragraph with the nouns swapped. A tag on a box that opens the wrong explosion threshold, or the wrong loan rule, is worse than an empty section.
- **Rulebook PDFs.** They are served from this repo under publishers' copyright (the Brass book in-repo is marked Roxley, 2018, all rights reserved). This audit does not remove them. Before the site is public to anyone but the owner, confirm each PDF is one you have the right to host. Quick-reference paraphrases in `enrich` are a different, smaller problem than redistributing the books.
- **Placeholder links.** `XXXXX` / `YYYYY` YouTube ids and `aids/*.pdf` paths 404. The sample rewrite did not invent replacements for other games.
- **`innerHTML` for rules text.** A `<` in a future edit is HTML, not text. Keep rules as plain sentences, or escape on render when the data moves.

## Sample rewritten in this branch

**Brass: Birmingham** (`brass-birmingham`). Chosen because it had the most text on the site and that text disagreed with the rulebook in the repo. No other game record was edited.

Checked against `rulebooks/brass-birmingham.pdf`, with the publisher's living-rulebook note that the coal, iron, and beer supply does not run out. The how-to link was already Rodney Smith's Watch It Played teach (`Lzxf4tfq9as`), which Roxley links from the Brass product page, so it stayed. `bggId` `224517` was already right. Cover `covers/brass-birmingham.webp` and rulebook `rulebooks/brass-birmingham.pdf` were already the files the page looks up; both are now set explicitly. Published play time on the Roxley page is 60–120 minutes, replacing 90–150.

Deep link for a tag, today: `https://bgquick.com/?game=Brass:%20Birmingham` or `https://bgquick.com/#/game/brass-birmingham`.

The only code change outside that game's JSON is `normalizeIncoming`, so the `?game=` link above actually opens the page.
