# Character chips

Some games give each player a different side. Those sides are `characters` on the game: a faction, a spirit, or any other asymmetric side. The page shows them as a multi-select chip row in the sticky bar, in the same style as the player-count buttons and the expansion chips.

The chip lists stay open while you scroll through them, including the last faction, spirit, or hireling pack. They collapse to one line only after that whole list has scrolled above the header, so the player aid is not stuck underneath it. The height and opacity ease closed without moving the text you are reading, and opening the lists plays that motion backward. Tapping that line, or scrolling back to the top, opens the full lists again. If the expansion chips still cover the aid after the character row is hidden, those collapse into the same line. The player-count buttons stay visible unless that row itself is tall enough to cover the aid.

Nothing is selected when the page opens. Turning a chip on adds that character under Quick Set Up: the character's name, one line on how it plays or scores, then its setup steps. Turning the chip off removes that block. More than one character can be on.

Every character stays in the selector, including sides from an expansion. Long lists are grouped: base game, then one group per expansion, with the selected names or a count on a closed group. A list with no expansion split and at least 10 sides sits in one disclosure named with `charactersLabel`. Choosing a side whose `expansion` or `ruleset` matches an expansion chip turns that chip on, so its setup, rules, and scoring still fold in. Turning that chip off clears the sides that belong to it and removes them from Quick Set Up and from the player aid. It does not remove them from the selector.

## Record shape

`characters` is an array on the game, not a separate menu row. `charactersLabel` is optional. It is the accessible name of the chip row. The default is `Characters`.

```json
{
  "charactersLabel": "Factions",
  "characters": [
    {
      "name": "Marquise de Cat",
      "overview": "Scores victory points each time she builds a building.",
      "setup": {
        "bullets": [
          { "lead": "Gather", "text": "Form a supply of 25 warriors." }
        ]
      }
    },
    {
      "name": "Lizard Cult",
      "expansion": "Riverfolk Expansion",
      "overview": "Scores victory points by completing rituals.",
      "setup": {
        "bullets": [
          { "text": "Place 4 warriors and 1 garden in a corner clearing." }
        ]
      }
    }
  ]
}
```

| Field | Required | What it is |
| --- | --- | --- |
| `name` | yes | Chip label, and the heading in Quick Set Up. |
| `overview` | no | One line on how this side plays or scores. Shown above the setup steps. |
| `setup` | no | Setup steps. Same bullet format as a rules section. |
| `expansion` | no | Exact `name` of an expansion chip. Omit it for a side that is in the base game. `ruleset` is read the same way when `expansion` is empty. |
| `aid` | no | Player aid for this side. Shown only while its chip is on. |

`overview` is one sentence. `setup` is only the steps for putting that side on the table. Shared setup stays on the base game.

`aid` holds a short paraphrase (`setup`, `actions`, `abilities`, `tip`) and, when the official PDF has that side's page, a `reference`. The card draws that page with PDF.js. It does not embed the PDF, because phones ignore `#page=` in an embedded viewer and show the cover. `reference.url` is the official file at the right page. `reference.renderUrl` and `reference.renderPage` are a same-origin extract of only those pages, used when the official host blocks a cross-origin read. `reference.crop` may be `right`. If the linked rulebooks have no page for that side, leave `reference` off and keep the paraphrase.

The text comes from the publisher's rules. Do not fill a character from a summary site, a teaching video, or a guess. If the official setup is printed on a panel or a card and is not in the booklet, say so in the source note for that game and transcribe the panel.

## Games filled in this pass

### Root

Factions from the Law of Root, October 13, 2025. The Law is the source when it disagrees with a Learn to Play booklet.

Base game: Marquise de Cat, Eyrie Dynasties, Woodland Alliance, Vagabond.

Grouped under that expansion, and selectable before the chip is on:

| Expansion chip | Factions |
| --- | --- |
| Riverfolk Expansion | Lizard Cult, Riverfolk Company |
| Underworld Expansion | Underground Duchy, Corvid Conspiracy |
| Marauder Expansion | Lord of the Hundreds, Keepers in Iron |
| Homeland Expansion | Lilypad Diaspora, Twilight Council, Knaves of the Deepwood |

The Vagabond is one faction. Starting items for each Vagabond character are the items marked S on that character card (Law 9.3.5). The individual Vagabond Pack characters stay on their cards.

### Spirit Island

Spirits from the Setup box on each spirit panel, plus the core rulebook's step that follows it: flip the panel and place the remaining Presence on the dashed circles of the Presence tracks. The play-style line is the first sentence of the Play Style box on that panel.

Base game: Lightning's Swift Strike, River Surges in Sunlight, Vital Strength of the Earth, Shadows Flicker Like Flame, A Spread of Rampant Green, Thunderspeaker, Ocean's Hungry Grasp, Bringer of Dreams and Nightmares.

Grouped under that expansion, and selectable before the chip is on:

| Expansion chip | Spirits |
| --- | --- |
| Spirit Island: Branch & Claw | Keeper of the Forbidden Wilds, Sharp Fangs Behind the Leaves |
| Spirit Island: Promo Pack 1 | Heart of the Wildfire, Serpent Slumbering Beneath the Island |
| Spirit Island: Jagged Earth | The ten Jagged Earth spirits, including Fractured Days Split the Sky |
| Spirit Island: Promo Pack 2 | Downpour Drenches the World, Finder of Paths Unseen |
| Horizons of Spirit Island | Devouring Teeth Lurk Underfoot, Eyes Watch from the Trees, Fathomless Mud of the Swamp, Rising Heat of Stone and Sand, Sun-Bright Whirlwind |
| Spirit Island: Nature Incarnate | The eight Nature Incarnate spirits |

Branch & Claw's own setup changes are the setup changes in that expansion's rulebook. Horizons is compatible with the core game; that sentence is the Horizons rulebook. The other new chips are there so their spirits can be turned on. Their spirit setup is the panel, not a second copy of the expansion booklet.

## Not filled in this pass

These games have asymmetric sides and can use the same `characters` array later. They are not implemented here.

- Unmatched. Each hero is a different fighter. Sets already on the menu include Battle of Legends Volume One, Houdini vs. The Genie, Brains and Brawn, and Stars and Stripes.
- Vast. Each role is a different game inside the same box. The Crystal Caverns and The Mysterious Manor are the two lines.
- Oath. The Chancellor and the exiles do not play the same game.
- Arcs. The campaign gives players different fates. The base game on the menu does not have a character row yet.
- Cosmic Encounter. Each alien power changes the rules for that player.

Do not add those rows until the setup text is taken from that game's own official rules.
