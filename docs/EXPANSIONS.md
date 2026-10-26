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
