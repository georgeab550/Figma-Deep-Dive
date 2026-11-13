# Figma build recipe — Plugin-API mechanics & failure modes

Everything here cost real time once. The builder agent reads this BEFORE its first
`figma_execute`. Node ids and keys in examples are placeholders (`<fileKey>`, `1234:5678`) —
they illustrate the shape, not values to reuse.

**Before anything else:**

- **Resolve the design-system profile** per `$CLAUDE_PLUGIN_ROOT/conventions/design-system.md`.
  Every library name, collection, component role, geometry default, label and plugin-data
  namespace below is a `profile.<path>` field.
- **`library` mode requires the library to be enabled in the working file.** If component
  lookup returns nothing, STOP and tell the user to enable it — never silently switch to
  `local` mode.
- **The Desktop Bridge is required** for everything in this file — no fallback. If it is not
  connected to the working file, STOP and tell the user to connect it.

## The structural pattern (per the plugin's naming/component convention)

**Source of truth:** `$CLAUDE_PLUGIN_ROOT/conventions/naming.md` (master/variant naming) and
`conventions/components.md` (property model). Build to those — the notes here are only the
Plugin-API mechanics for realizing that model.

A screen exists **ONCE** as a plain **COMPONENT master** — **one per SCREEN, not per state**, and
**never a `COMPONENT_SET`** (component sets with `Prop=Value` children live one layer down, inside
the design-system pieces, never at the screen level). The master name is `[Platform][Feature][Screen]`
— brackets concatenated, **no separator, no `[State]`, no description** (e.g.
`[Native][Checkout][Address]`; `[Platform]` is one of `profile.screens.platformTags`). This is
the ONLY place the prefix is stored.

**States are boolean / text / instance-swap component PROPERTIES + content overrides on that one
master** — not extra masters, not variant children. Each state the source shows becomes a placed
**instance** of the master with those props set and copy overridden, and that instance is
**renamed to the delta only**: `[State]? - description` (separator is a **hyphen** ` - `,
space-hyphen-space, never an en-dash), e.g. `[Edit address] - Change address from order
summary`. The primary/default state carries **no `[State]` bracket** (e.g. `- Order list item
examples`). **Never store the `[Platform][Feature][Screen]` prefix on the instance** — identity is
by component (`mainComponent.key` on the bridge, `componentId` over REST), and the full logical
name is assembled downstream (by `screen-canonicalizer` or any screen catalog) from the master
name + the instance delta, never written on a frame.

Masters park in a "masters strip" SECTION at large negative x on the build page. Flow SECTIONS hold
the **instances**, left-to-right in flow order; the state-instances of one screen stack
**vertically at identical x** (~200px gap); different screens sit ~450px apart. Steps:

1. Build the screen **once** as a plain FRAME (`profile.screens.buildWidth` wide — default 375;
   height = full un-clipped content), composed of published design-system component instances
   (see Library provenance below). `local` mode: composed of instances of the components
   authored on the working file's `profile.components.localPagePrefix` pages.
2. `figma.createComponentFromNode(frame)` → the screen master in place — instant, lossless (keeps
   auto-layout, token bindings, children). Name it `[Platform][Feature][Screen]` and re-parent it
   into the masters strip. **Do this BEFORE adding any state property:** `addComponentProperty`
   lives on `COMPONENT`/`COMPONENT_SET` only — a plain `FRAME` has no such method, so the frame must
   become a component first.
3. Add each state axis as a component PROPERTY on the **master** via
   `master.addComponentProperty(name, type, defaultValue)`: **boolean** for a show/hide part,
   **text** for copy that changes, **instance-swap** for a swapped sub-block — per `components.md`
   (prefer booleans + text over new variants; do NOT build a `COMPONENT_SET`). Then WIRE each
   property to the sublayer it drives by setting that sublayer's `componentPropertyReferences` — a
   boolean prop → the sublayer's `visible`, a text prop → the text node's `characters`, an
   instance-swap prop → the child instance's `mainComponent`. **Without this
   `componentPropertyReferences` wiring, `setProperties(...)` on an instance is a silent no-op and
   the state never changes.**
4. `master.createInstance()` per state → place in the flow section, set the state's props + content
   overrides for that state, then **rename the instance to the delta only**
   (`[State] - description` / bare `- description`). Fast (~1s) on a healthy bridge.
5. Arrows: `figma.createVector()` + `await v.setVectorNetworkAsync({vertices:[{x,y,strokeCap:'NONE'},
   {x,y,strokeCap:'ARROW_EQUILATERAL'}], segments:[{start:0,end:1}], regions:[]})` — arrowhead on
   the TARGET vertex only; `strokes=[#1C1C1E]`, `strokeWeight=1.5`, `fills=[]`. Label: Bold 20,
   above-left of a horizontal edge / beside a vertical one. (Arrows and labels are flow
   scaffolding — exempt from token binding, see `conventions/tokens.md` § Scope.)
6. Reactions: `await node.setReactionsAsync([{trigger:{type:'ON_CLICK'}, actions:[{type:'NODE',
   destinationId, navigation:'NAVIGATE', transition:null, preserveScrollPosition:false}]}])`.
   Nested-instance-sublayer targeting WORKS (put it on the CTA inside the instance). Reactions
   go on INSTANCES only; verify `master.reactions.length === 0`.

## Environment gotchas

- **Missing fonts**: design-system text nodes may use a family not installed on the machine
  (or installed only in some styles, e.g. italics only). Overriding `.characters` then does NOT
  re-render (stale glyphs), and new text nodes report `hasMissingFont`. Fix: switch the node to
  the installed family the font tokens actually resolve to — the family
  `profile.typography.fonts` gives for that size range (a system may use one family for body
  sizes and another for display sizes) — before setting characters.
- **Token traps**: word-indexed spacing variables may not be literal px (a variable named
  `spacing/sixteen` can resolve to something other than 16). When the distilled standard says
  "gap 16", set `itemSpacing = 16` literally; clear a bad binding with
  `setBoundVariable('itemSpacing', null)`. Bind colors / radii / paddings to the semantic
  collections (`profile.variables.semanticCollections`, across `profile.variables.modes`) —
  never `profile.variables.primitiveCollections` directly; apply type via the design system's
  **text styles** (`profile.typography.textStylePattern`), not raw variables from
  `profile.variables.typographyCollections`. Check a variable's resolved value before trusting
  its name. Full authored-node binding rules (nearest-match, gaps → proposal; in `local` mode
  gaps → added to the local system) live in `conventions/tokens.md`; compliance is swept by
  `audit-fix.md` §6.6 and fixed by §7.6.
- **Backgrounds**: design-system list rows/headers are usually authored to sit on the system's
  page background (`profile.screens.screenBackground`, often a light grey). Building on white
  then makes their white cards invisible and reveals built-in header bands. Form/list screens:
  the screen background. Status/illustration screens: white (or whatever the source shows). If
  the profile sets no `screenBackground`, follow the source.
- **Dynamic-page API**: `figma.currentPage = page` throws — use `await
  figma.setCurrentPageAsync(page)`; same for `getMainComponentAsync()` over `.mainComponent`.
- **Section coordinates are section-relative** — children of a SECTION use its local origin.

## Performance & the degradation ladder

The plugin sandbox slows over hours of building. Symptoms: `createInstance` of deeply-nested
components (form input fields) goes from ~1s to >28s timeouts, while probe latency stays fine.

- Always pass `timeout: 28000`; ONE heavy op per `figma_execute` call. Light ops batch fine.
- **On error the call rolls back; on TIMEOUT it does NOT** — after any timeout, list and delete
  partial/stray nodes before retrying.
- **`frame.clone()` / `instance.clone()` stays FAST (~10-20ms) even when `createInstance` is
  degraded** — the degradation hits fresh component instantiation only. Prefer clone-and-delta:
  build one exemplar (grind it if needed), then clone + override for siblings.
- Ladder: clear console buffer + reload plugin UI → clone-based building → build light/primitive
  screens first, park field-heavy → full Figma Desktop restart + plugin re-run (user action;
  detect via a changed `connectedAt` in `figma_get_status`). Abort a call pattern after 2
  consecutive failures — report, don't grind.

## Rendering & verification

- **Canvas repaint lag**: property-only edits (fills, strokes) don't force a canvas repaint —
  an un-touched canvas shows the PRE-edit raster while the document is already correct. Force
  repaint (set selection + `scrollAndZoomIntoView`) before screenshots; `exportAsync` always
  reflects true state. Verify contested claims against the scene graph (read fills/strokes),
  not a screenshot.
- **Export to disk**: `frame.exportAsync` base64 overflows tool-result caps and lands in a
  `tool-results/*.txt` spill file — decode it there (python: `json.load` → `b64decode`) instead
  of routing base64 through context. Screenshotting a SECTION renders from origin to content
  max-extent (giant margins) — clone children into a temp frame and export that.
- QA loop per screen, max 3 iterations: build → screenshot → compare vs the canonical source
  frame (video frame, source screenshot or legacy screen) → fix. Compare
  CONTENT/structure/tokens — not the source platform's chrome. Source captures may be at
  `profile.screens.renderWidth` (default 390) while the build is at `buildWidth` — scale, don't
  resize the build.

## Machine-readable flow (connectors are NOT available in Design files)

In `editorType === 'figma'` (Design), `figma.createConnector` is **undefined** —
ConnectorNodes are FigJam-only. Drawn arrows are dumb vectors (no endpoint
metadata). The API-readable flow therefore lives in two channels:

1. **Prototype reactions** (the source of truth). REST exposes them per node: an `interactions`
   array plus the legacy `transitionNodeID` (primary edge). Quirks: `destinationId` inside
   REST `interactions` can come back `null` on depth-limited fetches — cross-check
   `transitionNodeID`; reactions sit on nested sublayers (CTAs), so a consumer must walk the
   tree.
2. **Flow `sharedPluginData` on the build page** (the convenient derived channel), in the
   namespace `profile.pluginData.flowNamespace` — default `screenflow`, the name used in the
   samples below; always take the real one from the profile. After the build (and after ANY
   reaction/title change), derive edges from live reactions and write:

   ```js
   // walk: findAll(n => 'reactions' in n && n.reactions.length) → for each, climb to the
   // owning section child (instance), collect {from:{id,title,componentId}, to:{id,title,componentId},
   // trigger:{type,node,label}, navigation} — label = first TEXT under the trigger node.
   // componentId = (await inst.getMainComponentAsync()).id (or the master NAME) is REQUIRED: instance
   // titles are the delta only (`[State] - description`), so a title alone is ambiguous across
   // screens that share a master — the master identity disambiguates each edge endpoint.
   const NS = profile.pluginData.flowNamespace;   // default 'screenflow'
   page.setSharedPluginData(NS, 'edges', JSON.stringify(edges));
   page.setSharedPluginData(NS, 'meta', JSON.stringify({version, generated, source:'prototype-reactions'}));
   ```

   **WRITE only to `flowNamespace`.** Never write to a legacy namespace.

   Read side (for any downstream tool):

   ```
   GET https://api.figma.com/v1/files/<fileKey>/nodes?ids=<pageId>&plugin_data=shared
   → nodes[<pageId>].document.sharedPluginData.screenflow.{edges,meta}
   ```

   READ `flowNamespace` first; if it is empty, try each of
   `profile.pluginData.legacyFlowNamespaces` in order, so files built before a rename keep
   working. One fetch, no tree-walking, titles pre-resolved. Size limit ~100KB per entry
   (32 edges ≈ 9KB).

   The build's stamps (`owner`, `source`, `provenance`, `specId`, `sourcePage`) follow the same
   rule in `profile.pluginData.buildNamespace` (default `screenbuild`): write only there, read
   it first and then `profile.pluginData.legacyBuildNamespaces`.

- **REST sync lag**: the REST API serves the server-side copy; a live desktop document syncs
  seconds-to-minutes later. Freshly-written pluginData/renames may read stale — verify against
  the live scene graph (`figma_execute`), then re-fetch REST.
- Renaming a COMPONENT auto-renames instances whose names were never manually overridden — fix
  the `[Platform][Feature][Screen]` prefix at the MASTER. The flow instances ARE manually renamed
  to their delta (`[State] - description`), so a master rename does not clobber those deltas — the
  intended split (prefix on the master, delta on the instance) per `conventions/naming.md`.

## Library provenance (single source of truth)

Identity is by component **key**, never by the display-name string (`mainComponent.key` on the
bridge, `componentId` over REST) — see `conventions/components.md` ("Identity is by key, not name").
Resolve and dedupe forks by key. Whether a component is `library`, `foreign-library` or `local`
is decided by the check in `conventions/design-system.md` § "Is this component from the
library?" — use that, don't redefine it here.

**`local` mode:** there is no library. The components on the working file's
`profile.components.localPagePrefix` pages (default prefix `→ `, e.g. `→ Button`, `→ Input`)
ARE the source — place those, author a missing piece on such a page (bound per
`conventions/tokens.md`), and skip everything below about importing by key, forks, the derived
strip and promotion.

**`library` mode:** a build file can hold BOTH the linked/published library (instances read
`remote: true`, main lives in the library file) AND a local copy of the same design system
authored on the file's own pages (`remote: false`, main on a `→ Button`/`→ Input`/… page).
`figma_search_components` / a file scan returns the local fork and does NOT prefer the published
library — place the local copy and those screens detach from library updates and read as
"spinoffs".

- Pull the published component by key: `await figma.importComponentSetByKeyAsync(key)` (sets) /
  `importComponentByKeyAsync(key)` (single), then `instance.swapComponent(variant)` or place a
  fresh `set.defaultVariant.createInstance()`. Match the target variant to the instance's current
  `componentProperties` (VARIANT axes) — axis names can differ slightly between the local fork and
  the published set, so score-match shared axes rather than requiring an exact object equality.
  The components that fill the common roles are in `profile.components.roles`
  (`primaryButton`, `navigationBar`, `input`, `listItem`, `card`, `bottomActionBar`).
- Detect a mix: `mainComponent.remote === false` while a same-named `remote` twin exists = wrong
  source; prefer the `remote` one. Audit with `findAll(INSTANCE)` grouped by
  `(await getMainComponentAsync()).remote`.
- No published match (see the spec's match test)? DERIVE, don't invent: clone the closest
  library variant (`importComponentSetByKeyAsync` → pick nearest variant → `.clone()`) or compose
  from published library sub-components, binding fill/spacing/radius to the library's SEMANTIC
  tokens (`profile.variables.semanticCollections` — never `primitiveCollections` directly) and
  typography to the design system's text styles / typography tokens (layout frames only as
  scaffolding). Author it on the BUILD page in a section named `profile.labels.derivedStrip`
  (default `Derived — pending design-system promotion`) — never on an existing design-system
  page. Set the component's `description` to a promotion note (send into the library, then
  re-link so future screens consume the published version) and report it as
  `fallback (derived from <key>)`. Never place the file-local fork as a fallback.

## Component-instance editing

- Variant swap on a nested button may reject `setProperties` ("no property X") — use
  `swapComponent(targetVariantComponent)` then re-apply the label.
- Input-field-style components may ship value text nodes at `opacity: 0` in the placeholder
  variant — set opacity 1 to reveal filled values.
- Text width bugs: a value node under FILL sizing can resolve to width 0 and wrap per-character
  → `textAutoResize = 'WIDTH_AND_HEIGHT'`. `resize()` disables autoresize — set `layoutAlign =
  'STRETCH'` + `textAutoResize = 'HEIGHT'` instead of resizing after.
- Primitive CTAs: setting `layoutMode` AFTER `resize()` re-hugs the frame into a pill — set
  `primaryAxisSizingMode='FIXED'` + explicit width (`profile.screens.buildWidth` minus the two
  side margins — e.g. 327 at x=24 on the default 375 build width).
- Nav-bar title: it is the TEXT under the sub-navigation child — `findAll(TEXT)[0]` is usually
  the status-bar clock; don't overwrite it (it stays `profile.screens.statusBarTime`, default
  "9:41").
- Toggle rows: if the library's switch-row component forces a card wrapper the reference doesn't
  show, compose manually (horizontal auto-layout, label `layoutGrow=1`, switch hugging right).
- Illustrations with no design-system match: use the closest design-system illustration
  component (name the swap in the report); import cropped source art only as a last resort —
  keep crops ≤~4KB (larger base64 pasted into a tool param truncates and corrupts).
