# Readability Lab comparison

- **Before:** http://localhost:4321/index.html (2026-11-12T11:25:29.166Z)
- **After:** http://localhost:4321/index.html (2026-11-12T11:25:38.549Z)
- **Conditions:** identical viewport, browser, region and registry.

## Measured changes

| Metric | Before | After | Change |
|---|---|---|---|
| layout.cpl | 135 characters | 67 characters | -68 |
| layout.lineCount | 17 lines | 29 lines | +12 |
| layout.columnWidthPx | 931 px | 576 px | -355 |
| layout.contentHeightPx | 668 px | 1203 px | +535 |
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
- [heuristic-deviation] Median 135 characters per line is outside 50–75 (`cpl-range`; C-BASE-002, C-CPL-001, C-CPL-002, C-CPL-004, C-CPL-005, C-CPL-006, C-CPL-007)
- [heuristic-deviation] Body text is 15px, below 16px (`font-size-range`; C-BASE-002, C-SIZE-001, C-SIZE-002)
- [heuristic-deviation] Line height 1.3 is outside 1.4–1.7 (`line-height-range`; C-BASE-002, C-LH-001, C-LH-002, C-LH-003)
- [heuristic-deviation] Paragraph gap is 0.27× text size (`paragraph-gap`; C-PARA-001)
- [accessibility-failure] About 28 more characters become hidden under 320 CSS px reflow (`reflow`; C-WCAG-002)
- [needs-review] Element needs horizontal scrolling (possible 2D-content exception) (`reflow`; C-WCAG-002)
- [needs-review] Element needs horizontal scrolling (possible 2D-content exception) (`zoom-200`; C-WCAG-003)

## Findings introduced

- none

> These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied.
