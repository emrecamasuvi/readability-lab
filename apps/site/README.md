# Project website

`index.html` is a single self-contained page: inline CSS and JS, system fonts, no external requests. `pnpm build` (or `pnpm -C apps/site build`) writes a minified `dist/` with the responsive WebP/JPEG screenshots and a `_headers` file for long-lived asset caching and a strict CSP. `pnpm start` at the repo root serves it at http://localhost:4330 next to the workbench and demos (caching off, so a rebuild shows on reload). To preview with gzip and production cache headers:

```sh
pnpm -C apps/site build
node scripts/serve.mjs apps/site/dist 4330
```

Lighthouse 12 (2026-11-12, mobile and desktop) scores 100 in performance, accessibility, best practices and SEO. On mobile, LCP is 0.8 s, CLS is 0 and the initial transfer is 17 KiB; images load lazily. The palette is documented in `docs/palette.md`.

It dogfoods the toolkit:
- **Draggable column:** the hero column is resizable, and each rendered line's character count is charted in the margin against the 50–75 band.
- **X-ray (button; Esc closes):** outlines every rendered line on the page with its character count and badges each block's WCAG contrast. This is a simplified in-page version of the inspector.
- **Stress test (button):** applies the WCAG 1.4.12 spacing overrides page-wide and reports any container that cuts off text.
- **Before/after wipe:** real screenshots of a live article (tip.org.tr) before and after a recipe, from `examples/real-page` (`assets/tip-*`). Drag anywhere on the image, or use the range input.
- **Self-check:** the page passes `rlab check` at desktop, tablet and phone with no accessibility failures and no needs-review items. Body text meets the 7:1 target.

To re-check after edits:

```sh
node packages/cli/bin/rlab.mjs check apps/site/index.html --selector main --scenarios all --out reports/site
```

Numbers shown on the page (real-page deltas, test counts, registry counts) come from `examples/real-page/` and `docs/SUPPORT.md`. Update them together.

Accessibility notes:
- Column width uses a native range input; the drag handle is a pointer shortcut for the same value.
- There are no single-character keyboard shortcuts (WCAG 2.1.4).
- Supports forced-colors (Windows High Contrast) and `prefers-contrast: more`.
- Respects reduced motion.
- Below-the-fold sections use `content-visibility: auto` with remembered sizes.
