# Figma Screen Naming Convention

Standardizes screen identity so reuse is explicit, design handoff is reliable,
and tooling can catalog + de-duplicate screens automatically.

> **Audience & scope.** This governs **screen naming in feature/project files** —
> what a feature designer names. The UI *pieces* inside a screen are instances from your
> **design-system library**; their component names, layer names, and design tokens
> are inherited from that library (see `components.md`, `tokens.md` and `layers.md`).
> Which library that is — or that there is none — is recorded in the project's
> design-system profile (`design-system.md`). The plain-language
> version designers actually read is `conventions/designer-card.md`.

## The two levels: master and variant

A screen exists **once** as a master component and appears in flows as
**variants** (instances) of that master. The **name lives on the master**; each
variant stores only its **delta**. You never drop a master directly into a flow;
you always place a variant of it.

### Master — the screen template (lives off-flow)
`[Platform][Feature][Screen]`

| Part         | Required | Values                                             | Example              |
|--------------|----------|----------------------------------------------------|----------------------|
| `[Platform]` | yes      | one of `profile.screens.platformTags` (default `[Native]`, `[Web]`) | `[Native]` |
| `[Feature]`  | yes      | the product feature / area (stable)                | `[Checkout]`, `[Orders]`|
| `[Screen]`   | yes      | what the screen **is** — canonical, no state/entry | `[Address]` |

- Brackets concatenated, **no separator between them**: `[Native][Checkout][Address]`.
- No state, no description — it is the stable template. **This is the only place the
  `[Platform][Feature][Screen]` prefix is stored.**
- Real masters: `[Native][Checkout][Cart]`, `[Native][Checkout][Address]`,
  `[Native][Orders][Order list]`, `[Native][Checkout][Order status]`.

### Variant — the in-flow instance (stores only the delta)
The variant's **stored name is the delta only** — the master prefix is **not**
repeated on it. The full logical name is the master's name + the delta, and it is
**assembled by the tooling** (for the PRD / registry) — never written onto the frame.

- **Stored on the variant:** `[Screen-override]? [State]? - description`
- **Full logical name (assembled, not stored):** `[Platform][Feature][Screen][State] - description`

| Part                          | Stored on the variant?          | Notes                                                                    |
|-------------------------------|---------------------------------|--------------------------------------------------------------------------|
| `[Platform][Feature][Screen]` | **No — lives on the master**    | joined from the master (resolved by component identity) when assembling  |
| `[Screen]` override           | only for **reuse**              | present when the variant represents a *different* screen than its master |
| `[State]`                     | only if the master has ≥2 states| `[Edit address]`, `[Delivered]`, `[empty]`               |
| ` - description`              | **yes, always**                 | free-text scenario; separator is a **hyphen** ` - ` (space-hyphen-space) |

- The designer types the delta and **that is what stays on the frame**. The tool does
  **not** stamp the master prefix onto the variant.
- Description is free text; the tooling both **reads** it and can **propose** it from
  the screen's flow position (the flow-arrow/connector into the frame, else its
  section/neighbours).
- Stored examples:
  - `[Edit address] - Change address from order summary` (master `[Native][Checkout][Address]`)
  - `[Order details][Delivered] - Order item detail` (reuse of master `[Native][Orders][Order list]`)
  - `- Order list item examples` (primary/default of a master — no state bracket)

## Identity is by component, not name
The tooling groups screens by **main-component identity** — `componentKey` on the
bridge, `componentId` over REST — **never** by the name string. Because identity is
by component, the tool never needs to parse the delta to find the master, and
**reuse is recorded as a confirmed flag**, not inferred from bracket position. All
variants of a master share that identity → they collapse to **one build-once screen
with N variants**.

## State is boolean properties + a name bracket — NOT a Figma variant
Differences between a master's variants are carried by **boolean component
properties + content overrides** (e.g. `overlay`, `bottom sheet selector`, an
`Active` badge), and surfaced in the variant's `[State]` bracket. Screen masters are
**plain components, not component sets** — there are **no `Prop=Value` variant
children at the screen level**. (Component sets with `Prop=Value` exist one layer
down, inside the design-system pieces — not something you author in a feature file.)

## Reuse — one master, a different logical screen
A variant may reuse a master to represent a **different logical screen**: its delta
**leads with a `[Screen]` override bracket** that differs from the master's screen,
while `[Platform][Feature]` still match. This is allowed. The tooling records it as
its own logical screen that **shares** a master, and the tool **soft-flags** it —
"reusing master X as screen Y — intentional?" — for a human OK.

> Example: master `[Native][Orders][Order list]`, variant stores
> `[Order details][Delivered] - Order item detail` → assembled logical name
> `[Native][Orders][Order details][Delivered] - Order item detail`.

## How the tool audits a variant name
- **Redundant prefix** — the variant's stored name repeats its master's
  `[Platform][Feature][Screen]` → **strip it to the delta** (the master already holds
  it). This is the normal normalization.
- **Reuse** — the delta leads with a `[Screen]` bracket differing from the master's
  (platform+feature still match) → **soft-flag**; keep the override in the delta.
- **Missing description** on a variant → flag.
- **Separator** — a **hyphen** ` - ` before the description (never an en-dash `–`).
- The full logical name is only ever **assembled** (PRD/registry); the tool does not
  write the prefix onto the frame.

## What comes from the design system (not named in the feature file)
Screens are assembled from design-system component instances. You do NOT name or
re-author these — they are inherited:
- **Component names** — whatever the library calls them (e.g. `Button/primary`, `Card/info`).
- **Layer names** — inherited from the library's main component.
- **Design tokens** — the library's color, spacing, radius variables and text styles.

A piece that doesn't exist in the library is built, then promoted **into the library** —
not kept as a bespoke feature-file component. (No library at all? The pieces you author
in the file are the start of one.)

## Out-of-scope screens & flows — tag
Anything NOT built (other features, WIP, old versions, explorations, notes,
context-only frames owned by another team) is prefixed `[Out of scope]`.
Tooling catalogs only frames WITHOUT that tag (case-insensitive).

## Platform tag — [Native] vs [Web]
The allowed tags come from the design-system profile (`profile.screens.platformTags`,
see `design-system.md`); `[Native]` and `[Web]` are the defaults. The tag reflects HOW
it's built: web / WebView screens → `[Web]`; native screens → `[Native]`.
A flow may mix both — tag each screen by its own implementation. A platform break
is always a **different screen** (never collapse `[Web]` and `[Native]` as one).
(The platform tag lives on the master; a variant inherits it via identity.)

## Designer-facing version
The plain-language card designers actually read is `conventions/designer-card.md`
(rendered to `render/out/`). This file is the precise spec behind it — keep the two
in sync when either changes.

## Conformance examples

| Variant stored name(s)                                                          | Same screen?        | Why                                                                                          |
|---------------------------------------------------------------------------------|---------------------|----------------------------------------------------------------------------------------------|
| `[Edit address] - From cart…`, `[Edit address] - From summary…` (same master)  | SAME                | same master (same component id); differ by state/description → variants of one screen        |
| `[Edit cart] …` (master `[…][Cart]`), `[Edit address] …` (master `[…][Address]`) | DIFFERENT | different masters — cart and address are distinct screens                                    |
| `- Order list item examples`, `[Order details][Delivered] - …` (same master) | SAME master (reuse) | share one master; the second reuses it as a different logical screen → soft-flag             |
| `[Native][Checkout][Order status][Success] - Paid by card…` (full prefix stored) | redundant           | prefix duplicates the master → tool **strips** it to `[Success] - Paid by card…`         |
| a `[Web]` master vs a `[Native]` master                                         | DIFFERENT           | a platform break is always a different screen                                                |
