# Put it away

Private packing photos for inserts. The pages load only when this folder is present next to `index.html`. It is gitignored, so the files are not part of the public site.

## Where to put the bundle

```
private/put-away/<slug>/manifest.json
private/put-away/<slug>/steps/01.webp
private/put-away/<slug>/layers/01.webp
```

`<slug>` is the game's page slug, such as `thunder-road-vendetta`. Image paths inside the manifest are relative to that folder. Use web-safe names: letters, numbers, dots, hyphens, and slashes. No `..` and no web addresses.

A game with no `manifest.json` does not show Put it away.

## Manifest

`steps` is the packing order, one lid sheet or photo per step. `layers` is the insert from the bottom (`n` 1) to the top. Use either list, or both. A step can point at a layer with `layer`.

`kind` is `photo` or `illustration`. Photos are the private pictures. Illustrations are labeled Illustration on the page. Leave `image` off, or use `kind: "illustration"`, when there is no photo. A photo that fails to load is shown as an illustration instead of a broken picture.

```json
{
  "title": "Put it away",
  "note": "Private packing photos.",
  "steps": [
    {
      "image": "steps/01.webp",
      "caption": "Lid sheet 1. The long wells hold the big rigs.",
      "layer": 1,
      "kind": "photo"
    }
  ],
  "layers": [
    {
      "n": 1,
      "name": "Bottom tray",
      "image": "layers/01.webp",
      "kind": "photo",
      "caption": "This tray sits on the bottom of the box.",
      "trays": [
        {
          "name": "Long wells",
          "contents": ["Big rigs", "Choppers"]
        }
      ]
    }
  ]
}
```

| Field | Required | What it is |
| --- | --- | --- |
| `title` | no | Heading. Defaults to Put it away. |
| `note` | no | One short line under the heading. |
| `steps` | no | Ordered packing steps. |
| `steps[].image` | no | Path under the game folder. |
| `steps[].caption` | yes, unless `image` is set | What this step is showing. |
| `steps[].layer` | no | Layer number this step belongs to. |
| `steps[].kind` | no | `photo` (default) or `illustration`. |
| `layers` | no | Insert layers, bottom to top. |
| `layers[].n` | no | Layer number. 1 is the bottom. Defaults to the list order. |
| `layers[].name` | no | Short name on the stack. |
| `layers[].image` | no | Photo or illustration for this layer. |
| `layers[].caption` | no | What you are looking at. |
| `layers[].kind` | no | `photo` or `illustration`. |
| `layers[].trays` | no | Wells in that layer. |
| `layers[].trays[].name` | no | Name of the well. |
| `layers[].trays[].contents` | no | List of what goes in that well. |

The layer view is a stack you can tap. The lowest layer is the bottom of the box. Next and Previous move one layer up or down. The open layer lists its trays and what each tray holds.
