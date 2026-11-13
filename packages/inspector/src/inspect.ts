import { METRICS, relativeLuminance, summarize, type ElementRef, type Observation } from "@emrecamasuvi/readability-lab-core";
import { box, selectorFor, textSample } from "./dom.js";
import { CONTRAST_METHOD, normalizeColor, sampleContrast } from "./contrast.js";
import { FONT_METHOD, firstAvailable } from "./fonts.js";
import { LINE_METHOD, linePitch, measureLines } from "./lines.js";
import { applyTextSpacing, findClipping, findHorizontalOverflow, OVERFLOW_METHOD, verifyTextSpacing } from "./overflow.js";
import { findRegion, type RegionResult } from "./region.js";

export interface InspectOptions {
  selector?: string | null;
  /** Use an already chosen element (extension picker, or a region resolved by the caller). */
  element?: Element | null;
  /** How `element` was chosen; defaults to "user-picked". */
  regionMethod?: RegionResult["method"];
  scenarioId?: string;
  /** Omit text samples from element references. */
  privacy?: boolean;
  maxChars?: number;
  /** Whether to check page-level horizontal overflow (reflow). */
  pageOverflow?: boolean;
  /** Exception selectors from policy/recipe; matches are recorded on element refs. */
  exceptionSelectors?: string[];
}

/** FNV-1a 32-bit hash of normalized text: a layout-independent content fingerprint. */
export function fingerprint(text: string): string {
  const norm = text.normalize("NFC").replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a32:${h.toString(16).padStart(8, "0")}:${norm.length}`;
}

export interface InspectResult {
  region: { selector: string; method: RegionResult["method"]; candidates: RegionResult["candidates"]; error: string | null };
  observations: Observation[];
  page: { url: string; title: string; viewport: { width: number; height: number; deviceScaleFactor: number }; fontsStatus: string; userAgent: string; readyState: string };
  timingMs: number;
}

/** Inspect the current document. Runs entirely in the page; sends nothing anywhere. */
/**
 * Deferred-rendering content (content-visibility: auto/hidden-matchable skipped subtrees) is
 * measured as it renders, not as its size-contained placeholder: rendering is forced for the
 * duration of an inspection and restored afterwards.
 */
export function inspect(opts: InspectOptions = {}): InspectResult {
  const force = document.createElement("style");
  force.setAttribute("data-readability-lab", "render-all");
  force.textContent = "*, *::before, *::after { content-visibility: visible !important; }";
  (document.head ?? document.documentElement).appendChild(force);
  try {
    return inspectRendered(opts);
  } finally {
    force.remove();
  }
}

function inspectRendered(opts: InspectOptions): InspectResult {
  const t0 = performance.now();
  const scenarioId = opts.scenarioId ?? "baseline";
  const privacy = !!opts.privacy;
  const region: RegionResult = opts.element
    ? { element: opts.element, selector: opts.selector ?? selectorFor(opts.element), method: opts.regionMethod ?? "user-picked", candidates: [] }
    : findRegion(document, opts.selector);
  const obs: Observation[] = [];
  let n = 0;
  const exSel = opts.exceptionSelectors ?? [];
  const matched = (el: Element) =>
    exSel.filter((sel) => {
      try {
        return !!el.closest(sel);
      } catch {
        return false;
      }
    });
  const ref = (el: Element | null | undefined): ElementRef | null => (el ? { selector: selectorFor(el), box: box(el), textSample: textSample(el, privacy), matchedSelectors: matched(el) } : null);
  const add = (o: Partial<Observation> & Pick<Observation, "metric" | "value" | "status" | "method">) => {
    const full: Observation = {
      id: `${scenarioId}:${o.metric}:${++n}`,
      unit: null,
      scenarioId,
      element: null,
      distribution: null,
      unknownReason: null,
      details: {},
      ...o,
    };
    obs.push(full);
    return full;
  };

  const r = region.element;
  const pageInfo = () => ({
    url: location.href,
    title: document.title,
    viewport: { width: document.documentElement.clientWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
    fontsStatus: document.fonts?.status ?? "unknown",
    userAgent: navigator.userAgent,
    readyState: document.readyState,
  });
  if (region.error) {
    // Never silently measure something else when the requested region is missing.
    add({ metric: METRICS.measurementError, value: null, status: "unknown", method: "region-selection@1", unknownReason: region.error });
    return { region: { selector: region.selector, method: region.method, candidates: region.candidates, error: region.error }, observations: obs, page: pageInfo(), timingMs: Math.round(performance.now() - t0) };
  }

  // ---- Lines ----
  let lm: ReturnType<typeof measureLines> | null = null;
  try {
    lm = measureLines(r, { maxChars: opts.maxChars });
  } catch (e) {
    add({ metric: METRICS.measurementError, value: null, status: "unknown", method: LINE_METHOD, unknownReason: `Line measurement failed: ${(e as Error).message}` });
  }
  if (lm) {
    const full = lm.lines.filter((l) => !l.final);
    const cplValues = full.map((l) => l.chars);
    const dist = summarize(cplValues, 5);
    add({
      metric: METRICS.cpl,
      value: dist.median,
      unit: "characters",
      status: dist.count ? "measured" : "unknown",
      method: LINE_METHOD,
      element: ref(r),
      distribution: dist,
      unknownReason: dist.count ? null : lm.writingModeUnsupported ? "Vertical writing modes are not supported." : "No non-final prose lines found in the region (paragraphs may all be single lines).",
      details: { linesMeasured: full.length, mixedLines: full.filter((l) => l.mixed).length, truncated: lm.truncated, segmenter: lm.segmenter, blocks: lm.blocks.length },
    });
    add({ metric: METRICS.finalLines, value: lm.lines.length - full.length, unit: "lines", status: "measured", method: LINE_METHOD, details: { excludedFromDistribution: true } });
    add({ metric: METRICS.lineCount, value: lm.lines.length, unit: "lines", status: lm.truncated ? "estimated" : "measured", method: LINE_METHOD, details: { truncated: lm.truncated } });
    add({ metric: "region.characterCount", value: lm.characters, unit: "characters", status: "measured", method: LINE_METHOD });
    add({ metric: METRICS.contentFingerprint, value: fingerprint(lm.text), status: "measured", method: "fnv1a32-normalized-text@1", details: { note: "Hash of whitespace-normalized NFC prose text; layout independent." } });
    const scripts = Object.entries(lm.scripts).sort((a, b) => b[1] - a[1]);
    const totalLetters = scripts.reduce((s2, [, c]) => s2 + c, 0);
    const dominantScript = scripts[0]?.[0] ?? null;
    add({ metric: METRICS.script, value: dominantScript, status: dominantScript ? "measured" : "unknown", method: "unicode-script-tally@1", unknownReason: dominantScript ? null : "No letters found.", details: { tally: lm.scripts, share: dominantScript && totalLetters ? Math.round((scripts[0]![1] / totalLetters) * 100) / 100 : null, lang: (r.closest("[lang]")?.getAttribute("lang") ?? document.documentElement.lang) || null, direction: getComputedStyle(r).direction } });
    const widths = summarize(full.map((l) => l.widthPx), 50);
    add({ metric: METRICS.lineWidthPx, value: widths.median, unit: "px", status: widths.count ? "measured" : "unknown", method: LINE_METHOD, distribution: widths, unknownReason: widths.count ? null : "No full lines." });
    const pitch = linePitch(lm.lines);
    add({ metric: METRICS.linePitchPx, value: pitch, unit: "px", status: pitch === null ? "unknown" : "measured", method: LINE_METHOD, unknownReason: pitch === null ? "No consecutive lines in one block." : null });

    // ---- Dominant typography (weighted by measured characters) ----
    const weight = new Map<Element, number>();
    for (const l of lm.lines) {
      const b = lm.blocks[l.block]!;
      weight.set(b, (weight.get(b) ?? 0) + l.chars);
    }
    const dominant = <T,>(f: (cs: CSSStyleDeclaration) => T): { value: T; el: Element } | null => {
      const tally = new Map<string, { v: T; w: number; el: Element }>();
      for (const [el, w] of weight) {
        const v = f(getComputedStyle(el));
        const k = JSON.stringify(v);
        const t = tally.get(k);
        if (t) t.w += w;
        else tally.set(k, { v, w, el });
      }
      const best = [...tally.values()].sort((a, b) => b.w - a.w)[0];
      return best ? { value: best.v, el: best.el } : null;
    };
    const fs = dominant((cs) => parseFloat(cs.fontSize));
    if (fs) {
      add({ metric: METRICS.fontSizePx, value: fs.value, unit: "px", status: "measured", method: "computed-style@1", element: ref(fs.el), details: { note: "Nominal computed font-size; apparent size is not measured." } });
      const lhCss = dominant((cs) => cs.lineHeight);
      const lhPx = lhCss && lhCss.value !== "normal" ? parseFloat(lhCss.value as string) : null;
      if (lhPx !== null) {
        add({ metric: METRICS.lineHeightRatio, value: Math.round((lhPx / fs.value) * 1000) / 1000, unit: "ratio", status: "derived", method: "computed-style@1", element: ref(lhCss!.el), details: { computedLineHeight: lhCss!.value, measuredLinePitchPx: pitch } });
      } else if (pitch !== null) {
        add({ metric: METRICS.lineHeightRatio, value: Math.round((pitch / fs.value) * 1000) / 1000, unit: "ratio", status: "estimated", method: `${LINE_METHOD}+computed-style`, element: ref(fs.el), details: { computedLineHeight: "normal", note: "Estimated from glyph-box line pitch because line-height is 'normal'; inline font metrics can shift it." } });
      } else {
        add({ metric: METRICS.lineHeightRatio, value: null, unit: "ratio", status: "unknown", method: "computed-style@1", unknownReason: "line-height is 'normal' and no multi-line paragraph was available to measure line pitch." });
      }
      const fw = dominant((cs) => parseInt(cs.fontWeight, 10) || 400);
      if (fw) add({ metric: METRICS.fontWeight, value: fw.value, status: "measured", method: "computed-style@1" });
      const ls = dominant((cs) => (cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)));
      if (ls) add({ metric: METRICS.letterSpacingEm, value: Math.round(ls.value * 1000) / 1000, unit: "em", status: "derived", method: "computed-style@1" });
      const ws = dominant((cs) => (cs.wordSpacing === "normal" || cs.wordSpacing === "0px" ? 0 : parseFloat(cs.wordSpacing) / parseFloat(cs.fontSize)));
      if (ws) add({ metric: METRICS.wordSpacingEm, value: Math.round(ws.value * 1000) / 1000, unit: "em", status: "derived", method: "computed-style@1" });
      const ta = dominant((cs) => (cs.textAlign === "left" || cs.textAlign === "right" || cs.textAlign === "start" || cs.textAlign === "end" ? "start" : cs.textAlign));
      if (ta) add({ metric: METRICS.textAlign, value: ta.value, status: "measured", method: "computed-style@1", element: ref(ta.el), details: { note: "left/right/start/end are reported as start" } });
      const ff = dominant((cs) => cs.fontFamily);
      if (ff) {
        add({ metric: METRICS.fontDeclared, value: ff.value, status: "measured", method: "computed-style@1" });
        const avail = firstAvailable(ff.value);
        const xh = xHeightRatio(ff.value);
        add({ metric: METRICS.xHeightPx, value: xh === null ? null : Math.round(xh * fs.value * 100) / 100, unit: "px", status: xh === null ? "unknown" : "measured", method: "canvas-text-metrics@1", unknownReason: xh === null ? "Canvas text metrics unavailable." : null, details: { xHeightRatio: xh, note: "Rendered lowercase x height at the nominal size. Apparent size also depends on viewing distance, which is not measured." } });
        add({ metric: METRICS.fontRendered, value: avail.family, status: avail.family ? "estimated" : "unknown", method: FONT_METHOD, unknownReason: avail.family ? null : "No family in the stack could be confirmed.", details: { firstDeclaredAvailable: avail.firstDeclaredAvailable, checked: avail.checked, fontsStatus: document.fonts?.status ?? null } });
      }
      // Paragraph gap: extra separation between adjacent paragraphs, from rendered lines:
      // (first line top of next − last line top of previous) − that paragraph's line pitch,
      // normalized by the previous paragraph's own font size.
      const gaps: number[] = [];
      for (let i = 0; i + 1 < lm.blocks.length; i++) {
        const a = lm.blocks[i]!;
        const b = lm.blocks[i + 1]!;
        if (a.tagName !== "P" || b.tagName !== "P" || a.nextElementSibling !== b) continue;
        const la = lm.lines.filter((l) => l.block === i);
        const lb = lm.lines.filter((l) => l.block === i + 1);
        if (!la.length || !lb.length) continue;
        const acs = getComputedStyle(a);
        const afs = parseFloat(acs.fontSize);
        const pitchA = acs.lineHeight !== "normal" ? parseFloat(acs.lineHeight) : la.length > 1 ? la[1]!.top - la[0]!.top : null;
        if (pitchA === null) continue;
        gaps.push((lb[0]!.top - la[la.length - 1]!.top - pitchA) / afs);
      }
      if (gaps.length) {
        gaps.sort((x, y) => x - y);
        const g = gaps[Math.floor(gaps.length / 2)]!;
        add({ metric: METRICS.paragraphGapEm, value: Math.round(g * 100) / 100, unit: "em", status: "derived", method: "line-top-gap-minus-pitch@1", details: { pairs: gaps.length } });
      }
    }
  }

  // ---- Region geometry ----
  const rb = r.getBoundingClientRect();
  const rcs = getComputedStyle(r);
  const contentW = rb.width - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight) - parseFloat(rcs.borderLeftWidth) - parseFloat(rcs.borderRightWidth);
  add({ metric: METRICS.columnWidthPx, value: Math.round(contentW), unit: "px", status: "measured", method: "bounding-box@1", element: ref(r), details: { maxWidth: rcs.maxWidth } });
  add({ metric: METRICS.contentHeightPx, value: Math.round(rb.height), unit: "px", status: "measured", method: "bounding-box@1", element: ref(r) });

  // ---- Contrast ----
  try {
    const { samples, hiddenSkipped } = sampleContrast(r);
    for (const s of samples) {
      add({
        metric: METRICS.contrastSample,
        value: s.ratio, // raw, unrounded: WCAG thresholds must not be met by rounding
        unit: "ratio",
        status: s.status,
        method: CONTRAST_METHOD,
        element: ref(s.element),
        unknownReason: s.reason,
        details: { fg: s.fg, bg: s.bg, large: s.large, fontSizePx: s.fontSizePx, fontWeight: s.fontWeight, elementCount: s.elementCount, otherSelectors: s.selectors.slice(1).map(selectorFor), notes: s.notes },
      });
    }
    if (hiddenSkipped) add({ metric: "contrast.visuallyHiddenSkipped", value: hiddenSkipped, status: "measured", method: CONTRAST_METHOD });
    const bg = normalizeColor(rcs.backgroundColor);
    const fg = normalizeColor(rcs.color);
    if (fg && bg && bg.a > 0.99) add({ metric: METRICS.themePolarity, value: relativeLuminance(bg) < relativeLuminance(fg) ? "dark" : "light", status: "measured", method: "computed-style@1" });
  } catch (e) {
    add({ metric: METRICS.measurementError, value: null, status: "unknown", method: CONTRAST_METHOD, unknownReason: `Contrast sampling failed: ${(e as Error).message}` });
  }

  // ---- Clipping ----
  const { clipped, spilling } = findClipping(r);
  for (const c of clipped) add({ metric: METRICS.clipped, value: c.hiddenChars, unit: "characters", status: "measured", method: OVERFLOW_METHOD, element: ref(c.element), details: { mechanism: c.mechanism, axis: c.axis, hiddenPx: c.hiddenPx, totalChars: c.totalChars } });
  for (const sp of spilling) add({ metric: METRICS.overflowingBox, value: sp.spilledChars, unit: "characters", status: "measured", method: OVERFLOW_METHOD, element: ref(sp.element), details: { spillPx: sp.spillPx } });

  // ---- Page horizontal overflow ----
  if (opts.pageOverflow !== false) {
    const ho = findHorizontalOverflow(document);
    add({ metric: METRICS.pageHorizontalOverflow, value: ho.pageOverflow, status: "measured", method: OVERFLOW_METHOD, details: { scrollWidth: ho.scrollWidth, viewportWidth: ho.viewportWidth } });
    for (const e of ho.elements) add({ metric: METRICS.horizontalOverflowElement, value: e.overflowPx, unit: "px", status: "measured", method: OVERFLOW_METHOD, element: ref(e.element), details: { overflowPx: e.overflowPx, possibleException: e.possibleException, cause: e.cause } });
    for (const e of ho.scrollingProse) add({ metric: METRICS.scrollingProse, value: e.overflowPx, unit: "px", status: "measured", method: OVERFLOW_METHOD, element: ref(e.element) });
    if (ho.unattributed) add({ metric: METRICS.horizontalOverflowUnattributed, value: null, status: "unknown", method: OVERFLOW_METHOD, unknownReason: `Page is ${ho.scrollWidth}px wide in a ${ho.viewportWidth}px viewport but no single element could be attributed.` });
  }

  // ---- Unsupported content ----
  for (const c of Array.from(r.querySelectorAll("canvas"))) {
    const b = c.getBoundingClientRect();
    if (b.width * b.height > 2000) add({ metric: METRICS.canvas, value: null, status: "unknown", method: "dom-scan@1", element: ref(c), unknownReason: "Text drawn on canvas has no DOM text to measure." });
  }
  for (const f of Array.from(r.querySelectorAll("iframe, frame"))) {
    let reason = "Cross-origin frame: its document is not accessible from the page.";
    try {
      if ((f as HTMLIFrameElement).contentDocument) reason = "Same-origin frame: inspect its URL separately; frame content is not part of this region's measurements.";
    } catch {
      /* cross-origin */
    }
    add({ metric: METRICS.frame, value: null, status: "unknown", method: "dom-scan@1", element: ref(f), unknownReason: reason });
  }
  for (const el of Array.from(r.querySelectorAll("*"))) {
    if (!el.tagName.includes("-") || (el as HTMLElement).shadowRoot || el.childNodes.length) continue;
    const b = el.getBoundingClientRect();
    if (b.width * b.height > 400 && customElements.get(el.tagName.toLowerCase()))
      add({ metric: METRICS.closedShadow, value: null, status: "unknown", method: "dom-scan@1", element: ref(el), unknownReason: "Rendered custom element with no light DOM and no open shadow root: likely a closed shadow root that cannot be inspected." });
  }

  // ---- Reading controls ----
  const ctl = document.querySelector("rl-reading-controls, [data-reading-controls]");
  add({ metric: METRICS.readingControls, value: ctl ? true : null, status: ctl ? "measured" : "unknown", method: "dom-scan@1", element: ref(ctl), unknownReason: ctl ? null : "Reader-adjustment controls other than Readability Lab markers are not automatically detectable." });

  add({ metric: METRICS.scenarioCompleted, value: true, status: "measured", method: "inspector@1", details: { timingMs: Math.round(performance.now() - t0) } });
  return {
    region: { selector: region.selector, method: region.method, candidates: region.candidates, error: region.error ?? null },
    observations: obs,
    page: {
      url: location.href,
      title: document.title,
      viewport: { width: document.documentElement.clientWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      fontsStatus: document.fonts?.status ?? "unknown",
      userAgent: navigator.userAgent,
      readyState: document.readyState,
    },
    timingMs: Math.round(performance.now() - t0),
  };
}

function xHeightRatio(fontFamily: string): number | null {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.font = `100px ${fontFamily}`;
    const m = ctx.measureText("x");
    if (!m.actualBoundingBoxAscent) return null;
    return Math.round((m.actualBoundingBoxAscent / 100) * 1000) / 1000;
  } catch {
    return null;
  }
}

/**
 * Real-browser WCAG 1.4.12 scenario in the current page: apply overrides (document and
 * open shadow roots), verify they took effect per element, measure, then undo.
 */
export function inspectWithTextSpacing(opts: InspectOptions = {}): InspectResult {
  const scenarioId = opts.scenarioId ?? "text-spacing";
  const { undo, shadowRootsPatched } = applyTextSpacing(document);
  try {
    const region = opts.element ?? (opts.selector ? document.querySelector(opts.selector) : null) ?? document.body;
    const v = verifyTextSpacing(region);
    const res = inspect({ ...opts, scenarioId, pageOverflow: false });
    const id = `${scenarioId}:${METRICS.overrideCoverage}:0`;
    res.observations.push({
      id,
      metric: METRICS.overrideCoverage,
      value: v.checked === 0 ? null : v.notApplied.length,
      unit: "elements",
      status: v.checked === 0 ? "unknown" : "measured",
      method: "computed-style-verification@1",
      scenarioId,
      element: null,
      distribution: null,
      unknownReason: null,
      details: { checked: v.checked, unverifiable: v.unverifiable, shadowRootsPatched, examples: v.notApplied.slice(0, 5).map((x) => ({ selector: selectorFor(x.element), property: x.property, expected: x.expected, actual: x.actual })) },
    });
    return res;
  } finally {
    undo();
  }
}
