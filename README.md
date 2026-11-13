<img width="1672" height="760" alt="ChatGPT Image Apr 30, 2026, 04_46_17 PM 1" src="https://github.com/user-attachments/assets/5a1c93cf-31a9-423d-9c60-0cf9f53e03bb" />





## **Figma-Deep-Dive**

Claude Code plugin for working with Figma screens. It does three things:

| | What | How you use it |
|---|---|---|
| **Read** | Extracts a distilled, token-efficient spec from any Figma node — layout, colours, text, spacing, component identity | the `figma-deep-dive` agent |
| **Tidy** | Audits and applies a screen naming convention, and writes a "Screens to build" section into a PRD | `/figma-screens` |
| **Build** | Rebuilds a recording, code, screenshots, a written spec or an old Figma page as design-system-native screens | `/figma-screens build` |

It works with **your own design-system library, or with none**: nothing in the
plugin is tied to a particular design system or platform.

The reader never writes code — findings only. That keeps the parent
conversation's context small while still getting accurate design data. Every
change to Figma is shown to you first and waits for a yes.

---

## Table of contents

- [🚀 Install](#-install)
- [⚙️ How it works](#️-how-it-works)
- [🌍 Localization auto-resolution](#-localization-auto-resolution)
- [📱 Platform hints](#-platform-hints)
- [🎚 Modes](#-modes)
- [🧩 Screen toolkit](#-screen-toolkit)
- [🏗 Building screens](#-building-screens)
- [💬 Usage patterns](#-usage-patterns)
- [🛠 Troubleshooting](#-troubleshooting)
- [❓ FAQ](#-faq)
- [👥 Maintainers](#-maintainers)

---

## 🚀 Install

Prerequisites: **Claude Code** (installed + signed in), the **Figma Desktop** app
(not the web app), and a **Figma personal access token** — create one at
[figma.com → Settings → Security → Personal access tokens](https://www.figma.com/settings)
with scopes **File content: Read**, **Variables: Read**, **Comments: Read and write**.
Everything else is checked and fixed by the setup doctor.

You're installing three pieces; the doctor wires up the first two for you:

| Piece | What | Owner |
|---|---|---|
| **`figma-console-mcp`** | Node process that talks to Figma and exposes MCP tools | [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp) |
| **Figma Desktop Bridge** | Figma-desktop plugin that bridges Variables/Component APIs to the MCP server | Same repo, under [`figma-desktop-bridge/`](https://github.com/southleft/figma-console-mcp/tree/main/figma-desktop-bridge) |
| **This plugin (`figma-deep-dive`)** | The reader agent, the `/figma-screens` toolkit and the `/figma-setup` doctor | This repo |

1. Open a terminal (or the Claude Code prompt with `!`) and paste:

   ```bash
   claude plugin marketplace add georgeab550/Figma-Deep-Dive
   claude plugin install figma-deep-dive@Figma-Deep-Dive
   claude plugin enable figma-deep-dive
   ```

2. Start Claude Code and run `/figma-setup`. (Start typing `/figma-set…` and pick
   **`figma-deep-dive:figma-setup`** from the menu — plugin commands are namespaced
   under the plugin name.)

   It checks Node, your Figma token, the MCP server, and the Desktop Bridge —
   fixes what it can, and gives you one plain instruction for anything it can't.
   If it ends with "restart Claude Code", do that once and run it again — it
   should come back all green.

   **Your Figma token.** The doctor needs it once, then stores it in the MCP
   entry on your machine. Two ways to hand it over:

   - **Without pasting it into the chat (recommended).** Set it in your terminal,
     then start Claude Code from that same terminal and run `/figma-setup` — the
     doctor picks it up on its own:

     ```bash
     # macOS / Linux
     export FIGMA_ACCESS_TOKEN='figd_…'
     claude
     ```

     ```powershell
     # Windows PowerShell
     $env:FIGMA_ACCESS_TOKEN = 'figd_…'
     claude
     ```

     You only need this for the first run; close that terminal afterwards.
   - **Paste it when asked.** Quicker, and the doctor only ever displays the last
     4 characters — but the token stays in that conversation's history.

   No token yet? The doctor walks you through creating one.

3. Import the Desktop Bridge into Figma (one-time):
   download or clone [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp)
   (you only need the `figma-desktop-bridge/` folder), then in Figma **Desktop**
   open your file → **Plugins → Development → Import plugin from manifest…** →
   pick `figma-desktop-bridge/manifest.json` → Run. The tile turns **green** when
   it connects (it auto-scans ports 9223–9232). You import once — the bootloader
   pulls fresh code from the MCP server each run, so updates need no re-import.

Already had the old manual install? Same three commands — `/figma-setup` migrates
you automatically (your token is rescued from the old entry; no re-paste). Re-run
`/figma-setup` any time something Figma-related misbehaves.

> [!IMPORTANT]
> The Desktop Bridge is **required**, not optional. Every read goes through it
> first: it is the only way to get full-depth trees, library component keys,
> token names and screenshots, and every write tool needs it.
>
> If the Bridge is not connected, the read agent does not fail — it falls back
> to the Figma REST API and **opens its report with a warning** that the result
> is degraded (no library keys, no token names, no screenshots). Treat that
> warning as "connect the Bridge and re-run", not as a finished spec.

### Optional extras

Only needed for [building screens](#-building-screens), and only for the source you use:

| You want to build from | Install |
|---|---|
| A screen recording | [`ffmpeg`](https://ffmpeg.org) |
| A code project or HTML | Playwright, to render it headless (the Playwright MCP or a local Playwright install) |
| A pencil `.pen` file | the pencil MCP |
| A separate reference file to copy the look from | the official Figma MCP |

### Updating later

```bash
claude plugin marketplace update Figma-Deep-Dive
claude plugin install figma-deep-dive@Figma-Deep-Dive
```

### Under the hood

- `/figma-setup` registers `figma-console` as a **user-scope** MCP entry running
  `npx -y figma-console-mcp@latest` — deliberately not a plugin-bundled `.mcp.json`,
  which would namespace the tools (`mcp__plugin_…`) and break the
  `mcp__figma-console__*` references in the agent. Because it's `@latest`, `npx`
  picks up new MCP releases on its own.
- Your Figma token lives inline in that user-scope entry — on your machine only,
  never committed anywhere. Token changed or revoked? Re-run `/figma-setup`.
- The Desktop Bridge is the upstream bootloader, imported once via manifest; it
  loads its logic from the local MCP server at runtime, so it self-updates.

---

## ⚙️ How it works

When you invoke `figma-deep-dive`, it runs as a subagent in its own context
window and executes a fixed pipeline:

1. **Reads the inputs** — file URL, one or more node IDs (`NNNN:NNNN`), and an optional checklist of what to resolve.
2. **Probes the Desktop Bridge, then calls the `figma-console` MCP** — strictly this one, no other Figma providers. With the Bridge connected to the target file it walks the full tree in one read-only call and pulls per-node detail with `figma_get_component_for_development` (`includeImage: false`, text-only output). Without the Bridge it warns and falls back to REST. When more detail is needed, it escalates *within figma-console* on demand — `figma_get_variables`/`figma_get_token_values` to resolve a `VariableID` to its token name + value, and `figma_get_component_for_development_deep` when the first pass comes back thin. Escalation is per-node and bounded by the token cap.
3. **Handles large payloads** — if a response exceeds ~60k characters, the MCP writes it to disk and returns the path. The agent `jq`s the file in place instead of loading it into its context.
4. **Extracts the checklist** via canned `jq` patterns — tree summary, TEXT nodes with font + colour, children of named frames, etc. Hidden layers (`visible:false`) and their entire subtrees are excluded — only rendered nodes reach the spec.
5. **Auto-drills one level deeper** for common container names (`Card`, `Row`, `List Item`, `Content`, `input-field`, `list-item`, and generic `Frame <digits>` under those). No round-trip needed.
6. **Recurses through the REST depth-4 limit** (fallback path only) — when a frame shows `children: []` at depth 4, grabs child IDs from the parent and re-queries each.
7. **Resolves gradients** — reads `gradientHandlePositions` and reports the start and end points as normalised coordinates plus a plain direction (e.g. `(0,0)→(1,1) top-left→bottom-right`), which maps cleanly to SwiftUI, Compose, CSS or anything else. See [Platform hints](#-platform-hints).
8. **Resolves localization keys** — when the working repo contains an i18n catalog, dispatches the bundled `localization-resolver` agent to map every extracted text-node string to its key. Skipped silently when no catalog is present. See [Localization auto-resolution](#-localization-auto-resolution).
9. **Returns a structured report per node** — layout, ordered children (top-to-bottom, load-bearing for render order), text nodes, component instances (master name, identity, properties), and any remaining drill-worthy frames under `## Deferred`.

> [!IMPORTANT]
> Hard rules the agent enforces on itself:
>
> - **No code output, no platform assumptions.** No code in any language, no markdown mockups. Findings are in Figma's own terms (px, hex, font family as named in the file), so the parent session can write iOS, Android, web or any other code from the same report.
> - **Raw hex + Figma `VariableID`** when present, so the parent can map back to design tokens.
> - **Flags uncertainty** (`// couldn't resolve: …`) — never fabricates values.
> - **Caps output at ~3000 tokens.** Overflow goes to `## Deferred` with node IDs to re-query in a follow-up pass. *(Cap raised to ~8000 tokens in [`full-screen-audit` mode](#-modes).)*

See `agents/figma-deep-dive.md` for the full output schema and auto-drill pattern list.

---

## 🌍 Localization auto-resolution

When `figma-deep-dive` runs in a repo that contains an i18n catalog, it
automatically maps every extracted text node to its localization key by
dispatching the bundled `localization-resolver` agent. **No prompt change
required** — if a catalog is present, you get keys; if not, you get the
same output you always got.

Catalog formats detected out of the box:

- iOS: `*.xcstrings`, `Localizable.strings`, `*.lproj/*.strings`
- Android: `res/values*/strings.xml`
- Web/JS: `locales/**/*.json`, `i18n/**/*.json`, `translations/**/*.json`
- Gettext: `*.po`, `*.pot`
- YAML: `locales/**/*.yml`

Each TEXT node in the report gains a ` · key=<key>` suffix (or ` · key=?`
when no match exists), and a `### Localization` summary appears at the
bottom of every node block:

```
### Localization
- catalogs scanned: 1
- resolved: 4/5
- unresolved: "Save up to 20% yearly"
```

> [!TIP]
> The resolver is also usable on its own — call
> `Agent(subagent_type: "localization-resolver", …)` with any string
> array when you need keys outside the Figma flow.

---

## 📱 Platform hints

The report is **platform-neutral by default**: sizes in Figma px, colours as
hex, the font family exactly as the file names it, gradients as normalised
start/end points. That one report can drive iOS, Android, web or any other
code.

If you tell the agent which platform you are building for, it **appends that
platform's own terms** next to the neutral values — it never replaces them and
never writes code.

| Platform | How to ask | What gets appended |
|---|---|---|
| iOS | mention SwiftUI / UIKit / a `.swift` file, or `platform: ios` | gradient as a `UnitPoint` pair (`topLeading→bottomTrailing`), sizes in `pt`, weight names (`.semibold`) |
| Android | mention Compose / Kotlin / XML layouts, or `platform: android` | gradient start/end as fractions of the box, sizes in `dp` (`sp` for text), `FontWeight.SemiBold` |
| Web | mention React / CSS / HTML / Vue, or `platform: web` | CSS angle for axis-aligned gradients, sizes in `px`, numeric weights (`600`) |
| none (default) | name no platform | nothing — neutral values only |

Example, same gradient with and without a hint:

```
fill: gradient linear (0,0)→(1,1) top-left→bottom-right #FF5A5F→#C13584
fill: gradient linear (0,0)→(1,1) top-left→bottom-right #FF5A5F→#C13584 · ios: topLeading→bottomTrailing
```

> [!NOTE]
> On web, a diagonal gradient gets the points but no CSS angle: the angle
> depends on the box's aspect ratio, so a single number would be wrong for
> non-square boxes.

> [!NOTE]
> **Upgrading from 0.4.0 or earlier?** Reports used to assume iOS ("SF Pro",
> `UnitPoint` pairs) for everyone. If your prompts relied on that and don't
> name a platform, add `platform: ios`.

---

## 🎚 Modes

The agent has two extraction modes governing how aggressive it is about drilling
and how much output it allows itself, plus two read-only audit modes.

### `default` (no flag needed)

Targeted, terse, capped at ~3000 tokens. Auto-drill only fires for
children matching a known pattern allowlist (`Card`, `List Item`,
`input-field`, etc.). This is the right mode for
component extraction, token lookups, single-frame audits, and any drill
where you've supplied a tight checklist.

### `full-screen-audit`

Use when you're auditing or rebuilding an entire screen end-to-end and
need the full tree resolved in one pass. In this mode the agent:

- Drills **every** non-leaf child recursively (the allowlist is ignored).
- Always follows up on depth-4 truncations rather than deferring them.
- Suspends the "skip nodes the parent didn't ask about" rule — emits
  every reachable node under the requested root.
- Lifts the output cap from ~3000 to ~8000 tokens. Overflow still spills
  into `## Deferred` so you can re-request specific branches.

To trigger it, include the literal phrase `full-screen-audit` in your
prompt, e.g.:

> Audit my implementation of this screen (`<path to your screen file>`) against the full Figma screen at
> `https://figma.com/design/ABC/File?node-id=12-340` using
> `figma-deep-dive` in **full-screen-audit** mode. Then list
> discrepancies grouped by severity (structural / layout / visual /
> content).

> [!WARNING]
> Don't use this mode for targeted lookups — you'll burn tokens on a
> tree you're going to throw away. The defaults exist because most
> Figma extractions don't need the whole tree.

### `naming-audit` and `layer-audit` — read-only convention checks

Two further modes check a file against the conventions in `conventions/` and
report; they never rename anything.

- **`naming-audit`** — checks screen names against `conventions/naming.md`:
  masters are `[Platform][Feature][Screen]`, in-flow variants store only their
  delta `[State] - description`. Flags repeated prefixes, missing descriptions,
  wrong separators and reuse of a master as a different screen.
- **`layer-audit`** — checks inner layer names against `conventions/layers.md`:
  flags auto-names (`Frame 4934832`, `Group 12`) and the same element named
  differently across screens. Meant for component-authoring files.

Ask for one by name ("run a naming audit on …", "layer audit on …"). To apply
the fixes, use the [screen toolkit](#-screen-toolkit) below.

---

## 🧩 Screen toolkit

Beyond reading, the plugin ships a confirm-gated writer and a design→PRD
handoff. All of it runs from one command:

| You type | What happens | Changes Figma? |
|---|---|---|
| `/figma-screens profile <url>` | Detects the design system the file uses and saves the project profile | No — read-only |
| `/figma-screens init <url>` | Seeds a "📐 Conventions" page with the designer card (`conventions/designer-card.md`) | Yes, after you confirm |
| `/figma-screens <url>` | Audits screen names and normalises them to the convention | Yes, after you confirm each batch |
| `/figma-screens layers <url>` | Applies the inner-layer naming taxonomy on a component-authoring file | Yes, after you confirm each section |
| `/figma-screens build <source> [<working file url>]` | Rebuilds a recording, code/HTML, screenshots, a `.pen` file, a written spec or an old-format Figma page as design-system-native screens — see [Building screens](#-building-screens) | Yes — on a new page only; stops after 2 pilot screens for your review |
| `/figma-screens prd <links> --prd <path>` | Groups recycled screens into canonical screens + variants and writes a "Screens to build" block into your PRD | No — read-only |

The pieces behind it:

- **`figma-write`** (skill) — the writer. Reads through `figma-deep-dive`, shows
  you a plan, **waits for a yes**, then writes and re-checks. It also does
  surgical edits: change a text, bind a raw hex to a variable, fix a spacing value.
- **`screen-canonicalizer`** (skill) — groups frames that share a master
  component into one build-once screen with N variants and emits
  `canonical-screen-registry.json` (schema in `schemas/`).
- **`screens-to-prd`** (skill) — renders that registry into a fenced,
  regenerable block in a PRD. Re-running refreshes the block and leaves your
  prose alone.
- **`design-system-profile`** (skill) — detects the design system a file uses
  and saves the project profile. See [Your design system](#your-design-system).
- **`figma-screens-from-source`** (skill) — the builder. See
  [Building screens](#-building-screens).

### The convention in two lines

- A screen exists **once** as a master component named `[Platform][Feature][Screen]`.
- Every screen in a flow is an **instance** of a master, named with only what
  differs: `[State] - description`.

Identity comes from the component, not the name, so the tooling can tell that
two frames are the same screen. The full spec is `conventions/naming.md`; the
plain-language version for designers is `conventions/designer-card.md`
(`TEMPLATE.md` explains how to turn it into a starter file).

### Your design system

Nothing in the plugin is tied to a particular design system. What yours looks
like is recorded once per project in a **profile**
(`.figma-deep-dive/design-system.json`), and every build and audit reads it.

| Mode | Use it when | What happens |
|---|---|---|
| `library` | You have a published design-system library | Screens are built from its components and bound to its variables and text styles. Anything missing is built separately and listed as a proposal for the library |
| `local` | You have no design system — you start from code, screenshots or a recording | The build authors components, variables and text styles **in the working file**. That becomes your starting design system |

To set it up:

1. **Using a library? Link it to the working file first:** in Figma, open the
   file you will build in → **Assets → Libraries** → enable your library. The
   tooling can only use what the file can see; if the library is not enabled,
   a `library` build stops and tells you, it never falls back silently.
2. With that file open and the Desktop Bridge running, run
   **`/figma-screens profile <url>`**. It reads the enabled libraries, variable
   collections, modes and text styles, proposes a profile, and saves it after
   you confirm. No library found means it proposes `local`.

The profile is plain JSON you can edit. `conventions/design-system.md` explains
every field; `profiles/example.library.json` is a filled example.

---

## 🏗 Building screens

One skill — `figma-screens-from-source` — rebuilds an existing source as
**design-system-native Figma screens** — master components, states as
instances, flow sections — on a new page. The source is never modified. It
detects which kind of source you gave it:

| Source | What you give it | Extra requirement |
|---|---|---|
| A screen recording | A video file of the app (`.mp4`, `.mov`, …) | `ffmpeg` |
| Code, HTML, images or a spec | A code project, HTML files, screenshots or mockup images, a pencil `.pen` file, or a written markdown spec — from any author | Playwright (to render code and HTML); the pencil MCP for `.pen` files |
| An existing Figma page | The URL of a page or section in an older or mixed structure | — |

Every source goes through one guarded build (`build/`): the skill inventories
the source, builds **one or two pilot screens and stops for your review**, then
scales out, audits the result and fixes what the audit finds. It needs the
Desktop Bridge — there is no REST fallback for building — and a
[design-system profile](#your-design-system). Reading a separate *reference*
file (to copy an existing look) goes through the official Figma MCP.

Every page it builds is named with the suffix **"— Auto-built, pending design
review"**; a designer removes it after reviewing the page.

Run it with `/figma-screens build <source>`, or ask in plain words:

> Build Figma screens from `~/recordings/checkout-flow.mp4` into
> `<working file URL>`.

The full guide, with a walkthrough per source and example prompts, is
[`docs/figma-screens.md`](docs/figma-screens.md).

---

## 💬 Usage patterns

The agent is best called as a subagent from your parent Claude Code session,
not as a drop-in replacement for reading the full Figma design context. Typical
flow:

- Parent agent encounters a design implementation task and needs specific Figma node details (layout, text, colours).
- Parent calls `figma-deep-dive` with the file URL, node IDs, and a checklist of what to resolve.
- Agent returns a compact spec report (≤3000 tokens) that the parent consumes cheaply and acts on.

See `agents/figma-deep-dive.md` for the full output schema and auto-drill policy.

### Example prompts

Each example below is a plain-English prompt you paste into Claude Code. The
parent session dispatches `figma-deep-dive` for you — you never need to write
`Agent(subagent_type: …)` by hand.

> [!TIP]
> Always name the agent explicitly in your prompt (`Use figma-deep-dive …`)
> so Claude doesn't fall back to reading the full design context itself —
> that would defeat the whole point.

**1. Build a whole screen from scratch**

> I need to build this screen from scratch in this project's UI framework: `https://figma.com/design/ABC/File?node-id=12-340`. Use `figma-deep-dive` on the root frame and auto-drill every child — I want the full layout tree, every text node, fills, strokes, paddings, and the order of sections top-to-bottom. Don't skip anything; I'm writing the view from zero.

**2. Implement a single component**

> Implement the pricing card as a component in this codebase from `https://figma.com/design/ABC/File?node-id=45-101`. Use `figma-deep-dive` first — I need exact padding, colours, text styles, and the order of child rows.

**3. Audit an implementation against Figma (multi-variant)**

> I've already implemented the plan selection screen. Audit it against the empty state `https://figma.com/design/ABC/File?node-id=30-201` and the filled state `https://figma.com/design/ABC/File?node-id=30-415`. Use `figma-deep-dive` to extract both variants' specs, then diff them against my plan selection screen's source file and list discrepancies.

**4. Extract design tokens only**

> Pull colour + typography tokens from `https://figma.com/design/ABC/File?node-id=45-101` via `figma-deep-dive`. I only need the pricing card — fills, text colours, font sizes. Skip layout.

**5. Drill into a specific truncated frame**

> The image grid is at `https://figma.com/design/ABC/File?node-id=45-107`. Use `figma-deep-dive` and auto-drill into children — I need each cell's border colour, fill, and text style. Flag any inner frame deeper than 4 levels.

**6. Second pass — pick up where the first run stopped**

The agent has no memory between invocations, so a follow-up pass is just another call. Use this when the first pass listed nodes under `## Deferred` (token cap hit) or when you realise you need more detail on a sub-frame.

> Run `figma-deep-dive` again on the same file, nodes `45-101` and `45-133` — these came back under `## Deferred` in the previous pass. Give me each child's fills, strokes, and text styles. Skip anything already covered under `Content`.

> [!TIP]
> Reference earlier findings explicitly in the prompt ("skip anything
> already covered in X") so the new pass focuses on what's missing rather
> than re-extracting work the parent session already has.

### Why these prompts work efficiently

- **Always name the agent.** Without `Use figma-deep-dive`, Claude may read the full `get_design_context` itself and burn main-context tokens.
- **Paste the full frame URL.** Right-click the frame in Figma → *Copy link to selection*. The URL embeds the node, so the agent knows exactly what to read.
- **Name your platform.** "Build this in Compose" or `platform: web` gets you that platform's units and terms alongside the neutral values — see [Platform hints](#-platform-hints).
- **Tight checklists.** "I need padding, colours, text styles" beats "tell me everything"; the agent skips irrelevant branches and stays under its 3000-token output cap.
- **For full-screen builds (example 1), be explicit about auto-drill.** That's the one case where you *do* want depth — say so, and the agent drills into known patterns (Card, Content, List Item, list rows) in one pass instead of forcing a round-trip per level.

---

## 🛠 Troubleshooting

| Symptom | Fix |
|---|---|
| **Anything Figma-related fails** — start here | Run `/figma-setup`; follow its one instruction; restart Claude Code if it says so |
| `claude mcp list` doesn't show `figma-console` | Run `/figma-setup` — it registers the MCP entry for you |
| Desktop Bridge tile stays grey / never turns green | Make sure Claude Code is open (the MCP server runs inside it), re-run the Bridge plugin in Figma Desktop, check no other app is holding ports 9223–9232; then `/figma-setup` |
| MCP calls return `401`/`403` | Run `/figma-setup` — if the stored token is bad it walks you through creating a fresh one with the three scopes (File content: Read, Variables: Read, Comments: Read and write) |
| Variables or component descriptions return empty | Open the target file in Figma Desktop and run the Bridge plugin there; then `/figma-setup` to confirm it's connected |
| A build stops with "library not enabled" | In Figma, open the working file → **Assets → Libraries** → enable your library, then run the build again. It never switches to `local` mode on its own |
| A build or audit asks for a profile, or uses the wrong library | Run `/figma-screens profile <url>` with the working file open; or edit `.figma-deep-dive/design-system.json` |
| A report starts with "Desktop Bridge not connected — REST fallback" | The read is degraded. Open the file in Figma Desktop, run the Bridge plugin, and re-run |
| The Bridge is green but the tool reads the wrong file | The Bridge follows the file that is focused in Figma Desktop. Bring the right file to the front and re-run the Bridge plugin there |
| `ffmpeg: command not found` when building from a recording | Install `ffmpeg` (see [Optional extras](#optional-extras)) |
| `command not found: npx` | Run `/figma-setup` — its preflight installs Node 18+ (or points you to https://nodejs.org) |

---

## ❓ FAQ

### How is this different from the figma-console MCP?

It's a consumer of the MCP, not an alternative: the MCP exposes raw Figma data as tools, and the agent calls those tools but runs in its own separate context — returning only a distilled ~3000-token spec instead of dumping the full payload into your main session.

### Do I need a design system?

No. With a published library, enable it in the working file and the tooling builds from it. Without one, `local` mode authors the components, variables and text styles in the file as it builds, and that becomes your starting system. Either way it is recorded once in the project profile — see [Your design system](#your-design-system).

### Does it work for Android and web, or only iOS?

All of them. Reports are platform-neutral (Figma px, hex, the font the file uses); name your platform and the agent adds that platform's terms alongside — see [Platform hints](#-platform-hints).

### Will it change my Figma file without asking?

No. Reading never writes. Every write — renames, edits, a build — shows you a plan or a pilot first and waits for a yes, and a build always goes onto a new page, never over your source.

### How is this different from the Figma Desktop Bridge?

It doesn't replace the Bridge — it sits on top of it: the bridge is the pipe that pulls raw data out of Figma, and the agent digests that firehose in its own context and hands you back just a compact spec, so your main session's context stays clean.

---

## 👥 Maintainers

Created and maintained by [georgeab550](https://github.com/georgeab550).

This plugin lives at `georgeab550/Figma-Deep-Dive` and
is registered as a member of the `Figma-Deep-Dive` marketplace
(`.claude-plugin/marketplace.json` at repo root). Open a PR against `main`
to propose changes.

The underlying `figma-console-mcp` and Desktop Bridge are maintained by
[southleft](https://github.com/southleft/figma-console-mcp) — report upstream
issues there.
