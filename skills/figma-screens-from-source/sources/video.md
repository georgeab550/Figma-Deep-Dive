Source adapter for `figma-screens-from-source` — read `../SKILL.md` first.

# Source: a screen recording (`video`)

Reverse of the usual design→code flow: the product exists (video / live app), the
design file doesn't. The recording becomes a faithful as-built starting point for
designers, and downstream tooling gets screens to point at.

Paths: `build/…` and `conventions/…` are relative to the plugin root —
`$CLAUDE_PLUGIN_ROOT`, or three directories up from this file's real path
(`readlink -f`). `scripts/…` is relative to the skill directory (one up from this
file): `$CLAUDE_PLUGIN_ROOT/skills/figma-screens-from-source/scripts/`.

## Input

The **video** — a screen recording of the flow (or a capture of a live build);
phone portrait. A PRD or product doc helps naming and journey vocabulary but is
optional. Requires `ffmpeg` / `ffprobe`.

`local` mode: this source is a natural `local`-mode entry point — the source is a
recording, not Figma, so there is often no design system yet.

## Phase 0 — source preflight

- Locate the video on disk; `ffprobe` it (duration, resolution).

## Phase 1 — source inventory: `frame-inventory`

The three investigators don't contend: this one reads PNGs, standard-distill reads
the reference file via the official Figma MCP, component-inventory reads the build
file via figma-console.

**frame-inventory** — run `$CLAUDE_PLUGIN_ROOT/skills/figma-screens-from-source/scripts/extract_frames.sh` (the skill's `scripts/` folder, one level up from this file) first (1fps + scene-cut frames
at `profile.screens.renderWidth`, default 390px — pass another width via
`FRAME_WIDTH`):

```
extract_frames.sh <video> <outdir>                    # 1fps + scene-cut frames
extract_frames.sh <video> <outdir> --full "3 11 145"  # full-res frames at those seconds
```

The agent (vision) clusters frames into SCREENS vs STATES by the shared clustering
rules in `../SKILL.md` (same layout skeleton = states of one screen; scrolled
positions = one screen; bottom sheets/dialogs/full-screen pickers = sub-states of
the parent; a different logical screen sharing the master = a soft-flagged
**reuse** with a `[Screen]` override bracket). It picks ONE canonical frame per
state and outputs `screen-inventory.{json,md}`. Then re-extract the canonical
timestamps at FULL resolution (`--full`) — spec writers need to read exact copy,
verbatim in `profile.copy.locale`, accents and special characters included.

Brief template: `build/agent-briefs.md` §"1. frame-inventory".

## Source-specific spec rules

- **The frame beats the brief.** Spec writers transcribe what the canonical frame
  shows; when it contradicts the inventory or the brief, they flag it. Verify
  conflicts against the frame yourself and CUT states that turn out to be
  reconstructions (no video evidence = not built).
- Screens the video never shows but the flow needs → a separate **PROPOSED batch**:
  derived from named precedent frames, an amber `profile.copy.proposedBanner` banner
  (default "PROPOSED – to confirm") above the device frame, invented copy tagged,
  own section. Honesty is the feature.
- Platform: the video is usually the OTHER platform (e.g. Android video, iOS
  target). Content, structure and order come from the video; chrome (status bar,
  toggles, keyboards) comes from the target platform's components. Say so in every
  brief.

## Deltas table (this source's rows)

| Delta | Value |
|---|---|
| Honesty model | the shared page badge (`../SKILL.md` §Deltas); note card adds "built from a recording of the running app". PROPOSED batches — amber `profile.copy.proposedBanner` banner for states the video never shows |
| `screenbuild:provenance` (page) | `auto-built` (PROPOSED sections carry their own banner) |
| Parity ground truth | canonical video frames |
| Truth rule | the frame beats the brief — transcribe what the canonical frame shows |
| Chrome rule | content/structure/order from the video; chrome from the target platform's components |
| `screenbuild:source` (page) | `video` |

Owner tag and the namespace rules: `../SKILL.md` §Deltas.

## Does NOT do (this source)

- Never invents screen states without tagging them PROPOSED; never claims a
  reconstructed state came from the video.
- Never imports low-res brand logos from video crops; placeholders + a handoff note.

## Quick reference (this source)

| Situation | Do |
|---|---|
| A feature has a video but no Figma | this adapter, after the Step 1 preflight (profile, then Bridge) |
| Video never shows a needed screen | PROPOSED batch: precedent-derived + amber banner |
| The video is the other platform | content/structure/order from the video; chrome from the target platform's components |
| User asks "where is it in Figma" | file → new page (badged Auto-built) → sections; masters strip holds the masters |
