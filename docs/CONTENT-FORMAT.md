# At-the-table content format

The game page renders rules from the fields already on each game. A plain string still works. A later pass can turn a section into bullets without changing the renderer.

This file is the format that pass should write. Do not invent a second shape.

## Scoring summary

The box under the chip row is **How you win**. It reads the base game, then one line from each selected expansion.

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

## Page order

The game page, top to bottom:

1. Title, with the cover beside it on a wide screen and above it on a narrow one. The cover keeps its aspect ratio.
2. Player count and play time.
3. Action row: Rulebook, How to play, Teach it, Log a play, then extra official files. The buttons share one height and, on a phone, one width per row. The How to play control shows the words How to play. The video title and channel stay in the accessible name. A button is omitted when that game does not have it. Teach it opens `#/game/<slug>/teach` and the link carries the current player count, setup variant, and selected expansions and sides. Extra files come from `extraEssentials`. BoardGameGeek is the cover, not a separate button.
4. Chip row: the player-count buttons, the expansion chips, and, for a game with asymmetric sides, the character chips. The character row is documented in [CHARACTERS.md](CHARACTERS.md). The row scrolls away with the page. The site header stays put. **← All games** is a text link at the top-left of the page, above the title, and again at the bottom. It scrolls away. It is not in the chip row.
5. **How you win**.
6. **Common mistakes**, only when `commonMistakes` has text.
7. **First game? Use this**, only when `firstGameSetup` has text for the selected count.
8. Three chapters, each omitted when it has nothing to say: **Set up** (the chosen setup variant, then the shared setup, then the selected player count, then starting resources), **On your turn** (turn structure, then reminders), and **End of the game** (when it ends, then scoring). Set up is teal, On your turn uses the game accent, and End of the game is gold. The accent comes from the cover when the image can be read, and otherwise from a hue derived from the slug. A game with two or more `setupVariants` shows those choices as chips at the top of Set up. One setup shows no chips.
9. **Player aids**, only when at least one aid is on the page.

An empty field leaves no heading, placeholder, or gap. Common mistakes, First game, and Player aids do not render when empty. The three chapters do not show a placeholder line.

`endOfGame` is optional. It is the trigger: when the game stops, who takes a last turn, what is an instant win. Put points in `endGameScoring`, not here.

## Setup variants

Optional `setupVariants`. Use it when the same game has two or more named setups and the page already states both. A single setup stays in `quickStart` and shows no chips.

```json
"setupVariants": [
  {
    "id": "standard",
    "label": "Standard setup",
    "recommended": true,
    "setup": {
      "bullets": [
        { "lead": "Draw", "text": "Each player draws 3." }
      ]
    }
  },
  {
    "id": "advanced",
    "label": "Advanced setup",
    "requiredWhen": { "cornerStarts": 5 },
    "requiredNote": "Five or more factions at this table start in a corner. Use Advanced setup.",
    "setup": {
      "bullets": [
        { "lead": "Draw", "text": "Each player draws 5 and keeps 3." }
      ]
    }
  }
]
```

`id` is the value stored for the session and sent on the Teach it link as `setup`. `label` is the chip. `recommended` is the default. `setup` is the same bullet format as `quickStart`. The chip swaps only that block. Shared `quickStart` steps, the player-count block, starting resources, and a selected character's setup stay on the page.

`requiredWhen.cornerStarts` counts selected characters whose own setup text places pieces in a corner. At that count the named variant is selected and the other chips are unavailable. `requiredNote` is the sentence shown when that happens. Leave `requiredWhen` off when the choice is always free.

The choice is kept with the player count and the selected chips for the session. It is not a separate sticky bar.

## Header links

These sit under the player/time line. A missing or blank value leaves that link out. There is no placeholder.

| Link | Field | When it shows |
| --- | --- | --- |
| BoardGameGeek | `bggId` | The id is set. The cover is the link, labeled “View on BoardGameGeek”. There is no separate button. |
| Rulebook | `rulebook` | The field is set. A full `https://` URL opens directly. A slug loads `rulebooks/{slug}.pdf`. An empty field does not guess a file. |
| Log a play | `bgStatsUrl` | The URL is set. This is the BG Stats link. |
| How to play | `howToPlayVideo` | `url` is set. |

`bgStatsUrl` is a string. Use the page you want opened, including a `bgstats://` app link if that is the one you mean.

```json
"bgStatsUrl": "https://app.bgstatsapp.com/addPlay.html?gameId=68448"
```

The [BG Stats linking page](https://www.bgstatsapp.com/support/push-plays-to-bg-stats-from-other-apps-or-websites/) documents two query parameters for `addPlay.html`: `gameId` and `location`. It does not document a parameter for expansions. Played expansions are chosen in the app after the link opens. The Log a play button stays `gameId` only.

`howToPlayVideo` is an object:

| Field | Required | What it is |
| --- | --- | --- |
| `url` | yes, or the link is hidden | Video page. |
| `title` | no | Link text. Defaults to "How to play". |
| `channel` | no | Short name shown beside the title. |

```json
"howToPlayVideo": {
  "url": "https://www.youtube.com/watch?v=QVLUu7qkLWI",
  "title": "How to play in 8 minutes",
  "channel": "Watch It Played"
}
```

If `howToPlayVideo` is absent, a non-empty `youtube` string still renders as How to play. Once `howToPlayVideo` is set, that object is what the page uses, and an empty `url` hides the link.

`extraEssentials` is optional. Use it for another official file besides the main rulebook: an archive, almanac, appendix, learn-to-play, rules reference, or law. Leave the field off when the game has a single rulebook. Nothing extra is rendered in that case.

Each entry is an object:

| Field | Required | What it is |
| --- | --- | --- |
| `label` | yes, or the link is hidden | Link text. `title` is also accepted. |
| `url` | yes, or the link is hidden | Official file or page. |
| `kind` | no | `"rulebook"` gives the link the same treatment as the Rulebook link. |

```json
"extraEssentials": [
  {
    "label": "Archive",
    "url": "https://example.com/archive.pdf",
    "kind": "rulebook"
  }
]
```

## Rules status

`rulesStatus` marks a base game, or an expansion, whose rules text is not written yet.

| Value | Meaning |
| --- | --- |
| `"pending"` | Essentials are filled. Rules sections are intentionally empty so a later batch can find the entry and fill them. |

Leave the field off when it does not apply. The page does not render it. On an expansion it is not a rules section and it does not add an "Expansion rules" block.

```json
"rulesStatus": "pending"
```

## Mine and group

`mine` and `group` mark which collection a game belongs to. They are booleans. The game page does not name anyone.

| Field | Meaning |
| --- | --- |
| `group: true` | The game is in the group collection. |
| `mine: true` | The game is in my collection. |

Leave a flag off when it does not apply. A game that was already on the menu, and is not in the group collection, has neither flag.

```json
"mine": true,
"group": true
```

The menu uses the flags for two filters besides search. **All** is the default and shows every game. **Group** shows games with `group: true`. **My games** shows games with `mine: true`, and games that have neither flag. A game with `group: true` and no `mine` stays out of My games.

## Play time by player count

Optional. The header time follows the selected player-count button.

| Field | Required | What it is |
| --- | --- | --- |
| `playTimeByPlayerCount` | no | Map of count → display string. Keys match `setupByPlayerCount` (`"2"`, `"3"`, `"4"`). |
| `playTimeSource` | no | Short label for where those times came from, such as `box` or `BGG poll`. |

```json
"time": "45",
"playTimeByPlayerCount": {
  "2": "30–45 min",
  "4": "60–90 min"
},
"playTimeSource": "box"
```

Write the map value as the words to show, including `min` when you want it. A count with no entry falls back to `time`, and the page adds ` min` to that fallback the way it always has. The source label shows only next to a count-specific time. With no player-count buttons, the header keeps `time` and does not guess a count.

## Teach it

Optional `teachingScript`. Same bullet format as a rules section. Teach it is a button on the game page. It opens `#/game/<slug>/teach`. Leave the field off when you have nothing to teach from. The button appears when the base game, any expansion, or any character has a script.

Suggested order inside the bullets: theme or goal, what you do on a turn, how the game ends and how you win, then a "new players miss" list.

```json
"teachingScript": {
  "bullets": [
    { "lead": "Theme", "text": "Rival merchants race to finish a trade route." },
    { "lead": "Goal", "text": "Most points when the last building is placed." },
    { "lead": "On your turn", "text": "Build, trade, or sail. One action." },
    { "lead": "End", "text": "Finish the round in which someone places a last building. Most points wins." },
    {
      "lead": "New players miss",
      "text": "You trade with the supply, not with another player.",
      "bullets": [
        { "text": "A ship already in a port cannot sail again this round." }
      ]
    }
  ]
}
```

An expansion may set its own `teachingScript`. That addendum is appended under the expansion name, and only while its chip is on. If the base field is empty, the Teach it button appears only when such a chip, or a character with a script, is what the page can show. The button itself is on the game page whenever any of those scripts exist.

A character may set `teachingScript` in the same shape. It is appended under that character's name, after any selected expansion, and only while its chip is on. Turning the chip off removes it.

To follow the player-count buttons, use a count map. `"*"` is the shared script, read at every count. The entry for the selected count is added with that button: before `"*"` on the base script, and after the shared text on a character or an expansion. If `"*"` is absent, the map works like First game. The selected count is used, and `"*"` is only the fallback.

## Common mistakes

`commonMistakes` is the existing field. Do not rename it and do not rewrite the sentences for this layout. The page shows it under How you win, above the three chapters. The first 3 items are visible. The rest sit under **Show N more**. A section-level `details` block stays available. An empty string or empty list renders nothing.

## First game? Use this

Optional `firstGameSetup`. Bullet format. Use it for the rulebook's beginner layout, suggested first-game cards, or intro variant. It is a compact box directly above the rules.

One value applies at every player count:

```json
"firstGameSetup": {
  "bullets": [
    { "lead": "Starter layout", "text": "Use the A side of the board and deal 3 cards." },
    { "lead": "Skip", "text": "Leave the advanced modules in the box." }
  ]
}
```

To follow the player-count buttons, use a count map instead of a section object. Values are the same bullet format. An optional `"*"` entry is the fallback when the selected count has no entry. A count with no entry and no `"*"` hides the box.

```json
"firstGameSetup": {
  "2": {
    "bullets": [
      { "lead": "Starter", "text": "Use the short map and deal 3 cards." }
    ]
  },
  "4": {
    "bullets": [
      { "lead": "Starter", "text": "Use the full map and deal 5 cards." }
    ]
  }
}
```

## Player aids

Optional `playerAids` array. Rendered only when at least one entry is valid. The old `{ "label", "file" }` rows are ignored. Replace them with the object below. Do not keep writing `label` or `file`.

| Field | Required | What it is |
| --- | --- | --- |
| `title` | yes | Name of the sheet. |
| `url` | yes | `https://` link, or a path in this repo such as `player-aids/example.pdf`. |
| `source` | yes | `official`, `bgg`, or `other`. |
| `type` | yes | `pdf`, `image`, or `page`. |
| `note` | no | One short line under the title. |

`source: "official"` and `type: "pdf"` or `"image"` preview on the page. Tap the preview for a full-screen view. `source: "official"` and `type: "page"` is a link labeled Official, because a web page is not embedded. `bgg` and `other` are always links, labeled BoardGameGeek or Other, even when the file is a PDF or an image.

```json
"playerAids": [
  {
    "title": "Turn reference",
    "url": "player-aids/example-turn.pdf",
    "source": "official",
    "type": "pdf",
    "note": "Publisher sheet, 2024 edition."
  },
  {
    "title": "Icon chart",
    "url": "player-aids/example-icons.png",
    "source": "official",
    "type": "image"
  },
  {
    "title": "Publisher FAQ",
    "url": "https://example.com/game/faq",
    "source": "official",
    "type": "page"
  },
  {
    "title": "Fan reference",
    "url": "https://boardgamegeek.com/filepage/0000000/example",
    "source": "bgg",
    "type": "pdf",
    "note": "Not a publisher file."
  },
  {
    "title": "Community sheet",
    "url": "https://example.com/fan-sheet",
    "source": "other",
    "type": "page"
  }
]
```

An expansion may include its own `playerAids` array, same shape. Those aids show under the expansion name, and only while that chip is on. If the base list is empty, the Player aids heading appears only when such a chip is on.

## Expansion chips

There is no separate Expansions list at the bottom of the page. Chips still merge text into the rules while they are on.

| Expansion field | Section |
| --- | --- |
| `setup` | Set up |
| `quickStart` | Set up. If it is the same text as `setup`, it is shown once. |
| `rules` | On your turn, under Reminders |
| `reminders` | On your turn, under Reminders. If it is the same text as `rules`, it is shown once. |
| `scoring` | End of the game, under Scoring. A chip with no `scoring` does not change that section. |
| `teachingScript` | Teach it, under the expansion name |
| `playerAids` | Player aids, under the expansion name |
| `rulebook`, `youtube`, `bggId` | Links in On your turn, under the expansion name |
| `cover` | A small image in that same Turn block, when the field is set |
| `rulesStatus` | Not shown. `"pending"` means the chip has no rules text yet. |
| Any other non-empty text field | **Expansion rules: &lt;name&gt;** inside On your turn |

`name` is the chip label. Use a new field for rules that are not setup or scoring, such as a new action or a new card type. Put the bullet format on that field. The Turn block is titled `Expansion rules: ` plus the expansion name, and it disappears when the chip is off.

```json
"expansions": [
  {
    "name": "Sample Expansion",
    "bggId": "000000",
    "setup": [{ "lead": "Add", "text": "the extra board beside the map." }],
    "rules": [{ "lead": "Nectar", "text": "Nectar is wild when paying for a card." }],
    "scoring": [{ "lead": "Most nectar", "text": "5 points." }],
    "quickStart": [{ "lead": "Add", "text": "the extra board beside the map." }],
    "reminders": [{ "lead": "Nectar", "text": "Nectar is wild when paying for a card." }],
    "rulebook": "https://example.com/sample-expansion.pdf",
    "actions": {
      "bullets": [
        { "lead": "New action", "text": "Spend a token to peek at the top card." }
      ]
    }
  }
]
```

`actions` is not a special key. Any key other than the mapped ones above is treated as extra rules text.

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
- `teachingScript` (or each value in a `teachingScript` count map)
- `firstGameSetup` (or each value in a `firstGameSetup` count map)
- a character's `teachingScript`
- an expansion's `setup`, `rules`, `scoring`, `quickStart`, `reminders`, `teachingScript`, and any extra rules field

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
| `source` | no | A verified deep link into the official rulebook. See below. |

## Abbreviations

Write the words a player needs. Do not leave a letter, icon initial, or jargon code that only makes sense after reading the rulebook. If the book also uses a short label, put the full name first and the short label in parentheses: `2 boots (M)`. Printed set names, board sides, and setup letters stay when the sentence says what they are (`structure A, B, C, or D`, `the printed setup order A, then B, then C`).

## Rulebook links

Optional `source` on a bullet. The page draws a small control after the line. Tapping it opens the in-app rulebook viewer on that page and highlights the passage. Leave `source` off when the game has no official PDF the viewer can open, or when the page or heading was not checked against that PDF. Do not invent a page number or a section name.

| Field | Required | What it is |
| --- | --- | --- |
| `page` | yes | 1-based page in that game's `rulebook` PDF. |
| `query` | no | Words that appear on that page, used to highlight the passage. |
| `snippet` | no | A longer quote from that page when `query` matches more than once. Defaults to `query`. |
| `label` | no | The control's text. Defaults to `p. ` plus the page. Use the book's own section number when you have checked it. |

```json
{
  "lead": "Item supply",
  "text": "On the printed spaces: 2 boots (M) and 2 bags (B).",
  "source": { "page": 5, "query": "Form Item Supply", "label": "5.1.5" }
}
```

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

Player-count buttons update the player-count steps inside Set up. They also change the header time when `playTimeByPlayerCount` has that count, the First game box when `firstGameSetup` is a count map, and the Teach it link when `teachingScript` is a count map.

Empty chapters stay hidden. There is no per-game notes box. On load, leftover `notes_` keys in `localStorage` are removed. Theme and recently viewed stay.
