# Expansion toggles

The detail view can add an expansion on top of the base game. Nothing is selected when the page opens, and the base text stays as written.

## What the player sees

If a game's `expansions` list has at least one named entry with setup, rules, or scoring text, the page shows a row of toggle chips above Quick Set Up. The chips match the player-count buttons. A player can turn on more than one.

Turning a chip on appends that expansion under the base text:

| Chip field | Also accepted | Section it changes |
| --- | --- | --- |
| `setup` | `quickStart` | Quick Set Up |
| `rules` | `reminders` | Reminders |
| `scoring` | — | End Game Scoring |

`scoring` is not copied from `reminders`. An expansion with only a reminder changes Reminders and Quick Set Up, and leaves scoring alone.

Turning every chip off restores the base text. Games with no expansion text do not get a chip row.

The older expansion cards under the Expansions heading are still there. They read `quickStart` and `reminders`.

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

`setup` / `rules` / `scoring` are the fields the chips read. Copy `setup` into `quickStart` and `rules` into `reminders` so the expansion card matches the chip.

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
