import { marked } from "marked";
import articleBalanced from "../../../fixtures/article-balanced.html?raw";
import blogPost from "../../../fixtures/blog-post.html?raw";
import cjk from "../../../fixtures/cjk-japanese.html?raw";
import docsPage from "../../../fixtures/docs-page.html?raw";
import newsletter from "../../../fixtures/newsletter.html?raw";
import rtl from "../../../fixtures/rtl-arabic.html?raw";
import turkish from "../../../fixtures/turkish.html?raw";
import wide from "../../../fixtures/wide-measure.html?raw";

export interface Sample {
  id: string;
  /** Untrusted HTML to insert into the region after the (trusted) shell document loads. */
  untrustedBody?: string;
  title: string;
  kind: string;
  html: string;
  region: string;
  license: string;
  note?: string;
}

const CC = "Original text, CC BY 4.0 (Readability Lab fixtures)";
/** Nothing in user content may submit, embed or fetch: forms and embedded content are removed. */
const FORBIDDEN = ["script", "form", "input", "button", "textarea", "select", "iframe", "frame", "object", "embed", "video", "audio", "source", "track"];

export const SAMPLES: Sample[] = [
  { id: "article", title: "Long-form article", kind: "Article with footnote, quote and figure", html: articleBalanced, region: "article", license: CC },
  { id: "docs", title: "Documentation page", kind: "Prose, inline code, code block, table", html: docsPage, region: "#doc", license: CC },
  { id: "newsletter", title: "Newsletter", kind: "Table-based email layout", html: newsletter, region: "#letter", license: CC },
  { id: "blog", title: "Blog post", kind: "Div markup, sidebar, list", html: blogPost, region: "#post", license: CC },
  { id: "wide", title: "Wide, tight page", kind: "Heuristic deviations (not WCAG failures)", html: wide, region: "main", license: CC },
  { id: "turkish", title: "Turkish article", kind: "Latin script with diacritics", html: turkish, region: "#makale", license: CC, note: "Latin script, but most cited studies used English or other languages; transfer is not established." },
  { id: "arabic", title: "Arabic article", kind: "Right-to-left", html: rtl, region: "#maqal", license: CC, note: "Latin-derived ranges are not applied to Arabic text." },
  { id: "japanese", title: "Japanese article", kind: "CJK", html: cjk, region: "#kiji", license: CC, note: "Latin-derived ranges are not applied to Japanese text." },
];

const BASE_CSS = `body{margin:0;background:#fff;color:#1b1b1b;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
article{max-width:none;margin:24px;padding:0 8px;font-size:16px;line-height:1.4}
pre{overflow-x:auto;background:#f3f3f3;padding:8px}code{font-family:ui-monospace,Menlo,monospace}
table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}img{max-width:100%}`;

const REMOVE_ATTRS = ["action", "formaction", "srcset", "ping"];
let purify: Promise<typeof import("dompurify").default> | null = null;
/** DOMPurify is code-split and only downloaded when the native Sanitizer API is missing or a whole document must be cleaned. */
function loadDOMPurify() {
  purify ??= import("dompurify").then((m) => m.default ?? (m as unknown as typeof import("dompurify").default));
  return purify;
}

/**
 * Insert untrusted HTML into an element: native `setHTML()` (Sanitizer API) where available,
 * otherwise DOMPurify returning a DOM fragment that is moved in — never re-parsed from a string.
 */
export async function safeSetHTML(el: Element, html: string): Promise<void> {
  const native = el as Element & { setHTML?: (html: string, opts: object) => void };
  if (typeof native.setHTML === "function") {
    native.setHTML(html, { sanitizer: { removeElements: FORBIDDEN, removeAttributes: REMOVE_ATTRS } });
    return;
  }
  const DOMPurify = await loadDOMPurify();
  const frag = DOMPurify.sanitize(html, { FORBID_TAGS: FORBIDDEN, FORBID_ATTR: REMOVE_ATTRS, RETURN_DOM_FRAGMENT: true });
  el.replaceChildren(el.ownerDocument.importNode(frag, true));
}

/** Paste Markdown or plain prose. The shell is trusted; the rendered Markdown is sanitized on insertion. */
export function sampleFromMarkdown(md: string, title = "Pasted text"): Sample {
  const safeTitle = title.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return {
    id: "pasted",
    title,
    kind: "Your text (stays in this browser)",
    html: `<!doctype html><html lang="und"><head><meta charset="utf-8"><title>${safeTitle}</title><style>${BASE_CSS}</style></head><body><article id="content"></article></body></html>`,
    untrustedBody: marked.parse(md, { async: false }) as string,
    region: "#content",
    license: "Your content — not uploaded",
  };
}

/**
 * A local HTML file the user chose. Whole documents keep their own <style> for a faithful preview,
 * which the native Sanitizer's default allowlist does not cover, so DOMPurify (lazy-loaded) cleans it.
 */
export async function sampleFromHtmlFile(name: string, text: string, region: string | null): Promise<Sample> {
  const DOMPurify = await loadDOMPurify();
  const clean = DOMPurify.sanitize(text, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"], FORBID_TAGS: [...FORBIDDEN, "link", "meta", "base"], FORBID_ATTR: REMOVE_ATTRS });
  return { id: "local", title: name, kind: "Local file (stays in this browser)", html: `<!doctype html>${clean}`, region: region || "main, article, [role=main], body", license: "Your content — not uploaded" };
}
