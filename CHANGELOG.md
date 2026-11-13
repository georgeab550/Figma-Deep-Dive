# Changelog

All notable changes to this plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-11-13

### Added
- **Design-system profile** (`.figma-deep-dive/design-system.json`) — one JSON file per project that tells the tooling which design system the working file uses. Two modes: `library` (build from your published library, which must be enabled in the working file) and `local` (no design system: the build authors components, variables and text styles in the file). Schema in `schemas/`, a neutral default and a filled example in `profiles/`, field reference in `conventions/design-system.md`.
- **`design-system-profile` skill** and **`/figma-screens profile <url>`** — detects libraries, variable collections, modes and text styles from the open file and saves the profile after you confirm.
- **`figma-screens-from-source` skill** and **`/figma-screens build <source>`** — rebuilds an existing source as design-system-native screens on a new page. Accepts a screen recording, code or HTML, screenshots or mockup images, `.pen` files, a written spec, or an existing Figma page in an old or mixed structure; it detects the kind of source and loads only that procedure. Pilot-gated; the source is never modified.
- **One page badge.** Every page the build creates is named with the suffix "— Auto-built, pending design review", whatever the source; a designer removes it after reviewing.
- **`build/`** — the shared guarded build, the audit and fix manual, the subagent briefs and the Plugin-API recipe behind that skill.
- **`conventions/tokens.md` and `conventions/components.md`** — binding and component-property rules, driven by the profile.
- **`docs/figma-screens.md`** — user guide for the build skill.
- CI validates the bundled profiles against the schema.

### Changed
- Platform tags (`[Native]`, `[Web]`) are no longer fixed: `figma-write` and `conventions/naming.md` read the allowed values from the profile.

## [0.5.0] - 2026-11-13

### Added
- **`/figma-screens` command** — one entry point for the screen toolkit: `init` seeds a conventions page, a bare URL audits and normalises screen names, `layers` applies the inner-layer taxonomy, `prd` writes a "Screens to build" block into a PRD.
- **`figma-write` skill** — confirm-gated writer. Renames screens and layers to the convention and makes surgical edits (text, raw hex → variable binding, spacing). Never writes before an explicit yes.
- **`screen-canonicalizer` skill** — groups frames that share a master component into build-once screens with a variant matrix and emits a schema-valid `canonical-screen-registry.json`.
- **`screens-to-prd` skill** — renders that registry into a fenced, regenerable PRD block.
- **Conventions** (`conventions/naming.md`, `layers.md`, `designer-card.md`) — master `[Platform][Feature][Screen]`, variants store only the delta `[State] - description`; layer taxonomy `type/role[/qualifier]`. Plus `TEMPLATE.md`, the render scripts and the registry schema.
- **`naming-audit` and `layer-audit` modes** on the `figma-deep-dive` agent — read-only checks against the conventions.
- **Component identity in the report.** Every instance now lists its master's real name, its component id and (over the Bridge) its library key and properties.
- **CI checks** — the rendered designer card must match its source and the example registry must render.

### Changed
- **`/figma-setup` no longer needs the token pasted into the chat.** When no stored token is found it now offers the `FIGMA_ACCESS_TOKEN` environment variable first (set it, start Claude Code, re-run), with pasting as the quick alternative. The README documents both. Node install is now offered per OS (Homebrew on macOS, winget on Windows) instead of assuming macOS.
- **Bridge first, REST as an announced fallback.** The agent probes the Desktop Bridge on every run and uses it for full-depth trees, identity and token names. If the Bridge is not connected it no longer aborts: it falls back to the REST API and opens the report with a warning that the result is degraded. The Bridge is still required for a complete spec and for every write.
- **Platform-neutral output, with optional platform hints.** The report no longer assumes iOS. Fonts are reported by the family the file uses (was hardcoded "SF Pro"), and gradients as normalised start/end points plus a plain direction. A new optional `platform` input (`ios` | `android` | `web`, inferred from the prompt when it names a framework) appends that platform's own terms next to the neutral values — so a prompt that mentions SwiftUI still gets `topLeading→bottomTrailing`, now after the neutral form instead of in place of it. Prompts that name no platform get the neutral form only.
- **Payload handling works across figma-console versions.** The `jq` patterns normalise both the older `[{type,text}]` array and the bare-object shape returned by figma-console ≥ 1.32.

### Fixed
- README examples no longer carry real node ids or product-specific copy.

## [0.4.0] - 2026-07-18

### Added
- **`figma-setup` doctor skill** (`/figma-setup`) — self-installing setup for the whole toolchain. Resolves and validates your personal Figma token (walking you through creating one if needed), registers the `figma-console` MCP at user scope, migrates old manual installs automatically, checks MCP health and Desktop Bridge connectivity (with the one-time manifest-import walkthrough), and ends every run in a green/red status table. Idempotent — safe to re-run any time.
- **One-command install README** — three paste-commands (`marketplace add` / `install` / `enable`) plus `/figma-setup` replace the setup walkthrough.

### Changed
- **README install section rewritten.** The manual three-part install (Parts A/B/C: `claude mcp add` by hand, bridge import, plugin install) is replaced by the `/figma-setup` flow; troubleshooting now routes through the doctor.

## [0.3.0] - 2026-06-30

### Added
- **On-demand escalation to richer figma-console tools.** The cheap `figma_get_component_for_development` stays the default; when more detail is needed the agent now escalates *within figma-console* — `figma_get_variables` / `figma_get_token_values` to resolve a `VariableID` to its token name + value, and `figma_get_component_for_development_deep` when the primary call comes back thin. Escalation is per-node, bounded by the token cap, and never reaches for another MCP.
- **FAQ section** in the README — how the agent differs from the figma-console MCP and from the Figma Desktop Bridge.

### Fixed
- **Hidden layers are now excluded from extraction.** Any node with `visible: false`, and its entire subtree, is dropped from every section (tree, ordered children, text nodes, auto-drill) — a hidden parent also hides its visible descendants. Non-rendered layers no longer pollute the spec.
- **Consistent Desktop Bridge requirement.** Documentation now states uniformly that the Figma Desktop Bridge is required; the agent description previously claimed it worked over REST without it, contradicting the README setup.

## [0.2.0] - 2026-06-29

### Added
- Initial public release. A Claude Code subagent that extracts distilled, structured specs from Figma node IDs via the figma-console MCP, keeping main-context token usage low. Ships the `figma-deep-dive` agent, the `localization-resolver` agent, and a marketplace manifest for one-line install. Includes `default` and `full-screen-audit` modes and automatic localization-key resolution against the working repo's i18n catalogs.

[0.6.0]: https://github.com/georgeab550/Figma-Deep-Dive/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/georgeab550/Figma-Deep-Dive/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/georgeab550/Figma-Deep-Dive/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/georgeab550/Figma-Deep-Dive/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/georgeab550/Figma-Deep-Dive/releases/tag/v0.2.0
