/** Small DOM helpers shared by the inspector modules. */

/** Never rendered as page text. */
export const NEVER_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK"]);
/** Embedded or form content: excluded from prose measurement, included for clipping/spacing checks. */
export const CONTROL_TAGS = new Set(["svg", "SVG", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "OBJECT", "EMBED", "SELECT", "OPTION", "TEXTAREA", "INPUT", "BUTTON"]);
/** @deprecated kept for compatibility */
export const SKIP_TAGS = new Set([...NEVER_TAGS, ...CONTROL_TAGS]);

/** Content that is not continuous prose for line-length purposes. */
/** Inline code/kbd/samp inside prose IS counted; block code (pre) is not. */
export const NON_PROSE_SELECTOR = "pre, h1, h2, h3, h4, h5, h6, table, nav, button, figcaption, [aria-hidden='true'], [role='navigation'], [role='button'], [data-rl-ignore], rl-reading-controls";

export function cssEscape(s: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/** A reasonably short selector that uniquely identifies an element in its root. */
export function selectorFor(el: Element): string {
  const root = el.getRootNode() as Document | ShadowRoot;
  if (el.id && root.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) return `#${cssEscape(el.id)}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== el.ownerDocument.documentElement) {
    if (cur.id && root.querySelectorAll(`#${cssEscape(cur.id)}`).length === 1) {
      parts.unshift(`#${cssEscape(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    if (tag === "body") break;
    cur = parent;
  }
  return parts.join(" > ");
}

export function isRendered(el: Element): boolean {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return false;
  if (parseFloat(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0 && cs.display !== "contents") return false;
  return true;
}

/** Visually-hidden helper patterns (sr-only) render text for AT but not on screen. */
export function isVisuallyHidden(el: Element): boolean {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  if (cs.position === "absolute" && r.width <= 1 && r.height <= 1) return true;
  if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") return true;
  return false;
}

/** Is this element (not its ancestors) hidden from sighted readers? */
function selfHidden(el: Element, includeVisuallyHidden: boolean): boolean {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;
  // Content of a closed <details> other than its <summary> is not rendered.
  const parent = el.parentElement;
  if (parent?.tagName === "DETAILS" && !(parent as HTMLDetailsElement).open && el.tagName !== "SUMMARY") return true;
  const cv = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (cv && cs.display !== "contents" && !cv.call(el, { checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: false })) return true;
  if (!includeVisuallyHidden && isVisuallyHidden(el)) return true;
  return false;
}

export interface WalkOptions {
  skipSelector?: string;
  includeWhitespace?: boolean;
  /** Include text in buttons, labels and form controls (for clipping/spacing checks). */
  includeControls?: boolean;
  /** Include screen-reader-only text. */
  includeVisuallyHidden?: boolean;
}

/**
 * Walk rendered text nodes, descending into open shadow roots. Skips hidden subtrees
 * (display/visibility, closed <details>, checkVisibility, sr-only patterns).
 */
export function* textNodes(root: Node, opts: WalkOptions = {}): Generator<Text> {
  const stack: Node[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.nodeType === Node.TEXT_NODE) {
      if (opts.includeWhitespace || (node.textContent ?? "").trim()) yield node as Text;
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (NEVER_TAGS.has(el.tagName)) continue;
      if (!opts.includeControls && CONTROL_TAGS.has(el.tagName)) continue;
      if (opts.skipSelector && el !== root && el.matches(opts.skipSelector)) continue;
      if (selfHidden(el, !!opts.includeVisuallyHidden)) continue;
      if ((el as HTMLElement).shadowRoot) stack.push(...Array.from((el as HTMLElement).shadowRoot!.childNodes).reverse());
    }
    if (node.childNodes.length) stack.push(...Array.from(node.childNodes).reverse());
  }
}

/** Root plus all descendant elements, including inside open shadow roots. */
export function* deepElements(root: Element | ShadowRoot): Generator<Element> {
  const stack: (Element | ShadowRoot)[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.nodeType === Node.ELEMENT_NODE) yield n as Element;
    const kids = Array.from(n.children);
    const sr = (n as HTMLElement).shadowRoot;
    if (sr) stack.push(sr);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
}

/** Is the element hidden from sighted readers by itself or any ancestor? */
export function isHiddenInTree(el: Element): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parentElement ?? (((cur.getRootNode() as ShadowRoot).host as Element | undefined) ?? null)) {
    if (selfHidden(cur, false)) return true;
  }
  return false;
}

/** Nearest ancestor that establishes a block formatting context for inline text. */
export function blockContainer(node: Node): Element | null {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el) {
    const d = getComputedStyle(el).display;
    if (!d.startsWith("inline") && d !== "contents" && d !== "ruby" && d !== "ruby-text") return el;
    el = el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);
  }
  return null;
}

export function box(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
}

export function textSample(el: Element, privacy: boolean): string | null {
  if (privacy) return null;
  const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 80) : null;
}
