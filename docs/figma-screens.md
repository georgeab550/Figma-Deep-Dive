# figma-screens — user guide

Build real Figma screens from whatever you already have: a screen recording,
a codebase or HTML, screenshots or mockup images, a `.pen` file, a written
spec, or an old Figma page in the pre-convention format.

One skill does it — `figma-screens-from-source`. It works out which kind of
source you gave it and always produces the same result: a **new page** in your Figma file with
one master component per screen, the screen's states as instances of it, flow
arrows between screens, and a clickable prototype. Everything is assembled from
your design system — a published library, or one the build starts for you in
the file — and named by the plugin's convention. Nothing that already exists in
your file is touched.

## Install

The skill ships inside the `figma-deep-dive` plugin.

```bash
# 1. Register the marketplace (one-time, per user)
claude plugin marketplace add georgeab550/Figma-Deep-Dive

# 2. Install the plugin
claude plugin install figma-deep-dive@Figma-Deep-Dive
```

Then, inside Claude Code, run the setup doctor — it installs and checks the
figma-console MCP server and walks you through connecting the Desktop Bridge:

```
/figma-setup
```

To update to the latest version later:

```bash
claude plugin marketplace update Figma-Deep-Dive
claude plugin install figma-deep-dive@Figma-Deep-Dive
```

### Prerequisites

- **Figma Desktop** with the **Desktop Bridge** plugin connected to the working
  file (through the figma-console MCP server). The skill checks for the Bridge
  and stops if it is not connected — there is no fallback for building. Details
  are in the plugin's [README](../README.md), Install section.
- **ffmpeg** — only when the source is a screen recording.
- **Playwright** — only when the source is code or HTML, to render it. The
  **pencil MCP** is optional, needed for `.pen` sources.
- **The official Figma MCP** — to read a reference file that is not the one
  open in Figma Desktop.

## Your design system

The skill never assumes a particular design system. What is specific to yours
— the library, its variables and text styles, the labels the build uses — lives
in a **profile** saved at `.figma-deep-dive/design-system.json`. It has two
modes:

| Mode | When | What the build does |
|---|---|---|
| `library` | You have a published design-system library | Places the library's components and binds to its variables and text styles. Anything it has to author itself is parked in a "Derived" strip and proposed for the library |
| `local` | There is no design system yet | Creates the components, variables and text styles it needs in the working file. Those become your starting design system |

For `library` mode, **enable your library in the working file** first
(Figma → Assets → Libraries). If it is not enabled the build stops and tells
you — it never quietly switches to `local`.

Create the profile once per project:

```
/figma-screens profile <url>
```

It detects the mode from the open file, shows you the result, and saves it
after you confirm. If you skip this, the first build runs it for you. Every
field is described in
[`../conventions/design-system.md`](../conventions/design-system.md).

## What can the source be?

`figma-screens-from-source` takes three kinds of source. You do not pick one —
it detects the kind from what you give it, and asks when that is unclear (for
example a Figma link that could be either the page to convert or the page to
copy the structure from).

| You have | Kind |
|---|---|
| A screen recording of the app, no design file at all | a recording |
| A codebase, HTML files, a [Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs) export, a `.pen` file, screenshots of the running app, mockup images, or a written spec — whoever made it | code, images or a spec |
| Screens already in Figma, but in an old format (one master per state, component sets, plain frames) | an existing Figma page |
| A Figma page that just needs renames or small fixes in place | not this skill — use `figma-write` (`/figma-screens <url>`) |

Give it **one** source to rebuild. Extra material — a PRD, the codebase next to
a recording — is welcome as supporting context for naming; say which one is the
source.

Start it either way:

```
/figma-screens build <source> [<working file url>]
```

or just describe what you have in a prompt (examples below). Naming the skill
(`figma-screens-from-source`) works too, but is not needed.

## Before you start

1. Open the target file in **Figma Desktop** and connect the Desktop Bridge
   plugin.
2. Make sure the profile exists (`/figma-screens profile <url>`). In `library`
   mode, check the library is enabled in the file.
3. Pick the pages you'll point at as the good example — the pages in your
   files that are structured the way you want. The skill copies structure from
   a real reference, it does not guess one. No such pages yet? Say so, and the
   plugin's own convention is used as the standard.
4. Have your source ready: the video file, the project or image folder, or the URL of
   the old page.

## How a run goes

You write one prompt (examples below) or run `/figma-screens build <source>`,
the skill does the rest in five steps:

1. It reads your source and lists the screens and states it found.
2. Each element is matched against your design system. In `library` mode,
   anything without a library match is built from library pieces and parked in
   a "Derived" strip for the design team to look at later. In `local` mode the
   missing pieces are simply created in the file.
3. **It builds 2 screens and stops.** This is the checkpoint that matters:
   look at them properly, correct the naming words, say what looks wrong.
   Fixing things here is cheap — at screen 30 it isn't.
4. It builds the rest, section by section, wiring the flow as it goes.
5. Every built screen is compared back to its source image, then audited
   (naming, provenance, components) and auto-fixed where safe.

Three rules are always on, whatever the source:

- **New pages only.** Existing pages, masters and components are never
  modified.
- **Honest labeling.** Anything the skill invented beyond your source (say, a
  screen the video never showed) gets an amber "PROPOSED – to confirm" banner
  (the text is `profile.copy.proposedBanner`), and the built page itself is
  labeled with where it came from — so nobody mistakes it for reviewed design
  work.
- **Real design-system components.** In `library` mode, library components
  are placed by their published key, never re-created locally.

---

**The page badge.** Whatever the source, the new page's name ends
"— Auto-built, pending design review". It says the page was assembled by this
tool and has not been looked at by a designer yet. Remove the suffix once you
have reviewed it. (If you point the build at an existing empty page, your page is
not renamed — the suffix goes on each section instead.)

## Source: a screen recording

For when the product exists but the design file doesn't: there's an app build
or a screen recording, and designers need a faithful starting point in Figma.

**Give it:** the video (portrait phone recording), the target file, the
reference pages. A PRD helps with naming but is optional.

**You get:** the flow exactly as the video shows it, on a page whose name ends
"— Auto-built, pending design review". If a screen is needed for
the flow but never appears in the recording, it's built as a clearly bannered
PROPOSED screen — never passed off as recorded.

Example prompts:

> There's no Figma for the checkout flow, only a screen recording from the
> Android build at `<path to video>`. Build the screens in `<working file>`;
> use the Orders pages as the reference.

> Use `figma-screens-from-source` to reverse-engineer the screens from this
> video into Figma. Target file is the one open in Figma Desktop, video is
> `<path to video>`. The PRD is pasted below — use it for naming.

> Backfill the design file for the order-status flow from the iOS app
> recording. Reference = the Checkout section of the same file. Stop after the
> first two screens so I can check them.

> We have no design system yet. Build the checkout screens from this recording
> in a new file and create the components and variables as you go.

---

## Source: code, HTML, images or a spec

For when the design exists outside Figma and you want it there as real
components, not screenshots. Works with a code project (your app's codebase, a
prototype, a Claude Design export), HTML files, a pencil `.pen` file,
screenshots of the running app, mockup images, or just a written markdown
spec — it does not matter who or what made it.

**Give it:** the path to the project, files or images, the target file, the
reference pages. Code projects are run in a sandbox copy automatically — your
project is never modified.

**You get:** a page whose name ends "— Auto-built, pending design review". Text comes
verbatim from the code; layout comes from rendering it at phone width.

Example prompts:

> Build Figma screens from this codebase — `<path to project>` (it's a small
> React project). Put them in `<working file>`, reference = the Orders pages.

> Turn these screenshots of the checkout flow into Figma screens:
> `<path to screenshots folder>`. Same file that's open in Desktop.

> Claude Design gave me this export — `<path to export folder>`. Bring it into
> Figma in `<working file>` with `figma-screens-from-source`.

> Import these three HTML screens into Figma as design-system components:
> `cart.html`, `address.html`, `order-status.html`. Same file that's open in
> Desktop.

> Convert the .pen design at `<path to .pen file>` to Figma. Use Acme DS
> components wherever they match.

> I only have a written spec for the order-list flow (`orders-spec.md`,
> attached). Build proposal screens from it in `<working file>` — I know there
> are no pixels to compare against, checklist parity is fine.

---

## Source: an existing Figma page

For screens that are already in Figma but predate the convention: one master
per state, component sets used for screen states, plain frames, detached
near-duplicates.

**Give it:** the file URL and the page (or section) with the old screens, plus
the reference pages. The rebuild lands on a new page **in the same file**.

**You get:** the same screens rebuilt to convention, on a page whose name ends
"— Auto-built, pending design review", with a note saying which page it was
converted from. Names that already
follow the convention carry over unchanged, so there's no churn for designers
who did it right. The old page is left exactly as it was — you delete it
yourself once you've validated the new one. In `local` mode the old page's own
local components are reused as the starting design system.

Example prompts:

> The Orders page in this file is still one-master-per-state — convert it to
> the master/variant format on a new page. Keep every name that's already
> correct.

> Convert this Figma page to the convention: `<url of the old page>`.

> Modernize the old "Checkout v1" page to the convention. It uses component
> sets for the states; those should become instances of one master.

> This file mixes formats. Rebuild the section "Cart (old)" to standard —
> same file, new page — and keep the existing prototype connections so the
> flow survives.

> Someone detached half the instances on the Order status page over the years.
> Rebuild it clean against Acme DS; flag whatever doesn't match the library.

---

## Flags

Add these to your prompt when you need them (any source):

| Flag | What it does |
|---|---|
| `--report-only` | audit and report only, change nothing |
| `--fix` | allow auto-fix on a page the skill didn't build itself |
| `--page <id>` | run the audit/fix alone on a specific page |
| `--parity=off` / `--parity=require` | skip the source-image comparison / fail if there's nothing to compare against |
| `--max-iterations <n>` / `--change-budget <n>` | audit-fix loop limits (defaults 5 / 200) |

## What it will never do

- Modify existing pages, masters or components — the build is always a new
  page, and a Figma-page conversion never touches the source page, not even a
  rename.
- Modify your source — a code project runs in a sandbox copy; recordings,
  files and images are only read.
- Invent screens silently — anything beyond your source gets the amber banner.
- Fork a local copy of a component that exists in your published library
  (`library` mode).
- Switch modes behind your back — a library that is not enabled stops the run.
- Design anything. Creating designs stays with you and your design tools;
  editing existing pages in place stays with `figma-write`.

## More detail

- [`../conventions/design-system.md`](../conventions/design-system.md) — the
  profile: modes, how it is resolved, every field
- [`../build/guarded-build-core.md`](../build/guarded-build-core.md) — the
  shared build process, flags, guardrails
- [`../conventions/naming.md`](../conventions/naming.md) +
  [`../conventions/components.md`](../conventions/components.md) — the naming
  and component rules the builds follow
- [`../skills/figma-screens-from-source/SKILL.md`](../skills/figma-screens-from-source/SKILL.md)
  — inputs and source detection; the per-source specifics are in its
  `sources/` folder (`video.md`, `code.md`, `figma-page.md`)
