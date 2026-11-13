---
name: screens-to-prd
version: 1.0.1
description: >
  Read-only handoff that turns Figma links into the PRD "Screens to build" section.
  Runs the screen-canonicalizer to dedupe recycled screens into a canonical registry,
  then writes a fenced, regenerable "## 🖼️ Screens to build" block into the PRD (a
  summary table + a per-screen variant matrix). Never mutates Figma — reads via the
  figma-deep-dive agent; writes only the PRD. Triggers: screens to prd, write screens
  to build, figma to prd screens, /figma-screens prd.
---
# screens-to-prd — Figma → PRD "Screens to build"

The design→PRD handoff. **Read-only for Figma** — every Figma read goes through the
`figma-deep-dive` agent and no Figma write tool is ever called. It writes only the PRD,
and only inside a fenced generated block, so re-running refreshes cleanly and never
touches hand-written prose (Flows, Copy deck, etc.).

## Tools
- **Dedupe screens:** the `screen-canonicalizer` skill — reads Figma via figma-deep-dive,
  groups recycled screens by `mainComponent.key`, emits `canonical-screen-registry.json`
  (schema-valid).
- **Render + write:** `render/render-screens-section.mjs` (stdlib; registry → PRD block).
  Resolve it from `$CLAUDE_PLUGIN_ROOT/render/render-screens-section.mjs`, or two dirs up
  from this skill file (`readlink -f`).

## Workflow
1. **Intake.** Collect: the Figma file URL + node link(s) for the flow(s), and the target
   **PRD path**. Confirm the intent is "write the Screens-to-build section".
   - If the user already has a `canonical-screen-registry.json`, take it and skip step 2.
2. **Canonicalize.** Invoke the `screen-canonicalizer` skill on the Figma links → it emits
   `canonical-screen-registry.json` (validated against
   `schemas/canonical-screen-registry.schema.json` in the plugin root). Read-only.
3. **Preview.** Render the block WITHOUT writing, and show it to the user:
   ```
   node "$CLAUDE_PLUGIN_ROOT/render/render-screens-section.mjs" --registry <registry> --dry-run
   ```
4. **CONFIRM (gate).** Present the rendered block + the target PRD path, then ask
   **"Write this into <prd>? (yes / edit / cancel)"**. Do not write before the user says yes.
5. **Write.** Apply it:
   ```
   node "$CLAUDE_PLUGIN_ROOT/render/render-screens-section.mjs" --registry <registry> --prd <prd>
   ```
   Creates the `## 🖼️ Screens to build` section if absent; replaces the fenced block in
   place if present. Always pass a real path after `--prd` — the script exits non-zero if
   the value is missing (it will NOT silently fall back to a dry run). If it reports
   "malformed SCREENS markers", the PRD has an orphaned or duplicated marker; fix it by
   hand and re-run — the script refuses to write rather than risk clobbering prose.
6. **Report.** created-vs-replaced, the screen count, and remind: the block is generated —
   don't hand-edit it; re-run this to refresh after a Figma change. Confirm no Figma file
   was written.

## Notes
- The block is fenced by `<!-- SCREENS:BEGIN … --> … <!-- SCREENS:END -->` (heading
  inside). Regeneration is idempotent — the marker carries a screen count, never a
  timestamp, so the same registry + PRD produce a byte-identical block.
- **Other PRD tooling:** the generated block is machine-owned. If a linter or audit you
  run on the PRD flags its node-ids or terse cells, have it skip everything between the
  `SCREENS:BEGIN`/`SCREENS:END` markers.
- **Never invent rows** — the table is exactly the registry. If you need more columns
  (actions, navigation, platform, library pieces), enrich the registry via the
  canonicalizer; this skill only renders what the registry contains.
