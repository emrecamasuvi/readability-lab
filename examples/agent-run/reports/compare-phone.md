# Readability Lab comparison

- **Before:** http://localhost:4321/index.html (2026-11-12T11:25:33.465Z)
- **After:** http://localhost:4321/index.html (2026-11-12T11:25:42.149Z)
- **Conditions:** identical viewport, browser, region and registry.

## Measured changes

| Metric | Before | After | Change |
|---|---|---|---|
| layout.cpl | 49 characters | 40 characters | -9 |
| layout.lineCount | 38 lines | 45 lines | +7 |
| layout.columnWidthPx | 358 px | 358 px | 0 |
| layout.contentHeightPx | 1022 px | 1619 px | +597 |
| text.fontSizePx | 15 px | 18 px | +3 |
| text.lineHeightRatio | 1.3 | 1.5 | +0.2 |
| layout.paragraphGapEm | 0.27 em | 0.75 em | +0.48 |
| text.fontWeight | 400 | 400 | 0 |
| text.align | start | start | — |
| font.firstAvailableFamily | Helvetica Neue | Helvetica Neue | — |
| minimum contrast | 3.36 | 7 | |

## Findings resolved

- [accessibility-failure] Contrast 3.36:1 is below 4.5:1 (`contrast-aa`; C-CONTRAST-001, C-CONTRAST-004)
- [accessibility-failure] Contrast 3.36:1 is below 4.5:1 (`contrast-aa`; C-CONTRAST-001, C-CONTRAST-004)
- [heuristic-deviation] Body text is 15px, below 16px (`font-size-range`; C-BASE-002, C-SIZE-001, C-SIZE-002)
- [heuristic-deviation] Line height 1.3 is outside 1.4–1.7 (`line-height-range`; C-BASE-002, C-LH-001, C-LH-002, C-LH-003)
- [heuristic-deviation] Paragraph gap is 0.27× text size (`paragraph-gap`; C-PARA-001)
- [accessibility-failure] About 69 more characters become hidden under WCAG 1.4.12 text spacing (`text-spacing`; C-WCAG-001)
- [accessibility-failure] About 28 more characters become hidden under 320 CSS px reflow (`reflow`; C-WCAG-002)
- [needs-review] Element needs horizontal scrolling (possible 2D-content exception) (`reflow`; C-WCAG-002)
- [needs-review] About 92 more characters become hidden under 200% zoom (approximation) (`zoom-200`; C-WCAG-003)
- [needs-review] Content forces horizontal page scrolling (`zoom-200`; C-WCAG-003)
- [needs-review] Content forces horizontal page scrolling (`zoom-200`; C-WCAG-003)
- [needs-review] Element needs horizontal scrolling (possible 2D-content exception) (`zoom-200`; C-WCAG-003)

## Findings introduced

- none

> These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied.
