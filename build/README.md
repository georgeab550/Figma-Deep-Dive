# build/ — shared Figma build knowledge

Canonical home of the guarded-build references consumed by the
`figma-deep-dive:figma-screens-from-source` skill of this plugin and its three source
adapters (`skills/figma-screens-from-source/sources/` — kinds `video`, `code`, `figma-page`).

None of these docs names a design system: they read it from the profile
(`profile.<path>`), resolved first per `../conventions/design-system.md`.
Paths are plugin-relative — resolve them from `$CLAUDE_PLUGIN_ROOT`
(e.g. `$CLAUDE_PLUGIN_ROOT/build/audit-fix.md`).

| Doc | What |
|---|---|
| `figma-build-recipe.md` | Figma Plugin-API mechanics + every known failure mode (componentize, instance geometry, arrows, reactions, fonts, token binding, the machine-readable flow graph) |
| `guarded-build-core.md` | Resolve-the-profile step + Phases 2–7 + flags + shared guardrails, written once; the figma-screens-from-source skill dispatches to it after the Phase 1 source adapter |
| `audit-fix.md` | Phase 6 audit + Phase 7 fix protocol (naming/provenance/match/parity, escalation, budgets) |
| `agent-briefs.md` | Investigator / spec-writer / builder brief templates + the Code and Figma-page source-adapter briefs |
