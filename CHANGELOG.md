# Changelog

## 0.1.0 — unreleased (first public release candidate)

- Evidence registry 2026.11.0: 40 sources and 69 claims, with verification records and 11 documented gaps. See `evidence/CHANGELOG.md`.
- `@emrecamasuvi/readability-lab-core`:
  - open formats: Profile, Recipe, Report, Policy, experiments;
  - WCAG contrast, presets, publisher/reader resolution;
  - scoped CSS, DTCG tokens and design specs;
  - rules, report comparison, policy gate;
  - JSON Schemas.
- `@emrecamasuvi/readability-lab-inspector`:
  - rendered line-length measurement, computed typography, x-height;
  - contrast with unresolved-background handling, clipping, reflow culprits;
  - unsupported-content reporting, closed-loop CPL calibration.
- `@emrecamasuvi/readability-lab-cli` (`rlab`):
  - inspect, check, compare, recipe and claims commands;
  - real-browser WCAG 1.4.12 and 1.4.10 scenarios and a 200% zoom approximation;
  - axe-core cross-check, CI exit codes, Playwright library.
- `@emrecamasuvi/readability-lab-controls`: `<rl-reading-controls>` and a headless preferences API.
- `@emrecamasuvi/readability-lab-mcp`: MCP server with 7 tools. The `readability-lab` agent skill and adapters.
- Workbench:
  - layout comparison across devices with measured line-length distributions;
  - exports, share links, evidence atlas, preference exploration.
- Browser extension (Chromium and Firefox MV3):
  - page adjustment, reader view, region picker, per-site settings;
  - shortcuts, compare and reset, profiles, Inspect view.
