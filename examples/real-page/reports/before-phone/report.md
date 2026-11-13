# Readability Lab report

- **Target:** https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir — HABAŞ Toplu İşçi Katliamı Düzenin Aynasıdır!
- **Reading region:** `#postContent > article` (explicit-selector)
- **Conditions:** chromium 158.0.8127.18, viewport 390×844 @3x, fonts loaded
- **Tool:** readability-lab-cli 0.1.0, evidence registry 2026.11.0
- **Created:** 2026-11-12T15:02:20.627Z
- **Policy result:** **WARN** (0 failing, 5 warnings, 0 excepted)

> Automated checks describe what was tested, not complete accessibility conformance. No readability score is computed.

## Measurements (baseline)

| Metric | Value | Status | Method |
|---|---|---|---|
| layout.cpl | 40 characters (p10 34, p90 45, n=176) | measured | rendered-line-rects@1 |
| layout.lineCount | 198 lines | measured | rendered-line-rects@1 |
| layout.columnWidthPx | 328 px | measured | bounding-box@1 |
| layout.contentHeightPx | 7091 px | measured | bounding-box@1 |
| text.fontSizePx | 16.32 px | measured | computed-style@1 |
| text.lineHeightRatio | 1.75 | derived | computed-style@1 |
| layout.paragraphGapEm | 0.98 em | derived | line-top-gap-minus-pitch@1 |
| text.fontWeight | 400 | measured | computed-style@1 |
| text.align | start | measured | computed-style@1 |
| font.declaredFamily | Gabarito, sans-serif | measured | computed-style@1 |
| font.firstAvailableFamily | sans-serif | estimated | width-comparison-and-fontfaceset@1 |

### Contrast samples

| Element | Colors | Ratio | Large text | Status |
|---|---|---|---|---|
| `#postContent > article > section:nth-of-type(1) > p:nth-of-type(1)` | rgb(17, 17, 17) on ? | unknown | no | unknown: div is painted over the text |
| `#postContent > article > section:nth-of-type(1) > p:nth-of-type(2)` | rgb(17, 17, 17) on ? | unknown | no | unknown: div is painted over the text |
| `#postContent > article > section:nth-of-type(3) > p:nth-of-type(1)` | rgb(17, 17, 17) on ? | unknown | no | unknown: div is painted over the text |
| `#postContent > article > h1` | #000000 on #ffffff | 21.00:1 | yes | measured |
| `#postContent > article > p:nth-of-type(1)` | #111111 on #ffffff | 18.88:1 | no | measured |
| `#postContent > article > ul > li:nth-of-type(1)` | #000000 on #ffffff | 21.00:1 | no | measured |

## Findings

### Needs review (5)

- **Contrast could not be resolved** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: manual-review-required
  - Region: `#postContent > article > section:nth-of-type(1) > p:nth-of-type(1)`
  - Why: Background could not be determined: div is painted over the text. This is not treated as a pass.
  - Suggested action: Check this text manually with a colour picker against the actual rendered background.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **Contrast could not be resolved** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: manual-review-required
  - Region: `#postContent > article > section:nth-of-type(1) > p:nth-of-type(2)`
  - Why: Background could not be determined: div is painted over the text. This is not treated as a pass.
  - Suggested action: Check this text manually with a colour picker against the actual rendered background.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **Contrast could not be resolved** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: manual-review-required
  - Region: `#postContent > article > section:nth-of-type(3) > p:nth-of-type(1)`
  - Why: Background could not be determined: div is painted over the text. This is not treated as a pass.
  - Suggested action: Check this text manually with a colour picker against the actual rendered background.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **First declared font appears unavailable; likely rendering sans-serif** — rule `font-fallback`, scenario `baseline`, verification: approximation
  - Why: Declared: Gabarito, sans-serif. Detection compares rendered widths and is an estimate. Fallback fonts change apparent size and wrapping.
  - Suggested action: Load the intended font or choose a stack whose fallbacks have similar proportions.
  - Evidence: `C-SIZE-001`, `C-FONT-004`
- **Content forces horizontal page scrolling** — rule `zoom-200`, WCAG 1.4.4 (AA), scenario `zoom-200`, verification: approximation
  - Region: `body > footer > div > div:nth-of-type(2) > div > div`
  - Why: This element extends 5px beyond the viewport, so reading requires scrolling in two directions. (Approximation scenario.)
  - Suggested action: Remove fixed widths/min-widths and white-space: nowrap; use max-width: 100% and overflow-wrap: anywhere for long strings.
  - Evidence: `C-WCAG-003`

### Heuristic deviation (not a WCAG failure) (1)

- **Line height 1.75 is outside 1.4–1.7** — rule `line-height-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#postContent > article > p:nth-of-type(1)`
  - Why: Ratio of measured baseline distance to font size. This is a starting range, not a requirement. No reliable quantitative improvement established.
  - Suggested action: Very open spacing increases vertical travel; consider 1.5–1.7 unless readers chose it.
  - Evidence: `C-BASE-002`, `C-LH-001`, `C-LH-002`, `C-LH-003`

### Experiment idea (1)

- **Compare a short list of text faces at matched apparent size** — rule `experiment-font`, scenario `baseline`, verification: not-tested
  - Why: No typeface is established as universally fastest; individual results vary. For superiority of any named font: No reliable quantitative improvement established.
  - Evidence: `C-FONT-001`, `C-FONT-004`, `C-SIZE-001`, `C-METH-002`

### Pass (4)

- **3 measured text colour pair(s) meet 1.4.3 AA** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: computed-from-rendered-styles
  - Why: Computed from rendered styles for the sampled text in the region. Unresolved samples are reported separately.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **Median 40 characters per line on a 390px viewport** — rule `cpl-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Why: Phones should keep a useful text size and use the available width rather than force a desktop line length (10th–90th percentile 34–45, 176 lines).
  - Evidence: `C-CPL-007`
- **No content loss detected under WCAG 1.4.12 text spacing** — rule `text-spacing`, WCAG 1.4.12 (AA), scenario `text-spacing`, verification: automated-browser-test
  - Why: Checked hidden text, spilled text and horizontal scrolling after applying line-height 1.5, paragraph spacing 2em, letter spacing 0.12em and word spacing 0.16em (document and open shadow roots). Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-001`
- **No content loss detected under 320 CSS px reflow** — rule `reflow`, WCAG 1.4.10 (AA), scenario `reflow-320`, verification: automated-browser-test
  - Why: Checked hidden text, spilled text and horizontal scrolling after rendering at a 320×256 CSS px viewport. Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-002`

## Coverage

**Performed:**
- Rendered line lengths, computed typography, contrast of sampled text, clipping at baseline
- WCAG 1.4.12 text-spacing overrides in a real browser
- WCAG 1.4.10 reflow at 320×256 CSS px in a real browser
- 200% page zoom (approximation) — approximation

**Not performed:**
- Assistive technology (screen readers, voice control) — Not automated by this tool.
- Keyboard operability and focus visibility of page controls — Not automated for arbitrary pages; Readability Lab's own controls are tested separately.
- Browser text-only zoom — Automation cannot set the user text-size preference; page zoom is approximated instead.
- Apparent size (x-height at viewing distance), display luminance, ambient light, glare — Cannot be inferred from page styles.
- Reading speed, comprehension, comfort — Require experiments with readers; no score is computed.
- Complete WCAG conformance — Only the checks listed under 'performed' were run.

## Uncertainty

- 37 observation(s) are unknown and were not treated as passing.
- 4 observation(s) are estimates (e.g. font availability).
- Nominal font size is reported; apparent size depends on the font's x-height and viewing distance, which are not measured.

## Evidence consulted

- `C-CONTRAST-001` r1 (normative) — WCAG 1.4.3 Contrast (Minimum), AA: 4.5:1 text, 3:1 large text
- `C-CONTRAST-004` r1 (normative) — Large-scale text is 18pt (≈24px) or 14pt bold (≈18.66px); 18px body text is not large
- `C-CPL-007` r1 (heuristic) — Phones: keep text size and use the available width
- `C-BASE-002` r1 (heuristic) — Initial exploration ranges: 50–75 CPL, 16–22px, line height 1.4–1.7
- `C-LH-001` r1 (empirical) — Rello, Pielot & Marcos 2016: line spacing did not change fixation duration
- `C-LH-002` r1 (empirical) — Chiu & Drieghe 2023: wider line spacing shortens first fixations but worsens return sweeps
- `C-LH-003` r1 (hypothesis) — 1.5→1.6 (or 1.4→1.6) line height improving comprehension or speed is not established — No reliable quantitative improvement established.
- `C-SIZE-001` r1 (empirical) — Legge & Bigelow 2011: apparent size (x-height angle) governs fluent reading
- `C-FONT-004` r1 (hypothesis) — No universally fastest typeface; named-shortlist superiority not established — No reliable quantitative improvement established.
- `C-WCAG-001` r1 (normative) — WCAG 1.4.12 Text Spacing (AA): tolerate 1.5 / 2 / 0.12 / 0.16 overrides
- `C-WCAG-002` r1 (normative) — WCAG 1.4.10 Reflow (AA): usable at 320 CSS px without two-direction scrolling
- `C-WCAG-003` r1 (normative) — WCAG 1.4.4 Resize Text (AA): up to 200% without assistive technology
- `C-FONT-001` r1 (empirical) — Wallace et al. 2022: the fastest font differs between individuals
- `C-METH-002` r1 (heuristic) — Within-participant, counterbalanced testing with fresh passages and held-out confirmation
