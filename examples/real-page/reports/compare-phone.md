# Readability Lab comparison

- **Before:** https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir (2026-11-12T15:02:20.627Z)
- **After:** https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir (2026-11-12T15:02:28.485Z)
- **Conditions:** identical viewport, browser, region and registry.

## Measured changes

| Metric | Before | After | Change |
|---|---|---|---|
| layout.cpl | 40 characters | 36 characters | -4 |
| layout.lineCount | 198 lines | 218 lines | +20 |
| layout.columnWidthPx | 328 px | 328 px | 0 |
| layout.contentHeightPx | 7091 px | 7470 px | +379 |
| text.fontSizePx | 16.32 px | 18 px | +1.68 |
| text.lineHeightRatio | 1.75 | 1.5 | -0.25 |
| layout.paragraphGapEm | 0.98 em | 0.75 em | -0.23 |
| text.fontWeight | 400 | 400 | 0 |
| text.align | start | start | — |
| font.firstAvailableFamily | sans-serif | sans-serif | — |
| minimum contrast | 18.88 | 18.88 | |

## Findings resolved

- [heuristic-deviation] Line height 1.75 is outside 1.4–1.7 (`line-height-range`; C-BASE-002, C-LH-001, C-LH-002, C-LH-003)

## Findings introduced

- none

> These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied.
