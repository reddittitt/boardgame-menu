# Expansion toggles

The detail view can add an expansion on top of the base game. Nothing is selected when the page opens, and the base text stays as written.

## What the player sees

If a game's `expansions` list has at least one named entry with text, a link, or a player aid, the page shows toggle chips in the chip row. The chips match the player-count buttons. A player can turn on more than one. The row scrolls away with the page.

Eight or more chips sit in one disclosure labeled Expansions. The summary shows how many are inside, or the selected names once any are on. Root is the exception to that single disclosure: the shared Hirelings chip and the four hireling packs (Homeland, Marauder, Riverfolk, and Underworld) are nested in a Hirelings disclosure. The box expansions, decks, Landmarks Pack, and Vagabond Pack stay beside it. Those hireling packs are different products and are not removed.

There is no Expansions list at the bottom of the page. Turning a chip on merges that expansion into the sections below. Turning every chip off removes those additions.

| Chip field | Also accepted | Where it shows |
| --- | --- | --- |
| `setup` | `quickStart`, shown once when the two values are the same | Set up |
| `rules` | `reminders`, shown once when the two values are the same | On your turn, under Reminders |
| `scoring` | — | End of the game, under Scoring |
| `teachingScript` | — | Teach it. A count map follows the player-count button. |
| `playerAids` | — | Player aids |
| `rulebook`, `youtube`, `bggId`, `cover` | — | On your turn, under the expansion name |
| Any other non-empty field | — | On your turn, as **Expansion rules: &lt;name&gt;** |

`scoring` is not copied from `reminders`. An expansion with only a reminder changes the Reminders block inside On your turn, and Set up, and leaves scoring alone. The field shapes are in `docs/CONTENT-FORMAT.md`.

## Record shape

Add one object per expansion on the parent game. Do not add a separate menu row for a box that is only a toggle.

```json
{
  "name": "Oceania Expansion",
  "bggId": "300580",
  "setup": "Replace the food dice and player mats.\nEach player gains 1 nectar.",
  "rules": "Nectar is wild when paying to play a bird.",
  "scoring": "Most spent nectar in a habitat scores 5.",
  "quickStart": "Replace the food dice and player mats.\nEach player gains 1 nectar.",
  "reminders": "Nectar is wild when paying to play a bird.",
  "rulebook": "wingspan--oceania-expansion",
  "youtube": "",
  "cover": "covers/wingspan--oceania-expansion.webp"
}
```

`setup` / `rules` / `scoring` are the fields the chips read. Copy `setup` into `quickStart` and `rules` into `reminders` when you want the same words stored under both names. The page shows that pair once.

`rulebook` is optional. A full `https://` URL opens directly. A slug is loaded from `rulebooks/{slug}.pdf`. Leave it off when there is no legal free PDF. The hosted rulebooks in this repo are publisher files only.

`bggId` is the expansion's own BoardGameGeek thing id, not the base game's id.

## Games filled in this pass

Chips with real setup and scoring text are on:

- Wingspan: Europe, Oceania, Asia, Americas
- The Quacks of Quedlinburg: The Herb Witches, The Alchemists
- Heat: Pedal to the Metal: Heavy Rain, Tunnel Vision, Rocky Roads
- Ark Nova: Marine Worlds
- PARKS: Nightfall, Wildlife
- Everdell: Bellfaire, Pearlbrook, Spirecrest, Newleaf, Mistwood

Base-game rules on those pages were not rewritten. Brass: Birmingham was not given expansion chips.

Other games that already had an `expansions` list (7 Wonders Duel, and the rest) still show chips, because the old `quickStart` / `reminders` text counts as a delta. They do not yet have a `scoring` field, so their chips change setup and reminders only.

## Games filled in the rules pass

Chips with setup, reminders, and scoring, taken from the publisher booklets:

- Root: Riverfolk Expansion (Lizard Cult and Riverfolk Company), Underworld Expansion, Marauder Expansion, Homeland Expansion, Exiles and Partisans Deck, Squires and Disciples Deck, Landmarks Pack, Hirelings, Vagabond Pack. Hireling abilities stay on the hireling cards. Vagabond Pack characters stay on their cards. Lilypad and Twilight setup stays on the faction boards.
- 7 Wonders (2010): Armada and Leaders now have scoring. Cities is unchanged and still has no scoring field. Cities was not in the owned-expansion snapshot used for this pass.
- 7 Wonders (Second Edition): Edifice and Armada. The Armada text is the Repos EN02 booklet. A separate Second Edition Armada booklet was not used. Edifice pawn counts are the printed table in that booklet, not restated here.

`setupByPlayerCount` was added for Root, both 7 Wonders editions, Ark Nova, PARKS, Everdell, The Quacks of Quedlinburg, and The Crew: The Quest for Planet Nine. Brass: Birmingham was not edited. Wingspan's player-count diagram did not extract as text, so it was left alone. Heat's hosted PDF is the advanced booklet, and the base track setup was not rewritten.

## Games filled in the sourced-rules pass

Shells rewritten from a named free publisher booklet, plus the Cities chip and the Heat base page:

- 7 Wonders (2010) Cities: setup, reminders, and scoring from the Repos Cities EN02 booklet. Starting coins stay at 3. The old chip said 6 coins and that debt is paid at the end of the Age. Both of those were wrong. Armada and Leaders were not rewritten.
- Hanabi: R&R Games rules sheet, 2013. Hands are 5 cards at 2–3 players and 4 at 4–5. The multicolor suit stays in the variants.
- Splendor Duel: Space Cowboys English rulebook, 2022.
- Lost Cities: Thames & Kosmos 691821, the sixth-expedition edition.
- Point Salad: Alderac base-game rulebook. The buttons are how many of each veggie stay in the deck.
- Cryptid: Osprey rulebook, 2018. The separate two-player sheet is not restated.
- Cartographers: Thunderworks rulebook linked from the product page. Solo is the 1-player button. The sixteen scoring cards are one line each.
- Flamecraft: Cardboard Alchemy English PDF linked from cardboardalchemy.com. Two players remove 12 artisan dragons. Three players remove 6. Solo is the 1-player button. The achievement grid is not copied.
- Targi: Thames & Kosmos 691479.
- The Fox in the Forest: Foxtrot Games rulebook linked from foxtrotgames.com.
- Heat: Pedal to the Metal base text now follows the Days of Wonder basic booklet (“read this first”). The Open Rulebook button points at that PDF. The file in `rulebooks/` is the advanced booklet and is no longer the button target. Heavy Rain, Tunnel Vision, and Rocky Roads were not rewritten. Adrenaline is one last car at 2–4 players and the two last cars at 5–6.

## Still deferred

Left alone because there was no clean official free source, or the source did not yield a number that should be published:

- Can't Stop. It is not public domain. No publisher-hosted free booklet was found.
- Ticket to Ride: First Journey (U.S.). The Days of Wonder file that looked like a First Journey booklet is a different game. The guessed U.S. URL returned an HTML placeholder. Europe rules were not copied onto the U.S. page.
- Wingspan `setupByPlayerCount`. The local PDF is image-only. The birdfeeder dice diagram did not read cleanly. The base page and the expansion chips were not changed.
- Root hireling abilities and the individual Vagabond Pack characters. They stay on the cards. Lilypad and Twilight stay on the faction boards.
- 7 Wonders Manneken Pis, Great Wall, Agora, and the other promos. They are not in the owned expansion lists. Duel Pantheon still has no scoring field. Cities was not added to Second Edition.
- Ark Nova and PARKS solo modes.
- Flamecraft's full achievement grid, and Heat's advanced modules beyond the chips already on the page.

## Games filled in the second sourced-rules pass

Shells and two thin pages, each from a named free publisher booklet:

- Unmatched: Battle of Legends, Volume One. Restoration Games 2019 PDF. Two players are the base setup. Three and four are team play, and the map has to have four starting spaces.
- Unmatched: Houdini vs. The Genie. Restoration Games 2022 PDF. This box is 2 players. Team play needs another set. Houdini's boost placement and the secret passages are the set-specific rules.
- Unmatched: Brains and Brawn. Restoration Games 2023 PDF. Player count is now 2–4. Three is a free-for-all with the three heroes. Four adds a hero. Battlefield items, Spidey-Sense, She-Hulk's discard, and blind boost are from that booklet.
- Thunder Road: Vendetta. Restoration Games base PDF dated November 2023 on the publisher site, ©2022. The final tile is the fifth tile at 2 players, and the lead tile when someone drops out at 3 or more. Expansions were not added.
- Thunder Road: Ignition. The 2026 booklet © Restoration Games and IELLO, hosted by IELLO. Two cars win. A second damage token is a pit stop. There is no chopper and no road die.
- Point City. Alderac ©2023 rulebook, the March 2025 PDF. The buttons are the tier removals and the civic-token counts. Solo is the 2-player deck.
- The Crew: Mission Deep Sea. Thames & Kosmos UK 691869. Tasks are drawn until the difficulties add up exactly. Sonar is one per player. Submarines are never shown.
- The Crew: Journey to the Ends of the Earth. Kosmos German booklet for Die Crew: Jagd um die Welt, EAN 4002051687250. Thames & Kosmos lists English item 691866, and that file was not a stable direct link, so the notes follow the Kosmos book. The time marker moves on every task. The crew marker moves only on a success. Communication tokens are a shared pool.
- Codenames. Czech Games Edition, July 2015. The starting team has 9. Guessing once is required, and one extra guess is allowed.
- Kingdomino. Blue Orange US 2nd-edition sheet. The old 2-player line said to use a 7 by 7 grid. That size is only The Mighty Duel. The normal 2-player game is 24 dominoes and a 5 by 5 grid.
- Harmonies. Libellud English PDF. The old page described hexes and biome cards. The booklet uses colored tokens, stacks, and animal cards. Tree and river point tables that are only a diagram were not copied.

## Still deferred after that pass

- Burgle Bros., Burgle Bros 2, and Burgle Bros. 3. Fowers has product pages and FAQs. No Fowers-hosted rulebook PDF was found. Third-party copies were not used.
- Point Galaxy. Alderac hosts a 2025 PDF, and it has no text layer. It was not transcribed from the pictures.
- Oath. Leder's resources page does not list a booklet. A 2020 Law of Oath is on the designer's site. That file was not used, because it is a reference law and it may not be the current Leder text.
- Unmatched: Stars and Stripes. No Restoration Games PDF was found.
- Thunder Road: Vendetta – Maximum Chrome. Left as a shell. The base game is the Vendetta page. The consolidated expansion book was not rewritten into a second page.
- Can't Stop, For Sale, and Celestia. No free publisher booklet turned up. Can't Stop stays deferred from the previous pass. For Sale's old bullets were not rewritten without a booklet.
- Ticket to Ride: First Journey (U.S.). Still no matching Days of Wonder booklet.
- Arcs. Leder's resources page does not list it. The designer's rules page is a script, and no stable PDF URL was confirmed.

## Audit pass

Older pages were checked against a named free publisher booklet. Brass: Birmingham, on-device notes (`notes_` plus the slug), and the removed player-aid UI were not edited. Expansion chips on Wingspan, Quacks, Ark Nova, PARKS, and Everdell were not rewritten. Where a player-count button already matched the booklet, that button's numbers were kept.

### Rewritten

- Azul. Plan B Games rulebook, ©2017, the PDF in this repo. Factories are 5, 7, and 9. Tiles move to the wall at the end of the round, one tile from each complete line. The old page said they slide left when the line fills, and that only complete lines score.
- PARKS. Keymaster Games rulebook, the PDF in this repo. A dealt canteen card, a lit campfire, and the year-card choice replace the old bullet setup. Wildlife is wild for parks and photos, and not for canteens or gear. Solo rangers stay in the booklet.
- Ark Nova. Capstone Games English rulebook, ©2021 Feuerland, the PDF in this repo. The break, the slot-1 action card, and the scoring-area end replace the old one-line reminders. The 2-, 3-, and 4-player buttons already matched the booklet and were left as written. Solo stays in the booklet.
- Everdell. Starling Games rulebook, the PDF in this repo. The base page was empty apart from forest size and opening hands, which matched the book. The turn, the city of 15, the hand of 8, and the seasons are filled in. Rugwort stays in the booklet.
- Wingspan. Stonemaier Games rulebook, ©2019, the image PDF in this repo, read from the pages. Food is paid for bird cards kept, up to 5, and the bonus card is a choice of 1 from 2 with no food cost. The green goals are 5, 2, and 1. The same 5 dice and the same deck are used from 2 through 5 players, so there is still no player-count button. The Automa and the expansion chips were not rewritten.
- The Quacks of Quedlinburg. North Star Games English rulebook, the PDF in this repo. The starting chips, the explosion above 7, the flask, and the black-book buttons already matched. The turn now follows the Fortune Teller card, the rats from turn 2, and evaluation A through F. An exploded pot still chooses points or shopping.
- Splendor. Space Cowboys English rules. The ©2014 booklet and the 2024 printing SCSPL01EN agree on the counts. Nobles are players plus 1. Gems are 4, 5, or 7. Gold stays 5. The old line that left every noble in play was wrong. A tie goes to the fewest development cards.
- Ticket to Ride. Days of Wonder 7201 English rules, ©2004-2024. The North America game was an empty shell. Opening tickets keep at least 2. A later draw keeps at least 1. At 2 or 3 players only one side of a double route is used.
- SETI: Search for Extraterrestrial Intelligence. Czech Games English rulebook. Five rounds, one main action, and the neutral milestones at 20 and 30. Species sheets and the solo rival stay in the booklet.
- Point Galaxy. Alderac ©2025 image PDF, transcribed from the pages. The deck cuts are 81, 55, 29, and 3 cards removed. Rockets are 10, 12, 14, and 16. The planet-point table is the one on the scorepad and was not copied off a diagram that did not read cleanly. Solo is the 2-player deck.
- Unmatched: Stars and Stripes. Restoration Games set rules, ©2026, which were not on the publisher site in the previous pass. The PDF is the set booklet: ruses, Rosie's upgrades, John Henry's track, and Wyatt's showdown. It does not reprint core setup or team play.

### Verified and left in place

- Quacks starting chips, the white-chip explosion above 7, the flask on an exploding chip, and the 2-, 3-, and 4-player black-book buttons.
- Ark Nova break space, conservation-project row, 2-player covers, appeal by turn order, 25 money, and the draw of 8 cards keeping 4.
- Everdell forest cards, the meadow of 8, opening hands 5 through 8, and the workers on the Ever Tree.
- Wingspan's expansion chips, and the decision not to invent a 2-player dice change. The booklet uses 5 dice at every count in the multiplayer game.

### Still deferred

- 7 Wonders Duel. The PDF in this repo is credited to 1jour-1jeu, not Repos. It was not used. A stable Repos file was not retrieved. The old page was not patched from memory. Pantheon was not given a scoring field.
- Earth. Inside Up links a Google Drive folder, not a stable booklet URL. The page stays a shell.
- Arcs. Leder's resources page still does not list a booklet.
- Cascadia. It is not a title in this catalog.
- Burgle Bros., Burgle Bros 2, Burgle Bros. 3, Oath, Can't Stop, For Sale, Celestia, Ticket to Ride: First Journey (U.S.), and Thunder Road: Vendetta – Maximum Chrome. No new publisher PDF.
- Ark Nova and PARKS solo modes, and Everdell's Rugwort. They are in the booklets and were not copied onto the page.

## Pass 7

Chips that already had a name and almost no text now have setup, rules, and scoring from the book in this repo:

- Project L: Ghost Piece and Finesse, including the Finesse ambassador tiles. The base page and the player-count buttons were rewritten in the same pass.
- Dune: Imperium — Uprising: CHOAM. It is a module in the Uprising book, not a separate box. Rise of Ix is mentioned only where CHOAM tells you to add its contracts.

The Fellowship of the Ring mode "The Road Goes Ever On" stays off the chip row. It is a way to play the same box.

Raccoon Tycoon: The Fat Cat Expansion, and the three Wandering Towers mini-spell rows, still have no rules text.

Earth, Arcs, Burgle Bros., Burgle Bros 2, Oath, Can't Stop, Celestia, For Sale, and Ticket to Ride: First Journey (U.S.) now have base-game text. See `docs/AUDIT.md` for the source of each. Burgle Bros 3 still has no full publisher rulebook. Duel Pantheon still has no scoring field.

## Pass 8

Chips filled from the Repos booklets:

- 7 Wonders Duel: Pantheon. Grand Temples score 5, 12, or 21. Offerings are a one-use discount. Divinity text stays on the cards.
- 7 Wonders Duel: Agora. This chip was missing. Six chambers. A Senator costs as many coins as the Senators you already have. Controlling all six wins at once. Each controlled chamber is 1, 2, or 3 as printed.

Fat Cat and the Wandering Towers mini-spells are still empty. The other owned expansions named in `docs/AUDIT.md` were not given chips in this pass.

## Pass 9

Chips with setup, rules, and scoring, from the publisher booklets named in `docs/AUDIT.md`:

- Tiny Towns: Fortune, Architects, Villagers, Underground
- Splendor Duel: The Counterfeiters
- Finspan: Sharks & Reefs
- Wandering Towers: Spell Pack

The three numbered mini-spell rows were not filled from that sheet, because the sheet does not assign the six spells to box 1, 2, or 3. Sail: Seafarers, Onitama: Sensei's Path, Tiny Trees, LOTR Duel Allies, Wyrmspan: Dragon Academy, and the Finspan upgrade pack still have no chip. The reason for each is in `docs/AUDIT.md`.

## Pass 10

Chips with setup, reminders, and scoring, in the bullet format from `docs/CONTENT-FORMAT.md`. Sources are in `docs/AUDIT.md`.

- Sail: Seafarers
- Onitama: Sensei's Path
- Tiny Towns: Tiny Trees
- The Lord of the Rings: Duel for Middle-earth — Allies
- Wyrmspan: Dragon Academy
- Bomb Busters: The Pro Kit
- Castle Combo: Out of the Oubliette
- Heat: Legends
- Harmonies: Pulse and Crescendo
- Container: More Containers
- Oath: New Foundations
- Night at the Zoo: Latecomers
- Agent Avenue: Division M
- Deep Regrets: Lamentable Tentacles and Even Deeper Regrets
- Thunder Road: Vendetta: Big Rig and the Final Five, Carnage at Devil's Run, Choppe Shoppe, Extra Ammo, German Engineering
- Wandering Towers: Mini-Spell Expansion #1, #2, and #3, and The Magic Tower

The Spell Pack sheet still does not say which spell is in which mini box. The box assignment is the Board Game Barrister listing, and the spell text is Capstone's. Fat Cat, the Onitama promo pairs, Agent Avenue: Four Seasons, the Wingspan promo packs, and Burgle Bros 3 still have no rules text.

## Group collection orphans

These owned expansions have no parent base game on the menu, so they are not chips. BoardGameGeek's "expands" link was checked when the collection export left the parent blank. The parent still is not a base game on the site.

- Champions of Midgard: Jarl Edition, The Dark Mountains, Valhalla, and the Polyhedral Dice Promo Tiles. They expand Champions of Midgard, which is not on the menu.
- Rolling Realms: Trickerion Promo Pack. It expands Rolling Realms, which is not on the menu.
- Santorini: Hiding in the Underworld, Seasons of Chaos, Soaring over Olympus, and Tides of Poseidon. They expand Santorini: Second Edition, which is not on the menu.
- Suburbia: Con Tiles. It expands Suburbia, not Suburbia: Collector's Edition.
