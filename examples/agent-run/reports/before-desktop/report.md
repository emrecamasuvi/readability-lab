# Readability Lab report

- **Target:** http://localhost:4321/index.html — Exporting data — Fieldnotes Docs (example)
- **Reading region:** `.doc-content` (explicit-selector)
- **Conditions:** chromium 158.0.8127.18, viewport 1280×800 @1x, fonts loaded
- **Tool:** readability-lab-cli 0.1.0, evidence registry 2026.11.0
- **Created:** 2026-11-12T11:25:29.166Z

> Automated checks describe what was tested, not complete accessibility conformance. No readability score is computed.

## Measurements (baseline)

| Metric | Value | Status | Method |
|---|---|---|---|
| layout.cpl | 135 characters (p10 129, p90 137.1, n=10) | measured | rendered-line-rects@1 |
| layout.lineCount | 17 lines | measured | rendered-line-rects@1 |
| layout.columnWidthPx | 931 px | measured | bounding-box@1 |
| layout.contentHeightPx | 668 px | measured | bounding-box@1 |
| text.fontSizePx | 15 px | measured | computed-style@1 |
| text.lineHeightRatio | 1.3 | derived | computed-style@1 |
| layout.paragraphGapEm | 0.27 em | derived | line-top-gap-minus-pitch@1 |
| text.fontWeight | 400 | measured | computed-style@1 |
| text.align | start | measured | computed-style@1 |
| font.declaredFamily | "Helvetica Neue", Helvetica, Arial, sans-serif | measured | computed-style@1 |
| font.firstAvailableFamily | Helvetica Neue | estimated | width-comparison-and-fontfaceset@1 |

### Contrast samples

| Element | Colors | Ratio | Large text | Status |
|---|---|---|---|---|
| `#doc > p:nth-of-type(1)` | #8c8c8c on #ffffff | 3.36:1 | no | measured |
| `#doc > p:nth-of-type(5)` | #8c8c8c on #ffffff | 3.36:1 | no | measured |
| `#doc > h1` | #333333 on #ffffff | 12.63:1 | yes | measured |
| `#doc > p:nth-of-type(2)` | #333333 on #ffffff | 12.63:1 | no | measured |
| `#callout > p > strong` | #333333 on #f2f7fd | 11.73:1 | no | measured |
| `#doc > pre > code` | #333333 on #f4f4f4 | 11.49:1 | no | measured |

## Findings

### Accessibility failure (check performed) (3)

- **Contrast 3.36:1 is below 4.5:1** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#doc > p:nth-of-type(1)`
  - Why: #8c8c8c on #ffffff measures 3.36:1 for ordinary text (4.5:1 AA). Affects 1 element(s).
  - Suggested action: Darken the text or lighten the background to reach at least 4.5:1; the baseline target is 7:1.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **Contrast 3.36:1 is below 4.5:1** — rule `contrast-aa`, WCAG 1.4.3 (AA), scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#doc > p:nth-of-type(5)`
  - Why: #8c8c8c on #ffffff measures 3.36:1 for ordinary text (4.5:1 AA). Affects 1 element(s).
  - Suggested action: Darken the text or lighten the background to reach at least 4.5:1; the baseline target is 7:1.
  - Evidence: `C-CONTRAST-001`, `C-CONTRAST-004`
- **About 28 more characters become hidden under 320 CSS px reflow** — rule `reflow`, WCAG 1.4.10 (AA), scenario `reflow-320`, verification: automated-browser-test
  - Region: `#callout`
  - Why: 0 characters hidden at baseline, 28 after rendering at a 320×256 CSS px viewport. Text is lost in a real browser test.
  - Suggested action: Avoid fixed heights and overflow: hidden on text containers; let boxes grow with their content.
  - Evidence: `C-WCAG-002`

### Needs review (2)

- **Element needs horizontal scrolling (possible 2D-content exception)** — rule `reflow`, WCAG 1.4.10 (AA), scenario `reflow-320`, verification: automated-browser-test
  - Region: `#doc > pre > code`
  - Why: Tables, code, images and similar content may legitimately need two-dimensional layout under WCAG 1.4.10. Confirm this element qualifies; prose around it must still reflow.
  - Suggested action: Wrap the element in a container with overflow-x: auto so only it scrolls.
  - Evidence: `C-WCAG-002`
- **Element needs horizontal scrolling (possible 2D-content exception)** — rule `zoom-200`, WCAG 1.4.4 (AA), scenario `zoom-200`, verification: approximation
  - Region: `#doc > pre > code`
  - Why: Tables, code, images and similar content may legitimately need two-dimensional layout under WCAG 1.4.10. Confirm this element qualifies; prose around it must still reflow.
  - Suggested action: Wrap the element in a container with overflow-x: auto so only it scrolls.
  - Evidence: `C-WCAG-003`

### Heuristic deviation (not a WCAG failure) (4)

- **Median 135 characters per line is outside 50–75** — rule `cpl-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#doc`
  - Why: Measured from rendered line boxes (10th–90th percentile 129–137.1, 10 lines). 50–75 is a starting range, not an accessibility limit or proven optimum. For a fixed improvement from changing line length: No reliable quantitative improvement established.
  - Suggested action: Consider constraining the column (max-width) so typical lines fall near 60–70 characters, and verify the rendered result.
  - Evidence: `C-BASE-002`, `C-CPL-001`, `C-CPL-002`, `C-CPL-004`, `C-CPL-005`, `C-CPL-006`, `C-CPL-007`
- **Body text is 15px, below 16px** — rule `font-size-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#doc > p:nth-of-type(1)`
  - Why: Nominal size from computed styles. Apparent size also depends on the font's x-height and viewing distance, which this tool does not measure. For a transferable gain from a specific size change: No reliable quantitative improvement established.
  - Suggested action: Consider 18px for long-form body text, and make sure enlargement remains available.
  - Evidence: `C-BASE-002`, `C-SIZE-001`, `C-SIZE-002`
- **Line height 1.3 is outside 1.4–1.7** — rule `line-height-range`, scenario `baseline`, verification: computed-from-rendered-styles
  - Region: `#doc > p:nth-of-type(1)`
  - Why: Ratio of measured baseline distance to font size. This is a starting range, not a requirement. No reliable quantitative improvement established.
  - Suggested action: Consider 1.5 as a conservative starting point.
  - Evidence: `C-BASE-002`, `C-LH-001`, `C-LH-002`, `C-LH-003`
- **Paragraph gap is 0.27× text size** — rule `paragraph-gap`, scenario `baseline`, verification: computed-from-rendered-styles
  - Why: The extra gap between paragraphs is outside the heuristic 0.5–1× range (values up to 2× are tolerated before reporting). A heuristic only.
  - Suggested action: About 0.75× text size separates ideas without fragmenting them.
  - Evidence: `C-PARA-001`

### Experiment idea (1)

- **Compare a short list of text faces at matched apparent size** — rule `experiment-font`, scenario `baseline`, verification: not-tested
  - Why: No typeface is established as universally fastest; individual results vary. For superiority of any named font: No reliable quantitative improvement established.
  - Evidence: `C-FONT-001`, `C-FONT-004`, `C-SIZE-001`, `C-METH-002`

### Pass (1)

- **No content loss detected under WCAG 1.4.12 text spacing** — rule `text-spacing`, WCAG 1.4.12 (AA), scenario `text-spacing`, verification: automated-browser-test
  - Why: Checked hidden text, spilled text and horizontal scrolling after applying line-height 1.5, paragraph spacing 2em, letter spacing 0.12em and word spacing 0.16em (document and open shadow roots). Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.
  - Evidence: `C-WCAG-001`

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
- `C-SIZE-001` r1 (empirical) — Legge & Bigelow 2011: apparent size (x-height angle) governs fluent reading
- `C-SIZE-002` r1 (hypothesis) — 16→18px or 18→20px transferable gain is not established — No reliable quantitative improvement established.
- `C-LH-001` r1 (empirical) — Rello, Pielot & Marcos 2016: line spacing did not change fixation duration
- `C-LH-002` r1 (empirical) — Chiu & Drieghe 2023: wider line spacing shortens first fixations but worsens return sweeps
- `C-LH-003` r1 (hypothesis) — 1.5→1.6 (or 1.4→1.6) line height improving comprehension or speed is not established — No reliable quantitative improvement established.
- `C-PARA-001` r1 (heuristic) — Extra paragraph gap of about 0.75 × body size (range 0.5–1.0)
- `C-WCAG-001` r1 (normative) — WCAG 1.4.12 Text Spacing (AA): tolerate 1.5 / 2 / 0.12 / 0.16 overrides
- `C-WCAG-002` r1 (normative) — WCAG 1.4.10 Reflow (AA): usable at 320 CSS px without two-direction scrolling
- `C-WCAG-003` r1 (normative) — WCAG 1.4.4 Resize Text (AA): up to 200% without assistive technology
- `C-FONT-001` r1 (empirical) — Wallace et al. 2022: the fastest font differs between individuals
- `C-FONT-004` r1 (hypothesis) — No universally fastest typeface; named-shortlist superiority not established — No reliable quantitative improvement established.
- `C-METH-002` r1 (heuristic) — Within-participant, counterbalanced testing with fresh passages and held-out confirmation

## Artifacts

- screenshot: `screenshots/baseline.png` — Full-page screenshot
- screenshot: `screenshots/text-spacing.png` — Full-page screenshot
- screenshot: `screenshots/reflow-320.png` — Full-page screenshot
- screenshot: `screenshots/zoom-200.png` — Full-page screenshot
