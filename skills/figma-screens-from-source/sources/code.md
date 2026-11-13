Source adapter for `figma-screens-from-source` — read `../SKILL.md` first.

# Source: code, HTML, `.pen`, images or a written spec (`code`)

The design exists outside Figma — as a code project, HTML, a `.pen` file, mockup
images or screenshots of a running app, or a written spec — from any author (a
team's codebase, a prototype, a Claude Design export, hand-made mockups). This
adapter normalises it into a screen/state inventory plus one canonical render per
state: code/HTML is rendered headless at device width and screenshotted, and the
code itself is read for verbatim copy and colors.

Paths: `build/…` and `conventions/…` are relative to the plugin root —
`$CLAUDE_PLUGIN_ROOT`, or three directories up from this file's real path
(`readlink -f`).

## Input

The **source artifact** — a path to: a code project directory, one or more `.html`
files, a `.pen` file, an image set (mockups or screenshots), or a markdown spec. A
brief/PRD helps naming vocabulary but is optional. Requires Playwright to render
code/HTML and the pencil MCP for `.pen`.

`local` mode: this source is a natural `local`-mode entry point — the source is
code or images, not Figma. The source's colors, spacing and type **seed** the
variables the build creates in `profile.variables.semanticCollections`.

## Phase 0 — source preflight

- Locate the source on disk and detect its shape (a run may mix shapes):
  `package.json` present → **code project** · `.html` file(s) → **static HTML** ·
  `.pen` → **pencil** · image files → **images** · `.md` → **spec**.
- **Code project → idempotent sandbox boot** (self-healing; re-run re-probes and
  redoes only what's missing — no confirm gate):
  1. copy the project into the session scratchpad sandbox (the SOURCE directory is
     read-only to this skill — never install into or mutate it);
  2. `node_modules` missing OR lockfile hash changed since `run-state.json` → install;
  3. probe the dev-server port → not answering → boot it, wait for HTTP 200;
  4. single/static HTML → skip all of this, render via `file://` directly.
  Record `{sandboxPath, lockfileHash, port, pid, bootedAt}` in `run-state.json` next
  to the inventory so a resumed run knows what's already up.

## Phase 1 — source inventory: `source-inventory`

The three investigators don't contend: this one reads the source artifact,
standard-distill reads the reference file, component-inventory reads the build file.

**source-inventory** — emits the standard contract: `screen-inventory.{json,md}` +
**one canonical PNG per state at `profile.screens.renderWidth`** (default 390px).
Per shape:

- **code / HTML**: enumerate screens **static-first** — each HTML file (or top-level
  screen section / route) is one static screen; render each once at
  `profile.screens.renderWidth` wide (e.g. a 390×844 viewport on the default
  profile) via Playwright headless (`file://` for HTML, the sandbox dev-server URL
  for projects) and screenshot. Read the CODE for verbatim copy (in
  `profile.copy.locale`, accents and special characters included), colors, and
  structure — code is ground truth for CONTENT, the render for LAYOUT. Only when
  the code-scan finds state-switching logic (router, conditional renders) drive the
  browser (click-through) to capture the extra states. A state present in code but
  unreachable in the browser is specced from code and tagged
  `code-derived (not rendered)` — its parity degrades to checklist mode.
- **.pen**: pencil MCP `batch_get` (+ `snapshot_layout`) for the tree,
  `export_nodes` for the canonical PNGs. Never Read/Grep a .pen file directly.
- **images** (mockups, or screenshots of a running app): cluster stills into SCREENS
  vs STATES exactly like video frames; the image IS the canonical PNG.
- **md spec**: no pixels — screens/states from the text; the whole run switches to
  checklist parity.

Clustering follows the shared rules in `../SKILL.md` (same layout skeleton = states
of one screen; sheets/dialogs/pickers = sub-states of the parent; a "state" that is
really a different logical screen sharing the master → keep the shared master, lead
the delta with a `[Screen]` override bracket — a soft-flagged **reuse** per
`conventions/naming.md`). The inventory also proposes the
`[Platform][Feature][Screen]` **naming vocabulary** (`[Platform]` from
`profile.screens.platformTags`), derived in priority order: user brief/PRD → HTML
titles/headings → code component/file names. Confirmed at the Phase-3 gate.

Brief template, the `screen-inventory.json` extensions and `run-state.json`:
`build/agent-briefs.md` §"Code source adapters".

## Deltas table (this source's rows)

| Delta | Value |
|---|---|
| Honesty model | the shared page badge (`../SKILL.md` §Deltas); note card adds what the page was built from (code project, HTML, images or spec); amber `profile.copy.proposedBanner` banner only for states the skill invents beyond the source |
| `screenbuild:provenance` (page) | `auto-built` |
| Parity ground truth | the source renders (canonical PNGs from Phase 1); checklist mode for pixel-less states |
| Truth rule | the render beats the spec — CODE wins for content (strings, values), the RENDER wins for layout; an md-spec source has no render, the spec IS the truth |
| Chrome rule | content/structure/order from the source; OS chrome (status bars, keyboards, toggles) from the target platform's components |
| `screenbuild:source` (page) | `code` |

The badge says who assembled the Figma page (this build), not who made the source —
it applies whoever authored the code, images or spec, and stays until a designer
has reviewed the page. Owner tag and the namespace rules: `../SKILL.md` §Deltas.

## Does NOT do (this source)

- Never mutates the source project/files — all boots and installs happen in a
  sandbox copy.
- Never claims a `code-derived (not rendered)` state was visually verified.
- Never Reads/Greps a `.pen` file directly — pencil MCP only.
- Never imports low-res crops of mockup PNGs or screenshots as if they were brand
  assets; placeholders + a handoff note.

## Quick reference (this source)

| Situation | Do |
|---|---|
| A project directory (a codebase, a prototype, a Claude Design export) | Phase 0 sandbox boot (idempotent); render routes at `profile.screens.renderWidth` |
| Single HTML with several screen sections | each top-level section = one static screen; render each |
| Code has a state the browser can't reach | spec from code, tag `code-derived (not rendered)`, checklist parity |
| Two HTML files look like the same screen | states of one screen — ONE master, prop-set instances renamed to the delta |
| Screenshots of a running app, or mockup images | the images shape — cluster the stills; each image is its state's canonical PNG |
| Source is only an md spec | build from spec + design-system precedent; whole run = checklist parity |
| No design system at all | `local` mode — the build authors components, variables and text styles in the file, seeded from the source's values |
| Spec writer: code says X, render shows Y | code wins for content, render wins for layout; flag it |
| Naming vocabulary looks wrong at pilot | fix words at the gate — that's what it's for |
| User asks "where is it in Figma" | file → new page (badged Auto-built) → sections; masters strip |
