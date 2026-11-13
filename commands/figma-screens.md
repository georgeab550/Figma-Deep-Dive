---
name: figma-screens
version: 1.4.0
description: Prep a Figma file for the screen-identity pipeline, and hand off to the PRD. `init` seeds the conventions card; `prd` writes the "Screens to build" PRD section (read-only Figma); a bare URL audits + normalizes SCREEN naming — masters keep `[Platform][Feature][Screen]`, variants are stripped to their delta `[State] - description` (gated); `layers` applies the inner-layer taxonomy on design-system / component-authoring files (gated).
---
# /figma-screens

Usage:
- `/figma-screens init <url>` → figma-write **scaffold (init)** workflow (seeds the conventions card only; components come from your design-system library).
- `/figma-screens prd <links> [--prd <path>]` → **screens-to-prd** skill: dedupe screens → write the "Screens to build" section into the PRD. **Read-only for Figma.**
- `/figma-screens <url>` → figma-write **naming apply**: audit + normalize **screen** names — masters keep `[Platform][Feature][Screen]`; variants are **stripped to their delta** `[State] - description` (the master keeps the prefix; the full name is assembled downstream), gated. This is the **feature-designer** path — it does NOT touch inner layer names, because in a feature file layers come pre-named from the library instances you drop in (see `conventions/layers.md`).
- `/figma-screens layers <url>` → figma-write **layer naming apply**: audit + apply the inner-layer taxonomy (`type/role[/qualifier]`), gated. Use this **only on design-system / component-authoring files** — the files that define components, not feature files that consume them.

Routing:
1. If args start with `init` → figma-write "scaffold (init)".
2. Else if args start with `prd` → **screens-to-prd**.
3. Else if args start with `layers` → figma-write "layer naming apply" (component-authoring files).
4. Else → figma-write "naming apply" (screen names only) on the URL.

The write paths (`init`, `layers`, bare URL) require `figma-console` MCP + Desktop Bridge connected — if absent, STOP and tell the user to connect it. The `prd` path is **read-only** and reads through the figma-deep-dive agent: Bridge first, with the REST API as a degraded fallback when the Bridge is not connected.
