# Board Game Quick — architecture audit

Live site: [bgquick.com](http://bgquick.com/). The sections under "How the site is built" are the original snapshot. The catalog on `main` is now 177 titles. Pass 7 is the current rules pass.

## Pass 7

Forty-two games were rewritten or filled from a named source. Notes are paraphrases. Nothing was copied wholesale. A line at the end of each scoring section names the source. Where a number was only a diagram, or the text layer did not say it, it was left out.

Personal notes stay in `localStorage` under `notes_` plus the slug. The detail view still does not render player aids.

### Checked against a rulebook already in this repo

These pages had short AI bullets, or an empty scoring section. Each one now follows the PDF in `rulebooks/`.

- Acquire. Avalon Hill / Hasbro, ©2023, Renegade edition. Opening cash is $6,000. A chain of 11 is safe. The end may be declared at 41 tiles or when every chain is safe. The 2-player button is the stock-market stockholder.
- Archduke, Backgammon, Brink, Century: Golem Edition, Cover Your Assets, Five Crowns, Forest Shuffle, Graft, Jaipur, Monopoly Deal, Moonrollers, New York Zoo, Patchwork, Pillars of Fate, Play Nine, Raccoon Tycoon, Rook, Sail, Scales of Fate, Sky Team, Sniper Elite, Tend, Time to Panic, Turing Machine, Wandering Towers, Watergate.
- For Sale. The old page said to remove the highest or lowest properties. This booklet removes unseen cards: 6 property and 6 currency at 3 players, 2 of each at 4, and none at 5 or 6. Starting cash is two $2,000 coins plus fourteen $1,000 coins at 3–4 players, and ten $1,000 coins at 5–6.
- Sequence. This sheet deals 7, 6, 6, 5, 4, 4, 3, and 3 cards at 2, 3, 4, 6, 8, 9, 10, and 12 players. It prints no hand size for 5, 7, or 11. Two sides need two sequences. Three sides need one. One-eyed jacks remove a chip. Two-eyed jacks place one.
- The Fellowship of the Ring Trick-Taking Game. The hosted file is `rulebooks/the-lord-of-the-rings-fellowship-of-the-ring-trick-taking-game.pdf`, and the Open Rulebook button now points at that file. "The Road Goes Ever On" is a mode in the same book and was not turned into an expansion chip.
- Dune: Imperium — Uprising. The main text is the 3- and 4-player game in the hosted book. One, two, and six players stay in the supplements. The CHOAM module is a toggle: setup, rules, and scoring.
- Project L. Player-count decks are the buttons, including solo. Ghost Piece and Finesse now have setup, rules, and scoring on the chips. The old chip text was a one-line reminder.

Play Nine's position bonuses (a vertical pair scores 0, then −10, −15, and −20 for two, three, and four matched columns, with Hole-in-One cards excluded from that cancel) were read off a two-column page. The sentences are in the text layer. Card-by-card tables in the other books were not copied.

### Filled from a publisher or designer file that is not in the repo

The Open Rulebook button is the publisher or designer URL. No new PDF was added to the repo.

- Can't Stop. Eagle-Gryphon links a Google Drive folder as the English rulebook. The file is `CSrulesv15`, 23 June 2021, © FRED Distribution 2021. Three claimed columns win. The optional longer game is 4 columns at 3 players and 5 at 2.
- Celestia. BLAM! `Celestia_EN_1_2_7.pdf`, from the publisher product page. Deal 8 cards at 2–3 players and 6 at 4–6. The game ends at 50 points at the start of a journey.
- Ticket to Ride: First Journey (U.S.). Days of Wonder USA Map English rules, ©2004–2018, confirmed by the cities Seattle, San Francisco, Los Angeles, New York, Washington, and Miami. Twenty trains, 4 train cards, 2 tickets. Six completed tickets win at once. The Europe First Journey file on the same page was not used.
- Earth. Inside Up `Earth Rulebook Web.pdf`, from the Drive folder opened by the publisher's "Download the Rulebook" button. A 4 by 4 island. The player who plants the 16th card takes 7 VP, and the round finishes.
- Arcs. Base Game Rulebook, 23 March 2026, on the designer's resources page. The campaign book was not used. Power ends the game at 33, 30, or 27 for 2, 3, or 4 players. Cards 1 and 7 are only in the 4-player deck.
- Sagrada. Floodgate FGG-SA201. Dice in the bag are 50, 70, and 90. Each round rolls 5, 7, or 9, which is two per player plus one. Solo rolls 4 and scores empty spaces at −3.
- Catan. CATAN GmbH CN3081, v6.250401, ©2025, the base 3–4 player book. The 5–6 player book was not used. A settlement is 1, a city is 2, Longest Route is 2, Largest Army is 2, and each of the 5 Victory Point cards is 1. Building costs are drawings on the aid and were not copied. The 3-player button leaves out the white pieces.
- Burgle Bros. Fowers does not host an English PDF. The paraphrase is the Skellig Games German edition 1 booklet. Patrol decks drop 9, 6, 3, or 0 cards at 1, 2, 3, and 4 players. Three stealth each. Win by opening every safe and reaching the roof with the loot.
- Burgle Bros 2. The English booklet dated 3 Sep 2020 hosted by Skellig, which credits Tim Fowers. Loss at 6 heat. Two-player setup removes a Saleswoman chip.
- Oath. The Law of Oath, 20 October 2020, hosted by the designer. Leder's resources page, as fetched, did not list a newer file. Favor banks change at 5 and at 6. Later errata were not folded in. Playing time is not in that Law.

### Not changed

- Brass: Birmingham, and the expansion chips already audited on Wingspan, Quacks, Ark Nova, PARKS, and Everdell.
- Survive: The Island. The hosted PDF's text layer contradicts itself on rafts, and early pages are missing glyphs. The old page was left in place.
- Image-only PDFs: Scout, Ravine, Chronicles of Crime, Pan Am, Air, Land & Sea: Critters at War, Shallow Regrets. Wingspan was already read from the page images in an earlier pass, and its player-count diagram is still not a button.
- Burgle Bros 3. The Fowers page is an FAQ, not a full rulebook.
- Shells with no stable publisher file opened this pass, including Pandemic, Flip 7, Camel Up, Tiny Towns, Hive Pocket, Onitama, Azul Duel, Welcome to the Moon, Castle Combo, Bomb Busters, Trio, Ra: The Dice Game, 7 Wonders Dice, and The Lord of the Rings: Duel for Middle-earth.
- 7 Wonders Duel, including Pantheon scoring. The PDF in the repo is still the 1jour-1jeu file, and a Repos original was not retrieved.
- Raccoon Tycoon's Fat Cat chip, and the three Wandering Towers mini-spell rows. They are still named, and they still have no rules text.
- The BoardGameGeek owned-collection sync. `xmlapi2` now answers 401 with `WWW-Authenticate: Bearer realm="xml api"`. The public collection page is behind Cloudflare. The Geekdo user record for `codybumpus` (userid 4022222) is readable and does not include the owned list. No titles were added or removed.

### Still thin

Anything not in the rewritten list above, and not in an earlier pass, is still a shell or an old bullet page. That includes the image-only games, Burgle Bros 3, and the shells named in "Not changed."

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
