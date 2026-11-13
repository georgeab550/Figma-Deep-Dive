# How to set up screens

This file gets read to build the app — by your teammates and by AI tooling.
The screens live here; the UI pieces come from your **design-system library**.

## Name prefixes — every screen name starts with `[Platform][Feature]`
- `[Native]` — a native in-app screen · `[Web]` — a web / WebView screen
- `[Out of scope]` — anything not being built yet (notes, references, WIP)

## 1 · Name the master screen once
A screen exists **once** as a master component. Name the master:

`[Platform][Feature][Screen]`  — brackets back-to-back, no spaces between them.

- ✅ `[Native][Checkout][Address]`
- ✅ `[Native][Orders][Order list]`
- ❌ `Address (from cart)` — don't say where it came from
- ❌ `Frame 412` · `Address v2` — no default names, no versions

The master has **no state and no description** — it's the stable template. This is
the ONE full name you type; the UI pieces keep their library names.

## 2 · Build screens from the library — don't rebuild
Drop in library instances (`Button/…`, `Card/…`, `List item/…`). Never redraw a
piece that already exists in the library. Need something it doesn't have? Build it,
then flag it for the library — it belongs there, not in this file.

## 3 · The screens in your flow are variants of a master
You never drop the master straight into a flow — you drop a **variant** (an
instance) of it. If the same screen shows up in two flows, it's the same master
with two variants. Never copy the frame: copies drift apart; variants stay in
sync — and the tooling sees they're the same screen.

## 4 · One variant differs from another? Boolean property + a `[State]` tag
- A part shows or hides between variants → a **boolean** on the screen (e.g. show
  the "Active" badge, open a bottom sheet).
- Only the copy changes → a **text** property.
- Tag the difference in the variant name with a `[State]` bracket
  (`[Edit address]`, `[Delivered]`, `[empty]`).

Screens are plain components — **don't** turn them into Figma variant sets
(`Prop=Value`). That pattern belongs to library pieces, not your screens.

## 5 · Naming a variant: type only the delta — the master keeps the rest
On a variant you type **only the delta** — never repeat the master's
`[Platform][Feature][Screen]`:

`[State] - description`   — a **hyphen** between the tag and the description.

- ✅ you type: `[Edit address] - Change address from order summary`
- ✅ single-state screen (no state tag, description still required): `- Order list item examples`
- ❌ don't repeat the master: `[Native][Checkout][Address][Edit address] - …`

The master holds `[Platform][Feature][Screen]`; the tool joins the two to build the
full name **for the PRD** — it never stamps the prefix onto your frame. Typed the
prefix out of habit? The tool **strips** it back to the delta. Forgot the
description? It flags it — and can **suggest** one from where the screen sits in the
flow.

**Reusing a master as a different screen** is fine: lead the delta with the different
`[Screen]` bracket (e.g. the Order-list master shown as
`[Order details][Delivered] - Order item detail`). The tool keeps your label
and just asks you to confirm it's intentional.

## 6 · Use the library's tokens — never raw hex or px
- color → a color variable
- spacing, padding, radius → the matching number variable
- type → a text style

Bind to the variable or style — never type a hex or a pixel value.

## 7 · Housekeeping
- `[Out of scope]` on anything not being built (notes, WIP).
- Copy is final, in the product's language, spelled as it will ship.

## How this works — and how to run it

This card is part of a small toolkit that turns your Figma into a build-ready spec.
**You** run a command at each moment — nothing runs on its own.

- **① Start a file** → `/figma-screens init` — sets the file up and drops in this card.
- **② While designing** (if screen names drift) → `/figma-screens <url>` — checks
  your **screen names** against these rules: **strips any repeated master prefix**
  back to the delta, checks the delta form, and flags drift (you approve each change).
  It leaves layers alone — those come pre-named from the library pieces you drop in.
- **③ Hand off** (design done) → `/figma-screens prd <links>` — reads your finished
  screens, merges variants of the same master, and writes the **"Screens to build"**
  section into the PRD. Read-only — it never changes your Figma.

Behind the scenes: a **reader** pulls your Figma, a **writer** makes the ① and ②
changes after you confirm, and a **canonicalizer** groups variants for ③. You only
ever type the commands above.

---

Component & layer naming live in the library — you inherit them just by using its pieces.
