# Readability Lab report

- **Target:** http://localhost:4321/index.html — Exporting data — Fieldnotes Docs (example)
- **Reading region:** `.doc-content` (explicit-selector)
- **Conditions:** chromium 158.0.8127.18, viewport 1280×800 @1x, fonts loaded
- **Tool:** readability-lab-cli 0.1.0, evidence registry 2026.11.0
- **Created:** 2026-11-12T11:25:38.549Z

> Automated checks describe what was tested, not complete accessibility conformance. No readability score is computed.

## Measurements (baseline)

| Metric | Value | Status | Method |
|---|---|---|---|
| layout.cpl | 67 characters (p10 64, p90 69.9, n=22) | measured | rendered-line-rects@1 |
| layout.lineCount | 29 lines | measured | rendered-line-rects@1 |
| layout.columnWidthPx | 576 px | measured | bounding-box@1 |
| layout.contentHeightPx | 1203 px | measured | bounding-box@1 |
| text.fontSizePx | 18 px | measured | computed-style@1 |
| text.lineHeightRatio | 1.5 | derived | computed-style@1 |
| layout.paragraphGapEm | 0.75 em | derived | line-top-gap-minus-pitch@1 |
| text.fontWeight | 400 | measured | computed-style@1 |
| text.align | start | measured | computed-style@1 |
| font.declaredFamily | "Helvetica Neue", Helvetica, Arial, sans-serif | measured | computed-style@1 |
| font.firstAvailableFamily | Helvetica Neue | estimated | width-comparison-and-fontfaceset@1 |

### Contrast samples

| Element | Colors | Ratio | Large text | Status |
|---|---|---|---|---|
| `#doc > h1` | #333333 on #ffffff | 12.63:1 | yes | measured |
| `#doc > p:nth-of-type(1)` | #595959 on #ffffff | 7.00:1 | no | measured |
| `#doc > p:nth-of-type(2)` | #333333 on #ffffff | 12.63:1 | no | measured |
| `#callout > p > strong` | #333333 on #f2f7fd | 11.73:1 | no | measured |
| `#doc > pre > code` | #333333 on #f4f4f4 | 11.49:1 | no | measured |

## Findings

### Experiment idea (2)

- **If you are considering 1.5 vs 1.6 line height, test it** — rule `experiment-line-height`, scenario `baseline`, verification: not-tested
  - Why: Current ratio 1.5 is inside the starting range. For changing 1.5→1.6: No reliable quantitative improvement established. Compare with fresh passages and separate speed, comprehension and comfort.
  - Evidence: `C-LH-003`, `C-METH-002`
- **Compare a short list of text faces at matched apparent size** — rule `experiment-font`, scenario `baseline`, verification: not-tested
  - Why: No typeface is established as universally fastest; individual results vary. For superiority of any named font: No reliable quantitative improvement established.
  - Evidence: `C-FONT-001`, `C-FONT-004`, `C-SIZE-001`, `C-METH-002`

### Pass (5)

- **5 measured text colour pair(s) meet 1.4.3 AA** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: computed-from-rendered-styles
  - Why: Computed from rendered styles for the sampled text in the region. Unresolved samples are reported separately.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **Median 67 characters per line is within 50–75** — rule `cpl-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Why: Measured from rendered line boxes (10th–90th percentile 64–69.9, 22 lines).
  - Evidence: `C-BASE-002`, `C-CPL-001`, `C-CPL-002`, `C-CPL-004`, `C-CPL-005`, `C-CPL-006`, `C-CPL-007`
- **No content loss detected under WCAG 1.4.12 text spacing** — rule `text-spacing`, WCAG 1.4.12 (AA), scenario `text-spacing`, verification: automated-browser-test
  - Why: Checked hidden text, spilled text and horizontal scrolling after applying line-height 1.5, paragraph spacing 2em, letter spacing 0.12em and word spacing 0.16em (document and open shadow roots). Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-001`
- **No content loss detected under 320 CSS px reflow** — rule `reflow`, WCAG 1.4.10 (AA), scenario `reflow-320`, verification: automated-browser-test
  - Why: Checked hidden text, spilled text and horizontal scrolling after rendering at a 320×256 CSS px viewport. Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-002`
- **No content loss detected under 200% zoom (approximation)** — rule `zoom-200`, WCAG 1.4.4 (AA), scenario `zoom-200`, verification: approximation
  - Why: Checked hidden text, spilled text and horizontal scrolling after emulating 200% page zoom as a 640×400 CSS px viewport at 2x; browser text-only zoom is not tested. Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-003`

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

- 4 observation(s) are unknown and were not treated as passing.
- 4 observation(s) are estimates (e.g. font availability).
- Nominal font size is reported; apparent size depends on the font's x-height and viewing distance, which are not measured.

## Evidence consulted

- `C-CONTRAST-001` r1 (normative) — WCAG 1.4.3 Contrast (Minimum), AA: 4.5:1 text, 3:1 large text
- `C-CONTRAST-004` r1 (normative) — Large-scale text is 18pt (≈24px) or 14pt bold (≈18.66px); 18px body text is not large
- `C-BASE-002` r1 (heuristic) — Initial exploration ranges: 50–75 CPL, 16–22px, line height 1.4–1.7
- `C-CPL-001` r1 (empirical) — Shaikh & Chaparro 2005: 95 CPL read fastest in short online-news passages
- `C-CPL-002` r1 (empirical) — Dyson & Haselgrove 2001: better comprehension at 55 than 100 CPL
- `C-CPL-004` r1 (empirical) — Bernard et al.: no reading-time difference across 45, 76 and 132 CPL
- `C-CPL-005` r1 (heuristic) — Baymard 50–75 CPL guidance is an industry heuristic
- `C-CPL-006` r1 (hypothesis) — 80→65 CPL fixed improvement is not established — No reliable quantitative improvement established.
- `C-CPL-007` r1 (heuristic) — Phones: keep text size and use the available width
- `C-LH-003` r1 (hypothesis) — 1.5→1.6 (or 1.4→1.6) line height improving comprehension or speed is not established — No reliable quantitative improvement established.
- `C-METH-002` r1 (heuristic) — Within-participant, counterbalanced testing with fresh passages and held-out confirmation
- `C-WCAG-001` r1 (normative) — WCAG 1.4.12 Text Spacing (AA): tolerate 1.5 / 2 / 0.12 / 0.16 overrides
- `C-WCAG-002` r1 (normative) — WCAG 1.4.10 Reflow (AA): usable at 320 CSS px without two-direction scrolling
- `C-WCAG-003` r1 (normative) — WCAG 1.4.4 Resize Text (AA): up to 200% without assistive technology
- `C-FONT-001` r1 (empirical) — Wallace et al. 2022: the fastest font differs between individuals
- `C-FONT-004` r1 (hypothesis) — No universally fastest typeface; named-shortlist superiority not established — No reliable quantitative improvement established.
- `C-SIZE-001` r1 (empirical) — Legge & Bigelow 2011: apparent size (x-height angle) governs fluent reading

## Artifacts

- screenshot: `screenshots/baseline.png` — Full-page screenshot
- screenshot: `screenshots/text-spacing.png` — Full-page screenshot
- screenshot: `screenshots/reflow-320.png` — Full-page screenshot
- screenshot: `screenshots/zoom-200.png` — Full-page screenshot
