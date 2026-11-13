# Readability Lab comparison

- **Before:** https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir (2026-11-12T15:02:04.447Z)
- **After:** https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir (2026-11-12T15:02:12.313Z)
- **Conditions:** identical viewport, browser, region and registry.

## Measured changes

| Metric | Before | After | Change |
|---|---|---|---|
| layout.cpl | 111 characters | 64.5 characters | -46.5 |
| layout.lineCount | 80 lines | 130 lines | +50 |
| layout.columnWidthPx | 824 px | 549 px | -275 |
| layout.contentHeightPx | 3613 px | 5065 px | +1452 |
| text.fontSizePx | 16.32 px | 18 px | +1.68 |
| text.lineHeightRatio | 1.75 | 1.5 | -0.25 |
| layout.paragraphGapEm | 0.98 em | 0.75 em | -0.23 |
| text.fontWeight | 400 | 400 | 0 |
| text.align | start | start | — |
| font.firstAvailableFamily | sans-serif | sans-serif | — |
| minimum contrast | 18.88 | 18.88 | |

## Findings resolved

- [heuristic-deviation] Median 111 characters per line is outside 50–75 (`cpl-range`; C-BASE-002, C-CPL-001, C-CPL-002, C-CPL-004, C-CPL-005, C-CPL-006, C-CPL-007)
- [heuristic-deviation] Line height 1.75 is outside 1.4–1.7 (`line-height-range`; C-BASE-002, C-LH-001, C-LH-002, C-LH-003)

## Findings introduced

- none

> These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied.
