# Figma Token / Variable Rules

Authoritative rulebook for binding **authored** nodes to the design system. Applies to
every node the build AUTHORS — screen masters composed from design-system pieces, hero /
tile / illustration wrappers, and derived-fallback components. `figma-write` uses
this doc when it finds a raw fill/dimension to bind.

**Resolve the profile first** (`conventions/design-system.md`). Every collection, token
name, text-style name, size ladder and font below is a `profile.<path>` field — this doc
names none of them itself. Examples show the default profile (`profiles/default.json`)
and are labelled as examples.

> **The failure this prevents.** Text/spacing/color from a placed design-system
> **instance** inherit tokens for free, but hand-authored nodes silently keep raw values
> — or a lone bound `fontSize` variable that only *looks* bound. Bind authored nodes to
> the same tokens instances get; the audit sweep is `build/audit-fix.md` §6.6.

## The rule — three bindings, no exceptions on authored product nodes

1. **Color** (fills, strokes) → a semantic variable from one of
   `profile.variables.semanticCollections`, named per `profile.variables.tokenPatterns.color`
   (example, default profile: `color/{text|surface|border|icon|background|brand}/<name>`).
   Never a raw hex; never a variable from `profile.variables.primitiveCollections` directly.
2. **Dimension** (itemSpacing, padding, cornerRadius, borderWidth) → the matching token
   family in `profile.variables.tokenPatterns` (`spacing`, `padding`, `radius`, `border`;
   example, default profile: `spacing/<px>`, `padding/<size>`, `radius/<size>`,
   `border/<size>`).
3. **Typography** → a design-system **text style** (named per
   `profile.typography.textStylePattern`) applied with `setTextStyleIdAsync`. NOT raw font
   props, and NOT a lone bound `fontSize`/`fontFamily` variable from
   `profile.variables.typographyCollections` — a bound variable without a text style is
   the half-done state, it is **not** "using the style".

Where the system has several variable modes (`profile.variables.modes` — themes, brands),
bind to the semantic variable and let the mode resolve it; never pick a per-mode raw value.

## `library` mode vs `local` mode

| | `library` mode | `local` mode |
|---|---|---|
| Where variables and text styles come from | The enabled library. The library must be enabled in the working file; if it is not, the build stops and asks — it never silently switches mode | Created in the working file: variables in `profile.variables.semanticCollections` (raw values in `primitiveCollections`), text styles per `profile.typography.textStylePattern` |
| A value with no token in range (*Gaps* below) | Keep the literal, **propose** the addition | **Add** the variable / text style to the local system, bind to it, and list the addition in the run report |
| Nearest-match (±2px) | Applies | Applies — snap to what the local system already has before adding a near-duplicate |

In `local` mode there is no proposal strip, card or doc: the local system is the design
system, so a gap is simply filled.

## Nearest-match — when no exact token exists

A design system is finite; a value may fall between tokens.
- **Text:** apply the **nearest** style — match the weight (after applying
  `profile.typography.substitutions` for weights the system lacks), pick the nearest size
  on `profile.typography.sizeLadder`. e.g. on a 13/15/17/20/24 ladder with no Semibold:
  `14→15`, `12→13`, `Semibold → Bold`. If the system restricts a style to certain sizes
  (an all-caps style at one size only, say), all-caps text snaps to that style.
- **Dimension:** bind to the nearest token only when it is within **±2px**; otherwise keep
  the original literal (do NOT force a distant token — see *Gaps*).
- ≤2px snapping is acceptable drift; snapping further is not.

## Gaps → propose, never distort

When nothing is in range (text: size/weight off the ladder — e.g. a 34px display numeral;
dimension: >2px from every token — e.g. 32 or 48 on a 4/8/…/40 ladder):
1. **Keep the original value** on the node.
2. **Log it** to the run's consolidated proposal (produced by `build/audit-fix.md` §7.6):
   one amber note — `profile.labels.proposalCard` — in the `profile.labels.derivedStrip`
   strip + a `profile.labels.proposalDoc` file, aggregating every gap with where-used
   counts, interim handling, and the recommended design-system addition.

`local` mode: step 2 becomes "create the missing variable / text style in the working
file and bind to it" (table above).

Never silently snap a large gap to a token — that distorts the design and hides the
design-system gap.

## Token traps (see `build/figma-build-recipe.md` §Environment gotchas)

- **A variable's name is not its value.** Word- or ordinal-indexed spacing variables
  aren't necessarily literal px (a variable named `spacing/sixteen` can resolve to
  something other than 16). Verify a variable's resolved value before binding; if the
  source says "gap 16" and the binding resolves wrong, clear it
  (`setBoundVariable('itemSpacing', null); node.itemSpacing = 16`) and the **literal is
  then allowed** — the one sanctioned exception to rule 2.
- **Font-family resolution when setting `.characters`**: overriding text on a node whose
  family is missing renders stale glyphs. `setTextStyleIdAsync` loads the right font; when
  setting characters directly use the family `profile.typography.fonts` gives for that
  size range (a system may use one family for body sizes and another for display sizes).

## Scope

- **In scope:** authored (non-instance) product nodes on the build page + derived-fallback
  components (in `local` mode: every authored component on the
  `profile.components.localPagePrefix` pages too).
- **Exempt:** placed design-system **instance** internals (inherited — never override
  them); flow **scaffolding** (section band-titles, page notes, arrow labels — annotation,
  not product UI).
