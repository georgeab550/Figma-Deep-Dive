# Design-system profile

The screen-building skills never assume a particular design system. Everything
that is specific to yours — the library, its variable collections, its text
styles, the labels the build uses — lives in one **profile**. Every doc in
`build/` and `conventions/` refers to profile fields (written `profile.<path>`)
instead of naming a system.

## Two modes

| `profile.mode` | When | What the build does |
|---|---|---|
| `library` | A published design-system library is **enabled in the working file** (Figma → Assets → Libraries) | Places the library's components; binds authored nodes to its variables and text styles; anything it must author itself goes to the derived strip and is proposed for the library |
| `local` | There is no design system — the source is code, screenshots or a recording | Authors components, variables and text styles **in the working file**, on pages prefixed `profile.components.localPagePrefix`. Those become the starting design system. There is no "foreign" or "missing from the library" finding in this mode |

`library` mode only works if the library is actually linked to the working
file. If it is not, component lookup returns nothing: stop and tell the user to
enable it — do not silently switch to `local`.

## Resolving the profile (every skill, before building or auditing)

1. `.figma-deep-dive/design-system.json` in the working directory (or the path
   the user gives). Validate it against
   `$CLAUDE_PLUGIN_ROOT/schemas/design-system-profile.schema.json`.
2. If it does not exist, run the **`design-system-profile`** skill
   (`/figma-screens profile <url>`) to detect one from the open file and save it
   after the user confirms.
3. If the user declines, use `$CLAUDE_PLUGIN_ROOT/profiles/default.json`
   (`local` mode, neutral names) and say so.

Fields missing from a project profile fall back to the default profile's value.
`$CLAUDE_PLUGIN_ROOT` unset → resolve the plugin root from the skill file's real
path (`readlink -f`), two directories up.

## Field reference

| Field | Meaning |
|---|---|
| `mode` | `library` or `local` (above) |
| `library.name` | Display name used in reports and labels |
| `library.fileKeys` | File key(s) of the published library. **A component is "from the library" when its main component is remote and its source file key is in this list** |
| `library.componentKeys` | A few known component keys; used to resolve the file key when `fileKeys` is empty |
| `library.foreignNameHints` | Regexes for component names that signal a different, unwanted library |
| `variables.semanticCollections` | Collections authored nodes bind to |
| `variables.primitiveCollections` | Raw-value collections authored nodes must not bind to directly |
| `variables.typographyCollections` | Collections holding type variables |
| `variables.modes` | Variable modes in use (themes, brands) |
| `variables.tokenPatterns` | Naming pattern per token family (`color`, `spacing`, `padding`, `radius`, `border`, …) |
| `typography.textStylePattern` | How text styles are named |
| `typography.sizeLadder` / `weights` | What the system offers; nearest-match snaps to these |
| `typography.substitutions` | Rewrites for what the system lacks (e.g. `Semibold → Bold`) |
| `typography.fonts` | Font family per size range |
| `components.namePattern` | How components are named |
| `components.roles` | Which component fills a common role (`primaryButton`, `navigationBar`, `input`, `listItem`, `card`, `bottomActionBar`, `statusBar`) |
| `components.localPagePrefix` | `local` mode: prefix of the pages that hold authored components |
| `screens.platformTags` | Allowed `[Platform]` values |
| `screens.buildWidth` / `renderWidth` / `statusBarTime` / `screenBackground` | Screen geometry and defaults |
| `copy.locale` | Language of the product copy; copy is reproduced verbatim in it |
| `copy.proposedBanner` | Banner text marking copy the build had to invent |
| `labels.derivedStrip` / `proposalStrip` / `proposalCard` / `proposalDoc` | Exact names of the scaffolding the build creates and the audit matches |
| `pluginData.flowNamespace` / `buildNamespace` | `sharedPluginData` namespaces the build **writes** (`screenflow`, `screenbuild`). Keys under the build namespace: `owner`, `source` (the source kind: `video` \| `code` \| `figma-page`), `provenance`, `specId`, `sourcePage`, `strip` |
| `pluginData.legacyFlowNamespaces` / `legacyBuildNamespaces` | Older namespaces the tools also **read**, so files built before a rename keep working. Never written |

## Is this component from the library? (`library` mode)

For an INSTANCE `n`, with `mc = await n.getMainComponentAsync()`:

1. `mc.remote === false` → **local** (authored in this file).
2. `mc.remote === true` → resolve its source file key (from the Bridge's library
   lookup for `mc.key`). In `profile.library.fileKeys` → **library**. Otherwise →
   **foreign library**.
3. `fileKeys` empty → resolve it once from `profile.library.componentKeys`
   (look each up, take the file they share), tell the user, and offer to save it
   to the profile. Still nothing → classify by `foreignNameHints` only and mark
   the result `unverified`.

In `local` mode every component is local by definition; skip this check.
