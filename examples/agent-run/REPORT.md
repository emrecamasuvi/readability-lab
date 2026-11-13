# Agent run: improving the "Exporting data" docs page

This is a recorded run of the [`readability-lab` skill](../../skills/readability-lab/SKILL.md) (acceptance scenario 3). The request was: *"Inspect this documentation page, propose reading improvements, implement the useful ones within our design system, and verify the result."*

- **Page:** `examples/docs-site/index.html`, served at `http://localhost:4321/index.html` (`node scripts/serve.mjs examples/docs-site 4321`). The original is kept in [`before-site/`](before-site/).
- **Reading region:** `.doc-content`, the prose component. It is chosen explicitly because the page has a sidebar and a header.
- **Conditions:** Chromium 158.0.8127.18 headless, fonts loaded. Desktop is 1280×800 @1x and phone is 390×844 @3x. All scenarios ran in both: WCAG 1.4.12 text spacing, 1.4.10 reflow at 320 CSS px, and a 200% zoom approximation.
- **Code that styles the region:** `styles/tokens.css`, which holds the design tokens, and `styles/docs.css`, which holds the prose component, the callout and the code block. Each token is used only by the docs layout, so changing a token does not affect other components.

## Baseline (measured)

| | Desktop | Phone |
|---|---|---|
| Median characters per line (p10–p90) | 135 (129–137) | 49 (45–52) |
| Font size / line height | 15px / 1.3 | 15px / 1.3 |
| Extra paragraph gap | 0.27× size | 0.27× size |
| Lowest contrast | 3.36:1 (`.meta`, `.note`, #8c8c8c on white) | same |

Findings, by kind:
- **Accessibility failures (checks performed):**
  - WCAG 1.4.3 contrast on `.meta` and `.note`;
  - WCAG 1.4.10 at 320px: the `#callout` box has a fixed height and hides about 28 characters;
  - WCAG 1.4.12 on phone: `#callout` hides about 69 more characters under the spacing overrides.
- **Needs review:**
  - the code block makes the page scroll sideways at 320px (it may qualify for the 2D exception, but it scrolls the whole page);
  - under the 200% zoom approximation, header links overflow on phone.
- **Heuristic deviations (not WCAG failures):**
  - 135 CPL is outside the 50–75 starting range (C-BASE-002, C-CPL-006);
  - 15px is below the 16–22px starting range (C-SIZE-002);
  - line height 1.3 is outside 1.4–1.7 (C-LH-003);
  - the paragraph gap is 0.27× size (C-PARA-001).

## Changes (see [`changes.diff`](changes.diff))

| Token / rule | Before → after | Addresses | Evidence | Trade-off |
|---|---|---|---|---|
| `--color-muted` | #8c8c8c → #595959 | 1.4.3 failure (now 7.0:1) | C-CONTRAST-001, C-CONTRAST-002 | Muted text is less de-emphasised |
| `.callout` | `height` + `overflow:hidden` → `min-height` | 1.4.12 / 1.4.10 text loss | C-WCAG-001, C-WCAG-002 | Callout grows with its content |
| `.doc-content pre` | + `overflow-x: auto` | Page-level horizontal scrolling | C-WCAG-002 | Only the code block scrolls |
| `.site-header` | + `flex-wrap: wrap` | Header overflow under enlargement | C-WCAG-003 | Header may use two rows |
| `--content-max` | 960px → 36rem | ~135 CPL → ~65 target | C-BASE-001, C-BASE-002, C-CPL-006 | More lines, taller page |
| `--text-body` | 15px → 18px | Below starting range | C-BASE-002, C-SIZE-002 | Taller page |
| `--leading-body` | 1.3 → 1.5 | Outside starting range | C-BASE-002, C-LH-003 | Taller page |
| `--space-paragraph` | 4px → 0.75em | Heuristic gap | C-PARA-001 | Taller page |

The phone layout was not forced to a desktop line length. The column still uses the full width, and the larger text gives about 40 CPL (C-CPL-007).

## After (measured, same URL, selector, browser and viewports)

| | Desktop before → after | Phone before → after |
|---|---|---|
| Median CPL (p10–p90) | 135 → **67** (64–69.9) | 49 → **40** (36–44) |
| Lines in region | 17 → 29 | 38 → 45 |
| Region height | 668 → 1203 px | 1022 → 1619 px |
| Font size / line height | 15 → 18px / 1.3 → 1.5 | same |
| Paragraph gap | 0.27 → 0.75× size | same |
| Lowest contrast | 3.36 → 7.00:1 | same |

All baseline accessibility failures and needs-review findings were resolved, and no new findings appeared. The comparison reports `comparable: true`: the content fingerprint, viewport, browser, scenarios and policy are identical. See [`reports/compare-desktop.md`](reports/compare-desktop.md) and [`reports/compare-phone.md`](reports/compare-phone.md). Screenshots for each scenario are under `reports/*/screenshots/`.

## Not tested / uncertain

- **Not checked:** screen readers, keyboard and focus behaviour of page controls, and browser text-only zoom. The 200% zoom check is an approximation (a half-width viewport), not real browser zoom.
- **Not measured:**
  - apparent size, viewing distance, display luminance and glare;
  - whether "Helvetica Neue" is the font that actually renders, which is an estimate;
  - reading speed, comprehension and comfort. No reader study was run.
- **Unknown values:** the four unknown observations per report are whether the page offers reader-adjustment controls; this can't be detected automatically, one per scenario. They were not treated as passes.
- **Evidence limits:** for moving from about 80+ CPL to about 65, from 15px to 18px, or from a line height of 1.3 to 1.5: *No reliable quantitative improvement established.* These are reasonable starting values, not proven optima.
- **Cost:** the page is now about 80% taller on desktop. That is a measured layout consequence, not a reading-performance result.

## Reproduce

```sh
pnpm build
node scripts/serve.mjs examples/agent-run/before-site 4321 &   # baseline
node packages/cli/bin/rlab.mjs inspect http://localhost:4321/index.html --selector ".doc-content" --scenarios all --screenshots --out reports/before-desktop
# stop it, then serve the changed site on the same URL
node scripts/serve.mjs examples/docs-site 4321 &
node packages/cli/bin/rlab.mjs inspect http://localhost:4321/index.html --selector ".doc-content" --scenarios all --screenshots --out reports/after-desktop
node packages/cli/bin/rlab.mjs compare reports/before-desktop/report.json reports/after-desktop/report.json
```
