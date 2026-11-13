---
name: design-system-profile
version: 0.1.0
description: >
  Detects the design system a working Figma file uses and writes the project's
  design-system profile (.figma-deep-dive/design-system.json) after the user
  confirms. Reads the enabled libraries, variable collections, modes and text
  styles over the Desktop Bridge, proposes `library` or `local` mode, and
  validates the result against the plugin's schema. Read-only for Figma. Use
  before the first figma-screens-from-source build, when the design system changes,
  or when a build reports "no profile". Triggers: design system profile, detect
  design system, set up the profile, link my design system, /figma-screens profile.
---
# design-system-profile — detect and save the profile

Read `conventions/design-system.md` in the plugin root first (resolve the root
from `$CLAUDE_PLUGIN_ROOT`, or two directories up from this file via
`readlink -f`). It defines every field you are about to fill.

**Read-only for Figma.** You only write one JSON file in the user's project.

## Requirements
- `figma-console` MCP + Desktop Bridge connected to the **working file** (the
  file screens will be built in — not the library file). Probe with
  `figma_get_status`. Not connected, or connected to another file → STOP and
  tell the user to open the working file and run the Bridge.

## Workflow
1. **Intake.** The working file URL. If `.figma-deep-dive/design-system.json`
   already exists, read it and treat this run as an update — show what would change.
2. **Detect** with read-only calls:
   - Libraries and their components: `figma_get_library_components` (and
     `figma_search_components` when it returns nothing).
   - Variables: `figma_get_variables` → collection names, modes, name patterns
     per family. Classify a collection as *primitive* when its variables hold
     raw values that other collections alias, *semantic* when it aliases them.
   - Text styles: `figma_get_text_styles` → naming pattern, the set of sizes
     and weights, font families (and the size at which the family changes).
   - Roles: match component names to `primaryButton`, `navigationBar`, `input`,
     `listItem`, `card`, `bottomActionBar`, `statusBar`. Leave a role out when
     nothing clearly fits — never guess.
3. **Choose the mode.**
   - At least one enabled library with components → propose `library`, with its
     name and file key(s).
   - No library, or the user says there is no design system → propose `local`.
   - A library exists but is **not enabled** in this file → say so and give the
     one instruction: "In Figma: Assets → Libraries → enable `<name>`, then run
     this again." Do not write a `library` profile for a file that cannot see it.
4. **Ask what cannot be detected** — one short question each, with the default:
   platform tags (`Native`, `Web`), copy locale, build width.
5. **Preview + CONFIRM (gate).** Show the full profile JSON and, under it, a
   three-line plain summary (mode, library, what authored nodes will bind to).
   Ask **"Save this profile? (yes / edit / cancel)"**. Write nothing before yes.
6. **Write** `.figma-deep-dive/design-system.json`, then validate it against
   `schemas/design-system-profile.schema.json` in the plugin root. Invalid →
   fix and re-validate before reporting.
7. **Report** the path, the mode, and anything left empty that a build will ask
   about later.

## Rules
- Start from `profiles/default.json`; override only what you detected or the
  user told you. `profiles/example.library.json` shows a filled `library` profile.
- Never invent a library file key, collection name or style name. Unknown stays
  empty and is listed in the report.
- Keep `pluginData` namespaces at their defaults unless the user is migrating
  files built with other namespaces — then add those under the `legacy…` lists.
