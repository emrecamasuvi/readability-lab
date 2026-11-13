# Implementation plan (v0.1)

Product promise: make reading on the web adjustable, inspectable, and reproducible.
Core workflow: choose real content → inspect → compare → save a recipe → apply/export → verify.

## Architecture (one shared foundation)

| Package | Role | Runtime |
|---|---|---|
| `packages/core` | Zod schemas (Source, Claim, Observation, Finding, Report, Recipe, Profile, Policy, experiments), WCAG contrast math, presets, recipe/profile resolution, scoped CSS + DTCG tokens, rule engine, report building/comparison/markdown, evidence registry access, experiment analysis. DOM-free, no LLM, no network. | any |
| `evidence/registry.json` | Versioned sources + claims (the single registry used by tools, atlas, agent). | data |
| `packages/inspector` | In-page measurement: region selection, rendered line lengths (`rendered-line-rects@1`), computed typography, contrast with background resolution, clipping, horizontal overflow, unsupported content, apply/calibrate settings. Bundled as ESM and IIFE. | browser |
| `packages/cli` (`rlab`) | Playwright-driven inspect/check/compare/recipe/claims; scenarios: baseline, WCAG 1.4.12 text spacing (real browser), 1.4.10 reflow at 320 CSS px (real browser), 200% zoom (approximation); policy gate for CI; optional axe-core cross-check; Markdown/JSON/HTML + screenshots. Library export for Playwright tests. | node |
| `packages/mcp` | MCP stdio server wrapping CLI library + registry. | node |
| `packages/controls` | `<rl-reading-controls>` web component + headless preferences API using the same Profile format. | browser |
| `apps/workbench` | Designer playground: samples/paste Markdown, A/B recipes in device iframes, measured line distribution, exports (recipe, CSS, DTCG tokens, spec, screenshots), share links, evidence atlas, preference exploration. | static web |
| `apps/extension` | MV3 extension (Chromium + Firefox): pick region, reversible on-page styles, reader workspace (Mozilla Readability), presets, per-site prefs, shortcuts, compare/reset, profile import/export/share, Why?/Inspect panel. Local only. | browser |
| `skills/readability-lab` | Agent skill driving CLI/MCP with real measurements and claim IDs. | agents |

## Key semantics
- Finding kinds are separate: `accessibility-failure` only for a WCAG check actually performed; heuristics (CPL/size/line height ranges) are `heuristic-deviation` and never fail CI by default.
- Unknown observations are never passes (`needs-review` / `unsupported-check`).
- Precedence: page < publisher recipe < publisher responsive < reader profile < reader per-site. Reader `needs` are kept by presets and never overridden by publisher layers.
- CPL targets are converted to `ch` via browser calibration (closed loop), never assumed.
- No readability score, no percentage improvement claims; unestablished effects use "No reliable quantitative improvement established."

## Sequence
1. core + registry (done/in progress) → 2. inspector → 3. CLI + fixtures + e2e tests → 4. controls → 5. workbench (+atlas) → 6. extension → 7. MCP + skill + agent demo → 8. docs, support matrix, release packaging, verification.

## Acceptance matrix (verification paths)

| # | Scenario | Fixture / surface | Automated assertion | Artifact |
|---|---|---|---|---|
| 1 | Reader saves settings, reuses on another article, restores original | `fixtures/article-*.html` + extension (Playwright, Chromium persistent context) | profile stored; second page styled with same computed values; reset leaves no `[data-readability-lab]` style / `data-rl-region` and computed styles equal the pre-apply snapshot | `tests/e2e/extension.spec.ts`, screenshots |
| 2 | Designer exports recipe; developer reproduces at recorded conditions | workbench export → `rlab inspect --recipe` | median CPL within ±2 of the workbench measurement at same viewport/browser; recipe calibration recorded | `tests/e2e/recipe-roundtrip.spec.ts` |
| 3 | Agent changes a real page and reports before/after with evidence IDs | `examples/docs-site` | `rlab compare` shows resolved findings with claim IDs; comparison `comparable: true` (same fingerprint) | `examples/agent-run/` reports |
| 4 | Broken contrast/clipping detected; unresolved handled honestly | `fixtures/broken-contrast.html`, `broken-clipping.html`, `unresolved-background.html`, `canvas-frame-shadow.html` | failures with WCAG ids; gradient/opacity/overlay → `needs-review`, never `pass` | `tests/e2e/inspector.spec.ts` |
| 5 | Heuristic deviation never labeled a failure | `fixtures/wide-measure.html` (95 CPL, 1.2 lh, 14px, 4.6:1) | only `heuristic-deviation`; `gate()` passes under default policy | core unit + e2e |
| 6 | Controls usable with keyboard and enlarged text | `packages/controls` demo + extension popup | Tab/arrow operation changes settings; at 200% zoom + 1.4.12 overrides no clipping; axe-core clean on controls | `tests/e2e/controls.spec.ts` |
| 7 | Revised claim traces to dependents | registry fixture with revised claim | `dependentsOfClaim` lists rules/presets/recipes; `staleClaimReferences` flags recipe | core unit test |
| 8 | No invented % improvements | all UI/text sources | lint test scans UI strings/registry `plain` text for `% (faster|better|improve)` patterns | `tests/no-percent-claims.test.ts` |
| 9 | No private content sent remotely | extension + workbench | no `fetch`/XHR to remote origins in extension bundle; network log during e2e has only local origins | e2e network assertions |
| 10 | Every advertised feature has a working path | docs/SUPPORT.md matrix | each row links to a test or recorded manual verification | docs |

Also scheduled: apparent-size comparison mode in the workbench (match rendered x-height via `font.xHeightPx`, clearly labelled as an estimate) alongside equal nominal-size comparison.
