<img width="1672" height="760" alt="ChatGPT Image Apr 30, 2026, 04_46_17 PM 1" src="https://github.com/user-attachments/assets/5a1c93cf-31a9-423d-9c60-0cf9f53e03bb" />





## **Figma-Deep-Dive**

Claude Code plugin that adds the **`figma-deep-dive`** agent — a token-efficient
spec extractor for Figma designs.

Given a Figma file URL + one or more node IDs, the agent returns a distilled
report per node: layout, colours, text nodes, spacing, ordered children,
variant component IDs. It explicitly refuses to produce code — findings only.
That's the whole value prop: keep the parent conversation's context small
while still getting accurate design data.

---

## Table of contents

- [🧩 What you're installing](#-what-youre-installing)
- [✅ Prerequisites](#-prerequisites)
- [📦 Part A — Install `figma-console-mcp`](#-part-a--install-figma-console-mcp)
- [🔌 Part B — Install the Figma Desktop Bridge plugin](#-part-b--install-the-figma-desktop-bridge-plugin)
- [🎨 Part C — Install this plugin](#-part-c--install-this-plugin)
- [🚦 Verify end-to-end](#-verify-end-to-end)
- [⚙️ How it works](#️-how-it-works)
- [🌍 Localization auto-resolution](#-localization-auto-resolution)
- [🎚 Modes](#-modes)
- [💬 Usage patterns](#-usage-patterns)
- [🛠 Troubleshooting](#-troubleshooting)
- [❓ FAQ](#-faq)
- [👥 Maintainers](#-maintainers)

---

## 🧩 What you're installing

Three independent pieces. You install all three once per machine; the plugin
itself only ships the agent.

| Piece | What | Owner |
|---|---|---|
| **1. `figma-console-mcp`** | Node process that talks to Figma over WebSocket and exposes MCP tools (`figma_get_component_for_development`, etc.) | [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp) |
| **2. Figma Desktop Bridge** | Figma-desktop plugin imported via *Plugins → Development → Import plugin from manifest*. Bridges Variables/Component APIs to the MCP server. | Shipped in the same repo, under [`figma-desktop-bridge/`](https://github.com/southleft/figma-console-mcp/tree/main/figma-desktop-bridge) |
| **3. This plugin (`figma-deep-dive`)** | The agent file + docs | This repo |

> [!IMPORTANT]
> The Desktop Bridge is **required**, not optional — the MCP server cannot
> reach Figma's Variables API or component descriptions without it.

---

## ✅ Prerequisites

- **Claude Code** installed and running
- **Node.js 18+** — check with `node --version`
- **Figma Desktop app** (not the web app)
- **A Figma Personal Access Token**
  - Create one at [figma.com → Settings → Security → Personal access tokens](https://www.figma.com/settings)
  - Required scopes:
    - **File content**: Read
    - **Variables**: Read
    - **Comments**: Read and write

> [!TIP]
> The token starts with `figd_` and Figma only shows it once — copy it
> into a secure note immediately, you won't see it again.

---

## 📦 Part A — Install `figma-console-mcp`

```bash
claude mcp add figma-console -s user \
  -e FIGMA_ACCESS_TOKEN=figd_YOUR_TOKEN_HERE \
  -e ENABLE_MCP_APPS=true \
  -- npx -y figma-console-mcp@latest
```

Replace `figd_YOUR_TOKEN_HERE` with the token from the Prerequisites step.
The first call downloads the package via `npx`; later calls use the cache.

Restart Claude Code, then confirm with:

```bash
claude mcp list
```

`figma-console` should appear in the output.

---

## 🔌 Part B — Install the Figma Desktop Bridge plugin

The MCP server by itself cannot reach Figma's Variables API or reliably read
component descriptions. The Desktop Bridge plugin solves that by running
inside Figma Desktop and exposing those surfaces over a local WebSocket
(ports 9223–9232, auto-probed).

### Steps

1. **Download or clone** [`southleft/figma-console-mcp`](https://github.com/southleft/figma-console-mcp/tree/main/figma-desktop-bridge) — you only need the `figma-desktop-bridge/` folder.
2. **Launch Figma Desktop** (plugin development only works in the desktop client, not the web app).
3. Open any Figma file (an empty scratch file is fine).
4. Menu bar: **Plugins → Development → Import plugin from manifest…**
5. Navigate to `figma-desktop-bridge/manifest.json` inside the downloaded repo and click **Open**.
6. The plugin now appears under **Plugins → Development → Figma Desktop Bridge**. Run it in any file; its UI panel opens on the right.
7. The bridge auto-scans ports 9223–9232 and connects to whichever port the MCP server is running on. When connected, **the plugin tile turns green** — that's your signal that Part A + Part B are talking.

### Updating the bridge

> [!NOTE]
> You only import the manifest once. The bootloader pulls fresh code from
> the MCP server on each run, so you don't re-import when the server updates —
> just re-run the bridge plugin in whichever Figma file you're working on.

---

## 🎨 Part C — Install this plugin

This repo is a Claude Code marketplace. Three commands:

```bash
# 1. Register this repo as a marketplace (one-time, per user)
claude plugin marketplace add georgeab550/Figma-Deep-Dive

# 2. Install the plugin from that marketplace
claude plugin install figma-deep-dive@Figma-Deep-Dive

# 3. Enable the plugin in the current project
claude plugin enable figma-deep-dive
```

> [!NOTE]
> **Why three steps?** Claude Code separates *install* (download + register)
> from *enable* (activate). `install` never auto-enables — this is intentional
> so plugins don't run silently on your machine. The `enable` step is also
> available interactively via `/plugins` → *Installed* → toggle on.

After `enable`, the `figma-deep-dive` agent is available to Claude Code in
this project.

### Updating later

```bash
claude plugin marketplace update Figma-Deep-Dive
claude plugin install figma-deep-dive@Figma-Deep-Dive
```

---

## 🚦 Verify end-to-end

Once all three parts are installed:

1. The Desktop Bridge plugin in Figma shows **green** (Part B is connected to Part A).
2. `claude mcp list` shows `figma-console`.
3. `/plugins` in Claude Code shows `figma-deep-dive` enabled.
4. In a Claude Code session, invoke the agent on a real Figma URL:

   ```
   Agent(subagent_type: "figma-deep-dive", prompt: "Figma URL: https://www.figma.com/design/<key>/
   Checklist:
   - All TEXT nodes with font + colour
   - Padding of the main container
   - Gradient direction on the header")
   ```

   You should get back a structured spec block per requested nodeId.

---

## ⚙️ How it works

When you invoke `figma-deep-dive`, it runs as a subagent in its own context
window and executes a fixed pipeline:

1. **Reads the inputs** — file URL, one or more node IDs (`NNNN:NNNN`), and an optional checklist of what to resolve.
2. **Calls the `figma-console` MCP** — strictly this one, no other Figma providers. Primary tool is `figma_get_component_for_development` with `includeImage: false` (text-only output).
3. **Handles large payloads** — if a response exceeds ~60k characters, the MCP writes it to disk and returns the path. The agent `jq`s the file in place instead of loading it into its context.
4. **Extracts the checklist** via canned `jq` patterns — tree summary, TEXT nodes with font + colour, children of named frames, etc. Hidden layers (`visible:false`) and their entire subtrees are excluded — only rendered nodes reach the spec.
5. **Auto-drills one level deeper** for common container names (`Card`, `Row`, `List Item`, `Content`, `input-field`, `list-item`, and generic `Frame <digits>` under those). No round-trip needed.
6. **Recurses through the REST depth-4 limit** — when a frame shows `children: []` at depth 4, grabs child IDs from the parent and re-queries each.
7. **Resolves gradients** — reads `gradientHandlePositions` and reports direction as SwiftUI `UnitPoint` pairs (e.g. `topLeading→bottomTrailing`).
8. **Resolves localization keys** — when the working repo contains an i18n catalog, dispatches the bundled `localization-resolver` agent to map every extracted text-node string to its key. Skipped silently when no catalog is present. See [Localization auto-resolution](#-localization-auto-resolution).
9. **Returns a structured report per node** — layout, ordered children (top-to-bottom, load-bearing for render order), text nodes, composed components, and any remaining drill-worthy frames under `## Deferred`.

> [!IMPORTANT]
> Hard rules the agent enforces on itself:
>
> - **No code output.** No Swift, no markdown mockups. Findings only — the parent session writes the code.
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
- unresolved: "Win up to 50,000 lei"
```

> [!TIP]
> The resolver is also usable on its own — call
> `Agent(subagent_type: "localization-resolver", …)` with any string
> array when you need keys outside the Figma flow.

---

## 🎚 Modes

The agent has two modes governing how aggressive it is about drilling and
how much output it allows itself.

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

> Audit `SCREENX.swift` against the full Figma screen at
> `https://figma.com/design/ABC/File?node-id=3660-15559` using
> `figma-deep-dive` in **full-screen-audit** mode. Then list
> discrepancies grouped by severity (structural / layout / visual /
> content).

> [!WARNING]
> Don't use this mode for targeted lookups — you'll burn tokens on a
> tree you're going to throw away. The defaults exist because most
> Figma extractions don't need the whole tree.

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

> I need to build this screen in SwiftUI from scratch: `https://figma.com/design/ABC/File?node-id=3660-15559`. Use `figma-deep-dive` on the root frame and auto-drill every child — I want the full layout tree, every text node, fills, strokes, paddings, and the order of sections top-to-bottom. Don't skip anything; I'm writing the view from zero.

**2. Implement a single component**

> Implement the pricing card in SwiftUI from `https://figma.com/design/ABC/File?node-id=4143-31268`. Use `figma-deep-dive` first — I need exact padding, colours, text styles, and the order of child rows.

**3. Audit an implementation against Figma (multi-variant)**

> I've already implemented the plan selection screen. Audit it against the empty state `https://figma.com/design/ABC/File?node-id=3012-87001` and the filled state `https://figma.com/design/ABC/File?node-id=3659-9373`. Use `figma-deep-dive` to extract both variants' specs, then diff them against `PlanSelectionView.swift` and list discrepancies.

**4. Extract design tokens only**

> Pull colour + typography tokens from `https://figma.com/design/ABC/File?node-id=4143-31268` via `figma-deep-dive`. I only need the pricing card — fills, text colours, font sizes. Skip layout.

**5. Drill into a specific truncated frame**

> The image grid is at `https://figma.com/design/ABC/File?node-id=4143-31274`. Use `figma-deep-dive` and auto-drill into children — I need each cell's border colour, fill, and text style. Flag any inner frame deeper than 4 levels.

**6. Second pass — pick up where the first run stopped**

The agent has no memory between invocations, so a follow-up pass is just another call. Use this when the first pass listed nodes under `## Deferred` (token cap hit) or when you realise you need more detail on a sub-frame.

> Run `figma-deep-dive` again on the same file, nodes `4143-31268` and `4143-31300` — these came back under `## Deferred` in the previous pass. Give me each child's fills, strokes, and text styles. Skip anything already covered under `Content`.

> [!TIP]
> Reference earlier findings explicitly in the prompt ("skip anything
> already covered in X") so the new pass focuses on what's missing rather
> than re-extracting work the parent session already has.

### Why these prompts work efficiently

- **Always name the agent.** Without `Use figma-deep-dive`, Claude may read the full `get_design_context` itself and burn main-context tokens.
- **Paste the full frame URL.** Right-click the frame in Figma → *Copy link to selection*. The URL embeds the node, so the agent knows exactly what to read.
- **Tight checklists.** "I need padding, colours, text styles" beats "tell me everything"; the agent skips irrelevant branches and stays under its 3000-token output cap.
- **For full-screen builds (example 1), be explicit about auto-drill.** That's the one case where you *do* want depth — say so, and the agent drills into known patterns (Card, Content, List Item, list rows) in one pass instead of forcing a round-trip per level.

---

## 🛠 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `claude mcp list` doesn't show `figma-console` | Part A skipped or failed | Re-run the `claude mcp add` command in Part A |
| Desktop Bridge tile stays grey / never turns green | Part B not connected to Part A | 1) Restart the MCP server (close/reopen Claude Code). 2) Re-run the Bridge plugin in Figma. 3) Check no other app is holding ports 9223–9232. |
| Agent reports "figma-console unavailable" | MCP server down or not registered | `claude mcp list`; if missing, redo Part A; if present, restart Claude Code |
| MCP calls return `401` | Token missing a required scope | Regenerate token with File content (Read), Variables (Read), Comments (R/W) |
| Variables or component descriptions return empty | Bridge plugin not running in the target Figma file | Open the target file in Figma Desktop and run the Bridge plugin there |
| `command not found: npx` | Node.js not installed | Install Node 18+ (`brew install node` on macOS) |

---

## ❓ FAQ

### How is this different from the figma-console MCP?

It's a consumer of the MCP, not an alternative: the MCP exposes raw Figma data as tools, and the agent calls those tools but runs in its own separate context — returning only a distilled ~3000-token spec instead of dumping the full payload into your main session.

### How is this different from the Figma Desktop Bridge?

It doesn't replace the bridge — it sits on top of it: the bridge is the pipe that pulls raw data out of Figma, and the agent digests that firehose in its own context and hands you back just a compact spec, so your main session's context stays clean.

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
