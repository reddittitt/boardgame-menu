# Essential data

Pass 18. Every game in the catalog, checked for the eight essentials. A check means the field is filled from a source this pass could verify. A gap is still empty, with the reason in [Remaining gaps](#remaining-gaps).

The layout pass owns the renderer. This pass only fills data, plus one extractor fix so a one-digit BoardGameGeek id still links. `setupByPlayerCount`, templates, and CSS were not edited.

## How a field counts

| Essential | Field | Check |
| --- | --- | --- |
| BoardGameGeek | `bggId` | The id is set. The page builds `https://boardgamegeek.com/boardgame/<id>`. |
| Box cover | `cover`, or `covers/<slug>.webp` | The image file is in the repo. |
| Play time | `time` | A real range or number. A single printed range stays in `time`. |
| Player count | `players` | A real range. `*` does not count. |
| Rulebook | `rulebook` | A publisher or retailer PDF, a local file in `rulebooks/`, or a publisher rules page. A shop or collection URL does not count. |
| BG Stats | `bgStatsUrl` | See below. |
| How to play | `howToPlayVideo` | `{ url, title, channel }` from a video that oEmbed confirmed, for this game and edition. |
| Rules | `quickStart`, `turnStructure`, `endOfGame`, `endGameScoring` | All four are non-empty bullet lists, as in [CONTENT-FORMAT.md](CONTENT-FORMAT.md). |

## BG Stats link

The example `https://bgstats.app/bgg/<bggId>` does not work. `bgstats.app` has no DNS record (checked against 8.8.8.8). Nothing answers there.

BG Stats documents the link that opens Log a Play, and it answers HTTP 200:

`https://app.bgstatsapp.com/addPlay.html?gameId=<bggId>`

Their support page uses `gameId=36218`. `gameId=68448` (7 Wonders) returns the page titled "BG Stats - Add Play" and tells the app to open. The same path with a `bgstats://` scheme also works, and it only works on a phone with the app. The https link is what `bgStatsUrl` stores, because the header opens it in the browser and the page launches the app.

## Play time by player count

`playTimeByPlayerCount` and `playTimeSource` were not filled. The boxes and publisher pages that were opened print one range for the game, not a different time at each count. The header already shows `time` in that case, and `playTimeSource` only appears next to a count-specific time. No count map was invented.

## Before and after

184 games. Counts are games that pass the check above.

| Essential | Before | After | Still open |
| --- | ---: | ---: | ---: |
| BoardGameGeek | 175 | 184 | 0 |
| Box cover | 177 | 183 | 1 |
| Play time | 180 | 182 | 2 |
| Player count | 181 | 184 | 0 |
| Rulebook | 162 | 164 | 20 |
| BG Stats | 0 | 184 | 0 |
| How to play | 13 | 127 | 57 |
| Rules, four sections in bullets | 160 | 163 | 21 |

BoardGameGeek before is the count the page could actually link. 176 games had an id stored, and Acquire's id is `5`. The extractor asked for two digits, so that link never rendered. It now accepts one or more digits. Eight ids were missing and are filled: Sea Salt & Paper `367220`, Wyrmspan `410201`, Finspan `436126`, Star Wars Villainous `358800` (Power of the Dark Side, the Ravensburger book already on that page), Mythic Mischief `342894`, Explorers of Navoria `371932`, Fractured Sky `370581`, Unmatched Adventures: Tales to Amaze `381297`.

BG Stats before is 0 because `bgStatsUrl` did not exist yet. The old button built `https://bgstats.app/bgg/<id>`, which does not resolve.

Play time before does not count Mythic Mischief, which was `*`. The box prints 1–4 players and 45–90 min. Explorers of Navoria is 2–4 and 60–90 from the Dranda product page (BoardGameGeek says 40–80). Fractured Sky's box prints 40–90 min, replacing the shop line of 60–90. Unmatched Adventures is 1–4 from BGG 381297.

How to play before is the 13 real `youtube` links. One more link was `watch?v=XXXXX` on Heat and was replaced. After is `howToPlayVideo` objects. Air, Land & Sea: Critters at War still has its old `youtube` link and is not in the 127.

Rules after includes three pages whose scoring sentences were already in `scoringSummary` and are now bullet objects: Chess, Sequence, and Burgle Bros. No new rules text was written. The empty shells are still empty. That is where this pass stopped.

## Remaining gaps

### Box cover

- Star Wars Villainous. The Ravensburger US product page returned 403, and no publisher image was saved.

### Play time

- An Infamous Traffic: Second Edition. The record was blank and no publisher time was opened.
- Unmatched Adventures: Tales to Amaze. The shop page does not print minutes, and the box spec line was not readable.

### Rulebook

- Altera. No publisher PDF found (listed year 2027).
- Annulet. No publisher PDF found (listed year 2027).
- Honors End. No publisher PDF found (listed year 2027). IV Studio posted a how-to video.
- My Lil Everdell. Starling does not publish a stable English PDF. Third-party hosts have a copy.
- Mythic Mischief. IV Studio shop does not link a PDF. A copy is on 1jour-1jeu, not the publisher.
- The Old King's Crown. eerieidolgames.com has no PDF. A copy is on meepletron, not the publisher.
- Square One. No publisher PDF found.
- Camel Up: The Card Game. The Asmodee product page has no PDF. A copy is on 1jour-1jeu.
- Candy Land: Bluey. No Hasbro PDF found.
- Magical Athlete. CMYK links the how-to video, not a PDF. A copy of the booklet is on bghub.org.
- A Place for All My Books. No publisher PDF found.
- Corps of Discovery: Ultimate Edition. No publisher PDF found.
- Everdell Journeys. No public booklet found (listed year 2026).
- Gather: An Everdell Card Game. No public booklet found (listed year 2026).
- An Infamous Traffic: Second Edition. No publisher PDF found.
- Parks Europe. No public booklet found (listed year 2026).
- Tag Team: SNK Arcade Legends. No rules PDF found (listed year 2027).
- Explorers of Navoria. The Dranda page is a shop, not a rulebook. No PDF found.
- Unmatched Adventures: Tales to Amaze. The Restoration page is a shop. The BGG file did not open as a public PDF.
- Burgle Bros. 3: Future Flip. fowers.games/pages/bb3 is an FAQ, not a full booklet.

### How to play

A video was added only when the title and channel were the right game and edition, preferring a publisher channel, then Watch It Played, then Gaming Rules!, then another known teacher (The Rules Girl, RTFM, GothamChess, Game Boy Geek Rules School, IV Studio, Keymaster, Capstone, Repos, Fantasy Flight, Allplay, Dutch Blitz, CMYK, Runaway Parade, Ludonova, Bitewing, Dice Tower's how-to-play, Triple S Games for the mass-market card games).

Not used, on purpose:

- A Watch It Played hit for the wrong edition: Parks (2nd Edition) on the first-edition PARKS page, Chronicles of Crime: 1400, Sagrada Artisans, Blood Rage for the card game Rage, Vortex Chess, Century: Golem Edition Eastern Mountains, Brass: Birmingham on the Pittsburgh page, base Everdell on Journeys and Gather, base Kingdomino on Origins, base Moonrakers on Titan Edition, base Thunder Road: Vendetta on Maximum Chrome, Unmatched: Marvel on Brains and Brawn.
- Kickstarter preview teaches, when that was the only hit (Mycelia, Lairs, Fractured Sky, Mythic Mischief Vol. II).
- Vinhos teaches that do not say Deluxe Edition.
- 7 Wonders uses Watch It Played "7 Wonders - How To Play (updated video in description)". The title says a newer cut is linked from the description. This is still Rodney Smith's first-edition teach. The Second Edition page has its own video.
- Air, Land & Sea: Critters at War. The old link is Gameosity, "Game in a Minute." It stays in `youtube` and was not copied to `howToPlayVideo`.

No verified teach was found for the other games in the table marked with a video gap. Searches were `how to play <name>`, then the same query with Watch It Played and with Gaming Rules!.

### Rules

Setup, turn, end of game, and scoring were not written for the shells below. A booklet was not opened, or the page is still a placeholder, and nothing was invented.

- Altera, Annulet, Honors End, My Lil Everdell, Mythic Mischief, The Old King's Crown, Square One, Camel Up: The Card Game, Candy Land: Bluey, Magical Athlete, A Place for All My Books, Corps of Discovery: Ultimate Edition, Everdell Journeys, Gather: An Everdell Card Game, An Infamous Traffic: Second Edition, Parks Europe, and Tag Team: SNK Arcade Legends. Setup, turn, end, and scoring are empty.
- Burgle Bros. 3: Future Flip. Setup and turn are filled. There is still no end-of-game trigger. The FAQ does not say the mainframe flip wins.
- Explorers of Navoria, Fractured Sky, and Unmatched Adventures: Tales to Amaze. The page is still a placeholder. Turn and end of game are empty. Fractured Sky now has a rules PDF (the English file Gamers HQ distributes for the IV Studio box) and was not summarized in this pass.

## Catalog

| Game | BGG | Cover | Time | Players | Rulebook | BG Stats | Video | Rules |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 7 Wonders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 Wonders (Second Edition) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 Wonders Dice | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 Wonders Duel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A Gest of Robin Hood | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A Place for All My Books | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Acquire | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agent Avenue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Air, Land & Sea: Critters at War | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | overview only | ✓ |
| Altera | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| An Infamous Traffic: Second Edition | ✓ | ✓ | gap | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Annulet | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Archduke | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Arcs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ark Nova | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Azul | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Azul Duel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backgammon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Blokus | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bomb Busters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brass: Birmingham | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brass: Pittsburgh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Brick Like This! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brink | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Burgle Bros 2: The Casino Capers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Burgle Bros. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Burgle Bros. 3: Future Flip | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | end |
| Camel Up | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Camel Up: The Card Game | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| Can't Stop | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Candy Land: Bluey | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Caper: Europe | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cartographers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Castle Combo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Catan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Celestia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Century: Golem Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chess | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chronicles of Crime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codenames | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Container | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Corps of Discovery Duo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Corps of Discovery: Ultimate Edition | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Cover Your Assets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cozy Stickerville | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Critters at War: Flies, Lies & Supplies | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Cryptid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Deep Regrets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dune: Imperium - Uprising | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dutch Blitz | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Earth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Everdell | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Everdell Journeys | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Explorers of Navoria | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | turn, end |
| Finspan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fire Tower | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Five Crowns | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Flamecraft | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Flip 7 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FlipToons | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| FlipToons: Season 2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| For Sale | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| For Sale Autorama | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forest Shuffle | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Foundations of Metropolis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fractured Sky | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | turn, end |
| Gather: An Everdell Card Game | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Got Five! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Graft | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Gruntz | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hanabi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Harmonies | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Harvest | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Heat: Pedal to the Metal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hive Pocket | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Honors End | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| Hypothetically | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inkling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Jaipur | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kinfire Delve: Vainglory's Grotto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kingdomino | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kingdomino Origins | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Lairs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Light Speed: Arena | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Lost Cities | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Magic Maze Pocket | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Magical Athlete | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| Marvel Villainous | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Men-Nefer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Money! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monkey Palace | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monopoly Deal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moon Colony Bloodbath | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moonrakers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moonrakers: Titan Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Moonrollers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| My Lil Everdell | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| Mycelia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Mythic Mischief | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| Mythic Mischief Vol. II | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| New York Zoo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Night at the Zoo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Oath | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Onitama | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ostia: Mariner Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Paladins of the West Kingdom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pan Am | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Pandemic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PARKS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parks Europe | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Parks Second Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Patchwork | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pillars of Fate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Play Nine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Point City | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Point Galaxy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Point Salad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Project L | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ra: The Dice Game | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Raccoon Tycoon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Ravine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Rebel Princess: Deluxe Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rook | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Root | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rummikub | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sagrada | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Scales of Fate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Scout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Sea Salt & Paper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sequence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SETI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Shallow Regrets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Skip-Bo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sky Team | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sniper Elite: The Board Game | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Soar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Splendor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Splendor Duel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Square One | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Star Wars Villainous | ✓ | gap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Star Wars: The Deckbuilding Game | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Survive The Island | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Tacta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tag Team | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tag Team: Arthur's Legacy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Tag Team: SNK Arcade Legends | ✓ | ✓ | ✓ | ✓ | gap | ✓ | gap | setup, turn, end, scoring |
| Targi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tenby | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tend | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Crew: Journey to the Ends of the Earth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| The Crew: Mission Deep Sea | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Crew: The Quest for Planet Nine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Fellowship of the Ring Trick-Taking Game | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Fox in the Forest | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Lord of the Rings: Duel for Middle-earth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Old King's Crown | ✓ | ✓ | ✓ | ✓ | gap | ✓ | ✓ | setup, turn, end, scoring |
| The Quacks of Quedlinburg | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| The Two Towers Trick-Taking Game | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Thunder Road: Ignition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Thunder Road: Vendetta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Thunder Road: Vendetta – Maximum Chrome | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Ticket to Ride | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ticket to Ride: First Journey (U.S.) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time to Panic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Tiny Towns | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Toy Battle | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Turing Machine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Unicorn Glitterluck: Cloud Stacking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Unmatched Adventures: Tales to Amaze | ✓ | ✓ | gap | ✓ | gap | ✓ | ✓ | turn, end |
| Unmatched: Battle of Legends, Volume One | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Unmatched: Brains and Brawn | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Unmatched: Houdini vs. The Genie | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Unmatched: Stars and Stripes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Vinhos Deluxe Edition | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Wandering Towers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Watergate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Welcome to the Moon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Wingspan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wingspan Pocket | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Winnie the Pooh: Serious Detective | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gap | ✓ |
| Wyrmspan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
