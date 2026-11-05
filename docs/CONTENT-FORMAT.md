# At-the-table content format

The game page renders rules from the fields already on each game. A plain string still works. A later pass can turn a section into bullets without changing the renderer.

This file is the format that pass should write. Do not invent a second shape.

## Scoring summary

The box under the title is **How you win**. It reads the game, not the expansion cards.

1. If `scoringSummary` is set, the box uses that and ignores `endGameScoring`.
2. Otherwise it uses the first 3 scoring items in `endGameScoring`.

`scoringSummary` is optional. Leave it off when the first three scoring items are already short enough to read at the table. Set it when those lines are long, or when the win condition is not the start of `endGameScoring`.

A string is split on newlines. Blank lines are skipped. At most 3 lines are shown.

```json
"scoringSummary": "Most points after Age III wins.\nTie: most coins."
```

An array of strings, or the same bullet objects as a rules section, also works. Only the first 3 entries are shown. Nested bullets and `details` are left out of the box. A section object counts its intro line, then its bullets, and stops at 3.

```json
"scoringSummary": [
  "Most points after Age III wins.",
  "Tie: most coins."
]
```

Turning an expansion chip on appends one extra line: the expansion name, then the first scoring item from that chip. The base lines stay. Clearing the chips removes those lines.

## Jump links

The sticky bar links to a section only when that section has text.

| Link | Field | Heading on the page |
| --- | --- | --- |
| Setup | `quickStart`, `playerCountSetup`, `setupByPlayerCount`, or `startingResources` | Quick Set Up, Player Count Set Up, Starting Resources |
| Turn | `turnStructure` | Turn Structure |
| End of Game | `endOfGame` | End of Game |
| Scoring | `endGameScoring` or `scoringSummary` | End Game Scoring |

`endOfGame` is optional. It is the trigger: when the game stops, who takes a last turn, what is an instant win. Put points in `endGameScoring`, not here. Pages that only have `endGameScoring` show Scoring and do not show End of Game.

An expansion with setup or scoring text counts as that section being present, even when the base field is empty.

## Where the bullet format is allowed

Any of these may be a string, a bullet array, or a section object:

- `quickStart`
- `playerCountSetup`
- each value in `setupByPlayerCount`
- `startingResources`
- `turnStructure`
- `endOfGame`
- `endGameScoring`
- `commonMistakes`
- `remindersText`
- an expansion's `setup`, `rules`, `scoring`, `quickStart`, and `reminders`

`rulesGlossary` entries stay `{ "term", "desc" }`. `desc` may be a string or the bullet format below.

## Plain string

This is the current text. Newlines stay line breaks. The words are not rewritten.

```json
"turnStructure": "Draw one card.\nPlay it, or discard it."
```

If every non-empty line starts with `- `, `* `, or `• `, the page renders a real list. Two spaces of indent nest a bullet under the bullet above it. A line may start with `**Lead**` and the lead is bold.

```json
"turnStructure": "- **Draw** Take one card.\n- **Play** Place it, or discard it.\n  - The discard is worth 3 coins."
```

That string form is only a fallback so older dash lists stay scannable. The conversion pass should write the object form below. That is what gives each bullet its own details toggle.

## Bullet array

A section may be an array of items. Each item is an object:

| Field | Required | What it does |
| --- | --- | --- |
| `text` | yes, unless `lead` is set | The rest of the line. |
| `lead` | no | Bold label in front of `text`. One space is inserted between them. Put a colon in the lead if you want one. |
| `bullets` | no | Nested items, same shape. |
| `details` | no | Collapsed under a **Details** toggle. A string, an item array, or a section object. |

```json
"endGameScoring": [
  {
    "lead": "Military",
    "text": "Add the Victory and Defeat tokens. The total can be negative."
  },
  {
    "lead": "Treasury",
    "text": "1 point for each full set of 3 coins.",
    "details": "Leftover coins score nothing. A tie on coins is not broken further."
  },
  {
    "lead": "Science",
    "text": "Identical symbols score their count times itself.",
    "bullets": [
      { "text": "Also 7 points for each set of 3 different symbols." }
    ],
    "details": [
      { "lead": "Guilds", "text": "A guild can add symbols past the base table." }
    ]
  }
]
```

`details` is the place for edge cases, exceptions, and long clarifications. The main line stays the thing you need mid-game. The toggle is closed until someone asks.

## Section object

Use this when the section needs a lead-in sentence plus a list, or one Details block for the whole section.

| Field | Required | What it does |
| --- | --- | --- |
| `lead` | no | Bold intro, alone or in front of `text`. |
| `text` | no | Intro sentence or paragraph. Newlines are line breaks. |
| `bullets` | no | The list. Same item shape as the array form. |
| `details` | no | One Details toggle after the list. String, item array, or another section object. |

```json
"turnStructure": {
  "text": "Three Ages. At the start of an Age, deal 7 cards.",
  "bullets": [
    {
      "lead": "Choose",
      "text": "Build the card, build the next Wonder stage, or discard it for 3 coins."
    },
    {
      "lead": "Pass",
      "text": "Hand the rest to the next player.",
      "details": "Pass left in Age I, right in Age II, and left in Age III."
    }
  ],
  "details": "On the sixth turn you receive 2 cards. Play one. Discard the other with no coins."
}
```

A bare array and a section object can both be the value of a field. Prefer the section object when there is an intro or a section-level Details toggle. Prefer the array when every line is a bullet.

## What stays put

Player-count buttons still only change Player Count Set Up. Expansion chips still append that chip's `setup` (or `quickStart`) under Quick Set Up, `rules` (or `reminders`) under Reminders, and `scoring` under End Game Scoring. A chip with no `scoring` does not change the scoring section.

Empty sections still show their old placeholder line. Personal notes stay in `localStorage` under `notes_` plus the slug.
