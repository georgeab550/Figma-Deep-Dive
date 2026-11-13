# Agent briefs — templates for the pipeline's subagents

Subagents inherit nothing: no memory, no skills, no conversation. Every brief carries its full
context. These templates are condensed from real runs; adapt names/paths, keep the contracts.

> **Profile — MANDATORY.** No brief names a design system. The lead resolves the design-system
> profile first (`conventions/design-system.md` §"Resolving the profile") and passes it into EVERY
> brief: fill `<profile>` with the path to the resolved profile JSON (or paste the JSON). Each
> template starts with a `PROFILE:` line telling the subagent to read it; `profile.<path>` in a
> brief means a field of that file. `profile.mode` is `library` (a published library is enabled in
> the working file) or `local` (the build authors components, variables and text styles in the
> working file, on pages prefixed `profile.components.localPagePrefix`). A `library` profile whose
> library is not enabled is a STOP for every agent — report it, never switch mode.
>
> **Plugin-data names.** The briefs write `screenflow` / `screenbuild` — the defaults of
> `profile.pluginData.flowNamespace` / `buildNamespace`; substitute the profile's values. Write
> only to those; when reading, try them first, then `profile.pluginData.legacyFlowNamespaces` /
> `legacyBuildNamespaces`.
>
> **Two read channels, one write channel.** A *reference file* (someone else's file, read for its
> standard) is read through the official Figma MCP. The *build file* is read AND written through
> the figma-console Desktop Bridge, which is REQUIRED: if it is not connected to the build file,
> the agent stops and says so — there is no fallback for building, writing or auditing.
>
> **Paths.** Convention and build docs are plugin-relative: `$CLAUDE_PLUGIN_ROOT/conventions/…`,
> `$CLAUDE_PLUGIN_ROOT/build/…` (if the variable is unset, resolve the plugin root from the skill
> file's real path via `readlink -f`, two directories up). Give subagents the ABSOLUTE paths.

> **Output paths — MANDATORY.** Every file a subagent writes (screenshots, inventories, specs,
> reports) goes under the run `<workspace>` (the session scratchpad) or its `<built>` subdir.
> **Never** write into the user's working git repo or any path outside the scratchpad — the build
> itself targets a NEW Figma page only; nothing else lands on disk outside `<workspace>`.

## 1. frame-inventory (Phase 1, vision)

```
You are building a screen/state inventory from an app screen-recording. You have vision — Read PNGs.
PROFILE: read <profile> first (platform tags = profile.screens.platformTags; copy language =
profile.copy.locale).
Frames: <workspace>/frames-1fps/ (f_NNN.png, NNN = second), <workspace>/frames-scene/ (strong cuts).
Expected journey (from the PRD, order may differ): <numbered journey steps>.
Method (be efficient): scene frames first → every 4th 1fps frame → drill where neighbors differ
(catch short-lived dialogs/sheets/toasts). Same layout skeleton + different content = STATES of one
screen; scrolled positions = one screen (note what scroll reveals); sheets/dialogs/full-screen
pickers = sub-states overlaying the parent. If a "state" is really a DIFFERENT logical screen that
shares the layout (platform+feature match), record it as a REUSE — same master, delta leads with a
`[Screen]` override bracket (soft-flag, not a new master). Ignore transition-blur frames.
Pick ONE canonical (settled) frame per state + extra frames for scroll-hidden content.
Write: <workspace>/screen-inventory.json {screens:[{id,name,purpose,states:[{state,canonical,
extra_frames,t_sec,notes}],nav_from,nav_to}],flow_order,uncertain} AND screen-inventory.md
(table: # | screen | state | canonical | t | description | notable UI).
Name screens PascalCase English; app copy stays verbatim in its original language
(profile.copy.locale), character for character.
Final message: counts, flow order, ambiguities. Files are the deliverable.
```

## 2. standard-distill (Phase 1)

```
Distill the technical standard for how screens are built in Figma file <fileKey> ("<name>"),
reference node <node-id>, so a builder can replicate it. PROFILE: read <profile> first — it names
the design system (profile.library.name, profile.variables.*, profile.typography.*). Load the
official Figma MCP tools via ToolSearch (get_metadata, get_design_context, get_screenshot) — this
is a REFERENCE file, so it is read through the official Figma MCP, never the Bridge. Read-only.
Cover with node-id evidence: page/section organization; frame NAMING verbatim (downstream parsers
key off titles); device width (compare with profile.screens.buildWidth, report a mismatch);
**CONFIRM the merged screen model** — one plain COMPONENT master per SCREEN
(`[Platform][Feature][Screen]`), states carried by boolean/text/instance-swap component properties
+ content overrides, NOT one master per state and NOT a COMPONENT_SET — PROVE it (component
properties present on the master; `Prop=Value` variant children ABSENT at screen level; instances
carry a `[State] - description` delta name, not the full prefix); how the states of one screen are
laid out (stacked at identical x? labeled by delta?); autolayout skeleton (pinned
header/content/CTA regions, gaps, child widths); shared design-system components used (names/ids;
which fill the roles in profile.components.roles); token/style binding (which collections and
modes — compare with profile.variables.semanticCollections / .modes); typography roles (against
profile.typography.textStylePattern); flow wiring (drawn arrows vs prototype reactions — check
reactions explicitly, don't assume). This captures the reference's flow-wiring **pattern**
(the mechanism), NOT the source's actual edges — the source flow graph comes from the source
adapter's flow harvest (`legacy-inventory` step 6 → `flowEdges`), never from this reference read.
Ground every claim in
`$CLAUDE_PLUGIN_ROOT/conventions/naming.md` + `$CLAUDE_PLUGIN_ROOT/conventions/components.md`.
Where the reference disagrees with the profile (other collections, other text-style names, another
width), list it under "Profile mismatches" — do not silently follow either.
Write <workspace>/<ref>-standard.md. ~10-15 tool calls.
```

No reference file (the usual case in `local` mode): do not dispatch this brief. The plugin's
conventions ARE the standard — the lead writes a short `<workspace>/<ref>-standard.md` that cites
`conventions/naming.md` + `conventions/components.md` and the profile's screen geometry, so the
artifact still exists for the spec writers and the builder.

⚠️ The states/master question is where a distill most easily goes wrong (inventing a
master-per-state + stacked-instances pattern). The merged convention is the opposite: **one
plain-component master per screen, states = boolean/text component properties** (see
`conventions/naming.md` §"State is boolean properties…" and `components.md`). Demand
component-property-level proof; if ground truth ever seems to contradict the convention,
re-inspect immediately and defer to the convention — one wrong assumption here multiplies across
every built screen.

## 3. component-inventory (Phase 1)

```
Inventory the building blocks of the LIVE build file "<name>" (figma-console Desktop Bridge
connected — figma_get_status first; not connected or wrong file = STOP and report, no fallback).
PROFILE: read <profile> first; it names the design system and its mode (profile.mode).
Load figma-console tools via ToolSearch (search_components, get_file_data,
get_component, get_styles, get_variables, get_library_components, get_library_variables,
get_library_component_by_key). READ-ONLY.
MODE: `library` → the published library (profile.library.name) must be enabled in this file; if
get_library_components returns nothing, STOP and report "library not enabled" — never continue as
if the file had no design system. `local` → there is no library: inventory the pages prefixed
profile.components.localPagePrefix (possibly empty on a first run) and the variables / text styles
already in the file; section 6 shrinks as noted there.
Deliver <workspace>/components-inventory.md:
1. Pages (note naming system / status emoji conventions).
2. Component table grouped by role (navigation, buttons, inputs, cards/lists, sheets, feedback,
   misc): name | nodeId | key variant properties+values | purpose. Fetch full variant props for
   the ~15 screen-critical masters (top bar, CTA, text field, select row, switch, checkbox,
   list items, sheets, snackbar, illustrations).
3. Precedent screens: the nearest existing feature's pages — section/frame naming verbatim,
   states pattern, 2-3 template frames (list / form / offers) with nodeIds + structure sketch.
4. Tokens: collections, semantic color families, typography tokens, dimension tokens — mapped
   onto the profile: which collections are profile.variables.semanticCollections /
   .primitiveCollections / .typographyCollections, which modes exist vs profile.variables.modes,
   and whether names follow profile.variables.tokenPatterns (e.g. on the default profile:
   `color/{text|surface|border|icon|background|brand}/<name>`, `spacing/<px>`). Text styles vs
   profile.typography.textStylePattern + the sizes/weights actually present vs
   profile.typography.sizeLadder / .weights. Note if the file has NO classic styles (tokens
   only). Report every collection, mode or style family the profile does not name.
5. GAPS: screen-critical elements with no component (spinner? dropdown? chips?) + what to use
   instead. Check profile.components.roles first — a role the profile maps is not a gap. EVERY
   gap needs an ABSENCE PROOF — list the candidate components you actually INSTANTIATED and
   inspected (name + key) and the axis/slot each one lacks. A name-level scan cannot prove
   absence: anatomy lives in the variant axes (e.g. a boolean axis that adds a second text line)
   and in the slot options, so instantiate before you claim nothing fits. An unproven gap is a
   finding against the run. Where two components each hold HALF of what is needed, report it as
   `partial-match` plus a one-property proposal ("add `Switch=Yes|No` to X"), not as a gap.
   (`local` mode: gaps are simply the list of components the build must author; the proof is the
   list of local components inspected.)
6. PROVENANCE (single source of truth; `library` mode): classify EVERY component with the check
   in `$CLAUDE_PLUGIN_ROOT/conventions/design-system.md` §"Is this component from the library?" —
   `library` (remote AND its source file key is in profile.library.fileKeys), `foreign-library`
   (remote, another file) or `local` (authored on THIS file's own pages). Enumerate the published
   library via get_library_components/get_library_variables — an in-file search_components scan
   also returns the file-local fork and hides the split. The published library is canonical;
   record each component key so the builder can import by key. Flag every case where the file
   holds BOTH a published and a local copy of the same component.
   PIN THE LIBRARY FILE KEY: use profile.library.fileKeys; if it is empty, resolve it once (each
   of profile.library.componentKeys -> get_library_component_by_key -> the fileKey they share),
   record it and tell the lead so it can be saved to the profile — `remote:true` alone does NOT
   mean "from the library". Build files routinely subscribe older/other published libraries whose
   components are also remote; classify those as `foreign-library`, never as canonical. If the
   key cannot be resolved, fall back to profile.library.foreignNameHints and mark every row
   `unverified`.
   (`local` mode: skip the classification — every component is local by definition. List what
   sits on the profile.components.localPagePrefix pages, with keys, and stop there.)
```

## 4. spec-writer (Phase 2, vision; one per batch of ~4-10 states)

```
You write Figma BUILD SPECS for <feature> screens, reverse-engineered from the source's canonical frames (video stills, renders or screenshots),
for a builder using the Figma Plugin API on file "<name>".
PROFILE: read <profile> first — every design-system fact below comes from it (profile.mode,
profile.variables.*, profile.typography.*, profile.components.roles, profile.screens.*).
READ FIRST: <exemplar spec>.md (FORMAT EXEMPLAR), components-inventory.md (+ token catalog),
<ref>-standard.md (layout skeleton + naming).
CONVENTIONS (source of truth: `$CLAUDE_PLUGIN_ROOT/conventions/naming.md` +
`$CLAUDE_PLUGIN_ROOT/conventions/components.md`): <target platform> build (a tag from
profile.screens.platformTags; profile.screens.buildWidth px wide, platform-variant props); ONE
plain-component master per SCREEN named `[Platform][Feature][Screen]` (brackets concatenated, no
separator, no state/description) — states are boolean/text/instance-swap component properties +
content overrides on that one master, NOT extra masters and NOT a component set; each state is a
placed instance whose name is the delta only, `[State] - description` (hyphen ` - `, never an
en-dash; primary/default has no `[State]` bracket, e.g. `- <description>`). Bind everything to
tokens (variables in profile.variables.semanticCollections, named per
profile.variables.tokenPatterns; text styles per profile.typography.textStylePattern — snap an
observed size to the nearest step of profile.typography.sizeLadder within ±2px and apply
profile.typography.substitutions; a size or weight with no step in range is a proposed gap, not a
raw value); screen bg = profile.screens.screenBackground when set (list rows and cards carry
their own surface — do not stack a second one under them); status bar time =
profile.screens.statusBarTime; CTA = the profile.components.roles.bottomActionBar pattern
(pinned bottom bar holding the roles.primaryButton); dropdowns = the roles.input component with a
trailing chevron (opens a bottom sheet); sheets/pickers = SEPARATE states (dimmed parent + sheet).
MATCH TEST (classify EVERY element): a published library component fits only if it matches ROLE +
VARIANT (needed state exists w/o structural surgery) + ANATOMY (all slots present) + TOKEN/THEME
+ PLATFORM. Text/value mismatch = still a match (override). Role/anatomy/variant mismatch = NOT a
match → fallback. Mark each element `match` | `override-only` | `fallback`; for a fallback, name
the CLOSEST library component/variant to derive from (nodeId/key) + why the match failed, with the
ABSENCE PROOF (components inspected by key + the axis/slot each lacks). The builder derives
fallbacks from library atoms — color/space/radius bound to semantic variables
(profile.variables.semanticCollections, never profile.variables.primitiveCollections), type via
the library's text styles — never the local fork.
`local` MODE (profile.mode == "local"): there is no library. Run the same test against the
components already listed in components-inventory.md (the profile.components.localPagePrefix
pages); `fallback` then means "the builder authors this component on a local components page",
named per profile.components.namePattern — list its anatomy, props and the variables / text
styles it needs (existing or to be created). No "closest library component", no promotion note.
YOUR SCREENS: <per state: canonical frame file + 1-line content description + target name>.
Spec format per state: # <frame name> / Canonical + purpose / ## Element tree (top→bottom;
each element = COMPONENT name (nodeId) | props | overrides {"exact copy"} | sizing — or
PRIMITIVE + geometry + tokens) / ## Text inventory (verbatim in profile.copy.locale, character
for character | role/token) / ## Tokens used / ## Uncertainties (+ fallback).
TRANSCRIBE THE FRAME, not this brief — flag any contradiction. Keyboards: omit + note, unless
the design-system precedent includes them.
Final message: files written + riskiest uncertainty per screen (1 line each).
```

For PROPOSED screens (no video evidence): same format, plus a top blockquote
`> ⚠️ PROPOSED — no video evidence; derived from <precedent frame + nodeId>. Requires
product/design confirmation.`, an amber annotation banner (text = `profile.copy.proposedBanner`,
default "PROPOSED – to confirm"; warning-surface token) as element 0 ABOVE the device frame, and
`[PROPOSED COPY]` tags on
invented strings. The spec agent must screenshot and study the named precedent frames first.

## 5. builder (Phases 3-4, ONE persistent agent)

```
You are a Figma builder. Assemble screens inside the LIVE file "<name>" via figma-console.
PROFILE: read <profile> first. It decides where components come from (profile.mode), which
variables and text styles you bind to, the exact labels you create (profile.labels.*) and the
plugin-data namespaces you write (profile.pluginData.flowNamespace / .buildNamespace — written
below as their defaults `screenflow` / `screenbuild`; use the profile's values).
INPUTS: build-specs/*.md, <ref>-standard.md, components-inventory.md, reference frames for QA,
$CLAUDE_PLUGIN_ROOT/build/figma-build-recipe.md (READ FULLY — every gotcha in it cost real time).
SAFETY RAILS: figma_get_status first — Desktop Bridge not connected or wrong file = STOP and
report (there is no fallback). `library` mode and the library is not enabled in this file
(import by key fails / library lookup is empty) = STOP and report; never switch to `local` on
your own. Create nodes only on the page you create ("<page name>"); never modify existing
pages/components/masters; instance properties/overrides only on your own instances.
PATTERN (per figma-build-recipe.md §"The structural pattern" + the merged
`conventions/naming.md`+`components.md`): build the screen ONCE as a frame (width
profile.screens.buildWidth) from design-system instances →
add state axes as boolean/text/instance-swap component PROPERTIES (never a component set) →
createComponentFromNode → name the master `[Platform][Feature][Screen]` → move to masters strip →
one createInstance per state into the flow section, set its props + content overrides, rename the
instance to the delta only (`[State] - description`; primary = bare `- description`); state-instances
stacked at identical x; drawn arrows within sections; journey-chain reactions across them
(masters stay reaction-free).
SOURCE OF TRUTH (`library` mode): instance the PUBLISHED library component — import by key
(importComponentByKeyAsync / importComponentSetByKeyAsync); NEVER place the file's own local
design-system-page copy when a published twin exists (a file scan surfaces both). When the spec
marks an element `fallback`, DERIVE it: clone the closest published library variant (import by key
→ pick nearest variant → clone) or compose from library sub-components, binding fill/space/radius
to the library's semantic variables (profile.variables.semanticCollections — never
profile.variables.primitiveCollections) and type to the library's text styles / typography
variables (profile.typography.textStylePattern, profile.variables.typographyCollections) (layout
frames only). Place it on the build page in a SECTION named exactly profile.labels.derivedStrip
(never on design-system pages), set its description to a promotion note (send into the library +
re-link so future screens use the published version), **STAMP the derived master
`<comp>.setSharedPluginData('screenbuild','provenance','derived')`** (this tag is what the Phase-6
provenance classifier keys on to route it to the §6.5 compliance test instead of fork classification —
setting `description` alone is NOT enough), and report it as `fallback (derived from <key>)`. Never
place the local fork.
SOURCE OF TRUTH (`local` mode): there is no library. Author each component the specs need on a
page prefixed profile.components.localPagePrefix (create the page if missing; append-only — never
edit a component that existed before this run), named per profile.components.namePattern, bound
to variables in profile.variables.semanticCollections and text styles named per
profile.typography.textStylePattern — create the variables / styles that do not exist yet, never
leave a raw value. Then INSTANCE it into the screen; never build a screen from loose layers. No
derived section, no `derived` stamp, no promotion note; report each as `fallback (authored
locally)`.
EXECUTION: one section per sub-flow, flow order; wire as you build; QA loop ≤3/screen vs the
canonical frame; per-section report to "main" (SendMessage) + section screenshot to <built>/.
Report problems instead of going idle silently; never grind past 2 consecutive failures.
CLOSING STEP (Phase 5 finalize — you inherit nothing, so these stamps are on YOU):
(1) STAMP build provenance so the audit/fix loop can bind findings + know it owns the page:
`page.setSharedPluginData('screenbuild','owner','figma-screens-from-source@<runId>')`, the source kind
`page.setSharedPluginData('screenbuild','source','<video|code|figma-page>')`,
and, per built element, `node.setSharedPluginData('screenbuild','specId','<master title + element path>')`
— WITHOUT `owner`, Phase 7 is report-only; WITHOUT per-element `specId`, Phase 6 match is report-only.
(2) regenerate the `screenflow` sharedPluginData edge graph from live reactions (recipe
§Machine-readable flow) — it is derived data and MUST be rewritten after any reaction or title change.
Write it ONLY to profile.pluginData.flowNamespace; never to a legacy namespace.
FIX LOOP (Phase 7): after the auditor emits `audit-findings.json`, consume it and apply fixes per
`$CLAUDE_PLUGIN_ROOT/build/audit-fix.md` §7 — follow that protocol, do NOT restate it. (`local` mode:
there are no provenance or derive findings — naming, match, token/style and parity fixes only.) COALESCE provenance + match
fixes by owning master (a master edit propagating to N instances = ONE change-budget unit); NAMING
does NOT coalesce (`violation:master-format` lands on the master, the other classes on the individual
variant instance; `reuse` is soft-flagged, never auto-fixed). Order per master: provenance → match →
naming → parity. SELF-VERIFY BY OUTCOME — screenshot the screen-state for swaps/derives, re-read the
name for renames, run the §6.5 compliance test for derives — never trust the `remote` flag. ESCALATE
(report, don't mutate further) on a diverged fork, a non-compliant derive, no twin source, verify fail
after **N=2** tries, or the change budget (default 200 master-level mutations); remembered by fingerprint
so re-audit won't retry. On a swap verify-fail, REVERT (swap back to the fork + re-apply captured
overrides) BEFORE escalating — never leave a regressed instance on the page. LOOP-UNTIL-CLEAN
(re-audit each pass) up to `--max-iterations` (default 5). BRIDGE-GATED: if the bridge dies, run the
stray-node sweep, write the report, stop. STANDALONE: `setCurrentPageAsync` the `--page` target first,
and refuse to auto-fix a page lacking the `screenbuild:owner` marker (read
profile.pluginData.buildNamespace first, then each of profile.pluginData.legacyBuildNamespaces)
unless `--fix`. The marker counts when owner is `figma-screens-from-source`, or any legacy value
starting with `figma-screens-from-` (pages built before the skills were merged), with or without
its `@<runId>` suffix. Rename only via
`figma_execute`/`figma_rename_node`, never `figma-write`.
```

Keep this agent alive for the entire build: it accumulates working knowledge (what times out,
which components misbehave) that a respawn would lose. Send corrections as messages. If the
lead QAs sections in parallel, interrupts are messages too — expect message crossing and state
clearly what is already done.

## 6. auditor (Phase 6, read-only)

```
You audit an already-built Figma page and emit findings — READ-ONLY, mutate NOTHING (Phase 7 fixes).
PROFILE: read <profile> first — the audit classifies against it (profile.mode,
profile.library.fileKeys, profile.variables.*, profile.typography.*, profile.labels.*,
profile.pluginData.*). When reading plugin data, try profile.pluginData.buildNamespace /
.flowNamespace first, then each legacy namespace the profile lists.
Load figma-console tools via ToolSearch (figma_get_status, figma_execute, figma_capture_screenshot,
figma_get_variables). figma_get_status first — Desktop Bridge not connected or wrong file = STOP
and report; the audit has no fallback. `$CLAUDE_PLUGIN_ROOT/build/audit-fix.md` is the recipe —
every check, script, twin-harvest,
classification, and degradation rule lives there; this brief only says WHAT to run, that doc says HOW.
INPUTS: the build page id (or `--page <id>` for standalone); and WHEN PRESENT —
`canonical-screen-registry.json` (from screen-canonicalizer), the build-specs/*.md (per-element
`match | override-only | fallback` tags), and the canonical ground-truth frames.
RUN THE FOUR CHECKS (audit-fix.md §Phase 6): NAMING — dispatch figma-deep-dive `naming-audit` mode,
consume its taxonomy verbatim, never hand-roll a regex; PROVENANCE (`library` mode) — classify by
getMainComponentAsync (dynamic-page-safe) into `library` / `foreign-library` / `local` with the check
in `$CLAUDE_PLUGIN_ROOT/conventions/design-system.md` §"Is this component from the library?" (never by
the `remote` flag alone), build the twin registry LIBRARY-FIRST (figma_get_library_components) then
backstop with the on-page-library-instance harvest, dedupe by component identity, and REPORT EVERY
fork — forks WITH a published twin are fixable in Phase 7, forks with NO twin are reported + escalated
(build-masters + `library` instances exempt; a derived master is recognised by its
`screenbuild:provenance = derived` stamp and by sitting in the profile.labels.derivedStrip section);
MATCH — consume `canonical-screen-registry.json` + spec tags; PARITY — screenshot each state vs its
canonical frame (chrome-ignored, PROPOSED-exempt); plus the token/style compliance check (§6.6).
`local` MODE: SKIP PROVENANCE entirely — no fork, foreign or "missing from the library" finding
exists; report `provenance: n/a (local mode)`. Naming, match, parity and token/style compliance run
unchanged (authored nodes must bind to profile.variables.semanticCollections).
DEGRADE (audit-fix.md §Degradation): no specs / no `specId` stamp → MATCH is report-only; no canonical
registry → dispatch screen-canonicalizer to build one, never cluster by hand; no ground-truth pixels →
checklist parity (strings, counts, CTA states), note the mode; no twin source (`library` mode: the
library lookup is empty and the page has zero library instances) → PROVENANCE findings escalate,
never guess a twin — and say the library looks not enabled in this file.
EMIT: `audit-report.md` (counts by class/severity, escalations by fingerprint) + `audit-findings.json`
(one object per finding; fingerprint = `master title | element path | class`; schema in audit-fix.md
§Report format). Structural checks return FINDINGS ONLY via figma_execute — never route a whole tree
or base64 through context.
Final message: counts by class + severity; how many are auto-fixable vs report-only vs escalated.
```

## QA cadence for the lead

- Verify every "done" claim with your own eyes (Read the exported screenshot; on suspicion,
  take a live screenshot or read the scene graph). Re-exported JPGs can come back visually
  identical to the pre-fix state — canvas repaint lag; the scene graph tells the truth.
- Verify canonical-frame conflicts yourself before cutting or keeping a state.
- Interrupt on regression only; batch cosmetic nits into the Phase-5 sweep.

---

# Code source adapters (`figma-screens-from-source`, kind `code`)

The `source-inventory` investigator replaces frame-inventory when the source is
a code project, HTML, a `.pen` file, images / screenshots or a written spec (from
any author). It MUST emit the same contract frame-inventory emits —
`screen-inventory.{json,md}` + one canonical PNG per state at
`profile.screens.renderWidth` (default 390px) — so every downstream brief above
applies unchanged. This source is the usual `local`-mode case (code or stills,
no design system): the briefs above then follow their `local` branches.

**Parity mode (family-wide rule):** pixel-less states (md-spec source,
`code-derived (not rendered)`) run CHECKLIST parity (verbatim strings, element
counts, CTA states) rather than being skipped, and an md-spec source SATISFIES
`--parity=require` via checklist mode — this is now the family-wide rule per
`guarded-build-core.md` §Phase 6 and §Run modes & flags.

Extensions:

## source-inventory brief template

> You are a read-only source inventory agent. Source artifact: `<path>` (shape:
> `<code-project|html|pen|images|md-spec>`). Sandbox (code projects only):
> `<sandboxPath>` with dev server on `<port>` (already booted — do NOT install or
> boot anything yourself; if the server is dead, report it and stop).
> PROFILE: read `<profile>` first (render width = `profile.screens.renderWidth`;
> platform tags = `profile.screens.platformTags`; copy language =
> `profile.copy.locale`).
>
> 1. Enumerate screens STATIC-FIRST: each HTML file / top-level screen section /
>    route = one static screen. Only if the code contains state-switching logic
>    (router, conditional renders) plan extra states.
> 2. For each screen/state: render at `profile.screens.renderWidth`×844 (390×844
>    on the default profile) via Playwright headless
>    (`file://<file>` or `http://localhost:<port><route>`), full-page screenshot →
>    `frames-full/<NN>-<slug>.png`. One PNG per state.
> 3. Read the CODE for verbatim copy (in `profile.copy.locale`, character for
>    character), raw colors, font sizes/weights, spacing and radii, and DOM
>    structure. Code is ground truth for CONTENT; your render for LAYOUT. In
>    `local` mode these raw values are what the build turns into variables and
>    text styles, so list each distinct value once with where it is used.
> 4. States in code but unreachable in the browser: keep them, set
>    `"rendered": false` (they'll be specced from code and get checklist parity).
> 5. Cluster per the standard rules: same layout skeleton = states of one screen;
>    sheets/dialogs = sub-states; a different logical screen sharing a master =
>    reuse (soft-flag, `[Screen]` override bracket).
> 6. Propose the naming vocabulary: `[Platform][Feature][Screen]` per screen
>    (`[Platform]` from `profile.screens.platformTags`), derived in priority order user brief/PRD → HTML `<title>`/headings → code
>    component/file names. Mark low-confidence names `<?>`.
> 7. Output `screen-inventory.json` + `screen-inventory.md` per the schema below.
>
> For `.pen` sources: use pencil MCP `batch_get` (+ `snapshot_layout`) for the
> tree and `export_nodes` for the PNGs; never Read/Grep the .pen file.
> For image sources: cluster the stills; the image IS the canonical PNG.
> For md-spec sources: no PNGs; emit the inventory with `"rendered": false` on
> every state and note `parity: checklist` at the top.

## screen-inventory.json — extensions over the video schema

Each state object gains:

```json
{
  "sourceRef": "checkout.html#success | /routes/checkout | pen:node-id | img/03.png | spec §4.2",
  "rendered": true,
  "canonicalPng": "frames-full/07-checkout-success.png",
  "copySource": "code | render | spec"
}
```

Per screen: `"proposedMaster": "[Native][Checkout][Order status]"` +
`"vocabularyConfidence": "high | low"` (low = confirm wording at the pilot gate).

## run-state.json (written by Phase 0, read on re-run)

```json
{
  "sandboxPath": "<scratchpad>/claude-design-sandbox",
  "lockfileHash": "sha256 of package-lock.json/yarn.lock/pnpm-lock.yaml",
  "port": 5173,
  "pid": 12345,
  "bootedAt": "<iso timestamp>"
}
```

Re-run logic: hash mismatch → reinstall; port not answering → reboot server;
sandbox missing → recopy. Never touch the original source directory.

---

# Figma-page source adapter (`figma-screens-from-source`, kind `figma-page`)

The `legacy-inventory` investigator replaces frame-inventory when the source
is an existing old-format Figma page. Same output contract:
`screen-inventory.{json,md}` + one canonical PNG per state.

## legacy-inventory brief template

> You are a read-only source inventory agent. Source: Figma file `<url>`,
> page `<node id>` (old-format screens). The build target is a NEW page in
> the SAME file — you never write anything.
> PROFILE: read `<profile>` first (`profile.mode`, `profile.library.fileKeys`,
> `profile.copy.locale`, `profile.pluginData.*`).
>
> 1. Extract the source page via the `figma-deep-dive` agent's patterns, over
>    the Desktop Bridge (the build that follows requires it anyway; REST is only
>    that agent's degraded fallback for pure reads, and it must announce it).
>    Enumerate top-level frames/sections in visual order.
> 2. Cluster into SCREENS vs STATES: one-master-per-state and component-set
>    variants collapse into ONE logical screen; detached near-duplicates
>    cluster by layout skeleton; sheets/dialogs/pickers = sub-states of the
>    parent. Dispatch `screen-canonicalizer` when ambiguous — never cluster
>    by hand.
> 3. `figma_capture_screenshot` each frame/state → `frames-full/<NN>-<slug>.png`
>    — these are the canonical PNGs AND the parity ground truth.
> 4. Copy: transcribe TEXT nodes verbatim (in `profile.copy.locale`, character
>    for character, accents included).
> 5. Identity: for every INSTANCE record `{nodeId, componentKey, remote, origin}`
>    via `getMainComponentAsync` over the Bridge (required — there is no REST path for building). `origin` is
>    `library` / `foreign-library` / `local` per
>    `$CLAUDE_PLUGIN_ROOT/conventions/design-system.md` §"Is this component from
>    the library?" — `remote` alone does not mean "from the library". Flag
>    `local` and `foreign-library` instances — Phase 7 will reconcile them.
>    (`local` mode: record `origin: "local"` for all and flag nothing.)
> 6. Flow harvest: walk the page for prototype `reactions` (owning instance →
>    destination) and drawn arrow vectors + labels; also read any flow graph
>    already stored in page plugin data (`profile.pluginData.flowNamespace`,
>    then each of `profile.pluginData.legacyFlowNamespaces`). Output an edge list
>    `{from, to, label?}` keyed by screen/state titles. This list is the
>    **authoritative** flow graph the builder re-creates on the build page —
>    harvest EVERY reaction on the ACTUAL source page (don't sample, don't infer
>    from the reference); record the total count so the builder can verify 1:1.
> 7. Naming, audit-first: run the `naming-audit` taxonomy over the source
>    frames. Rows `ok` → name carries over VERBATIM into `proposedMaster` /
>    state deltas. Violations → propose per the taxonomy's fix classes
>    (description-from-flow-position where missing), confidence `low`,
>    confirmed at the pilot gate.
> 8. Output `screen-inventory.json` + `.md` per the standard schema, with the
>    legacy extensions below.

## screen-inventory.json — legacy extensions

Each state object gains:

```json
{
  "sourceRef": "figma:<frame node id>",
  "rendered": true,
  "canonicalPng": "frames-full/03-order-status.png",
  "copySource": "text-nodes",
  "instances": [{ "nodeId": "1234:5678", "componentKey": "<componentKey>", "remote": true, "origin": "library | foreign-library | local" }],
  "namingAudit": "ok | violation:<class>"
}
```

Per screen: `"proposedMaster"` (verbatim when `namingAudit: ok`, else the
proposal), `"vocabularyConfidence": "high | low"`, and a page-level
`"flowEdges": [{ "from": "...", "to": "...", "label": "..." }]` array from
the harvest.
