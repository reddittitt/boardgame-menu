# Rulebook search

A game page can search its official rulebook. The box is shown only when that game is listed in `rulebooks/index/manifest.json`. The index itself is fetched the first time the box is used, so the game list does not load it.

Typing a word or phrase shows up to 20 short snippets, about one or two lines each, with the query highlighted. Each snippet links to that page of the same PDF the Rulebook button opens (`#page=` plus the page number). The page does not paste the book.

## What the script reads

`scripts/build-rulebook-index` reads the game's `rulebook` field in `index.html`.

| `rulebook` value | PDF that is indexed |
| --- | --- |
| A slug, such as `wingspan` | The uploaded file `rulebooks/<slug>.pdf` |
| An `https://` URL | That URL, downloaded for the build and not committed |

Search results open that same PDF. Page numbers are the PDF's own page numbers.

Each page is read with `pdftotext`, keeping each column's lines separate. A page with almost no text is treated as an image and read with `tesseract`, one page at a time. The index stores a page number and the text lines from that page.

The download uses the `rulebook` URL as-is. A Dropbox link that returns an HTML preview (`dl=0`) is fetched again with `dl=1` so the index is built from that same PDF. If a host rejects the short agent string, the script tries once more with a browser agent. The game page still opens the original link.

### Wingspan and Heat

Wingspan's uploaded PDF has no text layer. Every page is OCR.

Heat's uploaded file, `rulebooks/heat-pedal-to-the-metal.pdf`, is the advanced booklet. The game page links to the Days of Wonder basic-rules PDF, and the index follows that link. Do not point the Heat index at the advanced booklet.

## Add a game

1. Set `rulebook` to the official PDF the page should open. Use a file in `rulebooks/` when this site hosts it. Use the publisher URL when the page already links out. The index and the Rulebook button must be the same PDF.
2. Install Poppler (`pdftotext`, `pdfinfo`, `pdftoppm`) and Tesseract (`tesseract`, English language data).
3. Run `scripts/build-rulebook-index <slug>`. With no arguments, the script rebuilds the pilot games.
4. Commit `rulebooks/index/<slug>.json` and `rulebooks/index/manifest.json`.

The page code does not need an edit. The manifest is the list of games that get a search box.

To drop a game, delete its JSON file and run the script again. The manifest is rebuilt from the JSON files in `rulebooks/index/`.

Leave `mine` and `group` as they are. Do not add a person's name to the page or the index.

## Pilot

| Game | Slug | Try |
| --- | --- | --- |
| Wingspan | `wingspan` | tuck |
| Brass: Birmingham | `brass-birmingham` | canal |
| Heat: Pedal to the Metal | `heat-pedal-to-the-metal` | stress |
| Ark Nova | `ark-nova` | sponsor |
| Root | `root` | rule |

## Index shape

```json
{
  "slug": "wingspan",
  "pages": [
    {"page": 4, "lines": ["Turn structure", "Play a bird from your hand"]}
  ]
}
```

`page` is the PDF page used in `#page=`. Lines are the text of that page, already trimmed to short lines.
