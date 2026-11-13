---
name: screen-canonicalizer
version: 1.4.0
description: "Reads a Figma file via the figma-deep-dive agent, clusters frames into canonical screens + a variant matrix, and emits a schema-valid canonical-screen-registry.json. Read-only — never mutates Figma. Triggers: canonicalize screens, build screen registry, dedupe figma screens."
---
# screen-canonicalizer — read-and-synthesize

Never mutates Figma. Never reads Figma directly — always via the `figma-deep-dive` agent. Do not call any Figma MCP tools directly in any step — every Figma read goes through the figma-deep-dive agent.

## Workflow
1. **Read.** Dispatch `figma-deep-dive` for the target nodes and **ask for the
   `Component instances (identity + properties)` block** (tell it you are canonicalizing).
   That block gives, per INSTANCE: `componentKey` (bridge, cross-file-stable),
   `componentId` (within-file-stable), `componentName` (the **master's** name), and
   `componentProperties`. Use the identity the agent actually returned — see the fallback in
   step 2.
   - **Names split across master + variant** — the master carries the canonical
     `[Platform][Feature][Screen]`; the variant (instance) carries only the delta
     `[State] - description`. Reconstruct the full logical name by JOINing `componentName`
     (the master) + the variant's delta. The agent resolves `componentName` over REST via a
     **two-hop** fetch (the instance's own payload echoes its overridden name, not the master's —
     do not trust that field). A variant carrying nothing beyond the master name is the
     **primary/default** screen (no delta).
   - **Reuse** — a variant may reuse a master to represent a *different* logical screen: its
     `[Screen]` bracket differs from the master's while `[Platform][Feature]` match. Record it as
     its **own logical screen that shares** the master's identity (same
     `componentKey`/`componentId`) — do not collapse it into the master's primary screen, and do
     not treat the differing `[Screen]` as a mismatch. Note the reuse for the human confirm.
2. **Group by sameness** (per the grouping rules below):
   - **B** → cluster by the screen master-component's identity: prefer
     `componentKey` (bridge). If the agent ran over **REST** and `key=—`, cluster by
     `componentId` instead — it is stable **within the one file** a registry covers, which
     is all grouping needs (deterministic either way).
   - **C** → cluster by frame `{key}` (deterministic).
   - **legacy/untagged** → similarity (structure + screenshot) then **CONFIRM the
     groupings with the user** before recording (no silent grouping).
   Resolve every library piece inside a screen by its own identity. **Canonicalizing a
   piece's display name to the current library name is bridge-only** (it needs the
   library `key`); over REST, keep the instance's current name and note it — never fail the
   run for want of the library lookup.
3. **Build variants.** For each cluster, read each member's `componentProperties`
   (B, from the Component-instances block) or `{entry}` + tree-diff (C) → a variant row.
   Screen-level state is carried by **boolean/text component properties + content**
   (e.g. `overlay`, `bottom sheet selector`, a text swap) — **not** `Prop=Value`
   variant sets, which don't exist at the screen level. Collect these props (plus the
   variant's `[State]` bracket) into `differsBy`.
4. **Platform guard.** A `[Web]` vs `[Native]` split is a DIFFERENT screen — never
   collapse across platform.
5. **Emit** `canonical-screen-registry.json` into `figma-screens/<fileKey>/` in the working
   directory (or the path the user gives) and validate against
   `$CLAUDE_PLUGIN_ROOT/schemas/canonical-screen-registry.schema.json` (or two directories
   up from this skill file, via `readlink -f`). If invalid, fix and re-validate.
6. **Report** the archetype count + any clusters left unconfirmed.
