# Essential data

The original 184 games. The catalog is larger now: the Poquoson group games are in, and other agents are filling those by alphabet. This pass did not edit them.

A check means the field is filled from a source that was opened. A gap is still empty. The reason is under [Still open](#still-open).

## How a field counts

| Essential | Field | Check |
| --- | --- | --- |
| BoardGameGeek | `bggId` | The id is set. The page builds `https://boardgamegeek.com/boardgame/<id>`. |
| Box cover | `cover`, or `covers/<slug>.webp` | The image file is in the repo. |
| Play time | `time` | A real range or number. |
| Player count | `players` | A real range. |
| Rulebook | `rulebook` | A publisher PDF, a retailer or archive copy of that PDF, a local file in `rulebooks/`, or a publisher rules page. A shop URL or an FAQ does not count. |
| BG Stats | `bgStatsUrl` | `https://app.bgstatsapp.com/addPlay.html?gameId=<bggId>`. `bgstats.app` does not resolve. |
| How to play | `howToPlayVideo` | `{ url, title, channel }` confirmed with YouTube oEmbed, for this game and edition. |
| Rules | `quickStart`, `turnStructure`, `endOfGame`, `endGameScoring` | All four are non-empty bullet lists, as in [CONTENT-FORMAT.md](CONTENT-FORMAT.md). |

`rulesStatus: "pending"` is set only when no booklet, publisher rules page, or reputable rules file could be found. The page does not render it. A game with a linked booklet and no summary yet does not get `pending`.

## This pass

Counted on the original 184 games. Before is the end of the previous essentials pass.

| Essential | Before | After | Still open |
| --- | ---: | ---: | ---: |
| BoardGameGeek | 184 | 184 | 0 |
| Box cover | 184 | 184 | 0 |
| Play time | 184 | 184 | 0 |
| Player count | 184 | 184 | 0 |
| Rulebook | 170 | 170 | 14 |
| BG Stats | 184 | 184 | 0 |
| How to play | 170 | 170 | 14 |
| Rules, four sections in bullets | 167 | 170 | 14 |

Ra: The Dice Game already had a rulebook field. That Rio Grande URL 404s. It now points at the Internet Archive copy of the same publisher PDF, captured 6 August 2009.

### Filled

- Star Wars Villainous cover. The box front is Power of the Dark Side.
- Play time. An Infamous Traffic: Second Edition is 60–120 minutes. The Wehrlegig retail line says one to two hours, which is how BoardGameGeek 475323 is described. Unmatched Adventures: Tales to Amaze is 20–60 minutes on BoardGameGeek 381297.
- Rulebooks now linked: Camel Up: The Card Game (eggertspiele English file, copyright 2016), Magical Athlete (the CMYK booklet), My Lil' Everdell (the Starling web-resolution PDF), Mythic Mischief (the English booklet), The Old King's Crown (Eerie Idol English file, copyright 2025), Unmatched Adventures: Tales to Amaze (IELLO's English Adventures rules, copyright 2023 Restoration Games).
- Rules written from the file that was opened: Magical Athlete, Camel Up: The Card Game, Fractured Sky, and Unmatched Adventures: Tales to Amaze. Explorers of Navoria has setup and the turn from the Dranda pledge-page how-to-play. That page does not print the ending.
- How-to videos were added only when the title was this game and this edition. Publisher first, then Watch It Played, then Gaming Rules!, then another known teacher. Air, Land & Sea: Critters at War now uses The Fanily's tutorial instead of the one-minute Gameosity link.

Left unused because the video was a different game or edition: Magic Maze for Magic Maze Pocket, base Moonrakers for Titan Edition, Parks 2nd Edition for Parks Europe, base Tag Team for Arthur's Legacy and for SNK Arcade Legends, Marvel Unmatched for Brains and Brawn, a Corps of Discovery teach that does not say Ultimate Edition, and a Vinhos teach that does not say Deluxe.

## Still open

### Rulebook

- Altera, Annulet, and Honors End. Listed year 2027. No booklet found.
- Square One. The Boardcubator page names the game and does not link a PDF.
- Candy Land: Bluey. The Hasbro Candy Land sheet is a different game. No Bluey sheet was found.
- A Place for All My Books. The BoardGameGeek file page does not open as a public PDF.
- Corps of Discovery: Ultimate Edition. No public booklet.
- Everdell Journeys and Gather: An Everdell Card Game. No public booklet.
- An Infamous Traffic: Second Edition. No finished booklet. The public videos are a prototype and a Kickstarter play-through.
- Parks Europe. Keymaster's video is what changed from PARKS, not a full booklet.
- Tag Team: SNK Arcade Legends. No rules PDF. Listed year 2027.
- Explorers of Navoria. The old link was a shop. The pledge page describes play and does not hand out a PDF URL.
- Burgle Bros. 3: Future Flip. `fowers.games/pages/bb3` is still an FAQ, not a full booklet.

### How to play

- Annulet. The videos found are previews, not a rules teach.
- Moonrakers: Titan Edition. The IV Studio how-to is the base game.
- Vinhos Deluxe Edition. The Gaming Rules! teach does not say Deluxe.
- Magic Maze Pocket. The teaches found are Magic Maze, not Pocket.
- Unmatched: Houdini vs. The Genie. The hits are reviews and a one-minute trailer.
- Winnie the Pooh: Serious Detective. The videos are spoiler-free overviews, not the rules.
- Corps of Discovery Duo. The hit is a preview.
- Corps of Discovery: Ultimate Edition. The teach does not name the Ultimate Edition.
- Gather: An Everdell Card Game. The hit is a trailer.
- An Infamous Traffic: Second Edition. The public videos are a prototype playtest and a long play-through.
- Parks Europe. Keymaster's "What's New" is not a full teach.
- Tag Team: Arthur's Legacy and Tag Team: SNK Arcade Legends. The official how-to is the base Tag Team game.
- Unmatched: Brains and Brawn. The how-to that came up is Marvel Unmatched.

### Rules

`rulesStatus` is `pending` where no rules file exists: Altera, Annulet, Honors End, Square One, Candy Land: Bluey, A Place for All My Books, Corps of Discovery: Ultimate Edition, Everdell Journeys, Gather: An Everdell Card Game, An Infamous Traffic: Second Edition, Parks Europe, and Tag Team: SNK Arcade Legends.

My Lil' Everdell, Mythic Mischief, and The Old King's Crown now have setup, the turn, the ending, and scoring from the linked booklets. My Lil' Everdell was read by OCR of the Starling image PDF. Mythic Mischief is the English file. The Old King's Crown is the Eerie Idol English file, copyright 2025.

Another search of the 14 missing teaches and 14 missing rulebooks did not add a link. A file stored under Explorers of Navoria on nastol.io is the rulebook for Townsfolk Wanted!, so it was not used. Publisher, Watch It Played, Gaming Rules!, and Dice Tower hits for the open videos were a different game or edition, or a preview rather than a teach.

Burgle Bros. 3: Future Flip still has no end-of-game line. The FAQ does not say what wins.

Explorers of Navoria has setup and the turn from the Dranda how-to-play. The ending is not on that page.
