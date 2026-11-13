import { deepElements, isRendered, isVisuallyHidden, textNodes } from "./dom.js";

export const OVERFLOW_METHOD = "scroll-vs-client-box@1";

export interface ClipResult {
  element: Element;
  mechanism: "overflow-hidden" | "overflow-clip" | "text-overflow" | "line-clamp";
  axis: "x" | "y";
  hiddenPx: number;
  /** Grapheme count of text whose rendered box lies mostly outside the clipping box. */
  hiddenChars: number;
  totalChars: number;
}

export interface SpillResult {
  element: Element;
  spillPx: number;
  spilledChars: number;
}

function hasText(el: Element): boolean {
  return (el.textContent ?? "").trim().length > 0;
}

const wordSeg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
const graphemeCount = (s: string) => Array.from(s).length;

/**
 * Count characters of text inside `el` whose rendered rects fall mostly outside `clip`
 * (the element's padding box). This measures actual text loss, not box overflow:
 * an overflowing image inside a text box yields 0.
 */
export function textOutside(el: Element, clip: DOMRect): { hidden: number; total: number } {
  let hidden = 0;
  let total = 0;
  const range = document.createRange();
  for (const t of textNodes(el, { includeControls: true })) {
    const data = t.data;
    const segs = wordSeg ? Array.from(wordSeg.segment(data), (x) => ({ s: x.segment, i: x.index })) : [{ s: data, i: 0 }];
    for (const { s: seg, i } of segs) {
      if (!seg.trim()) continue;
      range.setStart(t, i);
      range.setEnd(t, i + seg.length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      const n = graphemeCount(seg);
      total += n;
      let area = 0;
      let inside = 0;
      for (const r of rects) {
        area += r.width * r.height;
        const w = Math.max(0, Math.min(r.right, clip.right) - Math.max(r.left, clip.left));
        const h = Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top));
        inside += w * h;
      }
      if (area > 0 && inside / area < 0.5) hidden += n;
      if (total > 20000) break;
    }
  }
  return { hidden, total };
}

function paddingBox(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  const h = el as HTMLElement;
  return new DOMRect(r.left + bl, r.top + bt, h.clientWidth, h.clientHeight);
}

/** Text hidden by its own box (overflow hidden/clip, ellipsis, line clamp) or spilling out of it. */
export function findClipping(root: Element): { clipped: ClipResult[]; spilling: SpillResult[] } {
  const clipped: ClipResult[] = [];
  const spilling: SpillResult[] = [];
  for (const el of deepElements(root)) {
    if (!hasText(el) || !isRendered(el)) continue;
    if (el.closest("[data-rl-ignore]")) continue;
    // Screen-reader-only text is hidden on purpose; it is not lost content.
    if (isVisuallyHidden(el)) continue;
    const cs = getComputedStyle(el);
    const h = el as HTMLElement;
    if (h.clientWidth === 0 && h.clientHeight === 0) continue;
    const dx = h.scrollWidth - h.clientWidth;
    const dy = h.scrollHeight - h.clientHeight;
    if (dx <= 1 && dy <= 1) continue;
    const clipX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    const clipY = cs.overflowY === "hidden" || cs.overflowY === "clip";
    const clamp = (cs as unknown as Record<string, string>)["webkitLineClamp"];
    let mechanism: ClipResult["mechanism"] | null = null;
    let axis: "x" | "y" = "y";
    if (clamp && clamp !== "none" && dy > 1) mechanism = "line-clamp";
    else if (cs.textOverflow === "ellipsis" && clipX && dx > 1) {
      mechanism = "text-overflow";
      axis = "x";
    } else if (clipY && dy > 1) mechanism = cs.overflowY === "clip" ? "overflow-clip" : "overflow-hidden";
    else if (clipX && dx > 1) {
      mechanism = cs.overflowX === "clip" ? "overflow-clip" : "overflow-hidden";
      axis = "x";
    }
    if (mechanism) {
      const { hidden, total } = textOutside(el, paddingBox(el));
      if (hidden > 0) clipped.push({ element: el, mechanism, axis, hiddenPx: axis === "x" ? dx : dy, hiddenChars: hidden, totalChars: total });
    } else if (cs.overflowY === "visible" && dy > 2 && cs.display !== "inline" && !/^(HTML|BODY)$/.test(el.tagName)) {
      const { hidden } = textOutside(el, paddingBox(el));
      if (hidden > 0) spilling.push({ element: el, spillPx: dy, spilledChars: hidden });
    }
  }
  const inner = <T extends { element: Element }>(xs: T[]) => xs.filter((a) => !xs.some((b) => b !== a && a.element.contains(b.element)));
  return { clipped: inner(clipped), spilling: inner(spilling) };
}

const TWO_D = "table, pre, code, img, svg, video, canvas, iframe, math, picture, [role='img'], [role='math'], [role='grid'], [role='table'], [data-rl-2d]";

export interface HorizontalOverflow {
  pageOverflow: boolean;
  scrollWidth: number;
  viewportWidth: number;
  elements: { element: Element; overflowPx: number; possibleException: boolean; cause: "box" | "text" }[];
  /** Prose that scrolls horizontally inside its own container. */
  scrollingProse: { element: Element; overflowPx: number }[];
  unattributed: boolean;
}

/** Right edge of the element's own (direct) text, so text clipped inside descendants is ignored. */
function textRight(el: Element): number {
  let right = -Infinity;
  const r = document.createRange();
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType !== 3 || !(n.textContent ?? "").trim()) continue;
    r.selectNodeContents(n);
    for (const rect of Array.from(r.getClientRects())) if (rect.width > 0) right = Math.max(right, rect.right + scrollX);
  }
  return right;
}

/** Elements (boxes or their text) that make the page scroll horizontally. */
export function findHorizontalOverflow(doc: Document): HorizontalOverflow {
  const vw = doc.documentElement.clientWidth;
  const sw = doc.documentElement.scrollWidth;
  const out: HorizontalOverflow["elements"] = [];
  const scrollingProse: HorizontalOverflow["scrollingProse"] = [];
  const all = Array.from(doc.body.querySelectorAll("*"));
  for (const el of all) {
    if (!isRendered(el)) continue;
    const cs = getComputedStyle(el);
    const h = el as HTMLElement;
    // Internal horizontal scroller containing prose (not a 2D exception).
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && h.scrollWidth > h.clientWidth + 1 && !el.matches(TWO_D) && !el.closest(TWO_D)) {
      if (el.querySelector("p, li, blockquote, dd") || /^(P|LI|BLOCKQUOTE|DD)$/.test(el.tagName)) scrollingProse.push({ element: el, overflowPx: h.scrollWidth - h.clientWidth });
    }
    if (sw <= vw + 1) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const boxRight = r.right + scrollX;
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
    // Text clipped or scrolled by the element itself does not widen the page.
    const tRight = hasOwnText && cs.overflowX === "visible" ? textRight(el) : -Infinity;
    const right = Math.max(boxRight, tRight);
    if (right <= vw + 1) continue;
    let contained = false;
    for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible") {
        contained = true;
        break;
      }
    }
    if (contained) continue;
    if (cs.position === "fixed" && r.left >= vw) continue;
    out.push({ element: el, overflowPx: Math.round(right - vw), possibleException: !!el.closest(TWO_D) || el.matches(TWO_D), cause: tRight > boxRight ? "text" : "box" });
  }
  const outer = out.filter((a) => !out.some((b) => b !== a && b.element.contains(a.element)));
  const pageOverflow = sw > vw + 1;
  return { pageOverflow, scrollWidth: sw, viewportWidth: vw, elements: outer.slice(0, 25), scrollingProse: scrollingProse.slice(0, 25), unattributed: pageOverflow && outer.length === 0 };
}

/**
 * WCAG 1.4.12 override values (as in the W3C test bookmarklet). The `:not(#a#b#c)` suffix
 * adds id-level specificity so these !important rules beat ordinary author !important
 * rules; inline !important styles can still win, which `verifyTextSpacing` detects.
 */
const BOOST = ":not(#rl-ts-a#rl-ts-b#rl-ts-c)";
export const TEXT_SPACING_CSS = `*${BOOST}, *${BOOST}::before, *${BOOST}::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p${BOOST} { margin-bottom: 2em !important; }`;

export interface SpacingVerification {
  checked: number;
  notApplied: { element: Element; property: string; expected: string; actual: string }[];
  shadowRootsPatched: number;
}

/**
 * Check, for every element that directly holds rendered text (including buttons, labels
 * and open shadow roots), that the overrides are in effect. Closed shadow roots and
 * frames cannot be verified and are counted separately.
 */
export function verifyTextSpacing(root: Element): SpacingVerification & { unverifiable: number } {
  const notApplied: SpacingVerification["notApplied"] = [];
  const holders = new Set<Element>();
  for (const t of textNodes(root, { includeControls: true })) {
    if (t.parentElement) holders.add(t.parentElement);
    if (holders.size >= 3000) break;
  }
  let unverifiable = 0;
  for (const el of deepElements(root)) {
    if (el.tagName === "IFRAME" || el.tagName === "FRAME") unverifiable++;
    else if (el.tagName.includes("-") && !(el as HTMLElement).shadowRoot && customElements.get(el.tagName.toLowerCase()) && !el.childNodes.length) unverifiable++;
  }
  for (const el of holders) {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === "normal" ? NaN : parseFloat(cs.lineHeight);
    const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing);
    const ws = cs.wordSpacing === "normal" ? 0 : parseFloat(cs.wordSpacing);
    const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.6, b * 0.03);
    if (!near(lh, fs * 1.5)) notApplied.push({ element: el, property: "line-height", expected: `${(fs * 1.5).toFixed(1)}px`, actual: cs.lineHeight });
    else if (!near(ls, fs * 0.12)) notApplied.push({ element: el, property: "letter-spacing", expected: `${(fs * 0.12).toFixed(2)}px`, actual: cs.letterSpacing });
    else if (!near(ws, fs * 0.16)) notApplied.push({ element: el, property: "word-spacing", expected: `${(fs * 0.16).toFixed(2)}px`, actual: cs.wordSpacing });
    else if (el.tagName === "P" && parseFloat(cs.marginBottom) + 0.6 < fs * 2) notApplied.push({ element: el, property: "margin-bottom", expected: `${(fs * 2).toFixed(1)}px`, actual: cs.marginBottom });
  }
  return { checked: holders.size, notApplied, shadowRootsPatched: 0, unverifiable };
}

/** Inject the overrides into the document and every open shadow root. Returns an undo function. */
export function applyTextSpacing(doc: Document = document): { undo: () => void; shadowRootsPatched: number } {
  const styles: HTMLStyleElement[] = [];
  const add = (parent: Node) => {
    const st = doc.createElement("style");
    st.setAttribute("data-readability-lab", "wcag-1-4-12");
    st.textContent = TEXT_SPACING_CSS;
    parent.appendChild(st);
    styles.push(st);
  };
  add(doc.head ?? doc.documentElement);
  let n = 0;
  for (const el of Array.from(deepElements(doc.documentElement))) {
    const sr = (el as HTMLElement).shadowRoot;
    if (sr) {
      add(sr);
      n++;
    }
  }
  return { undo: () => styles.forEach((s) => s.remove()), shadowRootsPatched: n };
}
