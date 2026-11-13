# Figma Layer Naming Convention

> **Audience: component authoring.** This governs layer names INSIDE
> components. In a **feature file you don't name layers** — they come pre-named
> from the library instances you drop in, and instance children inherit from the
> library's main component. Feature designers: use `designer-card.md` and skip this.
> This convention is what the `layer-audit` tool checks when auditing a design-system
> (or other component-authoring) file.

Layers must be **context-named** and the **same logical layer carries the same
name everywhere** it appears. This lets the implementer reuse shared sub-components
and keeps components clean.

## Taxonomy — slash path `type/role[/qualifier]` (lowercase)
`section/<name>` · `row/<name>` · `card/<name>` · `sheet/<name>` ·
`button/<role>` (`primary`/`secondary`/`link-deactivate`) · `field/<name>` ·
`label/<name>` · `icon/<name>` · `image/<name>` · `nav/<name>`

> Existing libraries often use Title-Case structural frames (`Container`,
> `Content`, `Actions`) and carry instance layers by their component path.
> Both read as intentional; the hard, non-negotiable rule is the ban-list below.

## Ban-list (auto / non-semantic names — flag every match)
Regex (case-sensitive): `^(Frame|Group|Rectangle|Ellipse|Line|Component) \d+$`,
`^Vector( \d+)?$`, `^Instance$`, and any duplicated Figma default (`Frame 1321317645`).

## Scope — name only what a dev turns into a code element
Name: top frame, sections, rows, named controls, meaningful text
(titles/labels/values/CTAs), meaningful icons, instances, sheets, cards.
Do NOT descend into: icon internals, decorative shapes, auto-layout
spacers/dividers, library-instance guts. Stop at the code-element leaf.

## Inference source
Derive the name from the layer's content/role, using text content and the
project's i18n keys via the `localization-resolver` agent (string → key → name).
Ambiguous layers are asked or skipped — never guessed.

## Consistency
- Within a component's instances: names inherit from the main component (free).
- Across duplicates/screens: match by `same instance > same i18n key/text >
  structural`; flag "same thing, different names → unify" and "same name,
  different content → mismatch".

## Conformance examples
| Layer name        | Verdict | Why |
|-------------------|---------|-----|
| `Frame 4934832`   | BAN     | auto name |
| `Group 26086256`  | BAN     | auto name |
| `section/costs`   | OK      | taxonomy |
| `button/primary`  | OK      | taxonomy |
