# Audit + Fix loop — executor's manual (Phase 6 audit · Phase 7 fix)

This is the recipe book for the two phases that run **after** a build completes: **Phase 6 — Audit
(read-only)** produces one merged report; **Phase 7 — Fix (auto-run, bridge-gated)** remediates and
self-verifies. It is built to the merged convention — the authority is the plugin's own shipped
tooling, listed below. **Consume those; never edit or reinvent them.** Where any older note
conflicts, this doc and the merged convention win.

Authority (read, do not edit). Paths are relative to the plugin root — `$CLAUDE_PLUGIN_ROOT`, or,
when that is unset, two directories up from the invoking skill file's real path (`readlink -f`):
- `conventions/design-system.md` — the **profile**: how it is resolved, every field, the two modes,
  and the "Is this component from the library?" check.
- `conventions/naming.md` · `conventions/components.md` · `conventions/tokens.md` — the naming +
  property model and the token/style binding rules.
- `agents/figma-deep-dive.md` — its **`naming-audit` mode** and its
  **"Component instances (identity + properties)"** block.
- `skills/screen-canonicalizer/SKILL.md` + `schemas/canonical-screen-registry.schema.json` — the
  match/dedup tool + schema.
- `build/figma-build-recipe.md` — Plugin-API mechanics the fixes reuse (fonts, tokens,
  export-to-disk, degradation ladder, the `screenflow` flow graph).
- `build/guarded-build-core.md` — the build phases (2–5) whose output this loop audits.

## Profile first (every audit and every fix)

**Resolve the design-system profile before any check**, per `conventions/design-system.md`
§ "Resolving the profile". Nothing in this doc names a design system: every library, collection,
label and namespace is a profile field, written `profile.<path>`.

| `profile.mode` | What the audit and fix do |
|---|---|
| `library` | Everything below runs. The library must be **enabled in the working file**; if component lookup returns nothing, **STOP** and tell the user to enable it — never silently switch to `local`. |
| `local` | There is no library, so **provenance (§6.2) and the provenance swap (§7.1) are skipped** and no "foreign", "fork", "missing from the library" or "promote to the library" finding is ever raised. Naming, match, parity and the token/style sweep run unchanged; components are judged as local components on the `profile.components.localPagePrefix` pages, bound to variables in `profile.variables.semanticCollections`. |

**Plugin-data names come from the profile.** This doc writes `screenbuild` and `screenflow` — the
defaults of `profile.pluginData.buildNamespace` and `profile.pluginData.flowNamespace`. **Write**
only to those two. **Read** the current namespace first, then each entry of
`profile.pluginData.legacyBuildNamespaces` / `legacyFlowNamespaces`, so a file built before a rename
still audits. The keys: `owner`, `source`, `provenance`, `specId`, `sourcePage`, `strip`.
`owner` is `figma-screens-from-source`, or any legacy value starting with `figma-screens-from-`
(pages built before the skills were merged) — both count as the ownership marker; `source` is the
source kind (`video` | `code` | `figma-page`) and may be absent on those older pages.

**Profile preamble — prepend to every `figma_execute` script in this doc** (the scripts below call
its helpers):

```js
// PROFILE PREAMBLE. `profile` = the resolved profile, inlined by the caller as a JSON literal.
const BUILD_NS = profile.pluginData.buildNamespace;   // default "screenbuild" — the ONLY build namespace WRITTEN
const FLOW_NS  = profile.pluginData.flowNamespace;    // default "screenflow"  — the ONLY flow namespace WRITTEN
// READS: current namespace first, then each legacy one. Legacy namespaces are never written.
const readNs    = (n, spaces, key) => { for (const ns of spaces) { const v = n.getSharedPluginData(ns, key); if (v) return v; } return ""; };
const readBuild = (n, key) => readNs(n, [BUILD_NS, ...(profile.pluginData.legacyBuildNamespaces || [])], key);
const readFlow  = (n, key) => readNs(n, [FLOW_NS,  ...(profile.pluginData.legacyFlowNamespaces  || [])], key);

// Scaffolding is matched against the PROFILE label, by PREFIX (+ plugin data), never by full string
// equality: the honesty model appends a badge suffix to section names, which an exact match
// silently misses — and a missed strip misclassifies every derived component as a fork.
const isDerivedStrip = n => !!n && n.type === "SECTION" &&
  (n.name.startsWith(profile.labels.derivedStrip) || readBuild(n, "strip") === "derived");

// LIBRARY CHECK (`library` mode only) — implements conventions/design-system.md
// § "Is this component from the library?". classifyMain → "library" | "foreign-library" | "local".
const LIB_FILE_KEYS = new Set((profile.library && profile.library.fileKeys) || []);  // pinned once per run
const FOREIGN_HINTS = ((profile.library && profile.library.foreignNameHints) || []).map(s => new RegExp(s));
const SOURCE_FILE   = new Map(/* injected: [componentKey or setKey, sourceFileKey] — resolved off-script, below */);
function classifyMain(mc) {
  if (!mc || mc.remote !== true) return { cls: "local" };
  const set = mc.parent && mc.parent.type === "COMPONENT_SET" ? mc.parent : null;
  const fileKey = SOURCE_FILE.get(mc.key) || (set && SOURCE_FILE.get(set.key));
  if (fileKey) return { cls: LIB_FILE_KEYS.has(fileKey) ? "library" : "foreign-library" };
  // source file unresolved → name hints only, and the result is UNVERIFIED (a hint flags, never clears).
  const name = set ? set.name : mc.name;
  return { cls: FOREIGN_HINTS.some(r => r.test(name)) ? "foreign-library" : "library", unverified: true };
}
const isFromLibrary = mc => { const r = classifyMain(mc); return r.cls === "library" && !r.unverified; };
```

**Filling `LIB_FILE_KEYS` and `SOURCE_FILE` (off-script, once per run, `library` mode).** A sandbox
script cannot see which file a remote component comes from, so the caller resolves it and injects it:
1. `profile.library.fileKeys` empty → resolve it from `profile.library.componentKeys` (each →
   `figma_get_library_component_by_key` → `fileKey`; take the file they share), tell the user and
   offer to save it to the profile.
2. `figma_get_library_components` on each library file key → every key it returns maps to that file
   key (this is also the library-first twin registry of §6.2).
3. One read-only `figma_execute` lists the distinct remote main keys on the page (the set key when
   the main is a variant); any key step 2 did not cover → `figma_get_library_component_by_key` →
   its `fileKey`.

## Engine & model

**Engine = the figma-console MCP used directly, over the Desktop Bridge.** The Bridge is
**required** for the audit as well as the fix: if it is not connected to the working file, **STOP**
and tell the user to connect it (`figma-setup`) — there is no REST audit path. Structural checks run through
`figma_execute` returning **FINDINGS ONLY** (never a whole tree — keep main-context small; the
scripts below already filter and dedupe inside the sandbox). Visual checks run through
`figma_capture_screenshot`. The **`figma-deep-dive` agent** is reused for exactly two things: the
**naming audit** (its `naming-audit` mode, which reads the merged `naming.md`) and the **identity
block** (its "Component instances (identity + properties)" output, which `screen-canonicalizer`
consumes). Do **not** hand-roll a naming grammar and do **not** reinvent grouping/assembly.

**The screen model (recap — build to this).** A screen exists **once** as a plain **COMPONENT
master** (never a `COMPONENT_SET` — sets live only inside design-system pieces) named
`[Platform][Feature][Screen]` (brackets concatenated, no separator, no state/description). **States
are boolean / text / instance-swap component properties + content overrides**, surfaced as a
`[State]` bracket on the placed **instance**, whose stored name is the **delta only**
(`[State] - description`, or a bare `- description` for the primary; hyphen ` - `, never an en-dash).
**Identity is by component** — `componentKey` (the `figma-deep-dive` agent reports `componentId`
instead when it has to fall back to a REST read, and says so) — never by name.
Masters are **composed of published library instances** (`library` mode) or of the working file's
own components on the `profile.components.localPagePrefix` pages (`local` mode). Reuse = a variant
whose `[Screen]` override differs while platform+feature match → shares the master identity, is its
own logical screen, and is **soft-flagged, never auto-fixed**. The full logical name is **assembled
downstream** by `screen-canonicalizer` (or any other downstream tool), never stored on a frame.
`[Platform]` is one of `profile.screens.platformTags`.

---

# Phase 6 — Audit (read-only)

Four checks — **naming, provenance, match, parity** — plus the token/style sweep (§6.6). All
read-only. Each emits findings into the merged report (`§Report format`). The audit needs the
Desktop Bridge just as Phase 7 does (see *Engine & model*): Bridge not connected → stop, do not
degrade to a partial audit.

## 6.1 Naming — reuse `figma-deep-dive`'s `naming-audit` mode

Do **not** write regexes. Dispatch the deep-dive agent in `naming-audit` mode against the build
page's screen frames/masters; it reads the merged `conventions/naming.md` and returns a
`## Naming audit` block. Consume its taxonomy **verbatim**.

```
Agent(
  subagent_type: "figma-deep-dive:figma-deep-dive",
  prompt: "mode: naming-audit — run a naming audit against the merged convention.\n" +
          "fileUrl: <build file URL>\n" +
          "nodeIds: <build page id + each screen-master + each in-flow variant instance>\n" +
          "Use the Component instances (identity + properties) block to resolve each frame's masterName.\n" +
          "Return the ## Naming audit block only."
)
```

**Taxonomy (verbatim from `naming-audit`) → fix locus for Phase 7:**

| `naming-audit` class | Meaning | Phase-7 fix locus |
|---|---|---|
| `ok` | conforms | none |
| `redundant-prefix` | variant stored name repeats its master's `[Platform][Feature][Screen]` | **variant instance's stored name** — strip to the delta |
| `violation:separator` | en-dash `–` before description | **variant instance's stored name** — normalize to hyphen ` - ` |
| `violation:missing-description` | variant has no ` - description` | **variant instance's stored name** — append ` - <description>` |
| `violation:master-format` | a COMPONENT master isn't exactly `[Platform][Feature][Screen]` | **the MASTER** |
| `reuse` | delta leads with a `[Screen]` override differing from the master (platform+feature match) | **never auto-fix — soft-flag for human OK** |
| `out-of-scope` | `[Out of scope]` prefix (case-insensitive) | exempt — not audited/fixed |

The "acceptance test = zero naming findings on a fresh pilot page" is judged by `naming-audit`,
not a regex. Naming is the **one** check whose fix does **not** coalesce to the owning master (see
`§7 fix order`): `violation:master-format` lands on the master; the rest land on the individual
variant instance.

## 6.2 Provenance — classify every instance, dedupe by identity

**`local` mode: skip this whole check** (and §7.1). Every component is local by definition, so
there is no "foreign", "fork" or "missing from the library" finding; record
`provenance: skipped (local mode)` in the report. Everything below is `library` mode.

Per instance, resolve the main via `getMainComponentAsync()` (dynamic-page safe — never
`.mainComponent`/`.remote` off the instance directly), then classify it with `classifyMain(mc)` /
`isFromLibrary(mc)` from the profile preamble. Those implement
[`conventions/design-system.md` § "Is this component from the library?"](../conventions/design-system.md#is-this-component-from-the-library-library-mode)
— that section is the definition; it is not redefined here. The result is one of three values:

- **`library`** (`mc.remote === true` **AND** the main's source file key is in
  `profile.library.fileKeys`) — ok. `remote === true` alone is NOT sufficient: a build file
  routinely subscribes older/other published libraries, whose components are also
  `remote:true`. Pin the library file key(s) ONCE for the run (see *Profile first*).
- **`foreign-library`** (`remote === true`, from a file that is NOT in
  `profile.library.fileKeys`) — the same defect class as a file-local fork: reported, and
  eligible for twin-swap in Phase 7. When a source file key cannot be resolved for an
  instance, `profile.library.foreignNameHints` classify it (a name that does not follow
  `profile.components.namePattern` is a further hint) and the result is marked
  `unverified`. The heuristic FLAGS, it never clears — only the file key clears.
- **`local`** (`mc.remote === false`) — then split by what the local main is:
  - **file-local fork** (NOT a build-master, NOT derived) **that has a published library twin** —
    the defect. Twin existence is decided by matching the fork's set/component **name** against a
    twin registry (a fork and its twin have *different* keys, so the name is the only
    cross-reference; classification/dedup are still by key).
  - **derived-fallback** — tagged (`screenbuild` · `provenance = derived`); checked by the
    compliance test (`§6.5`), not here.
  - **build-master** — the skill's own plain-component screen masters
    (`[Platform][Feature][Screen]`, `remote:false` **by design**) and their instances.
    **Exempt — never flagged.**

Twin-key source: `figma.teamLibrary.getAvailableLibraryComponentSetsAsync()` is not reliably
available through the Bridge — do NOT rely on it. Build the twin registry **library-first**:
`figma_get_library_components` on each `profile.library.fileKeys` entry is the **REQUIRED first
attempt** — enumerate the published library and key each set/component by its name
(`profile.components.namePattern`, e.g. `Category/kebab-name`). The on-page harvest — a library
instance → `getMainComponentAsync()` → `.parent` (its `COMPONENT_SET`) → `.parent.key` — then
**backstops and merges into** that registry (it covers sets the enumeration misses and is the
**only** source when the enumeration is unreachable). Both key by `componentKey`. **Findings dedupe
by component identity** (the fork's own `componentKey`, else its node id) so a fork in a master + N
mirrored instances raises **one** finding. Validate provenance by this key-based classification,
never by hitting an expected count.

**Read-only classification + twin-harvest script (one `figma_execute`, findings only):**

```js
// PROVENANCE AUDIT — READ-ONLY, `library` mode only. Returns findings only; never the tree.
// Requires the PROFILE PREAMBLE (readBuild, isDerivedStrip, classifyMain, isFromLibrary).
const page = figma.currentPage;
const insts = page.findAllWithCriteria({ types: ["INSTANCE"] });

// --- build-master exemption (STRUCTURAL signal = primary): a non-remote COMPONENT that lives on
//     the BUILD page OUTSIDE the derived strip (`profile.labels.derivedStrip`) is a screen/build
//     master — exempt. Derived fallbacks live INSIDE that strip (handled by §6.5, not here). The
//     `[Platform]` bracket regex is a SECONDARY confirmation only — naming validation itself is
//     delegated to figma-deep-dive (§6.1) — so a master whose title is momentarily malformed is
//     still exempted by structure and doesn't misclassify as a fork. ---
// The strip is matched by the preamble's isDerivedStrip (profile label PREFIX + plugin data).
const derivedStrip = page.findOne(isDerivedStrip);
const inDerivedStrip = n => { for (let p = n && n.parent; p; p = p.parent) if (p === derivedStrip) return true; return false; };
const buildMasterIds = new Set();
for (const c of page.findAllWithCriteria({ types: ["COMPONENT"] })) {
  if (c.remote === true || inDerivedStrip(c)) continue;   // remote = a library; in-strip = derived (§6.5)
  buildMasterIds.add(c.id);                                // on-page local component outside the strip
  // secondary signal (informational only): a name opening with `[<one of profile.screens.platformTags>]`
  // confirms a screen master — new RegExp("^\\[(" + profile.screens.platformTags.join("|") + ")\\]").
}

// --- pass 1: twin registry name -> {key,isSet}. LIBRARY-FIRST: seed this map from the
//     figma_get_library_components MCP call (run OFF-script, then inject the pairs here) — that is
//     the REQUIRED first source. The on-page REMOTE-instance harvest below then BACKSTOPS/MERGES
//     (covers sets the enum misses; sole source when the enumeration is unreachable). isSet drives
//     which import API §7.1 uses (set vs plain component). ---
const twinByName = new Map(/* seeded from figma_get_library_components: [name, {key, isSet}] */);
for (const inst of insts) {
  let mc; try { mc = await inst.getMainComponentAsync(); } catch { continue; }
  if (!mc || mc.remote !== true) continue;
  const isSet = mc.parent && mc.parent.type === "COMPONENT_SET";
  const key  = isSet ? mc.parent.key  : mc.key;   // cross-file-stable library key
  const name = isSet ? mc.parent.name : mc.name;  // library name, per profile.components.namePattern
  // GUARD: only VERIFIED library mains may seed the twin registry. A foreign-library (or
  // unverified) component must never become a swap TARGET — that would swap a correct library
  // component out for one from another library. isFromLibrary implements
  // conventions/design-system.md § "Is this component from the library?"; the library file
  // key(s) it tests against are pinned once for the run.
  if (!isFromLibrary(mc)) continue;
  if (key && !twinByName.has(name)) twinByName.set(name, { key, isSet });
}

// --- pass 2: classify + dedupe forks by identity; record hasTwin (twin → fixable in §7.1,
//     no-twin → escalate). ALL forks are reported, not only those with a twin. ---
const findings = new Map();
const unverified = new Set();                  // remote mains whose source file could not be resolved
for (const inst of insts) {
  let mc; try { mc = await inst.getMainComponentAsync(); } catch { continue; }
  if (!mc) continue;
  const isBuildMaster = buildMasterIds.has(mc.id) || (mc.parent && buildMasterIds.has(mc.parent.id));
  if (isBuildMaster) continue;                 // build-master exemption (structural)
  const prov = classifyMain(mc);               // "library" | "foreign-library" | "local"
  if (prov.cls === "library") {                // library = ok — but only a resolved file key clears it
    if (prov.unverified) unverified.add(mc.key || mc.id);
    continue;
  }
  // derived-fallback: tagged at build/derive time → route to §6.5 compliance, NOT fork classification.
  if (readBuild(mc, "provenance") === "derived") continue;
  const isSet   = mc.parent && mc.parent.type === "COMPONENT_SET";
  const setName = isSet ? mc.parent.name : mc.name;
  const twin    = twinByName.get(setName) || null;   // published twin by NAME (fork != twin key)
  const id = mc.key || mc.id;                          // dedupe by the fork's own identity
  if (!findings.has(id)) findings.set(id, {
    class: "provenance",
    cls: prov.cls,                             // "local" = file-local fork · "foreign-library" = fork from another library
    unverified: !!prov.unverified,
    component: mc.name, componentKey: mc.key || null, componentId: mc.id,
    twinSetName: setName, twinKey: twin ? twin.key : null, twinIsSet: twin ? twin.isSet : null,
    hasTwin: !!twin, exampleNodeId: inst.id, props: inst.componentProperties || null, count: 0
  });
  findings.get(id).count++;
}
const out = [...findings.values()];
return {
  totalInstances: insts.length, twinRegistrySize: twinByName.size,
  forksWithTwin: out.filter(f => f.hasTwin).length,   // fixable in Phase 7
  forksNoTwin:   out.filter(f => !f.hasTwin).length,  // no swap source → escalate (§Degradation & standalone use)
  unverifiedRemote: unverified.size,                  // reported as a count; never a finding, never a twin source
  findings: out
};
```

A page with **zero** library instances, on a run where the library enumeration is also unreachable,
yields an empty twin registry, so its forks report `forksNoTwin` and **escalate** rather than guess
(`§Degradation & standalone use`). A fork with `hasTwin:false` is reported but never swapped. A
non-zero `unverifiedRemote` means source file keys are missing from `SOURCE_FILE` — resolve them
(see *Profile first*) and re-run before trusting the result.

## 6.3 Match — consume the canonical registry + spec tags (report-only until stamped)

Do **not** reinvent grouping or full-name assembly. **Consume `screen-canonicalizer`'s
`canonical-screen-registry.json`** — shape (per the schema): `{ file, screens:[{ screen, buildOnce,
differsBy[], variants:[{entry, frame}], sharedSubComponents[] }] }`. If none exists for the file,
dispatch `screen-canonicalizer` to produce one (it reads Figma only via `figma-deep-dive` and
clusters by component identity); never cluster by hand. Compare the **built page** (its identity
block + variant deltas, as returned by the `figma-deep-dive` agent) against the registry, and
cross-reference the build specs' per-element `match | override-only | fallback` tags.

**Report-only until element addressing exists.** Element-level match needs the builder to stamp
`node.setSharedPluginData('screenbuild','specId', <master title + element path>)` per element
(read it back with the preamble's `readBuild(node,'specId')`). Until
that stamp is present, match **never drives a fix** (a mis-bind would swap the wrong node) — it only
reports. Adding the stamp promotes match to auto-fixable.

**The five match-test outcomes (classify each element, unchanged from the spec's match test):**

| Mismatch on… | Outcome |
|---|---|
| ROLE | **fallback** |
| VARIANT (needed state absent without structural surgery) | **fallback** |
| ANATOMY (a required slot missing) | **fallback** |
| TOKEN / THEME only | **override-only** (set the right mode from `profile.variables.modes` / bind the right semantic token — not a fork) |
| PLATFORM only | **override-only** if the component has an `OS`/`Platform` axis (swap the variant); else **fallback** |

State is **boolean/text/instance-swap properties**, not Figma variant sets — the audit must not
expect or synthesize `Prop=Value` variant children at the screen level. `reuse` (a variant sharing a
master's identity with a differing `[Screen]` override) is a soft-flag, never a match failure.

## 6.4 Parity — screenshot each state vs its canonical source frame

`figma_capture_screenshot` each built screen-state; vision-compare to its canonical frame. Check
**strings (verbatim in `profile.copy.locale`, accents and special characters included), row counts,
CTA enabled/disabled**. **Ignore source-platform chrome**
(status bar, keyboards, OS toggles) — content/structure only. **Exempt PROPOSED sections** (the amber
`profile.copy.proposedBanner` banner — default "PROPOSED – to confirm" — matches no frame). Reuses the ≤3-iteration screenshot QA. Base64
overflows tool-result caps and spills to `tool-results/*.txt` — decode there (python `b64decode`),
never route base64 through context. **No ground-truth pixels supplied → run CHECKLIST parity (verbatim strings, element counts,
CTA states from the spec) and note the mode — never a silent skip** (`§Degradation & standalone use`;
a pixel-less source satisfies `--parity=require` via checklist mode).

## 6.5 Fallback-compliance test (used by 6.2 and by the derive fix in 7.4)

A `derived-fallback` **passes** iff ALL hold:
1. every INSTANCE descendant is from the library (`isFromLibrary` — remote **and** from
   `profile.library.fileKeys`);
2. non-instance descendants are layout frames / scaffolding only;
3. fills / strokes / radius bind to variables in `profile.variables.semanticCollections` (never
   directly to `profile.variables.primitiveCollections`);
4. text uses the design system's text styles (`profile.typography.textStylePattern`) / the
   variables in `profile.variables.typographyCollections`;
5. it lives in the derived strip (`profile.labels.derivedStrip`);
6. it carries the promotion note in `description` **and** the `fallback (derived from <key>)` tag.

**`local` mode:** there is no derived strip and nothing to promote. Run rules 2–4 on each authored
component on the `profile.components.localPagePrefix` pages; rule 1 becomes "every INSTANCE
descendant is one of those local components"; rules 5–6 do not apply.

**`static-asset` is a SEPARATE class — do not run the test above on it.** An
illustration/asset (design systems commonly ship these: an empty-state or no-results
illustration) is by definition instance-free outlined geometry, so rules 1, 2 and 4
can never pass. A `static-asset` (tagged `screenbuild` · `provenance = static-asset`) **passes** iff:
(a) it contains **no live component instances** — everything detached/outlined, so the
asset carries no font or library dependency; (b) it follows the library's own illustration
convention — structured and named the way the library's existing illustration components are
(same node type, same naming per `profile.components.namePattern`, same variant axis);
(c) it lives in the proposal strip (`profile.labels.proposalStrip`) or the derived strip, with the
promotion note — in `local` mode, on a `profile.components.localPagePrefix` page, no note.
Colour bindings are **not** required — a flattened asset legitimately holds raw fills.

**Exception:** literal `itemSpacing`/padding values are allowed where the token-trap
workaround applies (a spacing variable whose name does not state its px resolves to a wrong px — see
`conventions/tokens.md` § "Token traps" and `figma-build-recipe.md` § "Environment gotchas"); such
literals are **not** flagged.

**Read-only checker (`figma_execute`, findings only):**

```js
// FALLBACK-COMPLIANCE CHECK — READ-ONLY, `library` mode. Pass a derived component id.
// Requires the PROFILE PREAMBLE (readBuild, isDerivedStrip, isFromLibrary).
const c = await figma.getNodeByIdAsync(compId);
if (!c) return { compliant: false, fails: [{ nodeId: compId, why: "component not found" }] };
const fails = [];
const descendants = c.findAll(() => true);
for (const n of descendants) {
  if (n.type === "INSTANCE") {
    let mc; try { mc = await n.getMainComponentAsync(); } catch { mc = null; }
    if (!mc || !isFromLibrary(mc)) fails.push({ nodeId: n.id, why: "instance descendant not from the library (or unverified)" });
  }
  // fills/strokes/radius must be bound to a variable in one of profile.variables.semanticCollections
  // (collection name/id check resolved via figma_get_variables off-script); a raw hex/number with no
  // binding, or a binding into profile.variables.primitiveCollections => fail,
  // EXCEPT itemSpacing/padding literals covered by the token-trap exception.
}
const inStrip = isDerivedStrip(c.parent);   // profile.labels.derivedStrip, prefix + plugin data
const tagged  = readBuild(c, "provenance") === "derived";
const noted   = /fallback \(derived from /.test(c.description || "");
if (!inStrip) fails.push({ nodeId: c.id, why: "not in Derived strip" });
if (!tagged)  fails.push({ nodeId: c.id, why: "missing derived tag" });
if (!noted)   fails.push({ nodeId: c.id, why: "missing promotion note" });
return { compliant: fails.length === 0, fails };
```

## 6.6 Token/style compliance (authored nodes)

`§6.5` covers only components in the Derived strip. This sweep covers **every authored
(non-instance) node** against `conventions/tokens.md`: text with **no design-system text style**,
dimensions (itemSpacing/padding) or fills/strokes **bound to nothing** (raw), and the
half-done case of a bound `fontSize` **without** a text style. Run it per screen-holding
section (**Masters**, **Derived**); flow sections are annotation and are **not** swept.
Instance-inherited styling is exempt. Findings feed the Phase-7 binding pass (`§7.6`).
It runs in both modes: in `local` mode the styles and variables it expects are the ones authored in
the working file (`profile.variables.semanticCollections`), and there is no Derived section to sweep.

**Read-only checker (`figma_execute`, findings only):**

```js
// TOKEN/STYLE COMPLIANCE — READ-ONLY. Pass a screen-holding section id (Masters / Derived).
const sec = await figma.getNodeByIdAsync(sectionId);
const inInstance = n => { let p = n; while (p && p.id !== sec.id) { if (p.type === "INSTANCE") return true; p = p.parent; } return false; }; // start at n: a node that IS an instance is exempt too
const findings = [];
for (const t of sec.findAll(n => n.type === "TEXT")) {
  if (inInstance(t)) continue;                                     // inherited from a component instance
  const styled = typeof t.textStyleId !== "string" || t.textStyleId !== ""; // mixed => has styles => ok
  if (!styled) findings.push({ nodeId: t.id, kind: "text", why: "no design-system text style", size: t.fontSize });
}
for (const f of sec.findAll(n => ("layoutMode" in n) && n.layoutMode && n.layoutMode !== "NONE")) {
  if (inInstance(f)) continue;
  const bv = f.boundVariables || {};
  for (const k of ["itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft"]) {
    if (typeof f[k] === "number" && f[k] !== 0 && !bv[k])
      findings.push({ nodeId: f.id, kind: "dimension", field: k, value: f[k] }); // token-trap literals (tokens.md) excluded downstream
  }
}
return { compliant: findings.length === 0, findings };
```

## Check summary

| Check | Needs | Method | Auto-fixable? | Severity |
|---|---|---|---|---|
| Naming | page | reuse `figma-deep-dive` `naming-audit` mode | yes (by class); `reuse` soft-flag | medium |
| Provenance (`library` mode only; skipped in `local`) | page (+ library enum & on-page library instances for twins) | `figma_execute` classify (`library` / `foreign-library` / `local`) + library-first twin registry (backstopped by on-page harvest), dedupe by identity | yes, if a twin exists | high |
| Match | page + registry + specs + `specId` stamp | consume `canonical-screen-registry.json` + spec tags | **report-only** until stamped | high |
| Parity | page + source frames | `figma_capture_screenshot` vs frame (chrome-ignored, PROPOSED-exempt) | yes | string/structure high, cosmetic low |
| Token/style | page (authored, non-instance) | `figma_execute` findings-only sweep (§6.6) | yes — bind nearest; gaps → §7.6 proposal | medium |

---

# Phase 7 — Fix (auto-run, bridge-gated)

**Fix order & coalescing.** Apply per master in order **provenance → match → naming → parity → token/style**
(structure before the visual verify; token/style binding runs last, alongside parity). The **"resolve to the owning master" coalescing rule applies to
provenance and match ONLY — NOT naming** (§6.1: naming's fix lands on the master OR on an individual
variant instance, by class). Provenance/match fixes for one master coalesce into one operation set;
a master edit that propagates to N instances counts as **1** against the change budget.

## 7.1 Provenance swap — file-local fork → published twin

**`library` mode only** — skipped in `local` mode, where §6.2 raises no findings. It applies to
both fork classes of §6.2: a `local` fork and a `foreign-library` fork (for the latter the "fork
main" is the other library's component; if its node cannot be resolved the call escalates
`fork-node-not-found` and the instance is reported, not swapped).

Import the twin **by kind** — a set (`importComponentSetByKeyAsync` → variant score-match) or a plain
component (`importComponentByKeyAsync`, `guarded-build-core.md` Phase 4 already names it) per `twinIsSet` from the §6.2
harvest → **equivalence-gate** → `swapComponent` → **re-apply text/content overrides** (a
defensive default: a swap may drop them) → **screenshot-verify** the screen-state → escalate on regression. The caller
captures a **baseline screenshot of each affected screen-state BEFORE** invoking this call; on
verify-fail it **REVERTS** (swap back to the fork main + re-apply the captured overrides) and *then*
escalates — it never leaves a regressed instance on the page.

```js
// PROVENANCE SWAP — mutating; bridge-gated + owner-checked. One fork's placements per call.
// Requires the PROFILE PREAMBLE (readBuild).
// INPUT: forkMasterId, twinKey (harvested library key), twinIsSet (from §6.2 harvest),
//        FIX_FLAG (the --fix override). Placements are ENUMERATED here (step 3), never passed in.
// STANDALONE: the loop MUST `await figma.setCurrentPageAsync(<target>)` first — every findAll below
//             operates on figma.currentPage.

// 0) OWNERSHIP GATE (standalone): refuse to mutate a page we don't own unless --fix.
//    The marker is read from `screenbuild` first, then the profile's legacy build namespaces.
if (!readBuild(figma.currentPage, "owner") && !FIX_FLAG)
  return { escalate: "no-owner-marker" };

// 1) import the published twin — branch on kind (spec: set → set API + pickVariant; plain → plain API).
const fork = await figma.getNodeByIdAsync(forkMasterId);
if (!fork) return { escalate: "fork-node-not-found", forkMasterId };
let set = null, twinComp = null;
try {
  if (twinIsSet) set = await figma.importComponentSetByKeyAsync(twinKey);
  else           twinComp = await figma.importComponentByKeyAsync(twinKey);
} catch (e) { return { escalate: "twin-import-failed", twinKey, twinIsSet, error: String(e) }; }

// 2) EQUIVALENCE GATE — VARIANT-axis parity only (ROLE/ANATOMY drift is backstopped by the
//    screenshot-verify below; this gate can't see it). `componentPropertyDefinitions` THROWS on a
//    variant child of a COMPONENT_SET, so read defs off the SET when there is one — on BOTH sides.
const forkDefHost = fork.parent && fork.parent.type === "COMPONENT_SET" ? fork.parent : fork;
const twinDefHost = set /* set IS the def host */ || twinComp;
const forkP = Object.keys(forkDefHost.componentPropertyDefinitions || {});
const twinP = Object.keys(twinDefHost.componentPropertyDefinitions || {});
if (forkP.length === 0) {
  // (b) property-less fork: ratio-scoring is undefined → pass-vacuous on axes, fall back to a
  //     name + size + child-count structural check instead of forcing an escalation.
  const twinNode = set ? (set.defaultVariant || set.children[0]) : twinComp;
  const forkLeaf = (fork.name || "").split("/").pop();
  const twinLeaf = (twinNode.name || "").split(",")[0].split("/").pop();
  const nameOk = forkLeaf === twinLeaf;
  const sizeOk = Math.abs(fork.width - twinNode.width) <= 4 && Math.abs(fork.height - twinNode.height) <= 4;
  const kidsOk = Math.abs((fork.children || []).length - (twinNode.children || []).length) <= 1;
  if (!(nameOk && sizeOk && kidsOk))
    return { escalate: "diverged-fork", forkMasterId, why: "zero-prop structural mismatch",
             fork: { name: fork.name, w: fork.width, h: fork.height },
             twin: { name: twinNode.name, w: twinNode.width, h: twinNode.height } };
} else {
  // (d) RULE: all fork prop axes ⊆ twin prop axes → pass; ANY fork axis absent in twin → escalate.
  const missing = forkP.filter(p => !twinP.includes(p));
  if (missing.length) return { escalate: "diverged-fork", forkMasterId, forkP, twinP, missing };
}

// helper: nearest variant by shared VARIANT axes (axis names differ slightly fork vs published,
// so score-match rather than require exact equality).
function pickVariant(set, cur) {
  const want = Object.fromEntries(Object.entries(cur)
    .filter(([,v]) => v && v.type === "VARIANT").map(([k,v]) => [k, String(v.value)]));
  let best = set.defaultVariant, bestScore = -1;
  for (const v of set.children) {
    const props = Object.fromEntries((v.name||"").split(",").map(s => s.trim().split("=")));
    const score = Object.entries(want).reduce((n,[k,val]) => n + (props[k]===val?1:0), 0);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

// 3) ENUMERATE all placements of this fork ON THE PAGE (re-findAll by identity — never trust a
//    passed list: node ids churn across rebuilds, and an un-passed mirror instance would be missed).
const all = figma.currentPage.findAllWithCriteria({ types: ["INSTANCE"] });
const placements = [];
for (const inst of all) {
  let m; try { m = await inst.getMainComponentAsync(); } catch { continue; }
  if (m && m.id === forkMasterId) placements.push(inst);
}
// swap the copy INSIDE its owning screen master FIRST — un-overridden mirror instances of that
// master then inherit the swap automatically (fewer redundant mutations, no drift between mirrors).
const insideMaster = n => { for (let p = n.parent; p; p = p.parent) if (p.type === "COMPONENT" || p.type === "COMPONENT_SET") return true; return false; };
placements.sort((a, b) => (insideMaster(b) ? 1 : 0) - (insideMaster(a) ? 1 : 0));

// helper: capture TEXT overrides (match by LAYER NAME only). figma.mixed fontName can't be passed to
// loadFontAsync → load per-styled-segment or skip that node; non-text overrides
// (boolean/instance-swap/image) are NOT re-applied here — the screenshot-verify backstops them.
async function reapply(inst, overrides) {
  const now = inst.findAllWithCriteria({ types: ["TEXT"] });
  for (const o of overrides) {
    const n = now.find(x => x.name === o.name);          // layer-name match only
    if (!n || n.characters === o.chars) continue;
    try {
      if (o.font === figma.mixed) {
        for (let i = 0; i < n.characters.length; i++) await figma.loadFontAsync(n.getRangeFontName(i, i + 1));
      } else { await figma.loadFontAsync(o.font); }
      n.characters = o.chars;
    } catch {}
  }
}

const results = [];
for (const inst of placements) {
  // capture text/content overrides BEFORE the swap (a swap MAY drop them on a fork).
  const overrides = [];
  for (const t of inst.findAllWithCriteria({ types: ["TEXT"] }))
    overrides.push({ id: t.id, name: t.name, chars: t.characters, font: t.fontName });

  // 4) target = score-matched variant (set) or the plain component; then swap.
  const target = set ? pickVariant(set, inst.componentProperties || {}) : twinComp;
  try { inst.swapComponent(target); }
  catch (e) { results.push({ instId: inst.id, status: "escalated", why: "swap-threw", error: String(e) }); continue; }

  // 5) RE-APPLY captured text overrides (layer-name match; figma.mixed handled).
  await reapply(inst, overrides);

  // 6) force repaint, then verify by OUTCOME (screenshot), NOT the remote flag. exportAsync spills
  //    to tool-results/*.txt; decode + vision-compare vs the canonical frame OFF-context.
  //    ROLLBACK on verify-fail: swap back to `fork` + reapply(inst, overrides), THEN escalate — the
  //    caller keeps `overrides` per instId for exactly this (see revert note below).
  figma.currentPage.selection = [inst]; figma.viewport.scrollAndZoomIntoView([inst]);
  results.push({ instId: inst.id, status: "swapped-pending-verify", overrides });
}
return { forkMasterId, count: placements.length, results }; // caller screenshots; regression => revert + escalate.
```

**Revert (verify-fail):** the caller holds the pre-swap baseline screenshot and each instance's
captured `overrides`; on regression it runs `inst.swapComponent(fork)` then re-applies those overrides
(same `reapply` helper) so the page is restored to its pre-swap state, **then** escalates the
fingerprint — a regressed instance is never left on the page.

**Verify by outcome, not the `remote` flag** — the `remote:true` post-swap value alone is **not**
accepted as verification. A before/after screenshot of the owning screen-state must confirm no
regression; escalate (after **N=2** tries) → revert. **Fork shared across several screen masters:**
when placements span >1 owning master there is no single `master title` for the fingerprint — key it
on the **fork's own `componentKey` + class** (`<forkKey> | provenance`) instead (see §7.7 item 4).

## 7.2 Naming fixes — split by `naming-audit` class

Reuse the `naming.md` model; fix at the locus from `§6.1`. Rename directly via `figma_execute`
(`node.name = …`) / `figma_rename_node` in auto-run — **not** via `figma-write` (its contract is a
human gate; use it only in attended follow-up).

- **`violation:master-format`** → rename the **MASTER** to exactly `[Platform][Feature][Screen]`.
  Renaming a COMPONENT auto-renames only instances whose names were never manually overridden; the
  flow instances carry manual deltas, so this does not clobber them (`figma-build-recipe.md`).
- **`redundant-prefix`** → on the **variant instance's stored name**, strip the repeated
  `[Platform][Feature][Screen]` back to the delta (e.g.
  `[Native][Checkout][Address][Edit address] - Change address…` → `[Edit address] - Change address…`).
- **`violation:separator`** → normalize the en-dash `–` to a hyphen ` - ` on the variant instance.
- **`violation:missing-description`** → append ` - <description>` to the variant instance, sourcing
  the description per `conventions/naming.md`'s tooling rule (the flow-arrow /
  connector label into the frame, else its section / neighbours).
- **`reuse`** → **never auto-fix.** Soft-flag "reusing master X as screen Y — intentional?" for a
  human OK; keep the `[Screen]` override in the delta.

Verify a rename by **re-reading the name** (not a screenshot). Regenerate `screenflow` after any title
change (`§7.7`).

## 7.3 Match fixes (only once `specId` is stamped)

With per-element `specId` addressing present, a match finding drives one of:
- **swap to the correct component/variant** (TOKEN/THEME → set the mode from
  `profile.variables.modes` / bind the right semantic token; PLATFORM-with-axis → swap the OS
  variant) — same import-by-key + score-match recipe as 7.1;
- **convert a spinoff to a compliant derived-fallback** (7.4) when ROLE/VARIANT/ANATOMY fails and no
  published twin fits.
Until the stamp exists, match stays **report-only** — do not mutate.

## 7.4 Derive fallback — compose from published library sub-components

When nothing published matches: clone the closest library variant as the base (layout frames only as
scaffolding), bind color/spacing/radius to variables in `profile.variables.semanticCollections`
(never directly to `profile.variables.primitiveCollections`) + type via the design system's text
styles, place in the derived strip (`profile.labels.derivedStrip`), tag + promotion-note it, then
**self-verify** against the `§6.5` compliance test **and** a screenshot vs the frame. Non-compliant
derive → **escalate, don't ship**.

**`local` mode:** there is no library to derive from or promote to. Author the component on a
`profile.components.localPagePrefix` page, composed of the working file's own components and bound
to variables created in `profile.variables.semanticCollections`; no strip, no `derived` tag, no
promotion note. Self-verify with rules 2–4 of §6.5 and a screenshot.

```js
// DERIVE FALLBACK — mutating, `library` mode; owner-gated (as 7.1 step 0). Requires the PROFILE PREAMBLE.
// 1) base = closest published library variant, cloned; compose extra published library sub-instances in.
const set  = await figma.importComponentSetByKeyAsync(closestSetKey);
const base = pickVariant(set, desiredProps).createInstance();   // clone stays fast even when degraded
const frame = figma.createFrame(); frame.layoutMode = "VERTICAL"; frame.appendChild(base);
// … append additional imported library sub-instances; frames are scaffolding ONLY.

// 2) bind fills/strokes/radius to a variable in profile.variables.semanticCollections (never
//    profile.variables.primitiveCollections); type via the design system's text styles. Resolve
//    variable ids via figma_get_variables (the collection's modes are profile.variables.modes).
//    e.g. base.setBoundVariable("fills", semanticVarId);
// token-trap: if a spacing var whose name does not state its px resolves to a wrong px, set
//    itemSpacing literally and clear the bad binding —
//    frame.setBoundVariable("itemSpacing", null); frame.itemSpacing = 16;

// 3) componentize + place in the derived strip (found by profile label prefix + plugin data;
//    created with the exact profile label and tagged so later runs find it either way).
const comp = figma.createComponentFromNode(frame);
comp.name = "<Category>/<kebab-name>";                        // per profile.components.namePattern
let strip = figma.currentPage.findOne(isDerivedStrip);
if (!strip) {
  strip = figma.createSection(); strip.name = profile.labels.derivedStrip;
  strip.setSharedPluginData(BUILD_NS, "strip", "derived");
}
strip.appendChild(comp);

// 4) tag + promotion note (both required by §6.5). The `provenance=derived` tag is ALSO what the
//    §6.2 classifier keys on to route this component to §6.5 compliance instead of fork classification
//    — the build-time derive path (`guarded-build-core.md` Phases 2/4 + builder brief) stamps the SAME tag.
//    WRITE only to the current build namespace (BUILD_NS, default "screenbuild").
comp.setSharedPluginData(BUILD_NS, "provenance", "derived");
comp.description = `fallback (derived from ${closestSetKey}) — promote into ${profile.library.name}, then re-link so future screens consume the published version.`;
return { compId: comp.id }; // then run the §6.5 compliance checker + a screenshot; escalate on fail.
```

## 7.5 Parity fix — re-align a built state to its canonical frame

Makes parity's **auto-fixable: yes** real. A parity finding (from §6.4) is a **content/value** drift,
not a structural one, so the fix is bounded: **re-apply the text and prop overrides** the spec/frame
calls for onto the drifted instance (the same override-reapply mechanics as §7.1 step 5 — layer-name
match, `figma.mixed` fonts handled, `setProperties` for boolean/text/instance-swap props), then run the
**≤3-iteration screenshot QA** (`figma_capture_screenshot` vs the canonical frame, chrome-ignored,
PROPOSED-exempt — §6.4). Escalate — do **not** force-fix — when the drift is **structural** (a missing
slot, wrong ROLE/ANATOMY, a needed state absent): that is a match/derive concern (§7.3 / §7.4), not
parity, and force-editing it would fabricate content the frame doesn't support. Verify by the
before/after screenshot; escalate after **N=2** QA rounds fail.

## 7.6 Token/style binding pass (authored nodes)

Remediate each §6.6 finding per `conventions/tokens.md` (nearest-match): text →
`setTextStyleIdAsync(nearestStyleId)` (clear a conflicting bound font var first —
`setBoundVariable('fontSize', null)`); dimension → `setBoundVariable(field, nearestTokenVar)`
**only within ±2px**. **Gaps** (a text size/weight off `profile.typography.sizeLadder` /
`.weights` after `profile.typography.substitutions`; a dimension >2px from every token)
are **not** snapped — leave the literal. Verify by screenshot (≤3 iterations) that the screen is
visually unchanged; a shift >2px means a gap got snapped that shouldn't have.

Emit the consolidated **design-system proposal** once per run — the deliverable for the
design-system team: an amber note card titled with `profile.labels.proposalCard` placed in the
derived strip (`profile.labels.derivedStrip`), listing every text-style + dimension gap with
where-used counts, interim handling, and the recommended addition — plus a
`profile.labels.proposalDoc` file (default `design-system-proposal.md`) in the run workspace. Never
distort a design to force a token.

**`local` mode:** there is nobody to propose to — the working file is the design system. Close each
gap by authoring the missing variable in `profile.variables.semanticCollections` (or the missing
text style) and binding to it; list what was added in `audit-report.md`. No proposal card, no
proposal doc.

## 7.7 Safety net (every fix passes through this)

1. **Blast radius** — mutate the **build page only**. Standalone: the **ownership marker**
   `screenbuild` · `owner` on the page (stamped by the builder in Phase 5; read with the preamble's
   `readBuild(page,'owner')`, which also honours the profile's legacy build namespaces; accepted
   values: `figma-screens-from-source`, or any legacy value starting with `figma-screens-from-`) is
   **required** for auto-fix; a page lacking it is **report-only unless `--fix`**.
2. **Self-verify by outcome, not the finding flag** — swaps/derives verified by a before/after
   **screenshot** of the owning screen-state (+ the `§6.5` compliance test for derives, `§6.6` for
   authored nodes); renames
   verified by name re-read. The provenance `remote` flag alone is **not** verification.
3. **Escalate-on-failure / low-confidence** — continue on success; **escalate** (report, don't
   mutate further) on: verify fail after **N=2** tries, a **diverged-fork** swap, a **non-compliant
   derive**, no twin source, or the **change budget** exceeded.
4. **Stable finding identity — fingerprint = `master title | element path | class`** (survives the
   node-id churn a rebuild causes; for a fork shared across >1 owning master, key on the fork's own
   `componentKey + class` — §7.1). A **master rename re-keys** the fingerprint (its `master title`
   segment changes), so the re-audit that follows a rename recomputes it — an escalated *pre-rename*
   fingerprint won't spuriously match the renamed master. Escalated fingerprints are remembered so
   re-audit doesn't retry them; termination = no fixable *fingerprints* remain.
5. **Timeout hygiene** — after any `figma_execute` **timeout** (mutations persist, no rollback), run
   a **stray-node sweep** (list + delete partial/stray nodes) before continuing; abort a pattern
   after 2 consecutive failures (`figma-build-recipe.md` §degradation ladder).
6. **Flow integrity** — diff the `screenflow` **edge set before/after** each fix pass; an edge-count
   **shrink** (a fix dropped a reaction) **escalates** rather than silently regenerating a smaller
   graph. Edges carry `componentId` to disambiguate endpoints across shared masters. **Regenerate
   `screenflow`** after any title/structure change (recipe §Machine-readable flow). The "before" read
   takes `profile.pluginData.flowNamespace` first, then each of `legacyFlowNamespaces` (the
   preamble's `readFlow`); the regenerated graph is **written only** to the current namespace.
7. **Bridge-gated** — Phase 7 requires the Desktop Bridge; if it dies mid-loop, **pause, run the
   stray sweep, write the report, and stop** (builder's degradation ladder).
8. **Change budget** unit = **master-level mutations**; a master edit propagating to N instances
   counts as **1**. Default cap configurable (`--change-budget`).
9. **Loop-until-clean** — re-audit after each pass; repeat until no fixable fingerprints remain or
   the iteration cap (`--max-iterations`) is hit.

---

# Report format

Run-workspace artifacts:

- **`audit-report.md`** — counts by class/severity, before→after, escalations listed by
  **fingerprint**.
- **`audit-findings.json`** — one object per finding:
  ```json
  { "fingerprint": "master title | element path | class",
    "class": "provenance|naming|match|parity|token-style",
    "severity": "high|medium|low",
    "masterKeyOrId": "<componentKey, or the node id when the main has no key>",
    "nodeId": "<example placement node id>",
    "component": "<Category/kebab-name or master title>",
    "evidence": "<what proves the defect>",
    "proposedFix": "swap|rename|derive|rebuild|retag|none",
    "status": "open|fixed|escalated|report-only",
    "verify": "screenshot-ok|name-reread-ok|compliance-ok|failed|n/a" }
  ```

# Degradation & standalone use

- **Desktop Bridge not connected to the working file** → **stop** and tell the user to connect it.
  Neither phase has a REST path.
- **`library` mode but the library is not enabled in the working file** (component lookup returns
  nothing) → **stop** and tell the user to enable it; never silently switch to `local`.
- **`local` mode** → **provenance** and the provenance swap are skipped; everything else runs.
- **No specs / no `specId` stamp** → **match** is report-only (provenance/naming/parity still run).
- **No canonical registry** → dispatch `screen-canonicalizer` to build one; never cluster by hand.
- **No video frames** → **parity** degrades to checklist mode with a note (a pixel-less source satisfies `--parity=require` via checklist mode).
- **No twin source** (page has zero library instances and the library enumeration is unreachable) →
  **provenance** fixes **escalate** — report the forks, never guess a twin.
- **Standalone on a non-owned page** (no `screenbuild` · `owner` marker) → **report-only unless `--fix`**.
- **Standalone `--page <id>`** → the loop **`await figma.setCurrentPageAsync(<page>)` FIRST** — every
  audit/fix script operates on `figma.currentPage`, so the target must be current before any findAll.

# Config / flags

- `--report-only` — stop after the audit report; never mutate.
- `--fix` — force auto-fix even on a page without the `screenbuild` · `owner` marker.
- `--parity=auto|off|require` (default **`auto`**) — `auto` runs checklist parity with a note when no
  video frames are supplied; `off` never runs parity; `require` **FAILS the run** only if a pixel-bearing
  source supplies no ground truth — a pixel-less source satisfies `require` via checklist mode.
- `--page <id>` — standalone target (the loop `setCurrentPageAsync`es it first, see above).
- `--max-iterations <n>` — loop-until-clean cap. Default **5**.
- `--change-budget <n>` — master-level mutations (a master edit propagating to N instances = 1).
  Default **200**.
- Retry budget **`N = 2`** (not a flag) — aligns with the "abort after 2 consecutive failures" rule
  (§7.7 item 5); a fix that fails verification twice escalates.
