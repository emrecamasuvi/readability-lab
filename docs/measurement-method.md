# Measurement method

Every observation records a `method` id, a `status`, the scenario, and the element. The `status` is one of `measured`, `derived`, `user-reported`, `estimated` or `unknown`. An `unknown` value is never treated as a pass.

## Deferred rendering

Content in `content-visibility: auto` sections is not rendered until it nears the viewport; until then it is sized by its `contain-intrinsic-size` placeholder and is not hit-testable. Every inspection therefore forces such content to render (an injected `content-visibility: visible !important` rule, removed afterwards) so line lengths, clipping and contrast describe the content as readers will see it.

## Pages with a strict Content Security Policy

The CLI and MCP server open pages with Playwright's `bypassCSP`, so the inspector and its measurement-only styles can run on pages that forbid inline scripts and styles or enforce Trusted Types. CSP does not change layout, so measurements are unaffected. The extension runs as a content script and is subject to browser rules for extensions; where a page's policy blocks its styles, the text-spacing scenario reports overrides that did not apply as incomplete rather than passing.

## Reading region

- `--selector` / `selector` is the recommended way to choose the region, and it wins. If it matches nothing, the run is an error: exit code 3, a `measurement.error` observation, and nothing else measured or styled.
- Without a selector, the region is auto-detected from common article containers. Candidates are scored by paragraph text minus link density, and the innermost candidate keeping ≥ 85% of the best score is chosen. The report records `regionMethod` as `explicit-selector`, `auto-detected`, `user-picked` or `whole-document`.

## Rendered line lengths — `rendered-line-rects@1`

**What is measured**
- Prose only: text in block containers inside the region.
- Excluded: headings, `pre`, tables, navigation, buttons, figcaptions, `[aria-hidden=true]`, `[data-rl-ignore]`, hidden subtrees (display, visibility, closed `<details>`, `checkVisibility`) and screen-reader-only text.
- Inline `code`, `kbd`, `em` and links are prose and count.

**How lines are found**
1. Text is split into word segments (`Intl.Segmenter`). Each segment's `getClientRects()` places it.
2. A segment that spans more than one rect (hyphenation, CJK, `overflow-wrap`) is split into grapheme clusters.
3. A new line starts when a glyph box overlaps the previous glyph box vertically by less than half the smaller height. This covers explicit breaks, short lines and new columns.
4. A new line also starts when a glyph is clearly below the previous one *and* has moved back toward the line start, depending on writing direction.

**How characters are counted**
- Characters are grapheme clusters: a combining accent plus its letter counts once, and an emoji ZWJ sequence or a flag counts once. Punctuation counts.
- Whitespace counts once per rendered (non-zero-width) run, so collapsed spaces count as one. Leading and trailing whitespace on a line does not count.
- Inline replaced content (img, svg, math, inputs) adds no characters; such lines are flagged `mixed`.

**What is reported**
- The **last line of each block** is paragraph-final. It is excluded from the CPL distribution and reported separately (`layout.cpl.paragraphFinalLines`).
- The distribution gives count, min, p10, median, mean, p90, max and a 5-character histogram.
- Line widths in px are reported as well.
- Vertical writing modes are not supported and are reported as unknown.

**Verified against ground truth** (`fixtures/ground-truth/`)
- Exact counts for forced lines, combining accents, ZWJ emoji, flags, inline elements, collapsed whitespace, short lines and two-column layouts.
- A 60ch monospace column never exceeds 60.

**A width in `ch` is not CPL.** `ch` is the advance of "0", while average prose characters differ by font and language. Recipes store CPL targets. The browser converts them to `ch` by closed-loop calibration, and the factor is recorded (`calibration.charsPerCh`, browser and viewport).

## Typography

- **Font size and weight:** values from computed style, weighted by measured characters. The font size is the *nominal* size.
- **Line height:** the computed `line-height` ÷ font size, with status `derived`. When it is `normal`, the median top-to-top line pitch is used instead, with status `estimated`.
- **Paragraph gap:** (first-line top of the next paragraph − last-line top of the previous one − that paragraph's line pitch) ÷ its own font size. This captures margins *and* padding.
- **Rendered x-height:** canvas `measureText('x')` in the computed font stack. Apparent size also depends on viewing distance, which is not measured.
- **Font availability:** checked against loaded faces in `document.fonts` and by comparing text widths against two fallbacks. It is always `estimated`.

## Contrast — `computed-colors-ancestor-composite@1`

- **Colors** are normalised to sRGB through a 1×1 canvas, so any CSS color syntax the browser supports works.
- **Background:** ancestor backgrounds are composited, innermost first, until an opaque layer is reached.
  - The result is **unknown** when a background image or gradient sits above that layer, or when an ancestor has opacity < 1, a filter, a backdrop-filter or a blend mode.
  - With no opaque layer, the default canvas is assumed. The result is `estimated` and routed to needs-review.
- **Painted layers** are hit-tested at points inside the text's line boxes, with every element temporarily made hit-testable.
  - Off-screen text is scrolled into view; only this window scrolls, never the parent frames.
  - Any non-ancestor painting behind the text, or any non-descendant painting over it, makes the result **unknown**.
- Ratios use the WCAG 2.x formula and are compared **unrounded**: 4.499:1 fails.
- Large text means ≥ 24px, or ≥ 18.66px at weight ≥ 700.
- Passing samples with identical conditions are grouped. Failing and unresolved samples are kept per element, so exceptions apply to exactly the elements they name.
- **Not covered:** text-shadow, which is noted but not modelled; anti-aliasing; display luminance; APCA. WCAG 3 is a Working Draft and its contrast method is undecided (see C-APCA-001).

## Clipping, spacing, reflow

- **Clipping:** text hidden by an element's own box (`overflow: hidden/clip`, ellipsis, line clamp) is counted as characters whose rects fall mostly outside the padding box.
  - Overflowing images are not text loss.
  - Screen-reader-only text is skipped.
  - Open shadow roots are traversed.
- **Text spacing (WCAG 1.4.12, real browser):**
  - The W3C override values are injected into the document and every open shadow root, with id-level specificity.
  - The tool then verifies, *per text-holding element*, that each override took effect. Elements where an override did not apply (for example inline `!important`) make the result incomplete, never a pass. Frames and closed shadow roots are counted as unverifiable.
  - An element whose hidden characters increase compared with baseline counts as content loss and is an accessibility failure. Text spilling out of fixed-size boxes needs review.
- **Reflow (WCAG 1.4.10, real browser, 320×256 CSS px):**
  - Culprits are elements whose box *or own text* extends past the viewport and that are not inside their own scroll container.
  - Tables, code, images and similar content are flagged as possible two-dimensional exceptions and need review.
  - Prose that scrolls inside its own container needs review.
  - Unattributed page overflow needs review.
  - Text hidden at 320px compared with baseline is a failure.
- **200% zoom:** this is an *approximation* (half-width viewport at double device scale), so all its findings are needs-review. Text-only zoom is not tested.

## What is never inferred

The tool never infers viewing distance or visual angle, display luminance, ambient light, glare, or a reader's visual needs (C-UNKNOWN-001). It never computes reading speed, comprehension, comfort or a "readability score".
