import { NON_PROSE_SELECTOR, selectorFor } from "./dom.js";

export interface RegionResult {
  element: Element;
  selector: string;
  method: "explicit-selector" | "auto-detected" | "user-picked" | "whole-document";
  candidates: { selector: string; score: number }[];
  error?: string;
}

const CANDIDATES = "[data-reading-region], article, main, [role='main'], [itemprop='articleBody'], .post-content, .entry-content, .article-body, .markdown-body, .prose, #content, .content";

function proseScore(el: Element): number {
  let chars = 0;
  for (const p of Array.from(el.querySelectorAll("p, li, blockquote, dd"))) {
    if (p.closest(NON_PROSE_SELECTOR)) continue;
    if (p.closest("nav, header, footer, aside")) continue;
    chars += (p.textContent ?? "").trim().length;
  }
  const links = Array.from(el.querySelectorAll("a")).reduce((s, a) => s + (a.textContent ?? "").length, 0);
  const total = (el.textContent ?? "").length || 1;
  return chars * (1 - Math.min(0.9, links / total));
}

/**
 * Choose the reading region. An explicit selector always wins and is never silently
 * replaced; if it matches nothing the result carries an error.
 */
export function findRegion(doc: Document, selector?: string | null): RegionResult {
  if (selector) {
    const el = doc.querySelector(selector);
    if (!el) return { element: doc.body, selector, method: "explicit-selector", candidates: [], error: `Selector "${selector}" matched no element.` };
    return { element: el, selector, method: "explicit-selector", candidates: [] };
  }
  const scored = Array.from(doc.querySelectorAll(CANDIDATES))
    .map((el) => ({ el, score: proseScore(el) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  // Prefer the innermost candidate that keeps ≥85% of the best score (e.g. article inside main).
  let best = scored[0];
  if (best) {
    for (const c of scored) if (c.score >= best.score * 0.85 && best.el.contains(c.el) && c.el !== best.el) best = c;
  }
  if (!best) {
    // Fall back to the element containing the most paragraph text directly.
    const parents = new Map<Element, number>();
    for (const p of Array.from(doc.querySelectorAll("p"))) {
      if (!p.parentElement) continue;
      parents.set(p.parentElement, (parents.get(p.parentElement) ?? 0) + (p.textContent ?? "").length);
    }
    const top = [...parents].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 200) best = { el: top[0], score: top[1] };
  }
  const candidates = scored.slice(0, 5).map((c) => ({ selector: selectorFor(c.el), score: Math.round(c.score) }));
  if (!best) return { element: doc.body, selector: "body", method: "whole-document", candidates };
  return { element: best.el, selector: selectorFor(best.el), method: "auto-detected", candidates };
}
