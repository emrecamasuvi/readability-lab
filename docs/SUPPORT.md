# Support matrix and verification results

Verified on 2026-11-12, macOS (arm64), Node 24.13.1, pnpm 10.29.3, Playwright 1.65.0.

`pnpm verify` runs these steps:

| Step | Result |
|---|---|
| Build: core, inspector, CLI, controls, MCP, workbench, extension (Chromium and Firefox) | ✅ |
| Typecheck: all packages | ✅ |
| Unit tests (vitest) | ✅ 25 passed |
| Evidence integrity (`scripts/check-evidence.mjs`) | ✅ 40 sources, 69 claims, all tool claim IDs resolve |
| Browser tests (Playwright, Chromium 158) | ✅ 45 passed |
| `web-ext lint`, Firefox build | ✅ 0 errors. 5 warnings: `innerHTML` with DOMPurify-sanitized content, inside DOMPurify, the reader view and the inert template used to filter media |

## Browsers

| Surface | Chromium (Chrome/Edge) | Firefox | Safari |
|---|---|---|---|
| CLI and inspector (Playwright) | ✅ Tested: Chromium 158 headless, all suites | ⚠️ `--browser firefox` is supported by the code; the Firefox build was not run in this release | ⚠️ `--browser webkit` is supported by the code but not run |
| Workbench | ✅ Tested in Chromium (e2e) | ⚠️ Not tested | ⚠️ Not tested |
| Reading controls | ✅ Tested in Chromium: keyboard, 200% approximation plus WCAG spacing, axe A/AA clean | ⚠️ Not tested | ⚠️ Not tested |
| Extension | ✅ Tested in Chromium (MV3, test build); scenarios below | 🟡 Builds as MV3 (min 142) and passes `web-ext lint`; **not run** in this release | ❌ Not packaged. Planned via `safari-web-extension-converter` |

✅ verified · 🟡 builds but not exercised · ⚠️ expected to work, not verified · ❌ not available

## Acceptance scenarios

| # | Scenario | Status | Verification |
|---|---|---|---|
| 1 | Reader saves settings, reuses them on another article, restores the original | ✅ Chromium | `tests/e2e/extension.spec.ts`: the profile is reused on `blog-post.html`, which uses different markup. After reset, computed styles, injected styles and region markers equal the pre-apply snapshot. Reset leaves page-owned controls' styles alone. Reader view is a modal dialog: focus stays inside, Escape works after traversal, and closing restores the page's inline styles exactly. "Never adjust" blocks presets and reader view. |
| 2 | Designer exports a recipe that a developer reproduces under recorded conditions | ✅ | `workbench.spec.ts`: a recipe downloaded from the workbench, reproduced by `rlab` within ±2 CPL. `review-regressions.spec.ts`: exported CSS reproduces 65 ±2 CPL with no re-fitting. |
| 3 | Agent changes a real page and reports measured before/after results with evidence IDs | ✅ | [`examples/agent-run/REPORT.md`](../examples/agent-run/REPORT.md): reports, screenshots and comparisons under identical conditions. |
| 4 | Broken contrast and clipping are detected; unresolved cases handled honestly | ✅ | `inspector.spec.ts` and `review-regressions.spec.ts`: contrast, 1.4.12 and 1.4.10 failures. Gradients, opacity, overlays and off-screen siblings come out as needs-review. Canvas, frames and closed shadow roots come out as unsupported. Missing regions and scenarios that did not run never pass. |
| 5 | Heuristic deviations are not labelled accessibility failures | ✅ | Unit `rules` tests plus `wide-measure.html` (193 CPL, 14px, line height 1.2): only heuristic deviations; the default gate passes. |
| 6 | Controls usable with keyboard and enlarged text | ✅ Chromium | `controls.spec.ts` (Tab order, visible focus, arrow keys, 200% approximation with 1.4.12 overrides, axe) and `extension.spec.ts` (popup keyboard and axe). |
| 7 | A revised claim traces to dependent recommendations | ✅ | Unit test: `dependentsOfClaim` and `staleClaimReferences`; `rlab claim <ID> --dependents`; `rlab recipe validate`; atlas "Used by". |
| 8 | No invented percentage improvements | ✅ | `tests/unit/no-percent-claims.test.ts` scans UI, tool, skill and registry text. |
| 9 | No private reading content sent to remote services | ✅ | Workbench and extension e2e tests assert no requests outside localhost.<br>Pasted forms are removed and the preview sandbox blocks submission (test).<br>Reader view makes no new requests, even for `no-store` images (test).<br>Profiles shared with pages contain only that site's settings (test).<br>Previews run under `default-src 'none'; form-action 'none'`. |
| 10 | Every advertised core feature has a working path | ✅ with the caveats in this file | This matrix. |

## Checks: what is real, approximated or not done

| Check | Fidelity |
|---|---|
| Rendered characters per line, line pitch, paragraph gap, column width, content height | Real browser layout |
| WCAG 1.4.3 contrast | Computed from rendered styles. Unresolvable layers become needs-review. |
| WCAG 1.4.12 text spacing | Real browser. Overrides are verified per element; frames and closed shadow roots are counted as unverifiable. |
| WCAG 1.4.10 reflow (320 CSS px) | Real browser |
| WCAG 1.4.4 at 200% | **Approximation** (half viewport, double scale); always needs-review |
| Font availability | **Estimate** |
| Keyboard and focus on arbitrary pages, screen readers, text-only zoom, apparent size at viewing distance, luminance and glare, reading performance | **Not performed**; listed in every report |

## Agent integrations

| Integration | Status |
|---|---|
| MCP server (stdio) | ✅ Tested with the official MCP TypeScript SDK client (`tests/e2e/mcp.spec.ts`) |
| `readability-lab` skill | ✅ Used to produce `examples/agent-run/` |
| Claude Code MCP configuration | 🟡 Documented command; not exercised by automated tests |
| `AGENTS.md` snippet for other agents | 🟡 Instructions only |

## Known limitations

- Region auto-detection is heuristic. Pass a selector for dependable results; the extension's picker records it per site.
- The guided reading-performance experiment UI is not built yet; the core model and analysis are tested.
- The workbench "apparent size" match equalises the rendered x-height computed by canvas. It is an estimate and does not account for viewing distance.
- Large pages: line measurement samples up to 40,000 characters, and contrast samples up to 400 elements. When truncation happens, the report records it.

## Known reader-view limitation

Cross-origin images are not shown in reader view. They appear as links, because they cannot be copied without a new request. Same-origin images are copied as static PNG snapshots, so animations are not preserved.
