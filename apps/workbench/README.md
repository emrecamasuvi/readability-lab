# Workbench

`pnpm -C apps/workbench dev` (development) or `build` (static site in `dist/`). Requires `pnpm -C packages/inspector build` first.

- **`#/compare`:** the same text in two panes (original vs recipe, or two recipes). Device presets: desktop, tablet, phone, and enlarged 200% (an approximation). Shows the measured line-length distribution and layout consequences. Also offers WCAG 1.4.12 overrides, blind fonts, apparent-size (x-height) matching labelled as an estimate, exports (recipe JSON with calibration, CSS, DTCG tokens, design spec, measurements), the CLI command for reference screenshots, share links and preference recording.
- **`#/atlas`:** a searchable evidence registry, with entry questions, filters by kind and outcome, claim details, sources and verification status, dependents and history.
- **`#/explore`:** blind preference exploration (preference only). An explanation of reading-performance experiments.

**Figma handoff:** the DTCG tokens export can be imported with token plugins, and the design spec carries the reasoning and calibration. A dedicated Figma plugin is on the roadmap.
