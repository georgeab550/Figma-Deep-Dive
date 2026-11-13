# Guarded build core — Phases 2–7 of the figma-screens-from-source skill

The shared half of the build pipeline. The `figma-screens-from-source` skill and
its source adapter (`sources/<kind>.md` — kind `video`, `code` or `figma-page`)
own Phase 0 (preflight) and Phase 1 (the source inventory), both of
which end at the same contract: `screen-inventory.{json,md}` + one canonical
ground-truth PNG per state (at `profile.screens.renderWidth`, default 390px)
where the source has pixels.
From Phase 2 on, THIS doc is the process. It is a reference, not a skill —
the skill says "read it before Phase 2" and then follows it.

Source-specific behavior is parameterized by the **deltas table**;
everywhere this doc says *(per deltas)*, look up the row in the source adapter
(`skills/figma-screens-from-source/sources/<kind>.md`); the rows that are the same
for every source are in that skill's SKILL.md §Deltas.

## Resolve the design-system profile first (MANDATORY)

Nothing in this doc names a design system. Before Phase 2 — and before any
standalone audit or fix — resolve the **profile** per
`conventions/design-system.md` §"Resolving the profile": the project's
`.figma-deep-dive/design-system.json`, else the `design-system-profile` skill,
else `$CLAUDE_PLUGIN_ROOT/profiles/default.json`. Every `profile.<path>` below
is a field of that resolved profile; pass the resolved JSON (or its path) into
every subagent brief — subagents inherit nothing.

The profile's `mode` decides where components come from:

| `profile.mode` | Component source | Tokens & type | Library-provenance findings |
|---|---|---|---|
| `library` | the published library (`profile.library.name`), imported by key; what it lacks is DERIVED from it on the build page | the library's variables in `profile.variables.semanticCollections` and its text styles | apply (`library` / `foreign-library` / `local`, per `conventions/design-system.md` §"Is this component from the library?") |
| `local` | components the build authors in the working file, on pages prefixed `profile.components.localPagePrefix` — they become the starting design system | variables the build creates in `profile.variables.semanticCollections` + text styles named per `profile.typography.textStylePattern` | SKIPPED — there is no "foreign", "missing from the library" or "promote to the library" finding |

- **`library` mode requires the library to be enabled in the working file.** If
  component lookup returns nothing, STOP and tell the user to enable it — never
  silently switch to `local`.
- **The Desktop Bridge is required** for every phase in this doc (build, audit,
  fix). If it is not connected to the working file, STOP and tell the user to
  connect it — there is no fallback.
- **Plugin-data names come from the profile.** This doc writes `screenflow` and
  `screenbuild` — the defaults of `profile.pluginData.flowNamespace` and
  `profile.pluginData.buildNamespace`; substitute the profile's values. WRITE
  only to those two. When READING, try them first, then each entry of
  `profile.pluginData.legacyFlowNamespaces` / `legacyBuildNamespaces`.

## The deltas table contract

Every source adapter defines these six rows:

| Row | Meaning |
|---|---|
| Honesty model | the shared page badge `— Auto-built, pending design review` on every build page, plus what the source adds (note-card line, PROPOSED batches for invented states) |
| `screenbuild:provenance` (page) | page-level stamp value: `auto-built`, or `converted` for a rebuilt Figma page |
| Parity ground truth | what built states are vision-compared against |
| Truth rule | which source artifact wins when spec, brief and ground truth disagree |
| Chrome rule | where OS chrome (status bars, keyboards, toggles) comes from |
| `screenbuild:source` (page) | the source kind: `video` \| `code` \| `figma-page` |

The owner tag is the same for every source: `screenbuild:owner` =
`figma-screens-from-source@<runId>`. A reader accepts owner
`figma-screens-from-source`, or any legacy value starting with
`figma-screens-from-`, so pages built before the skills were merged still audit.

Shared rule regardless of deltas: a state the SKILL invents beyond what the
source shows gets the amber `profile.copy.proposedBanner` banner (default
"PROPOSED – to confirm") above the device frame, invented copy tagged, own
section. Honesty is the feature.

## Running without subagents (MANDATORY read)

Every fan-out in this doc (Phase-1 investigators, Phase-2 spec writers, the
Phase-6 naming audit) is an **execution strategy, not the deliverable**. When the
Agent tool is unavailable — user config, harness restriction, a solo run — the
work does **not** get skipped: the lead performs it inline and still emits the
artifact. Losing the agents must never silently lose `screen-inventory.{json,md}`,
`components-inventory.md`, the per-element build specs, or the naming audit block.

| Fan-out | Artifact that is still REQUIRED solo |
|---|---|
| Phase-1 source-inventory | `screen-inventory.{json,md}` + one canonical PNG per state |
| Phase-1 standard-distill | `<ref>-standard.md`, node ids cited |
| Phase-1 component-inventory | `components-inventory.md` incl. PROVENANCE + GAPS + absence proofs |
| Phase-2 spec-writer | one build spec per batch, every element tagged |
| Phase-6.1 naming audit | the `## Naming audit` block, taxonomy verbatim from `conventions/naming.md` |

Solo runs are slower, not thinner. A phase whose artifact is missing is an
**incomplete run** — say so in the run report rather than proceeding as if done.

## Phase 2 — Build specs (parallel per flow batch)

Fan out spec writers over screen batches (~4-10 states each). Each spec:
element tree where every element is a **component nodeId + variant props +
text overrides** or an explicit PRIMITIVE with geometry + tokens; verbatim
text inventory (copy verbatim in `profile.copy.locale`, character for
character, accents included — transcribe from the source artifact the skill's
Truth rule names); token table; uncertainties with proposed fallbacks.

Ground rules (identity is by component **key**, never by name — see
`conventions/components.md`, "Identity is by key, not name"). They are written
for `library` mode; each ends with what changes in `local` mode:
- **Component match test** — a published library component satisfies an element
  only if it matches on ROLE + VARIANT + ANATOMY + TOKEN/THEME + PLATFORM.
  Failing only on text/value = still a match (override it). Failing on
  role/anatomy/variant = NOT a match → fallback. Tag every element
  `match` | `override-only` | `fallback`; for a fallback, name the CLOSEST
  library component/variant to derive from (nodeId/key) + why the match failed.
  Start the search from `profile.components.roles` (the component the profile
  names for a common role). *`local` mode:* the same test runs against the
  components already on the local components pages (authored by this or an
  earlier run); `fallback` means "author it".
- **Absence must be PROVEN, never asserted.** An element may be tagged
  `fallback` only with a recorded **absence proof**: the candidate library
  components actually inspected (by key), and the axis/slot each one lacks.
  "No library component does X" without that evidence is a finding against the
  run, not a gap. Inspect ANATOMY (instantiate + read the variant axes and
  slots) — a name-level scan cannot decide the match test. *`local` mode:* the
  proof lists the local components inspected; an empty local set is its own
  proof.
- **`partial-match` — when two components each hold half.** If component A has
  the required anatomy on one side and component B has it on the other (e.g. one
  list item ships title+description, another ships the switch), the element is
  `partial-match`, NOT a plain fallback. Derive from the closer base as usual,
  **and** the run report MUST carry a **property-addition proposal** naming the
  ONE existing component and the ONE property that would close the gap. A
  one-property addition to a shipping component beats a new component — propose
  that first, and only propose a NEW component when no single addition suffices.
  *`local` mode:* when the closer component was authored by THIS run, add the
  property to it directly and record the change; a component that existed
  before the run still gets the proposal, not an edit.
- **Fallback = derive from the library, never invent.** When nothing matches,
  the builder creates a NEW component composed ENTIRELY of published library
  sub-components (clone the closest library variant as the base; layout frames
  only as scaffolding), binding color/spacing/radius to the library's SEMANTIC
  variables (`profile.variables.semanticCollections` — never
  `profile.variables.primitiveCollections` directly) and type to the library's
  text styles (`profile.typography.textStylePattern`). It lives on the BUILD
  page in a strip named exactly `profile.labels.derivedStrip`, stamps
  `setSharedPluginData('screenbuild','provenance','derived')` on the derived
  master, carries a promotion note, and is tagged
  `fallback (derived from <library key>)` in the run report. *`local` mode:*
  author the component on a local components page
  (`profile.components.localPagePrefix`), named per
  `profile.components.namePattern`, bound to variables and text styles the build
  creates in `profile.variables.semanticCollections` /
  `profile.typography.textStylePattern` — no derived strip, no `derived` stamp,
  no promotion note; tag it `fallback (authored locally)`.
- **The ground truth wins** *(per deltas: Truth rule)* — spec writers
  transcribe what the canonical ground truth shows; when it contradicts the
  inventory or the brief, they flag it. Verify conflicts against the ground
  truth yourself and CUT states that turn out to be reconstructions.
- **Platform chrome** *(per deltas: Chrome rule)* — say so in every brief.

## Phase 3 — Pilot (USER GATE)

Build 2 screens (one simple + one rich) with ONE builder agent, then stop and
show the user. Corrections here are 10× cheaper than after 30 screens.
Include: the per-screen masters in a "masters strip" section (each a plain
component named `[Platform][Feature][Screen]`, states as boolean/text props —
never a component set), their instances in a flow section with state-instances
stacked at identical x and renamed to the delta (`[State] - description`), one
drawn arrow, one prototype reaction — the full pattern in miniature. The gate
ALSO confirms the proposed **naming vocabulary** from the inventory — wrong
words get caught at 2 screens, not 30.

## Phase 4 — Batch build (sequential, one persistent builder)

- **One writer at a time**: all Figma writes go through a single Desktop
  Bridge connection — keep ONE persistent builder agent for the whole build
  (it accumulates recipe knowledge; message corrections instead of
  respawning). Read-only agents may run in parallel with it.
- **One component source**: import published library components by key
  (`importComponentByKeyAsync` / `importComponentSetByKeyAsync`), never the
  file-local fork; when the library has NO match (Phase-2 match test), DERIVE
  one per the fallback rule above — never author on existing design-system
  pages, never fall back to the file-local fork. *`local` mode:* the one source
  is the local components pages — author the component there FIRST, then
  instance it; never build a screen from loose, un-componentized layers.
- Build section-by-section (one section per sub-flow, per the reference
  standard), wire as you build, report per section with a screenshot; the
  lead QAs in parallel and interrupts only on regression.
- **Three-layer flow rule**: (1) drawn arrows + labels live WITHIN sections —
  for humans (plus a short outgoing edge at a section boundary); (2) prototype
  ON_CLICK→NAVIGATE reactions follow the TRUE temporal journey across
  sections, set on instances/sublayers only — masters stay reaction-free;
  (3) a machine-readable flow graph written as `screenflow` sharedPluginData
  (`profile.pluginData.flowNamespace`) on the page (Phase 5). Real
  ConnectorNodes are FigJam-only.
- The Plugin-API mechanics and every known failure mode live in
  `figma-build-recipe.md` (sibling doc). The builder MUST read it.
- **Bridge degradation ladder** (see `figma-build-recipe.md` §"Performance &
  the degradation ladder"): clear console + reload plugin UI → prefer
  `frame.clone()`/instance-clone over fresh `createInstance` → build
  light/primitive screens first, park field-heavy ones → full Figma Desktop
  restart + plugin re-run. Never grind against >2 consecutive failures.

## Phase 5 — Parity sweep & package

- Re-compare each built state against its **canonical ground truth** *(per
  deltas: Parity ground truth)* — strings character for character (accents
  included), row counts, CTA enabled/disabled; fix drifts. **Pixel-less states** (no ground-truth PNG:
  md-spec sources, `code-derived (not rendered)`) get **checklist parity**
  instead: verbatim strings, element counts, CTA states from the spec.
- **Brand logos & low-res assets**: official vector marks are a designer
  handoff item — keep clean placeholders, never import low-res crops
  (video stills, mockup PNGs, screenshots) as if they were assets; note the
  gap in the run report.
- Tidy the page: masters strip left, sections in journey order, uniform
  gutters. Apply the skill's **Honesty model** *(per deltas)* — the page badge,
  the note card and any PROPOSED sections.
- **Write the machine flow graph**: derive the edge list from the live
  reactions and persist `setSharedPluginData('screenflow','edges', JSON)` + a
  `meta` key on the page — the namespace is `profile.pluginData.flowNamespace`
  (default `screenflow`), and it is the ONLY flow namespace the build writes;
  regenerate after ANY reaction or title change. A reader looks in that
  namespace first, then in each of `profile.pluginData.legacyFlowNamespaces`.
  Recipe + read quirks in `figma-build-recipe.md` §Machine-readable flow.
- **Stamp build provenance** (namespace `profile.pluginData.buildNamespace`,
  default `screenbuild`): `screenbuild:owner` =
  `figma-screens-from-source@<runId>`; `screenbuild:source` = the source kind
  *(per deltas)*; page-level `screenbuild:provenance` *(per deltas)*;
  per built element `screenbuild:specId` = `<master title + element path>`.
  Without `owner`, Phase 7 standalone treats the page as report-only; without
  `specId`, Phase-6 match stays report-only.
- Final package: per-section exports + one whole-page overview, final counts
  (masters, instances, arrows, reactions, `screenflow` edges), zero-stray +
  masters-clean verification. The page is now parseable by downstream tooling:
  titles follow the naming convention and the `screenflow` edges carry the
  flow, so any downstream tool can read it.

## Phase 6 — Audit (read-only)

Four checks, one merged report. Recipes in `audit-fix.md` — dispatch to it,
do NOT restate it:
- **Naming** — figma-deep-dive `naming-audit` mode, taxonomy verbatim.
- **Provenance** — published-twin detection, library-first; every instance is
  classified `library` / `foreign-library` / `local` by the check in
  `conventions/design-system.md` §"Is this component from the library?".
  *`local` mode:* skipped — report `provenance: n/a (local mode)`. The
  token/style compliance check (`audit-fix.md` §6.6) still runs in both modes.
- **Match** — spec tags + `specId` stamps; report-only without the stamp.
- **Parity** — vision-compare each built state to its canonical ground truth
  *(per deltas)*; **pixel-less states run checklist parity** (never skipped
  as "no frames"); a run whose source has no pixels at all notes
  `parity: checklist mode`.

Read-only — mutates nothing. Emits `audit-report.md` + `audit-findings.json`.

## Phase 7 — Fix (auto-run, bridge-gated)

Consume `audit-findings.json`, remediate per class (provenance swap with
equivalence gate → naming renames via `figma_execute`/`figma_rename_node`,
never `figma-write` in auto-run → match swaps once `specId` exists → derive
fallback → parity re-apply), self-verify by outcome, escalate on failure,
loop-until-clean. Full protocol, budgets, and safety net in `audit-fix.md`
§Phase 7 (token/style binding pass §7.6, safety net §7.7) — reference it, do
NOT restate. *`local` mode:* the provenance swap and the derive-fallback fix
have nothing to act on; naming, match, token/style binding and parity fixes run
unchanged.

## Run modes & flags

- **In-pipeline (default)** — after Phase 5 the loop auto-runs Phase 6 → 7 →
  re-audit; the build page carries `screenbuild:owner`, so fixes apply.
- **Standalone (`--page <id>`)** — defaults to report-only; auto-fix only
  with `--fix` or an existing `screenbuild:owner` marker (also honoured when
  found under one of `profile.pluginData.legacyBuildNamespaces`). The marker
  counts when owner is `figma-screens-from-source`, or any legacy value
  starting with `figma-screens-from-`.
- **`--report-only`** — stop after the audit report; never mutate.

Flags: `--report-only` · `--fix` · `--parity=auto|off|require` (default
`auto`; `require` FAILS the run only if a pixel-bearing source has no ground
truth — a pixel-less source satisfies `require` via checklist mode) ·
`--page <id>` · `--max-iterations <n>` (default 5) · `--change-budget <n>`
(default 200). See `audit-fix.md` §Config / flags.

## Shared "Does NOT do"

- Never modifies existing CONTENT, masters, or components of the build file.
  Default build location is a NEW page. When the user designates an EXISTING
  page, building there is allowed **only if it is empty**; nothing already on a
  page may be moved, renamed, restyled or deleted. On a designated existing page
  the honesty badge moves off the page NAME (renaming a user's page is a
  mutation) onto **every section name + the provenance note card + page-level
  `screenbuild` plugin data** — record the substitution in the run report.
  *`local` mode:* the build also ADDS components, variables and text styles
  (pages prefixed `profile.components.localPagePrefix`, collections in
  `profile.variables.semanticCollections`) — append-only; anything that existed
  there before the run is never edited, renamed or deleted.
- Never runs two Figma writers concurrently.
- Never mixes component provenance: the published library component by key
  when a match exists; else DERIVE from library atoms + variables (build page,
  tagged) — never raw primitives, never the file-local fork. *`local` mode:*
  always an instance of a local-page component — never loose layers, never raw
  values where a variable exists.
- Never switches `profile.mode` on its own: a `library` profile whose library
  is not enabled in the working file stops the run.
- Never builds, audits or fixes without the Desktop Bridge connected to the
  working file.
- Never invents states beyond the source without the amber
  `profile.copy.proposedBanner` banner.
- Never imports low-res brand assets; placeholders + a handoff note.
- Phase 7 never mutates outside the build page; renames in auto-run never go
  through `figma-write` (its contract is a human gate).

## Shared quick reference

| Situation | Do |
|---|---|
| Two source states look like the same screen | states of one screen — ONE `[Platform][Feature][Screen]` master, prop-set instances renamed to the delta, stacked at same x |
| A clustered "state" is really a different logical screen | keep the shared master; lead the delta with a `[Screen]` override bracket — a soft-flagged **reuse** per `conventions/naming.md` |
| Source never shows a needed screen | invented batch: precedent-derived + amber `profile.copy.proposedBanner` banner |
| Spec conflicts with inventory/brief | the ground truth wins (per deltas: Truth rule); verify yourself; cut reconstructions |
| createInstance starts timing out | degradation ladder (`figma-build-recipe.md` §"Performance & the degradation ladder"); clone > createInstance |
| Screenshot looks stale after edits | canvas repaint lag — select+zoom, or trust exportAsync |
| "Use connectors between screens" | FigJam-only — reactions + `screenflow` sharedPluginData ARE the machine-readable flow |
| A REST read shows old names/pluginData | server sync lag — wait, re-fetch; live scene graph (Bridge) is truth |
| File has a linked design-system library AND local copies | published library canonical — import by key |
| No published library component matches (`library` mode) | derive from library atoms on the build page (`profile.labels.derivedStrip` strip); note for promotion |
| No component exists yet (`local` mode) | author it on a local components page (`profile.components.localPagePrefix`), bind to semantic variables, then instance it |
| `library` mode but component lookup returns nothing | the library is not enabled in the working file — STOP, ask the user to enable it; never switch to `local` |
| Desktop Bridge not connected | STOP and ask the user to connect it — build, audit and fix have no fallback |
| Audit found file-local forks with a published twin | provenance swap (Phase 7), equivalence-gated → re-apply overrides → screenshot-verify |
| Standalone `--page` on a foreign page | report-only unless `--fix` or `screenbuild:owner` |
| Match findings but no `specId` stamp | report-only — the Phase-5 stamp promotes match to auto-fixable |
| Source has no pixels at audit time | checklist parity (never a silent skip) |
