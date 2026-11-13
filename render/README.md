# render — designer surfaces generator

Renders the AUTHORED designer card from `../conventions/designer-card.md` and emits
two designer-facing outputs under `out/`. Outputs are **generated** — do not edit
them by hand; edit `conventions/designer-card.md` instead.

The card is authored in a designer register (plain language, worked examples). The
technical convention docs (`naming.md`, `layers.md`) are the AI / engineering +
component-authoring reference and are **not** rendered here.

## Run

```bash
node render/render-designer-surfaces.mjs
```

From the plugin root. No `npm install` required (stdlib only).

## Outputs

| File | Description |
|------|-------------|
| `out/conventions-card.md` | The authored designer card (Markdown) with a generated header — pasted into new files by `/figma-screens init` |
| `out/designer-doc.html`   | Self-contained HTML of the same card, ready to open in a browser |

Both files begin with `<!-- generated from conventions/designer-card.md — edit the source, not this file -->`.

## Re-generate after editing the card

Edit `../conventions/designer-card.md`, then re-run the script above. The outputs
are deterministic: same source → byte-identical output.
