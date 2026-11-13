# Real page: a published article, re-set with a recipe

The website's before/after wipe uses this example. It shows the toolkit on a live third-party page:
- **Page:** "HABAŞ Toplu İşçi Katliamı Düzenin Aynasıdır!" on tip.org.tr: <https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir>. It is in Turkish.
- **Region:** `#postContent > article` (auto-detection picks the same region).
- **Recipe:** [`recipe.json`](recipe.json), which is the Balanced preset (18px, about 65 characters per line, line height 1.5, paragraph gap 0.75em) scoped to the article. Nothing outside the article changes.
- **Conditions:** Chromium 158 headless, fonts loaded, 1280×800 @1x and 390×844 @3x. Captured 12 November 2026. Reports were written with `--privacy`, so they contain no text samples.

## Results (measured)

| | Desktop before → after | Phone before → after |
|---|---|---|
| Median characters per line | 111 → **64.5** (p10–p90 58–70) | 40 → 36 |
| Lines in region | 80 → 130 | 198 → 218 |
| Region height | 3613 → 5065 px | 7091 → 7470 px |
| Column width | 824 → 549 px | 328 → 328 px |
| Font size / line height | 16.3px / 1.75 → 18px / 1.5 | same |
| Paragraph gap | 0.98 → 0.75× size | same |

Findings, by kind:
- **Desktop before:** two heuristic deviations (not WCAG failures): CPL 111 is outside the 50–75 starting range, and line height 1.75 is outside 1.4–1.7. **After:** none.
- **Both runs, both viewports, needs review:** the first declared font (Gabarito) appears not to load, so the text renders in a fallback. The recipe does not change fonts, so this item stays.
- **Phone, both runs, needs review:** contrast could not be resolved for three paragraphs, and a footer element makes the page scroll sideways. Both are outside what the recipe changes.

These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied. On a phone the column already fills the width, so larger text means fewer characters per line. Whether that suits this page is a design decision.

Reports: [`reports/`](reports/) (`before-*`, `after-*`, `compare-*.md`).

## Reproduce

```sh
node packages/cli/bin/rlab.mjs check "https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir" -s "#postContent > article" --privacy --out examples/real-page/reports/before-desktop
```
```sh
node packages/cli/bin/rlab.mjs check "https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir" -s "#postContent > article" --privacy --recipe examples/real-page/recipe.json --out examples/real-page/reports/after-desktop
```

Add `--viewport phone` for the phone runs. The page is live, so later runs may differ if its content or styles change. `rlab compare` reports when the content fingerprint no longer matches.

To refresh the wipe images, run `node examples/real-page/capture.mjs <dir>`. It writes `before.png` and `after.png` at 2× and frames both on the article card. Then downscale them to 1280 and 640 px wide as JPEG and WebP, and save them as `apps/site/assets/tip-{before,after}-{1280,640}.{jpg,webp}`.
