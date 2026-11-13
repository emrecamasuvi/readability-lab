# Architecture and decisions

## Overview

```
evidence/registry.json ──► @camasuvi/readability-lab-core ◄── schemas/*.json (generated)
                              │  formats · contrast · presets · resolution · CSS/tokens
                              │  rules · reports · comparison · experiments
                              ▼
                    @camasuvi/readability-lab-inspector  (runs inside a page)
                     │            │              │              │
          @camasuvi/readability-lab-cli  workbench   extension   @camasuvi/readability-lab-controls
          (Playwright)          (iframes)   (content     (publisher pages)
                │                            script)
          @camasuvi/readability-lab-mcp ── skills/readability-lab (agents)
```

Every interface uses the same core and inspector, so they agree about:
- profiles, recipes and policy semantics;
- metric names (`METRICS`) and measurement methods;
- rules and their claim IDs;
- finding kinds.

Every interface reads the same registry.

## Decisions (ADR summary)

1. **TypeScript monorepo (pnpm workspaces); esbuild for libraries; Vite for the workbench.**
   - One language across the browser, Node and the extension.
   - Packages export TypeScript sources inside the workspace and bundled `dist/` builds when published (`publishConfig`).
   - The CLI and MCP bundles inline the core and the inspector, so published packages have no workspace dependencies.

2. **Zod 4 schemas are the single source of truth for the open formats.**
   - JSON Schemas are generated from them (`pnpm schemas`).
   - Namespace imports (`import * as z`) keep embeddable bundles small (controls: 40 KB gzip).
   - Values that end up in CSS (`fontFamily`, theme colors) are restricted to safe syntaxes, and `toCss` validates again. An imported profile or share code therefore cannot inject CSS rules.

3. **Measurement happens in a real browser layout.**
   - Line lengths come from client rects of word segments (Intl.Segmenter), not from computed widths. See [measurement-method.md](measurement-method.md).
   - A CPL target becomes `ch` through closed-loop calibration, and the calibration is recorded in the exported recipe.

4. **Finding kinds are separate by construction.**
   - `accessibility-failure` exists only for WCAG checks the tool actually performed.
   - Heuristic ranges produce `heuristic-deviation`.
   - Approximations and unresolved cases produce `needs-review` or `unsupported-check`.
   - A missing scenario completion record blocks any pass.
   - CI policy fails only on configured kinds (default: performed accessibility failures). Exceptions require a reason and a review date, and they match only selectors the browser resolved against the affected element.

5. **No LLM in the loop.**
   - Claims, rules, measurement and profile semantics are deterministic code and data.
   - The agent skill orchestrates the tools; it does not replace them.

6. **Local first.**
   - The extension has no network permission (`connect-src 'none'`).
   - The workbench previews run under a CSP with `default-src 'none'`.
   - Pasted content is never put in share links.
   - Exported profiles drop the site list.
   - See [PRIVACY.md](PRIVACY.md).

7. **Extension permissions are minimal.**
   - Required: `activeTab`, `scripting` and `storage`.
   - Host access is requested per site, and only when the reader turns on "apply automatically". Those sites get a registered content script.
   - The automated tests use a separate test build that adds host permissions; it must never be distributed.

8. **Reader view uses Mozilla Readability on a cloned document.**
   - The output is rendered in a shadow root over the page, with DOMPurify sanitization and attribution.
   - When extraction fails, the view says so.
   - The live page is never mutated; reset removes every style, marker attribute and overlay, and a test asserts this.

## Existing projects evaluated

| Project | License | Decision |
|---|---|---|
| [Mozilla Readability](https://github.com/mozilla/readability) | Apache-2.0 | **Used** for reader-view extraction in the extension. It is mature and preserves links, images, lists, tables and code reasonably. We add attribution, an extraction-failure notice, sanitization and our own typography. |
| [axe-core](https://github.com/dequelabs/axe-core) | MPL-2.0 | **Integrated as an optional cross-check.** `rlab inspect --axe` runs its contrast-related rules on the region and reports the results alongside ours, without merging them. It is also used in our tests to audit our own UI (controls, extension popup). We don't reimplement general WCAG auditing; Readability Lab is a reading-focused complement. |
| [Dark Reader](https://github.com/darkreader/darkreader) | MIT | **Not used.** It generates dark themes for whole pages dynamically, which is a different goal. Our themes apply fixed, contrast-checked palettes (all ≥ 7:1) to the reading region only, so measurements stay attributable. Readers who want whole-page dark mode can use Dark Reader alongside; the two do not conflict. |
| [Deque axe-accessibility](https://github.com/dequelabs/axe-accessibility) | MIT (plugin) | **Not a dependency.** It is a Claude Code plugin that configures Deque's Axe MCP Server. It requires an Axe DevTools subscription, uses an API key or OAuth, and consumes AI credits for remediation. Our core features must work without accounts or paid services, so we document it as a complementary general-accessibility agent tool that can run next to the `readability-lab` MCP server. |

## Package boundaries

- **`core`:** pure functions and data only. It has no DOM, Node or network access, and imports nothing from the other packages.
- **`inspector`:** DOM-only. It is safe to run in pages, iframes, content scripts and Playwright, and it uses the globals of the window it runs in.
- **`cli`:** Node and Playwright orchestration of scenarios (viewports, overrides), report I/O and exit codes.
- **`controls`:** core plus inspector `applySettings`. It has no registry, so publisher bundles stay small.
- **`mcp`:** thin tool adapters over the CLI library and the registry.
