Source adapter for `figma-screens-from-source` — read `../SKILL.md` first.

# Source: an existing Figma page in an old or mixed structure (`figma-page`)

The design exists in Figma but predates the convention (plain frames, one master
per state, component sets, detached copies) or mixes formats. This adapter
converts it by REBUILDING it as design-system-native screens on a NEW page of the
SAME file. The source page is never modified; the designer deletes it after
validating the conversion.

It is the richest source: copy comes verbatim from text nodes, component identity
is pre-resolved from the live instances (keys via `getMainComponentAsync`),
existing prototype reactions and drawn arrows are harvested into the new flow
graph, and names that already pass the naming audit carry over verbatim.

Paths: `build/…` and `conventions/…` are relative to the plugin root —
`$CLAUDE_PLUGIN_ROOT`, or three directories up from this file's real path
(`readlink -f`).

## Input

1. The **source page** — file URL + page (or section/node ids) holding the
   old-format screens. Must be in the SAME file the rebuild targets — so the build
   target (input 2 of `../SKILL.md`) is this file, open in Figma Desktop with the
   Desktop Bridge connected.
2. The technical-standard reference is often the same file's newest pages.

`local` mode: there is no library. The source page's **own local components** are
the starting design system — the build reuses them, and authors only what is
missing (components on pages prefixed `profile.components.localPagePrefix`,
variables in `profile.variables.semanticCollections`, text styles in the file).

## Phase 0 — source preflight

- Confirm the source page exists and enumerate its top-level frames/sections (count
  only — the inventory agent does the deep read).
- The plan echo names the build location as a NEW page in the SAME file. The source
  page is read-only for the entire run.

## Phase 1 — source inventory: `legacy-inventory`

**legacy-inventory** — the source adapter; emits the standard contract:
`screen-inventory.{json,md}` + one canonical PNG per state.

- **Inventory**: `figma-deep-dive` agent extraction over the source page +
  screen-canonicalizer clustering (dispatch `screen-canonicalizer` when
  states/masters are ambiguous — never cluster by hand). Old formats map:
  one-master-per-state and component-set variants cluster into ONE logical screen;
  detached near-duplicates cluster by layout skeleton.
- **Hidden layers — read them directly, not through the agent.** The
  `figma-deep-dive` agent excludes hidden layers by design: it never lists or
  counts them, so do NOT ask it for them. Old-format pages often carry a state as a
  hidden frame or a visibility-toggled layer; to keep those from being lost, run
  ONE read-only `figma_execute` over the Bridge that lists the `visible === false`
  frames/layers under each source screen (id, name, type, parent, text content).
  Hidden top-level frames stay out of the build (list them in the inventory as
  skipped); a hidden layer inside a screen is a **state candidate** — confirmed at
  the pilot gate, never assumed. This read changes nothing on the page.
- **Canonical PNGs**: `figma_capture_screenshot` each source frame/state.
- **Copy**: text nodes verbatim (in `profile.copy.locale`, accents and special
  characters included) — no OCR, no render.
- **Identity pre-resolved**: for every INSTANCE record the component key
  (`getMainComponentAsync` over the Bridge) and its classification — `library` /
  `foreign-library` / `local` — using the check in `conventions/design-system.md`
  § "Is this component from the library?". The Phase-2 match test consumes these
  directly; in `library` mode `local` and `foreign-library` instances route to the
  Phase-7 provenance swap. In `local` mode every component is local: skip the
  classification and record the local component each instance uses.
- **Flow harvest**: read existing prototype reactions + drawn arrows on the source
  page into an edge list (they are re-created on the build page in Phases 4-5 —
  never copied blindly). If the source page already carries a flow graph in
  `sharedPluginData`, read it too: `profile.pluginData.flowNamespace` first, then
  each of `profile.pluginData.legacyFlowNamespaces`.
- **Naming, audit-first**: run the `figma-deep-dive` agent in `naming-audit` mode on
  the source page. Names already compliant carry over VERBATIM; violations get
  proposals (from flow position, per the `figma-write` skill) confirmed at the pilot
  gate. No re-derivation churn.

Brief template and the `screen-inventory.json` extensions:
`build/agent-briefs.md` §"Figma-page source adapter".

**component-inventory, this source** — the build file IS the source's file. In
`local` mode: inventory the local components, variables and text styles the source
page uses — that IS the starting system — and note where each one lives (see the
clone rule below for components that live on the source page).

## Deltas table (this source's rows)

| Delta | Value |
|---|---|
| Honesty model | the shared page badge (`../SKILL.md` §Deltas); note card adds "Converted from `<source page>` — delete that page once this one is validated"; amber `profile.copy.proposedBanner` banner only for states the skill invents beyond the source |
| `screenbuild:provenance` (page) | `converted` + `screenbuild:sourcePage = <source page node id>` |
| Parity ground truth | screenshots of the source page's frames |
| Truth rule | the source frame beats everything; text nodes ARE the copy |
| Chrome rule | chrome already correct on the source — carry it over |
| `screenbuild:source` (page) | `figma-page` |

Owner tag and the namespace rules: `../SKILL.md` §Deltas.

**`local` mode — clone off the source page.** A local component whose main
component lives **on the source page** is re-authored (cloned) onto a
`profile.components.localPagePrefix` page and the build uses the clone — the source
page is never edited and must stay deletable. Library-provenance findings and the
Phase-7 provenance swap do not apply.

## Does NOT do (this source)

- Never modifies the source page — not even renames; naming fixes land on the
  REBUILT masters/instances only (in-place renaming is `figma-write`'s job).
- Never converts across files — NEW page in the SAME file only (or a designated
  EXISTING page in that file, when empty — see the core's "Does NOT do").
- Never reuses a source-page **screen master** on the build page (even a compliant
  one): masters are rebuilt for uniform provenance so the source page stays
  deletable; in `library` mode the audit/fix loop reconciles them to published
  components.
- Never asks the `figma-deep-dive` agent for hidden layers — it excludes them; the
  hidden-layer read is a direct, read-only `figma_execute`.
- Never claims converted content was validated — the page badge stays until a
  designer removes it.

## Quick reference (this source)

| Situation | Do |
|---|---|
| Source has one master per state | cluster to ONE `[Platform][Feature][Screen]` master; states become prop-set instance deltas |
| Source uses a component set for states | same — plain master + props on the build page; never a component set |
| Source frame names already compliant | carry over verbatim (audit-first); don't re-derive |
| Source instance uses a file-local copy of a library component (`library` mode) | record the key; build with it, let the Phase-7 provenance swap reconcile to the published twin |
| No library at all (`local` mode) | the page's own local components are the starting system; clone any that live on the source page; author the rest |
| A state exists only as a hidden layer | list it from the direct Bridge read as a state candidate; confirm at the pilot gate |
| Existing reactions/arrows on the source page | harvest the edge list; re-create on the build page; regenerate the `screenflow` flow graph |
| Designer asks "can you fix the old page in place" | out of scope — figma-write renames; this skill rebuilds |
| A source screen is already perfectly compliant | rebuild it anyway (uniform provenance, deletable source) |
