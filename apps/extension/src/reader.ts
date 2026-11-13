import { isProbablyReaderable, Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { getPreset, THEMES, type TypographySettings } from "@camasuvi/readability-lab-core";
import { applySettings } from "@camasuvi/readability-lab-inspector";

const HOST_ID = "rl-reader-host";
let previousFocus: Element | null = null;

const BASE_CSS = `
:host { all: initial; }
dialog.wrap { position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; overflow: auto; box-sizing: border-box; background: var(--rl-bg, #fff); color: var(--rl-fg, #1b1b1b); font-family: Georgia, "Times New Roman", serif; }
.bar { position: sticky; top: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; padding: 8px 16px; background: inherit; border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); font: 14px/1.4 system-ui, sans-serif; z-index: 1; }
.bar button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
.bar a { color: inherit; }
:focus-visible { outline: 3px solid #014abb; outline-offset: 2px; }
.page { padding: 24px 16px 64px; }
header.meta { font: 14px/1.4 system-ui, sans-serif; margin: 0 auto 16px; max-width: 40em; }
header.meta h1 { font: 700 1.9em/1.2 Georgia, serif; margin: 0.2em 0; }
article.rl-article { margin: 0 auto; }
article.rl-article img, article.rl-article video, article.rl-article svg { max-width: 100%; height: auto; }
article.rl-article pre { overflow-x: auto; white-space: pre; font-size: 0.85em; }
article.rl-article table { display: block; overflow-x: auto; border-collapse: collapse; }
article.rl-article td, article.rl-article th { border: 1px solid color-mix(in srgb, currentColor 30%, transparent); padding: 4px 8px; }
article.rl-article blockquote { margin-inline: 0; padding-inline-start: 1em; border-inline-start: 3px solid color-mix(in srgb, currentColor 35%, transparent); }
footer.attribution { max-width: 40em; margin: 32px auto 0; font: 13px/1.4 system-ui, sans-serif; opacity: 0.85; }
dialog.wrap::backdrop { background: var(--rl-bg, #fff); overflow: hidden; overscroll-behavior: contain; }
/* Keep scroll gestures inside the reader instead of chaining to the page behind it. */
dialog.wrap:modal { overscroll-behavior: contain; }
.media-note { font: 13px/1.4 system-ui, sans-serif; border: 1px dashed currentColor; padding: 6px 10px; margin: 8px 0; }
.failure { max-width: 36em; margin: 48px auto; font: 16px/1.5 system-ui, sans-serif; }
`;

export function isReaderOpen(): boolean {
  return !!document.getElementById(HOST_ID);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export interface ExtractionResult {
  ok: boolean;
  reason: string | null;
  title: string;
  byline: string | null;
  siteName: string | null;
  /** Sanitized article content in an inert document (no browsing context, so nothing loads). */
  body: HTMLElement | null;
  characters: number;
  pageCharacters: number;
  /** Media that would have required a new network request and was replaced by a link. */
  removedMedia: number;
}

/**
 * The reader view must not make network requests. Same-origin images the page already
 * decoded are copied as data URLs from memory; everything else (cross-origin, unloaded or
 * lazy images, video, audio, remote backgrounds) becomes a plain link the reader can follow.
 */
const REMOVE_ELEMENTS = ["style", "form", "input", "button", "iframe", "object", "embed", "link", "meta", "base"];
const REMOVE_ATTRS = ["srcset", "ping", "action", "formaction"];

/**
 * Sanitize into an inert document: native Document.parseHTML() (Sanitizer API) when available,
 * otherwise DOMPurify returning DOM. Either way nothing is fetched until nodes are moved into the page.
 */
function sanitizeInert(html: string): HTMLElement {
  const D = Document as unknown as { parseHTML?: (html: string, opts: object) => Document };
  if (typeof D.parseHTML === "function") return D.parseHTML(html, { sanitizer: { removeElements: REMOVE_ELEMENTS, removeAttributes: REMOVE_ATTRS } }).body;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true, mathMl: true, svg: true }, FORBID_TAGS: REMOVE_ELEMENTS, FORBID_ATTR: REMOVE_ATTRS, RETURN_DOM: true }) as HTMLElement;
}

function withoutNewRequests(root: HTMLElement): number {
  // Bytes of images the page already decoded, copied from memory. Only same-origin images
  // can be read back from a canvas; reusing a URL is NOT enough (no-store responses refetch).
  const copies = new Map<string, string>();
  for (const img of Array.from(document.images)) {
    if (!img.complete || img.naturalWidth === 0 || !img.currentSrc || copies.has(img.currentSrc)) continue;
    try {
      if (new URL(img.currentSrc).origin !== location.origin) continue;
      const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      copies.set(img.currentSrc, c.toDataURL("image/png"));
    } catch {
      /* tainted or undecodable: becomes a link */
    }
  }
  const tpl = { content: root };
  let removed = 0;
  const toLink = (el: Element, url: string | null, label: string) => {
    removed++;
    const p = root.ownerDocument.createElement("p");
    p.className = "media-note";
    if (url && /^https?:/i.test(url)) {
      const a = root.ownerDocument.createElement("a");
      a.href = url;
      a.textContent = `${label} not loaded in reader view — open it`;
      p.append(a);
    } else p.textContent = `${label} not shown in reader view`;
    el.replaceWith(p);
  };
  const abs = (u: string | null) => {
    try {
      return u ? new URL(u.split(/\s+/)[0]!, location.href).href : null;
    } catch {
      return null;
    }
  };
  for (const img of Array.from(tpl.content.querySelectorAll("img"))) {
    const label = `Image${img.getAttribute("alt") ? ` “${img.getAttribute("alt")}”` : ""}`;
    const src = abs(img.getAttribute("src"));
    const lazy = abs(["data-src", "data-lazy-src", "data-original", "data-srcset"].map((k) => img.getAttribute(k)).find(Boolean) ?? null);
    const real = lazy && (!src || src.startsWith("data:")) ? lazy : src;
    img.removeAttribute("sizes");
    for (const k of ["data-src", "data-lazy-src", "data-original", "data-srcset"]) img.removeAttribute(k);
    if (real?.startsWith("data:")) continue;
    const copy = real ? copies.get(real) : undefined;
    if (copy) {
      img.setAttribute("src", copy);
      continue;
    }
    toLink(img, real, label);
  }
  for (const el of Array.from(tpl.content.querySelectorAll("video, audio, source, track"))) toLink(el, abs(el.getAttribute("src")), el.tagName === "AUDIO" ? "Audio" : "Video");
  for (const el of Array.from(tpl.content.querySelectorAll("[style]"))) if (/url\(/i.test(el.getAttribute("style") ?? "")) el.removeAttribute("style");
  for (const el of Array.from(tpl.content.querySelectorAll("image, use, feImage"))) el.remove(); // SVG external references
  return removed;
}

export function extract(): ExtractionResult {
  const pageCharacters = (document.body?.innerText ?? "").length;
  const base = { title: document.title, byline: null, siteName: null, body: null, characters: 0, pageCharacters, removedMedia: 0 };
  if (!isProbablyReaderable(document)) {
    return { ...base, ok: false, reason: "This page does not look like a single article (for example a home page, app or search results)." };
  }
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone, { keepClasses: false }).parse();
  if (!article || !article.content || (article.textContent ?? "").trim().length < 200) {
    return { ...base, ok: false, reason: "Mozilla Readability could not find enough article text on this page." };
  }
  const body = sanitizeInert(article.content);
  const removedMedia = withoutNewRequests(body);
  return { ok: true, reason: null, title: article.title || document.title, byline: article.byline ?? null, siteName: article.siteName ?? null, body, characters: (article.textContent ?? "").length, pageCharacters, removedMedia };
}

export function openReader(settings: TypographySettings): ExtractionResult {
  closeReader();
  const result = extract();
  previousFocus = document.activeElement;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-rl-ignore", "");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });
  const theme = settings.theme ?? THEMES.light;
  const origin = location.href;
  shadow.innerHTML = `<style>${BASE_CSS}</style>
<dialog class="wrap" aria-label="Reader view" style="--rl-bg:${theme.background};--rl-fg:${theme.foreground}">
  <div class="bar"><span>Reader view · Readability Lab</span><span><a href="${esc(origin)}" id="orig">Original page</a> <button type="button" id="close">Close reader (Esc)</button></span></div>
  <div class="page">
  ${
    result.ok
      ? `<header class="meta">${result.siteName ? `<div>${esc(result.siteName)}</div>` : ""}<h1 id="rl-title">${esc(result.title)}</h1>${result.byline ? `<div>${esc(result.byline)}</div>` : ""}<div><a href="${esc(origin)}">${esc(origin)}</a></div></header>
         <article class="rl-article" lang="${esc(document.documentElement.lang || "")}" dir="${esc(document.documentElement.dir || "auto")}"></article>
         <footer class="attribution">Content from <a href="${esc(origin)}">${esc(result.siteName ?? location.hostname)}</a>, extracted locally with Mozilla Readability. Kept ${result.characters.toLocaleString()} characters of text; the full page has ${result.pageCharacters.toLocaleString()} (including navigation and other page parts). ${result.removedMedia ? ` ${result.removedMedia} media item(s) the page had not loaded are shown as links, so reader view makes no new requests.` : ""} If something is missing, use the original page.</footer>`
      : `<div class="failure" role="alert"><h1 id="rl-title">Reader view is not available here</h1><p>${esc(result.reason ?? "")}</p><p>You can still adjust this page directly: close this view and use <strong>Pick region</strong> in the Readability Lab panel to choose the text you want to read.</p></div>`
  }
  </div>
</dialog>`;
  // Move the sanitized, already-filtered nodes in (never re-parsed from a string).
  const articleSlot = shadow.querySelector("article.rl-article");
  if (articleSlot && result.body) articleSlot.replaceChildren(...Array.from(result.body.childNodes, (n) => document.importNode(n, true)));
  document.documentElement.appendChild(host);
  const dialog = shadow.querySelector("dialog")!;
  // A modal dialog makes the page behind it inert and keeps keyboard focus inside.
  dialog.showModal();
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeReader();
  });
  const articleEl = shadow.querySelector("article.rl-article");
  if (articleEl) {
    const effective = { ...getPreset("balanced")!.settings, ...settings, theme };
    applySettings(articleEl, effective, { key: "reader", styleRoot: shadow, important: true });
  }
  shadow.getElementById("close")!.addEventListener("click", () => closeReader());
  (shadow.getElementById("close") as HTMLButtonElement).focus();
  return result;
}

export function closeReader(): void {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  (host.shadowRoot?.querySelector("dialog") as HTMLDialogElement | null)?.close();
  host.remove();
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
  previousFocus = null;
}
