# Starter Template — Figma file procedure

How to create and maintain the **starter Figma file** that new feature designs
duplicate to begin with the correct setup.

The scaffold is defined by `scaffold-spec.json` and built once via `/figma-screens init`.
It seeds ONE thing: the **📐 Conventions card** (the designer-facing rules). Components
do **not** come from the template — they come from your **design-system library**, which is linked
into every feature file. The template just makes the conventions visible in-file.

When `conventions/designer-card.md` changes, re-run Step 2 on the template. The scaffold
reads the card **source** directly, so there is no render step to remember first.

---

## Prerequisites

- `scaffold-spec.json` is up to date (current version: 2.1.0).
- `figma-console` MCP + Desktop Bridge plugin connected in Figma Desktop.

The scaffold seeds the card from the **source** `conventions/designer-card.md`, so it is
always current — no pre-render needed.

---

## Step 1 — (optional) Refresh the shareable HTML artifact

```bash
# from the plugin root
node render/render-designer-surfaces.mjs
# Output: render/out/designer-doc.html (+ conventions-card.md)
```

This is **not** required for the scaffold — `/figma-screens init` reads the card source
directly. Run it only when you want to refresh the standalone HTML version for sharing.

---

## Step 2 — Build the template file ⚠️ DEFERRED ATTENDED STEP

> **STATUS: DEFERRED — template file URL: TBD**
>
> This step requires a human present with Figma Desktop + Desktop Bridge connected.
> It has not been run yet. Complete it the first time you need the starter file,
> or when the card changes substantially.

When ready:

1. Create a new empty Figma file (name it e.g. **"[Template] Figma Starter"**).
2. Enable your **design-system library** for the file (Assets → Libraries) — every
   working file needs it linked so screens can be built from library instances.
3. Copy the file URL.
4. With Desktop Bridge connected to that file, run:

   ```
   /figma-screens init <new-template-file-url>
   ```

   This reads `scaffold-spec.json` and builds the scaffold:

   - **Page "📐 Conventions"** — the authored designer card
     (source `conventions/designer-card.md`) rendered to **native Figma text styling**
     (headings bold + larger, inline bold, clean bullets — Markdown markers stripped)
     as a single **locked** text node. It covers:
     name prefixes, the screen-naming format (master `[Native][Feature][Screen]`,
     variant `[…][State] - description`), build-from-the-library, master-component reuse,
     screen-level boolean properties, and library tokens.

5. Verify the "📐 Conventions" page exists with the locked card text node.
6. Record the template file URL here (replace TBD):

   **Template file URL:** `TBD — fill in after Step 2 is completed`

---

## Step 3 — Acceptance ⚠️ DEFERRED ATTENDED STEP

> **STATUS: DEFERRED — depends on Step 2 completing first.**

1. Create a second empty Figma file.
2. Run `/figma-screens init <second-file-url>`.
3. Confirm it produces the same scaffold (same "📐 Conventions" page + card).
4. Duplicate the template file via Figma UI → confirm the duplicate starts with the card.
5. Note both results in the PR that records the template URL.

---

## Re-sync when the card changes

Whenever `conventions/designer-card.md` changes:

1. Re-run Step 2 on the existing template file URL (or create a new file and retire the old one) —
   it re-reads the card source, so the pasted card is current.
2. Update the **Template file URL** line above.
3. (Optional) Refresh the shareable HTML: `node render/render-designer-surfaces.mjs`.

---

## Files referenced

| File | Role |
|------|------|
| `scaffold-spec.json` | Machine-readable scaffold (card-only) consumed by `/figma-screens init` |
| `conventions/designer-card.md` | Authored designer card — the source; pasted onto the Conventions page |
| `render/out/designer-doc.html` | Standalone HTML version of the card, for sharing (not used by the scaffold) |
| `conventions/naming.md` | Screen-naming spec (feature files) |
| `conventions/layers.md`, `conventions/components.md`, `conventions/tokens.md` | Component-authoring conventions (layers, properties, tokens) |
| `conventions/design-system.md` | The design-system profile every build reads |
