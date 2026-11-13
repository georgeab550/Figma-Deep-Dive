# Figma Component / Variant Conventions

> **Audience.** Applies wherever you DEFINE component properties: **design-system
> component authoring** (in the library, or — in `local` mode — on the working file's
> component pages), and **screen master-components** in feature files.
> Feature designers who only *use* library pieces don't need this — see
> `designer-card.md`. Component and token naming come from the design-system
> profile (`design-system.md`); resolve it first.

A canonical screen (or a design-system component) is built once; each placement is an
instance. Variation is carried by properties — never by duplicating frames or by name.

## Naming (from the profile)
- **Components:** `profile.components.namePattern`. Example, default profile:
  `Category/kebab-name` — PascalCase category, `/`, lowercase-kebab name. The components
  that fill the common roles (primary button, card, list item, input, navigation bar,
  bottom action bar) are listed in `profile.components.roles`. Feature namespace:
  `<feature>/…` (e.g. `checkout/…`).
- **Screen master-components** (feature files): `[Platform][Feature][Screen]`; variants add `[State] - description` (see `naming.md`).
- **Tokens** — bind, never hardcode: variables named per
  `profile.variables.tokenPatterns` (`color`, `spacing`, `padding`, `radius`, `border`),
  type styles per `profile.typography.textStylePattern`. Rules in `tokens.md`.
- **`local` mode:** authored components live on pages prefixed
  `profile.components.localPagePrefix` (default `→ `, e.g. `→ Button`) and follow the
  same name pattern — they are the starting design system.

## Property types — split axes to avoid variant explosion
| Type          | Use for                                   | Example |
|---------------|-------------------------------------------|---------|
| **Boolean**   | show/hide an independent part             | `showTC`, `showDeactivate` |
| **Text**      | copy that changes                         | `ctaLabel`, `stepCounter` |
| **Variant**   | one distinct state/type from a dropdown — SPARINGLY | `mode` / `status` |
| **Instance-swap** | swap a structural sub-block           | payment-row block |

Rule of thumb: **show/hide → boolean · change words → text · swap a block →
instance-swap · one distinct state to pick → variant (sparingly).**

⚠️ Variants MULTIPLY (`5 modes × 2 × 2 × 2 = 40`). Booleans/text are orthogonal
and stack freely — prefer them. Reserve variants for a single low-cardinality axis.

> **A caution about existing libraries.** Existing libraries often lean on variants
> and bake copy into them — a single list-item component whose "type" axis has dozens
> of values is common. That sprawl is the anti-pattern this rule exists to prevent;
> don't copy it. For NEW components (and screen master-components) prefer booleans +
> text properties over new variants, and use `Yes/No` Title-Case for boolean-style
> axes (libraries drift — `Yes/No` vs `True/False` vs `On/Off`; standardize on
> `Yes/No`).

## Worked example — `checkout/address`
One screen component, ~4 booleans + 2 text props (NOT 40 variants):
`showHelperText · showSecondaryAction · showInlineError · isBlockedGate · ctaLabel · stepLabel`.
Each entry point is a preset of those property values, e.g.
`edit → { showSecondaryAction:true, ctaLabel:"Save", stepLabel:"2 of 3" }`.

## Composition rules (authored screens)

- **Secondary actions** → the multi-button variant of the bottom-action component
  (`profile.components.roles.bottomActionBar`) or the master's `showSecondaryAction`
  boolean. **Never** a raw TEXT node styled as a link beside a 1-button
  CTA — that isn't a real button (no states, not tokenized, sits outside the CTA's auto-layout).
- **Auto-layout** → authored content-stack frames use auto-layout (`VERTICAL`/`HORIZONTAL`).
  Reserve `layoutMode = NONE` for the outer screen scaffold (nav-bar + bottom CTA docked by
  coordinate — matching the reference masters) and for illustration / icon-group / overlay
  frames. Never absolute-position a content stack.
- **Token binding** → every authored node binds color / dimension / type per
  `conventions/tokens.md`; instance-inherited styling is left as-is.

## Identity is by key, not name
Every tool in this plugin resolves an instance by its **`mainComponent.key`** (stable
and unique), not its display name. Legacy/stale display names still resolve; downstream
tooling can canonicalize them to the component's current name. So renaming
a *component* never breaks identity — but renaming a variant *property name or
value* can break instance assignments and Code Connect, so avoid en-masse
property renames (normalize values downstream instead). Whether a key belongs to the
design-system library is decided by the check in `design-system.md` § "Is this
component from the library?".
