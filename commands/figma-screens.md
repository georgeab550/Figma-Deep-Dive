---
name: figma-screens
version: 1.6.0
description: Prep a Figma file for the screen-identity pipeline, and hand off to the PRD. `profile` detects the file's design system and saves the project profile; `init` seeds the conventions card; `prd` writes the "Screens to build" PRD section (read-only Figma); `build <source>` rebuilds a recording, code/HTML, screenshots, a `.pen` file, a written spec or an old-format Figma page as design-system-native screens on a new page (pilot-gated); a bare URL audits + normalizes SCREEN naming — masters keep `[Platform][Feature][Screen]`, variants are stripped to their delta `[State] - description` (gated); `layers` applies the inner-layer taxonomy on design-system / component-authoring files (gated).
---
# /figma-screens

Usage:
- `/figma-screens profile <url>` → **design-system-profile** skill: detect the libraries, variables and text styles the working file uses and save `.figma-deep-dive/design-system.json` after you confirm. **Read-only for Figma.** Run it once per project, before building screens.
- `/figma-screens init <url>` → figma-write **scaffold (init)** workflow (seeds the conventions card only; components come from your design-system library).
- `/figma-screens prd <links> [--prd <path>]` → **screens-to-prd** skill: dedupe screens → write the "Screens to build" section into the PRD. **Read-only for Figma.**
- `/figma-screens build <source> [<working file url>]` → **figma-screens-from-source** skill: rebuild an existing source as design-system-native screens on a NEW page of the working file. `<source>` is a screen recording, a code project or HTML, screenshots or mockup images, a `.pen` file, a written spec, or the URL of a Figma page in an old or mixed structure — the skill detects which and asks when it is ambiguous. Stops after 2 pilot screens for your review; the source is never modified. **Requires the Desktop Bridge** — there is no REST fallback for building.
- `/figma-screens <url>` → figma-write **naming apply**: audit + normalize **screen** names — masters keep `[Platform][Feature][Screen]`; variants are **stripped to their delta** `[State] - description` (the master keeps the prefix; the full name is assembled downstream), gated. This is the **feature-designer** path — it does NOT touch inner layer names, because in a feature file layers come pre-named from the library instances you drop in (see `conventions/layers.md`).
- `/figma-screens layers <url>` → figma-write **layer naming apply**: audit + apply the inner-layer taxonomy (`type/role[/qualifier]`), gated. Use this **only on design-system / component-authoring files** — the files that define components, not feature files that consume them.

Routing:
0. If args start with `profile` → **design-system-profile**.
1. If args start with `init` → figma-write "scaffold (init)".
2. Else if args start with `prd` → **screens-to-prd**.
3. Else if args start with `layers` → figma-write "layer naming apply" (component-authoring files).
4. Else if args start with `build` → **figma-screens-from-source** with the source (and the working file URL when given; otherwise the file open in Figma Desktop). Requires the Desktop Bridge.
5. Else → figma-write "naming apply" (screen names only) on the URL.

The write paths (`init`, `layers`, `build`, bare URL) and `profile` require `figma-console` MCP + Desktop Bridge connected — if absent, STOP and tell the user to connect it. The `prd` path is **read-only** and reads through the figma-deep-dive agent: Bridge first, with the REST API as a degraded fallback when the Bridge is not connected.
