---
name: figma-write
version: 1.6.0
description: >
  Writes to Figma under the plugin's screen conventions, with a hard confirm-before-mutating
  gate. Phase 1: rename frames to the screen naming convention — masters
  `[Platform][Feature][Screen]`, variants store only the delta `[State] - description`
  (the tool strips any repeated master prefix; the full name is assembled downstream,
  never stamped on the frame); rename inner layers to the slash-path taxonomy
  (`type/role[/qualifier]`); scaffold (init) a new file by rendering the conventions
  card to NATIVE Figma text styling (headings bold + larger, inline bold, clean
  bullets — Markdown markers stripped, not pasted literally); and make surgical edits
  to existing nodes (text, raw-hex → variable binding, spacing/padding/radius). Reads current state
  via the figma-deep-dive agent, proposes a plan, WAITS for approval, then writes
  via the figma-console MCP and self-validates with a screenshot loop. Requires the
  figma-console MCP + Figma Desktop Bridge connected. Triggers: rename frames to
  convention, fix figma naming, apply naming convention, write to figma, edit this
  figma node, bind this fill to a variable, apply layer names, fix layer naming,
  rename layers to convention, layer naming apply.
---

# figma-write — confirm-gated Figma writer (Phase 1)

You write to Figma on the user's behalf, governed by the plugin's conventions, and you
**never mutate without explicit approval**. You run in the main session (not as a
subagent) precisely so you can pause and show the user a plan + screenshot before
writing.

## Tools
- **Read current state:** dispatch the `figma-deep-dive` agent (do NOT read the
  full design context yourself — keep main context lean).
- **Write:** the `figma-console` MCP write tools only — Phase 1 uses
  `figma_rename_node` (this task) and, for edits, `figma_set_text` /
  `figma_set_fills` / spacing setters (Task 4). Re-search component/node IDs at the
  start of a session; they go stale.
- If `figma-console` is unavailable or the Desktop Bridge is not connected, STOP
  and tell the user to connect it (see the plugin README) — do not attempt writes.

## Load the conventions
Resolve, then read, the rules relevant to the request:
1. If `$CLAUDE_PLUGIN_ROOT` is set → `$CLAUDE_PLUGIN_ROOT/conventions/naming.md`.
2. Otherwise resolve this skill file's real path (`readlink -f`) and read
   `conventions/naming.md` two directories up (the plugin root).

## Workflow — naming apply

1. **Intake.** Collect the Figma file URL, the node/section to operate on, and
   confirm the intent is "rename to convention".

2. **Read + audit.** Dispatch `figma-deep-dive` for a naming audit of the target:
   ```
   Use figma-deep-dive to run a NAMING AUDIT on <url>, node <id>. Report violations only.
   ```
   Use its `## Naming audit` block as the work-list (skip frames already `ok` or
   `out-of-scope`).

3. **Resolve each flagged name (delta-only).** The `[Platform][Feature][Screen]`
   prefix lives on the **master** and is **never written onto the variant** — the
   variant stores only its delta. Work the audit rows by tag:
   - **`redundant-prefix`** (the common path) — the variant's stored name repeats its
     master's `[Platform][Feature][Screen]`. **Strip it** to the delta
     (`[State] - description`; for a primary/default screen, just `- description`).
     Resolve the master by identity (`masterName` in the identity block; bridge or REST
     two-hop) to know exactly which prefix to remove.
   - **`reuse`** — the delta leads with a `[Screen]` bracket that differs from the
     master's (platform+feature match). **Keep** the override in the delta. **ASK**
     "reusing master `<master>` as screen `<screen>` — intentional?" and record the
     reuse on confirm.
   - **`violation:separator`** — normalize an en-dash `–` before the description to a
     hyphen ` - `.
   - **`violation:missing-description`** — a variant needs a ` - description`. Propose
     one from the screen's **flow position** (the flow-arrow/connector into the frame,
     else its section/neighbours), then ASK to confirm or edit. Never invent silently.
   - **`violation:master-format`** (the node is a COMPONENT/master) — a master must be
     `[Platform][Feature][Screen]` with no `[State]`/description; propose the trimmed
     form and confirm.
   - **`master-unresolved`** — the master couldn't be resolved. **Leave the stored name
     alone** (don't strip a prefix you can't confirm is redundant); flag for the user.

   The full logical name (`[Platform][Feature][Screen][State] - description`) is only
   ever **assembled downstream** (canonicalizer/PRD) by joining the master's name with
   the variant's delta — figma-write never stamps it onto the frame.

4. **Plan + CONFIRM (HARD GATE).** Present the assembled renames as a table, grouped
   by master:
   ```
   Master [Native][Checkout][Order status]
     "[Native][Checkout][Order status][Success] - Paid by card…"  → [Success] - Paid by card…   (strip redundant prefix)
     "[Success] - Paid on delivery…"                                  → (already delta — no change)
   Reuse (confirm):
     "[Order details][Delivered] - …" — reuses master [Native][Orders][Order list]. Intentional?
   ```
   Resolve any `reuse` / `<…?>` by asking. Then ask: **"Apply these renames? (yes / edit / cancel)"**
   Do **not** call any write tool until the user says yes.

5. **Execute.** For each approved row, call `figma_rename_node` with the new name.
   Renames are idempotent — re-running on an already-correct name is a no-op.

6. **Report.** List `old → new` for every frame renamed, and anything skipped
   (already ok / out-of-scope / user-cancelled).

## Workflow — surgical edits

For changing existing nodes (text, fills, spacing) — not creating anything new.

1. **Intake.** File URL + the exact node ID(s) + what to change.

2. **Read current.** Dispatch `figma-deep-dive` on those node IDs to get current
   text, fills (raw hex AND any `VariableID`), and spacing/padding/radius.

3. **Plan a diff.** For each node, show `field: current → proposed`:
   ```
   node 1203:44 "Total label"
     text:   "Total"      → "Total amount"
     fill:   #F7F8FB (raw) → bind variable Surface/Subtle
     padding: L16 → L24
   ```
   **Token rule:** if a fill is a raw hex and a matching variable exists, propose
   the variable binding, not another raw hex.

4. **Before-screenshot + CONFIRM (HARD GATE).** Capture a before screenshot of the
   target (via the deep-dive/bridge screenshot path) and present it with the diff.
   Ask **"Apply these edits? (yes / edit / cancel)"**. No write tool runs before yes.

5. **Execute.** Apply approved edits: `figma_set_text` for copy; `figma_set_fills`
   binding the variable for fills; the corresponding spacing/padding/radius setter.

6. **Validate loop (MCP-mandated).** After writing: screenshot → compare to the
   intended diff → if a field didn't land, fix and re-screenshot. Cap at 3
   iterations; if still off, report what's unresolved rather than looping.

7. **Report.** `field: old → new` per node, the final screenshot, and anything the
   validate loop couldn't reconcile.

## Workflow — layer naming apply

1. **Intake.** File URL + target node(s) + confirm intent "apply layer names".

2. **Audit.** Dispatch `figma-deep-dive` with `mode: layer-audit`:
   ```
   Use figma-deep-dive to run a LAYER AUDIT on <url>, node <id>.
   ```
   Use its `## Layer audit` rows as the work-list (skip rows already `ok`).

3. **Resolve names.** For each non-ok row, take the `suggested` name from the
   audit; resolve any `<ASK>` by asking the user. Enforce
   `conventions/layers.md` taxonomy (`type/role[/qualifier]`, lowercase).
   - Derive from content/role using text and the project's i18n keys where
     applicable (via the `localization-resolver` agent).
   - Ambiguous layers → ask, never guess.
   - Target **main components** (type B in the audit) or canonical frames (type C).
     **NEVER rename a layer that lives inside a Figma instance** — instance
     children inherit names from their main component; renaming them is a no-op
     at best and misleading at worst.

4. **Plan + CONFIRM (HARD GATE), batched per section.** Present the proposed
   renames grouped by the section they belong to:
   ```
   Section "Costs"
     1203:44  "Frame 4934832"    →  section/costs
     1203:51  "Group 26086256"   →  row/cost-simple

   Section "Header"
     1204:10  "Rectangle 11"     →  image/hero
   ```
   For each section, ask:
   **"Apply this section's renames? (yes / edit / skip / cancel)"**
   - **yes** → proceed to Execute for that section.
   - **edit** → let the user amend names, then re-confirm.
   - **skip** → move on to the next section without writing.
   - **cancel** → abort the entire workflow; no further writes.
   **No write tool runs before the user says yes.** Non-negotiable.

5. **Execute.** For each approved row, call `figma_rename_node` with the new
   name. Renames are idempotent — re-running on an already-correct name is a
   no-op.

6. **Validate loop.** After executing a section's renames, re-audit those node
   IDs. If a name didn't land (audit still flags it), retry (cap 3 attempts);
   if still unresolved after 3, report the failure rather than looping further.

7. **Report.** List `old → new` for every layer renamed, and anything
   skipped (already ok / user-skipped / inside-instance / unresolved after
   retry cap).

## Workflow — scaffold (init)
For an empty file/page at project kickoff. Seeds ONLY the conventions card so the
file is legible to the pipeline — components come from your **design-system library** (linked
into the working file), never from the scaffold.
1. **Intake.** File URL (must be empty/near-empty) + confirm intent "scaffold".
2. **Read** `scaffold-spec.json` + `conventions/designer-card.md` from the plugin root
   (resolved as in **Load the conventions**) (the authored
   source — read it directly so the scaffold never seeds a stale rendered copy;
   `render/` only produces the HTML artifact for sharing).
3. **Plan + CONFIRM (HARD GATE).** Show what will be created: a "📐 Conventions"
   page holding the card as a single **locked** text node, **rendered to native
   Figma text styling** — headings bold + larger, inline `**bold**`, clean bullets,
   with the Markdown markers (`#`, `**`, backticks, leading `-`/`*`) **stripped, not
   pasted literally**. Ask "Create this scaffold? (yes/edit/cancel)".
4. **Execute — render the card to native styling.** Figma text nodes do **not**
   render Markdown, so parse the card and apply **per-range** styling via
   `figma_execute` (the discrete write tools can't do per-range bold/size). Use the
   validated recipe below. Embed the card with `JSON.stringify` so its backticks /
   quotes / emoji survive. The recipe sets the stripped plain text **before** any
   range styling, so even if a later step throws, the node holds clean text — never
   raw Markdown. It reads the node's **own** font and loads that family's Bold;
   if Bold isn't available it degrades to size-only. (If the bridge/`figma_execute`
   is unavailable at all, figma-write's top-level rule already stops and asks you to
   connect it.)
5. **Report** what was created (page + node id, whether bold applied) + the doc link.

### Scaffold styling recipe
Run once via `figma_execute` (validated live: base font Inter Regular, Bold loaded,
renders headings / inline bold / emoji / diacritics). `md` is the card text,
injected via `JSON.stringify`:

```js
const md = /* JSON.stringify(designer-card.md contents) */;
function parseCard(md){
  const lines = md.replace(/\r\n/g,'\n').split('\n');
  let text=''; const ranges=[];
  for(const raw of lines){
    let size=null, headBold=false, s=raw;
    if(/^#\s+/.test(raw)){ s=raw.replace(/^#\s+/,''); size=24; headBold=true; }
    else if(/^##\s+/.test(raw)){ s=raw.replace(/^##\s+/,''); size=16; headBold=true; }
    else if(/^###\s+/.test(raw)){ s=raw.replace(/^###\s+/,''); size=14; headBold=true; }
    else if(/^\s*---\s*$/.test(raw)){ s=''; }
    else if(/^\s*[-*]\s+/.test(raw)){ s='•  '+raw.replace(/^\s*[-*]\s+/,''); }
    s = s.replace(/`/g,'');
    let clean=''; const spans=[]; let i=0;
    while(i<s.length){
      if(s[i]==='*'&&s[i+1]==='*'){
        const e=s.indexOf('**',i+2);
        if(e!==-1){ const inner=s.slice(i+2,e); const bs=clean.length; clean+=inner; spans.push([bs,clean.length]); i=e+2; continue; }
      }
      clean+=s[i]; i++;
    }
    const start=text.length; text+=clean; const end=text.length;
    if(size!==null) ranges.push({start,end,size});
    if(headBold) ranges.push({start,end,bold:true});
    for(const sp of spans) ranges.push({start:start+sp[0],end:start+sp[1],bold:true});
    text+='\n';
  }
  return {text:text.replace(/\n$/,''), ranges};
}
const {text, ranges} = parseCard(md);

await figma.loadAllPagesAsync();
let page = figma.root.children.find(p => p.name === '📐 Conventions');
if (!page) { page = figma.createPage(); page.name = '📐 Conventions'; }

const node = figma.createText();
page.appendChild(node);
const base = node.fontName;                 // the node's own default font
await figma.loadFontAsync(base);
node.characters = text;                     // stripped plain text first (safe fallback)
node.name = 'Conventions card';
node.fontSize = 13;
node.lineHeight = { value: 150, unit: 'PERCENT' };
node.resize(560, node.height);
node.textAutoResize = 'HEIGHT';
node.x = 0; node.y = 0;

let boldName = { family: base.family, style: 'Bold' }, boldOk = true;
try { await figma.loadFontAsync(boldName); } catch (e) { boldOk = false; }
for (const r of ranges) { if (r.size) node.setRangeFontSize(r.start, r.end, r.size); }
if (boldOk) { for (const r of ranges) { if (r.bold) node.setRangeFontName(r.start, r.end, boldName); } }

node.locked = true;                         // lockOnPaste
return { pageId: page.id, nodeId: node.id, boldApplied: boldOk, chars: text.length };
```

## Validation rules (enforce on every proposed name)
- **Master** = `[Platform][Feature][Screen]` — brackets concatenated, no `[State]`,
  no description.
- **Variant stores the delta only** = `[Screen-override]? [State]? - description` —
  it **never repeats** the master's `[Platform][Feature][Screen]`. `[State]` only when
  the master has ≥2 states; a ` - description` is **always** present; a `[Screen]`
  override appears only for a **confirmed reuse**.
- The platform tag lives on the **master** (exactly `[Native]` or `[Web]`), never on
  the variant.
- **Hyphen** ` - ` (space-hyphen-space) before the description — never an en-dash `–`.
- The full logical name is **assembled downstream**, never stamped onto the variant.
- `[Out of scope]` frames are left alone unless the user explicitly asks to retag.

## Hard rules
- **No mutation before the confirm gate.** Non-negotiable.
- **Stay in scope.** Phase 1 = naming apply + surgical edits. No screen
  generation, no component/variable/variant/mode creation, no comments.
- **Never fabricate** a Flow/Screen you can't infer — ask.
