# Changelog

All notable changes to this plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/georgeab550/Figma-Deep-Dive/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/georgeab550/Figma-Deep-Dive/releases/tag/v0.2.0
