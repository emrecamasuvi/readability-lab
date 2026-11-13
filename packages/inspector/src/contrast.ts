import { composite, contrastRatio, isLargeText, toHex, type Rgba } from "@emrecamasuvi/readability-lab-core";
import { isHiddenInTree, isRendered, isVisuallyHidden, textNodes } from "./dom.js";

export const CONTRAST_METHOD = "computed-colors-ancestor-composite@1";

let ctx: CanvasRenderingContext2D | null = null;

/** Normalise any CSS color the engine supports to sRGB 8-bit via a 1×1 canvas. */
export function normalizeColor(css: string): Rgba | null {
  if (!ctx) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    ctx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return { r: d[0]!, g: d[1]!, b: d[2]!, a: d[3]! / 255 };
}

export interface BackgroundResult {
  color: Rgba | null;
  status: "measured" | "estimated" | "unknown";
  reason: string | null;
  notes: string[];
}

/**
 * Resolve the effective background behind an element by compositing ancestor background
 * colors (innermost first) until an opaque layer is found. Every ancestor is still checked
 * for effects (opacity, filters, blending) that change the rendered result, and any
 * background image above the opaque layer makes the result unknown.
 */
export function resolveBackground(el: Element): BackgroundResult {
  const layers: Rgba[] = [];
  const notes: string[] = [];
  let opaqueFound = false;
  let cur: Element | null = el;
  while (cur) {
    const cs = getComputedStyle(cur);
    const tag = cur.tagName.toLowerCase();
    if (cs.filter !== "none" || (cs.backdropFilter && cs.backdropFilter !== "none")) return { color: null, status: "unknown", reason: `CSS filter on ${tag} changes rendered colors`, notes };
    if (cs.mixBlendMode !== "normal") return { color: null, status: "unknown", reason: `mix-blend-mode: ${cs.mixBlendMode} on ${tag}`, notes };
    if (parseFloat(cs.opacity) < 1) return { color: null, status: "unknown", reason: `opacity ${cs.opacity} on ${tag} blends text with content behind it`, notes };
    if (!opaqueFound) {
      // A background image paints above the same element's background color.
      if (cs.backgroundImage && cs.backgroundImage !== "none") return { color: null, status: "unknown", reason: `background image or gradient on ${tag}`, notes };
      const bg = normalizeColor(cs.backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      if (bg && bg.a >= 0.999) opaqueFound = true;
    }
    cur = cur.parentElement ?? (((cur.getRootNode() as ShadowRoot).host as Element | undefined) ?? null);
  }
  let status: BackgroundResult["status"] = "measured";
  let base: Rgba;
  if (!opaqueFound) {
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    const dark = /dark/.test(scheme) && matchMedia("(prefers-color-scheme: dark)").matches;
    base = dark ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    status = "estimated";
    notes.push(`No opaque background found; assumed the browser's default ${dark ? "dark" : "white"} canvas.`);
  } else base = layers.pop()!;
  while (layers.length) base = composite(layers.pop()!, base);
  return { color: base, status, reason: null, notes };
}

function paints(s: Element): boolean {
  const cs = getComputedStyle(s);
  const bg = normalizeColor(cs.backgroundColor);
  return (!!bg && bg.a > 0) || cs.backgroundImage !== "none" || /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|svg)$/i.test(s.tagName);
}

/**
 * Check painted layers at sample points on the text. Any non-ancestor that paints behind
 * the text, or any non-descendant that paints above it (e.g. a translucent overlay),
 * makes the ancestor-based result untrustworthy → unknown. Text outside the viewport is
 * scrolled into view first (scroll is restored by the caller).
 */
function layerProblem(el: Element, lineRects: DOMRect[]): string | null {
  // Sample points inside actual line boxes of the text (not its bounding box, which can
  // include gaps between lines or extend past the viewport).
  const pts: [number, number][] = [];
  const first = lineRects[0];
  const last = lineRects[lineRects.length - 1];
  for (const [r, fx] of [[first, 0.15], [first, 0.5], [last, 0.15]] as [DOMRect | undefined, number][]) {
    if (!r) continue;
    const left = Math.max(r.left, 1);
    const right = Math.min(r.right, innerWidth - 2);
    const y = r.top + r.height / 2;
    if (right <= left || y < 0 || y >= innerHeight) continue;
    pts.push([left + (right - left) * fx, y]);
  }
  if (!pts.length) return "text could not be brought into the viewport to check painted layers";
  let hits = 0;
  for (const [x, y] of pts) {
    const stack = document.elementsFromPoint(x, y);
    const idx = stack.findIndex((s) => s === el || el.contains(s));
    if (idx < 0) {
      const top = stack[0];
      if (top && !top.contains(el) && paints(top)) return `${top.tagName.toLowerCase()} is painted over the text`;
      continue; // point fell between glyph boxes; try the next one
    }
    hits++;
    // If the text's own element paints an opaque background, nothing behind it can show through.
    const ownCs = getComputedStyle(el);
    const ownBg = normalizeColor(ownCs.backgroundColor);
    const ownOpaque = !!ownBg && ownBg.a >= 0.999 && ownCs.backgroundImage === "none";
    for (const s of stack.slice(0, idx)) {
      if (el.contains(s) || s.contains(el)) continue;
      if (paints(s)) return `${s.tagName.toLowerCase()} is painted over the text`;
    }
    if (ownOpaque) continue;
    for (const s of stack.slice(idx + 1)) {
      if (s.contains(el)) {
        // Anything painted below an opaque ancestor is hidden by it.
        const cs = getComputedStyle(s);
        const bg = normalizeColor(cs.backgroundColor);
        if (bg && bg.a >= 0.999 && cs.backgroundImage === "none") break;
        continue;
      }
      if (paints(s)) return `${s.tagName.toLowerCase()} painted behind the text is not an ancestor`;
    }
  }
  return hits ? null : "text is not hit-testable at its own position";
}

export interface ContrastSample {
  element: Element;
  ratio: number | null;
  fg: string | null;
  bg: string | null;
  large: boolean;
  fontSizePx: number;
  fontWeight: number;
  status: "measured" | "estimated" | "unknown";
  reason: string | null;
  notes: string[];
  elementCount: number;
  selectors: Element[];
}

/**
 * Sample text colour pairs in the region. Passing samples with identical conditions are
 * grouped; failing and unresolved samples are kept per element so exceptions and fixes
 * apply to exactly the elements they name.
 */
export function sampleContrast(region: Element, opts: { maxElements?: number; maxPerElementSamples?: number } = {}): { samples: ContrastSample[]; hiddenSkipped: number } {
  const max = opts.maxElements ?? 400;
  const maxSingles = opts.maxPerElementSamples ?? 80;
  const seen = new Set<Element>();
  const groups = new Map<string, ContrastSample>();
  const singles: ContrastSample[] = [];
  let hiddenSkipped = 0;
  const sx = scrollX;
  const sy = scrollY;
  // Make every element hit-testable so overlays with pointer-events: none are seen, and render deferred content.
  const hit = document.createElement("style");
  hit.setAttribute("data-readability-lab", "hit-test");
  // Render content-visibility:auto subtrees too: skipped content is not hit-testable until it renders.
  hit.textContent = "*, *::before, *::after { pointer-events: auto !important; content-visibility: visible !important; }";
  (document.head ?? document.documentElement).appendChild(hit);
  try {
    for (const t of textNodes(region, { includeVisuallyHidden: true })) {
      if (!t.data.trim()) continue;
      const el = t.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (seen.size > max) break;
      if (!isRendered(el)) continue;
      if (isVisuallyHidden(el) || isHiddenInTree(el)) {
        hiddenSkipped++;
        continue;
      }
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = isLargeText(size, weight);
      const fgRaw = normalizeColor(cs.color);
      const bgRes = resolveBackground(el);
      const notes = [...bgRes.notes];
      if (cs.textShadow && cs.textShadow !== "none") notes.push("text-shadow present; perceived contrast may differ");
      let ratio: number | null = null;
      let status = bgRes.status;
      let reason = bgRes.reason;
      let fgHex: string | null = null;
      let bgHex: string | null = null;
      const range = document.createRange();
      range.selectNodeContents(t);
      const lines = () => Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
      let rects = lines();
      const f = rects[0];
      // Test layers with the text in the middle band of the viewport, away from sticky or
      // fixed headers/footers that would otherwise cover it at an arbitrary scroll position.
      if (status !== "unknown" && f && (f.top < innerHeight * 0.3 || f.bottom > innerHeight * 0.7 || f.left < 0 || f.left > innerWidth - 4)) {
        // Scroll only this window (scrollIntoView would also scroll ancestor frames' containers).
        scrollTo({ left: Math.max(0, f.left + scrollX - 8), top: Math.max(0, f.top + scrollY - innerHeight / 2), behavior: "instant" as ScrollBehavior });
        rects = lines();
      }
      const problem = status !== "unknown" ? layerProblem(el, rects) : null;
      if (problem) {
        status = "unknown";
        reason = problem;
      }
      if (fgRaw && bgRes.color && status !== "unknown") {
        const fg = fgRaw.a < 1 ? composite(fgRaw, bgRes.color) : fgRaw;
        ratio = contrastRatio(fg, bgRes.color);
        fgHex = toHex(fg);
        bgHex = toHex(bgRes.color);
      } else if (!fgRaw) {
        status = "unknown";
        reason = `could not parse text color ${cs.color}`;
      }
      const sample: ContrastSample = { element: el, ratio, fg: fgHex ?? cs.color, bg: bgHex, large, fontSizePx: size, fontWeight: weight, status, reason, notes, elementCount: 1, selectors: [el] };
      const passes = status === "measured" && ratio !== null && ratio >= (large ? 3 : 4.5);
      if (!passes) {
        if (singles.length < maxSingles) singles.push(sample);
        continue;
      }
      const key = `${fgHex}|${bgHex}|${large}|${status}`;
      const g = groups.get(key);
      if (g) {
        g.elementCount++;
        if (g.selectors.length < 5) g.selectors.push(el);
        if (ratio !== null && g.ratio !== null && ratio < g.ratio) g.ratio = ratio;
      } else groups.set(key, sample);
    }
  } finally {
    hit.remove();
    scrollTo(sx, sy);
  }
  return { samples: [...singles, ...groups.values()], hiddenSkipped };
}
