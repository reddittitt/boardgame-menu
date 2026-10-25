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
