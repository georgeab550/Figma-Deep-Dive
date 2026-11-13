---
name: figma-screens-from-source
version: 0.6.0
description: |
  Rebuilds an existing source as design-system-native Figma screens (master
  components, states as instances, flow sections) on a NEW page; the source is
  never modified. Accepts: a screen
  recording / video, a code project or HTML (e.g. a Claude Design export),
  screenshots or mockup images, pencil `.pen` files, a written spec, or an existing
  Figma page in an old or mixed structure. Detects the source kind and loads only
  its procedure. Works with your own design-system library or with none. Pilot-gated.
  Triggers: "build figma screens from this codebase",
  "turn these screenshots into figma screens", "figma screens from this recording",
  "convert this figma page to the convention", "there's no figma for this, only a
  recording", "reverse-engineer the screens from the video", "build the Figma flow
  from the Android/iOS app", "backfill the design file", "bring this claude design
  to figma", "import these html screens into figma", "convert the .pen design to
  figma", "convert this page to the master/variant format", "modernize this figma
  file", "migrate these screens to the new structure", "the file has one master per
  state, fix it", "rebuild this page to standard". Requires the figma-console MCP +
  Desktop Bridge.
---

# Figma screens from source

Something already exists — a recording of the app, code or HTML, screenshots or
mockup images, a `.pen` file, a written spec, or a Figma page that predates the
convention — and the team needs it as proper Figma screens. This skill rebuilds that
source as a Figma page that looks native to how the team's design files are built:
real component instances bound to tokens, **one plain-component master per screen**
(states carried by boolean/text/instance-swap component properties + content
overrides, not extra masters and never a component set), flow sections with drawn
arrows, and a presentation-mode click-through of the real journey. Screen naming +
the property model follow the plugin's convention — `conventions/naming.md` and
`conventions/components.md` are the source of truth. Everything specific to the
design system comes from the **design-system profile**
(`conventions/design-system.md`), written `profile.<path>` below.

It is **import-only**: it never generates the design itself, it works on content
from any author, and it never modifies the source.

One skill, three kinds of source. The skill detects the kind (Step 2), reads ONLY
that kind's adapter (Step 3), and from Phase 2 on every kind runs the same guarded
build (`build/guarded-build-core.md`).

## Resolving plugin docs

1. If `$CLAUDE_PLUGIN_ROOT` is set → conventions at
   `$CLAUDE_PLUGIN_ROOT/conventions/`, build docs at `$CLAUDE_PLUGIN_ROOT/build/`,
   this skill at `$CLAUDE_PLUGIN_ROOT/skills/figma-screens-from-source/`.
2. Otherwise resolve this skill file's real path (`readlink -f`) and go two
   directories up to the plugin root. (From a `sources/*.md` adapter the plugin
   root is three directories up.)

Every `conventions/…` and `build/…` path below is relative to that root; every
`sources/…` and `scripts/…` path is relative to this skill's directory.

## Requirements

- **figma-console MCP + Figma Desktop with the Desktop Bridge plugin connected to
  the build file — required for building.** There is no REST fallback: not
  connected = STOP and tell the user to connect it.
- A **design-system profile** (Step 1) — your own published library, or none.
- Per source, only when that source is used:
  - `ffmpeg` (with `ffprobe`) — a screen recording.
  - **Playwright** — rendering a code project or HTML.
  - the **pencil MCP** — `.pen` files.
- The **official Figma MCP** — to read a separate *reference* file (one that is not
  the build file open in Figma Desktop).

## Inputs to resolve before starting (ask if missing)

1. The **source** — what to rebuild. Each adapter (`sources/<kind>.md`) says exactly
   what it accepts. A brief/PRD or product doc helps naming and journey vocabulary
   but is optional.
2. The **build-target Figma file** — open in Figma Desktop with the **figma-console
   Desktop Bridge plugin** connected (`figma_get_status` first; verify the file NAME
   before any write). In `library` mode it must have the design-system library
   enabled; in `local` mode an empty file is enough.
3. A **technical-standard reference** — a Figma file/section the user names as "how
   screens should be structured". The standard is distilled from it, not assumed. If
   the user has no such file (common in `local` mode), the standard is the plugin's
   own convention docs — say so in the standard artifact instead of inventing a
   reference.

## Step 1 — Resolve the design-system profile (Phase 0 starts here)

- **Resolve the design-system profile first**, per `conventions/design-system.md`
  § "Resolving the profile": `.figma-deep-dive/design-system.json` → if it does not
  exist, run the **`design-system-profile`** skill → if the user declines, the default
  profile. **State the mode** in the plan echo.
  - `library` mode: the library (`profile.library.name`) must be **enabled in the
    working file** (Figma → Assets → Libraries). Verify it — a team-library
    enumeration that returns nothing means it is not. Then STOP and tell the user to
    enable it; never silently switch to `local`.
  - `local` mode: there is no library. The build authors the components, variables
    and text styles it needs **in the working file** — components on pages prefixed
    `profile.components.localPagePrefix`, variables in
    `profile.variables.semanticCollections`, text styles in the file — and those
    become the starting design system. Each adapter adds what `local` mode means for
    its source (what seeds the system, what is reused).
  Pass the resolved profile's path into **every subagent brief** (the `<profile>`
  placeholder in `build/agent-briefs.md`) — subagents do not inherit it.
- `figma_get_status` (probe) → confirm the Desktop Bridge is connected and the
  connected file IS the build target. Not connected = STOP and tell the user to
  connect it (there is no fallback for building). Wrong file = stop.

## Step 2 — Detect the source kind

| What the user gave | Kind | Read |
|---|---|---|
| A video file (`.mp4`, `.mov`, `.webm`, `.mkv`, …) — a screen recording or a capture of a live build | `video` | `sources/video.md` |
| A directory with code (`package.json`, …), one or more `.html` files, a `.pen` file, image files (`.png` / `.jpg` / …), or a `.md` spec | `code` | `sources/code.md` |
| A figma.com URL (or page / section / node ids) of a page or section that is to be **converted** | `figma-page` | `sources/figma-page.md` |

Rules:

- **Images are the `code` kind's image adapter** — mockup images and *screenshots of
  a running app* alike. Only a video file is the `video` kind.
- **A Figma URL is not automatically the source.** It is the `figma-page` kind only
  when the user wants that page/section *converted*. A Figma URL named as "how
  screens should look" is the technical-standard reference (input 3), and the build
  file's URL is the target (input 2).
- **Ambiguous input → ASK one question, never guess.** Typical cases: both a
  recording and a codebase were given; a Figma URL that could be the reference or
  the source; a folder holding both a recording and screenshots. Ask which one is
  the source to rebuild.
- **Mixed sources**: allowed only as **one primary source + optional supporting
  material**. The primary source picks the kind, the adapter, the parity ground
  truth and the Truth rule. Supporting material (a PRD, a codebase next to a
  recording, a few screenshots next to a spec) helps naming and journey vocabulary
  the way a brief does — it never overrides the primary source's Truth rule and is
  never built from. State which is primary in the plan echo. (Within the `code`
  kind a run may mix shapes — see `sources/code.md`.)
- Two sources that would each be built (a recording of one flow and a Figma page of
  another) are two runs, one per source.

## Step 3 — Read ONLY the matching adapter

Read `$CLAUDE_PLUGIN_ROOT/skills/figma-screens-from-source/sources/<kind>.md` (if
the variable is unset: resolve this file's real path with `readlink -f` and read
`sources/<kind>.md` next to it). Do NOT read the other two adapters — their rules
do not apply to this run.

Then follow the adapter for:

- the rest of the **Phase 0 preflight** that is specific to the source (locating and
  probing it);
- **Phase 1** — its source-inventory investigator;
- its **deltas table**, source-specific spec rules, "Does NOT do" items and
  quick-reference rows.

Finish Phase 0 by echoing the plan: the source kind (and, for mixed input, which
source is primary), the phases below as milestones, the profile mode, and the build
location (a NEW page in the target file).

## Phase 1 — Sources (three parallel read-only investigators)

Spawn all three in one turn — they don't contend: one reads the source, one reads
the reference file (via the official Figma MCP when it is a separate file), one
reads the build file via figma-console. **If the Agent tool is unavailable, run all
three INLINE and still emit their artifacts** — see `build/guarded-build-core.md`
§"Running without subagents"; the fan-out is a strategy, the artifacts are the
requirement.

1. **source inventory** — defined by the adapter (`frame-inventory` for `video`,
   `source-inventory` for `code`, `legacy-inventory` for `figma-page`). Whatever the
   source, it ends at the same contract: `screen-inventory.{json,md}` + **one
   canonical PNG per state at `profile.screens.renderWidth`** (default 390px) where
   the source has pixels. Clustering rules shared by every kind: same layout
   skeleton = states of one screen; scrolled positions = one screen; bottom
   sheets/dialogs/full-screen pickers = sub-states of the parent. If a clustered
   "state" turns out to be a **different logical screen** that happens to share the
   layout/master (platform + feature match), keep the shared master and lead its
   delta with a `[Screen]` override bracket — a **reuse** soft-flagged per
   `conventions/naming.md`, not a separate master. Copy is always verbatim in
   `profile.copy.locale`, accents and special characters included.
2. **standard-distill** — reads the reference file/section and answers precisely:
   frame naming (verbatim examples — downstream tooling may key off titles), device
   width, how screens relate to masters, **how the states of one screen are
   represented** (verify on ground truth, confirm against the plugin's convention:
   **one plain COMPONENT master per SCREEN** named `[Platform][Feature][Screen]` —
   `[Platform]` from `profile.screens.platformTags` — with states carried by
   **boolean/text/instance-swap component properties + content overrides** — NOT
   one master per state, and NOT a component set; each state is a placed instance
   whose name is the delta only, `[State] - description`), flow wiring (drawn vector
   arrows + text labels; check whether real prototype reactions exist), autolayout
   skeleton, token binding, typography. Cite node ids for every claim, and ground
   the model in `conventions/naming.md` + `conventions/components.md`.
3. **component-inventory** — enumerates the build file: pages, component sets with
   nodeIds + variant properties (~15 screen-critical ones in detail),
   variables/token collections (a file may have NO text styles — tokens only), the
   closest precedent screens (e.g. an existing `[Orders]` flow when building
   `[Checkout]`), and GAPS (no spinner component, no OS dropdown → input component +
   bottom sheet, etc.). **Provenance** (`library` mode): tag each entry `library` /
   `foreign-library` / `local` using the check in `conventions/design-system.md`
   § "Is this component from the library?", and enumerate the library via the
   team-library APIs (`figma_get_library_components` / `get_library_variables`), not
   only an in-file `search_components` scan — the scan also returns file-local
   copies and hides the split. The published library is the single source of truth;
   record its key (`profile.library.fileKeys`) so the builder imports by key. In
   `local` mode there is no provenance to tag: list what the file already holds
   locally, and the GAPS list becomes the list of components, variables and text
   styles the build will author.

Brief templates for all three, the spec contract, and the builder brief live in
`build/agent-briefs.md` — read it before composing briefs (each adapter names its
own section there). Subagents inherit nothing.

## Deltas (parameterize the core)

The guarded build is parameterized by a **deltas table**. Five of its rows —
Honesty model, `screenbuild:provenance`, Parity ground truth, Truth rule, Chrome
rule — plus the `screenbuild:source` value are in the adapter. The rest is the same
for every source:

- `screenbuild` / `screenflow` are the defaults of
  `profile.pluginData.buildNamespace` / `profile.pluginData.flowNamespace` — write
  only to the profile's values; read the profile's value first, then each legacy
  namespace it lists.
- **Owner stamp**: `screenbuild:owner` = `figma-screens-from-source@<runId>` on the
  build page.
- **Source stamp**: `screenbuild:source` = the kind — `video` | `code` |
  `figma-page` — on the build page, next to `owner`.
- **Reading `owner`**: a page is owned by a build when `owner` is
  `figma-screens-from-source`, or any legacy value starting with
  `figma-screens-from-` (pages built before the skills were merged: `…-video`,
  `…-claude-design`, `…-legacy`), each followed by `@<runId>`. Such pages audit and
  fix exactly like new ones; a missing `source` key on them is not a finding.
- **Page badge (every source kind)**: the build page's name ends with the suffix
  `— Auto-built, pending design review`, and the provenance note card on the page
  says the same in a sentence plus what the page was built from. The badge says who
  assembled the page (this build), not how trustworthy the source is; a designer
  removes it after reviewing the page. The adapter's Honesty model row adds only
  what is specific to its source (e.g. the source page a conversion came from).
- **Designated existing (empty) page**: never rename a user's page. The badge
  suffix moves to every SECTION name + the note card + page `screenbuild` data.
- **Invented states**: the amber `profile.copy.proposedBanner` banner (default
  "PROPOSED – to confirm") marks every state the skill invents beyond the source,
  whatever the adapter's page-level honesty model is.

## Phases 2–7 — the shared guarded build

`build/guarded-build-core.md` is the process from here on — **read it before
Phase 2**; it also holds the flags and the shared guardrails. Overview only:

| Phase | What happens |
|---|---|
| 2 — Build specs | per-screen specs, parallel per flow batch: every element a component (match test, proven absence) or an explicit primitive; verbatim copy |
| 3 — **Pilot (USER GATE)** | build 2 screens, stop, show the user |
| 4 — Batch build | one persistent builder, section by section, flow wired as it goes |
| 5 — Parity sweep & package | each built state re-compared to its ground truth; honesty model applied; flow graph + `screenbuild` stamps written |
| 6 — Audit (read-only) | naming, provenance, match, parity |
| 7 — Fix | auto-run, bridge-gated, loop-until-clean |

### The pilot gate

Every run, every source: the build makes **2 screens (one simple + one rich)** on
the new page — masters strip, state instances, one drawn arrow, one prototype
reaction — and **stops for the user** before scaling out. The gate also confirms
the proposed **naming vocabulary** from the inventory, and whatever the adapter
defers to it (state candidates, naming proposals). Corrections here are 10× cheaper
than after 30 screens. Never skip it, never scale out without the user's go.

## Does NOT do

Shared guardrails live in the core (`build/guarded-build-core.md` §"Shared 'Does
NOT do'"). For every source, this skill also:

- Never modifies the source — recording, files, project directory or Figma page.
- Never generates the design itself (import-only) — creation stays with whichever
  tool or person produced the source.
- Never guesses the source kind on ambiguous input, and never builds from two
  primary sources in one run.
- Never declares a design-system gap it has not PROVEN by instantiating and
  inspecting the candidate components (see the core's absence-proof rule). In
  `local` mode a gap is simply a piece to author — after checking the file's
  existing local components first.
- Never switches profile mode on its own: `library` mode with the library not
  enabled is a stop, not a fallback to `local`.

Source-only items are in the adapter.

## Quick reference

| Situation | Do |
|---|---|
| Any source, first step | Step 1 preflight first (profile, then Bridge), then detect the kind |
| A feature has a video but no Figma | kind `video` → `sources/video.md` |
| A codebase, HTML, `.pen`, screenshots / mockup images, or a written spec | kind `code` → `sources/code.md` |
| A Figma page in an old or mixed structure | kind `figma-page` → `sources/figma-page.md` |
| Two candidate sources, or a Figma URL that may be reference or source | ask ONE question; build from one primary source |
| No design system at all | `local` mode — the build authors components, variables and text styles in the file |
| Library exists but is not enabled in the file | STOP; ask the user to enable it (Figma → Assets → Libraries) |
| Naming vocabulary looks wrong at pilot | fix words at the gate — that's what it's for |
| User asks "where is it in Figma" | file → new page (name ends "— Auto-built, pending design review") → sections; masters strip holds the masters |
| A page built by one of the old `figma-screens-from-*` skills | still owned — the legacy `owner` value is accepted; audit/fix as usual |

Source-specific rows are in the adapter; the build-wide ones in the core's "Shared
quick reference".
