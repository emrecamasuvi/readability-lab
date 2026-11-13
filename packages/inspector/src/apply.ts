import { toCss, type TypographySettings } from "@emrecamasuvi/readability-lab-core";
import { selectorFor } from "./dom.js";
import { measureLines } from "./lines.js";


const STYLE_ID_PREFIX = "rl-style-";

type StyleRoot = Document | ShadowRoot;
const isDoc = (r: StyleRoot): r is Document => r.nodeType === 9;

/** Insert (or replace) a style element in a document or shadow root. Returns a remover. */
export function injectCss(css: string, key = "main", root: StyleRoot = document): () => void {
  const id = STYLE_ID_PREFIX + key;
  let el = root.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    const doc = isDoc(root) ? root : root.ownerDocument;
    el = doc.createElement("style");
    el.id = id;
    el.setAttribute("data-readability-lab", key);
    if (isDoc(root)) (root.head ?? root.documentElement).appendChild(el);
    else root.appendChild(el);
  }
  el.textContent = css;
  return () => el!.remove();
}

export function removeCss(key = "main", root: StyleRoot = document): void {
  root.getElementById(STYLE_ID_PREFIX + key)?.remove();
}

const markerAttr = (key: string) => `data-rl-region-${key.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;

/** Mark the region for one owner (style key) so several controllers can coexist. */
export function markRegion(el: Element, key = "main"): string {
  const attr = markerAttr(key);
  for (const other of Array.from(el.ownerDocument.querySelectorAll(`[${attr}]`))) if (other !== el) other.removeAttribute(attr);
  el.setAttribute(attr, "");
  return `[${attr}]`;
}

export function unmarkRegion(doc: Document = document, key = "main"): void {
  const attr = markerAttr(key);
  for (const el of Array.from(doc.querySelectorAll(`[${attr}]`))) el.removeAttribute(attr);
}

/** The element currently marked for an owner, if any. */
export function markedRegion(doc: Document = document, key = "main"): Element | null {
  return doc.querySelector(`[${markerAttr(key)}]`);
}

function medianCpl(region: Element): number | null {
  const lines = measureLines(region, { maxChars: 8000 }).lines.filter((l) => !l.final);
  if (!lines.length) return null;
  const v = lines.map((l) => l.chars).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)]!;
}

export interface FitResult {
  charsPerCh: number | null;
  achievedMedianCpl: number | null;
  iterations: number;
  css: string;
}

/**
 * Apply settings to a region, converting a CPL target to a `ch` max-width by measuring
 * rendered lines and iterating (closed loop). The resulting calibration is reported so
 * exports can record it. Width is still bounded by the available container width.
 */
export function applySettings(region: Element, settings: TypographySettings, opts: { important?: boolean; key?: string; center?: boolean; charsPerCh?: number | null; styleRoot?: StyleRoot } = {}): FitResult {
  const styleRoot: StyleRoot = opts.styleRoot ?? (region.getRootNode() as StyleRoot);
  const key = opts.key ?? "main";
  const scope = markRegion(region, key);
  const css0 = toCss(settings, { scope, important: opts.important ?? true, center: opts.center, charsPerCh: null });
  injectCss(css0, key, styleRoot);
  const m = settings.measure;
  if (!m || m.unit !== "cpl") return { charsPerCh: null, achievedMedianCpl: medianCpl(region), iterations: 0, css: css0 };
  let factor = opts.charsPerCh ?? 1.15;
  let appliedFactor = factor;
  let css = css0;
  let achieved: number | null = null;
  let i = 0;
  for (; i < 6; i++) {
    css = toCss(settings, { scope, important: opts.important ?? true, center: opts.center, charsPerCh: factor });
    injectCss(css, key, styleRoot);
    appliedFactor = factor;
    achieved = medianCpl(region);
    if (achieved === null) break;
    if (Math.abs(achieved - m.value) <= 1.5) break;
    const containerLimited = (region as HTMLElement).getBoundingClientRect().width < parseFloat(getComputedStyle(region).maxWidth || "0") - 1;
    if (containerLimited && achieved < m.value) break; // the container is narrower than the target
    factor = factor * (achieved / m.value);
  }
  // Report the calibration that produced the applied CSS and measurement, never a later guess.
  return { charsPerCh: achieved === null ? null : Math.round(appliedFactor * 1000) / 1000, achievedMedianCpl: achieved, iterations: i + 1, css };
}

export function clearSettings(doc: Document = document, key = "main", styleRoot?: StyleRoot): void {
  removeCss(key, styleRoot ?? doc);
  unmarkRegion(doc, key);
  if (styleRoot && !isDoc(styleRoot)) for (const el of Array.from(styleRoot.querySelectorAll(`[data-rl-region-${key.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}]`))) el.removeAttribute(`data-rl-region-${key.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`);
}

export { selectorFor };
