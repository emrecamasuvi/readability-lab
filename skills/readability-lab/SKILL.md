---
name: readability-lab
description: Inspect, improve and verify the reading presentation of a real web page (docs, articles, blogs) with measured before/after results and evidence claim IDs. Use when asked to improve readability, typography, line length, spacing, contrast or reading comfort of a page, or to check text-spacing/reflow/contrast for reading content.
---

# Readability Lab — inspect, change, verify

You improve how a page reads using **measurements from a real browser** and the **shared evidence registry**. You do not recite generic typography advice, invent a readability score, or promise speed/comprehension gains.

## Tools

Use either interface; both run the same engine locally (no content leaves the machine).

- **MCP** (if the `readability-lab` server is connected): `rl_inspect`, `rl_check`, `rl_compare`, `rl_claims`, `rl_claim`, `rl_recipe`, `rl_rules`.
- **CLI**: `rlab inspect|check|compare|recipe|claims|claim` (`node packages/cli/bin/rlab.mjs` inside this repo, or `npx @camasuvi/readability-lab-cli` once published). Run `rlab --help` for options.

## Workflow

1. **Identify the reading region and the code that styles it.**
   - Start the project's dev server (or use the built HTML). Pick an explicit CSS selector for the main prose (e.g. `.doc-content`, `article`). Avoid letting auto-detection guess on pages with sidebars.
   - Find the repository files that define its typography: design tokens (CSS custom properties, Sass variables, Tailwind theme, JSON tokens), the prose/markdown component, layout container widths, and responsive breakpoints. Note which values are tokens shared with other components.

2. **Inspect the rendered baseline** at the viewports that matter (at least desktop and phone):
   ```
   rlab inspect http://localhost:3000/docs/page --selector ".doc-content" --scenarios all --screenshots --out reports/before-desktop
   rlab inspect http://localhost:3000/docs/page --selector ".doc-content" --viewport phone --scenarios all --out reports/before-phone
   ```
   Exit code 3 means the page could not be inspected as requested (wrong selector, navigation error) — fix that first; do not interpret partial results.

3. **Retrieve evidence for what you found.** For each finding, read its claim IDs (`rlab claim C-CPL-006`, `rl_claim`). Check `kind` (normative/empirical/heuristic/hypothesis), evidence strength and limitations. Use the atlas questions (`rlab claims --nrqi`, `rl_claims {questionId}`) when the user asks "is X better than Y?".

4. **Separate what you found into categories, and keep them separate in your proposal:**
   - `accessibility-failure` — a WCAG check that was actually performed failed (e.g. 1.4.3 contrast, 1.4.12 content lost, 1.4.10 two-direction scrolling). Fix these first.
   - `needs-review` / `unsupported-check` — unresolved backgrounds, frames, approximations (200% zoom). Do **not** call these failures or passes; say what needs manual testing.
   - `heuristic-deviation` — outside starting ranges (≈50–75 CPL, 16–22px, 1.4–1.7 line height). Reasonable to adjust, but they are design choices, not compliance problems, and no fixed improvement is established.
   - `experiment-idea` / `preference` — propose as optional tests, never as fixes.

5. **Propose scoped changes with reasons.** For each: the token/selector to change, old → new value, the measured observation it addresses, claim IDs, and the trade-off (e.g. more lines/vertical scrolling). Rules:
   - Change existing tokens or the prose component, not global `*`/`body` overrides. Keep responsive behaviour: phones keep text size and use available width (C-CPL-007); don't force desktop CPL on phones.
   - Express line length as a `max-width` on the prose container. A CPL target must be verified in the browser (use `ch` or `rem` values and re-measure; a `ch` width is not a measured CPL).
   - Never remove user control: do not add `!important` to spacing, fixed heights on text containers, or `user-scalable=no`. Respect deliberate user settings and existing reader controls.
   - Preserve semantics (headings, lists, tables, links) and contrast for links/focus states.
   - If the user only asked for a review, stop here and present the proposal.

6. **Make the authorized changes** in the repository. Keep the diff small and explain any token whose change affects other components.

7. **Re-run the same checks under the same conditions** and compare:
   ```
   rlab inspect <same url> --selector "<same selector>" --scenarios all --screenshots --out reports/after-desktop
   rlab compare reports/before-desktop/report.json reports/after-desktop/report.json --out reports/compare-desktop.md
   ```
   If `compare` says conditions differ (content fingerprint, viewport, scenarios, policy), fix the setup before claiming anything was resolved. Findings from checks that did not run again are "untested", not "resolved".

8. **Report** (use this structure):
   - **Region and conditions:** URL, selector, viewports, browser/version, font loading.
   - **Measured before → after:** median CPL (p10–p90), line height, font size, paragraph gap, minimum contrast, clipping/reflow results — numbers from the reports.
   - **Fixed accessibility failures** (WCAG criterion, check type) and **heuristic adjustments** (with claim IDs) — listed separately.
   - **Not tested / uncertain:** everything under "Not performed" in the report (assistive tech, text-only zoom, apparent size/viewing distance, reading performance), approximations, needs-review items, estimated font availability.
   - **Evidence caveats:** quote "No reliable quantitative improvement established." where the claims say so. Never translate layout changes into speed, comprehension or eye-strain percentages.
   - **Artifacts:** paths to reports, screenshots and the comparison.

## Don'ts

- Don't label a heuristic deviation as a WCAG failure or say a page "passes WCAG" because these checks passed — they cover only what the report lists.
- Don't pick a "best font" or claim specialist fonts help; offer a shortlist experiment instead (C-FONT-004, C-DYS-001).
- Don't infer viewing distance, luminance, glare or a reader's visual needs from page styles (C-UNKNOWN-001).
- Don't apply Latin-script ranges to CJK/RTL text; the tool reports these as out of scope.
