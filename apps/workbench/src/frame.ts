import type { Observation, TypographySettings } from "@camasuvi/readability-lab-core";
import type * as Inspector from "@camasuvi/readability-lab-inspector";
import inspectorUrl from "../../../packages/inspector/dist/inspector.iife.js?url";

type Api = typeof Inspector;

export interface Device {
  id: "desktop" | "tablet" | "phone" | "zoom200";
  label: string;
  width: number;
  height: number;
  note: string;
}

export const DEVICES: Device[] = [
  { id: "desktop", label: "Desktop", width: 1280, height: 800, note: "1280×800 CSS px" },
  { id: "tablet", label: "Tablet", width: 820, height: 1180, note: "820×1180 CSS px" },
  { id: "phone", label: "Phone", width: 390, height: 844, note: "390×844 CSS px" },
  { id: "zoom200", label: "Enlarged 200%", width: 640, height: 400, note: "Desktop at 200% page zoom, approximated as a 640×400 CSS px viewport. Text-only zoom is not simulated." },
];

/** No network from the preview: only same-origin scripts (the inspector) and inline/data assets. */
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'">`;

/**
 * Previews are sandboxed: same-origin is needed to inject and run the inspector, but forms,
 * popups, top-level navigation and downloads are not allowed.
 */
export const PREVIEW_SANDBOX = "allow-same-origin allow-scripts";

export function withCsp(html: string): string {
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${CSP}`) : `${CSP}${html}`;
}

export async function ensureInspector(win: Window): Promise<Api> {
  const w = win as unknown as { ReadabilityLabInspector?: Api };
  if (w.ReadabilityLabInspector) return w.ReadabilityLabInspector;
  const doc = win.document;
  await new Promise<void>((resolve, reject) => {
    const s = doc.createElement("script");
    s.src = new URL(inspectorUrl, location.href).href;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the inspector into the preview"));
    (doc.head ?? doc.documentElement).appendChild(s);
  });
  return w.ReadabilityLabInspector!;
}

export interface PaneMeasurement {
  observations: Observation[];
  regionError: string | null;
  regionSelector: string;
  fit: { charsPerCh: number | null; achievedMedianCpl: number | null; css: string } | null;
  xHeightRatio: number | null;
  timingMs: number;
}

/** Apply settings (or clear them) and measure inside the iframe. Runs locally only. */
export async function applyAndMeasure(win: Window, region: string, settings: TypographySettings | null, opts: { textSpacing: boolean }): Promise<PaneMeasurement> {
  const api = await ensureInspector(win);
  const doc = win.document;
  const reg = api.findRegion(doc, region);
  if (reg.error) {
    return { observations: [], regionError: reg.error, regionSelector: region, fit: null, xHeightRatio: null, timingMs: 0 };
  }
  api.clearSettings(doc, "wb");
  clearTextSpacing(win);
  const fit = settings && Object.keys(settings).length ? api.applySettings(reg.element, settings, { important: true, key: "wb" }) : null;
  // While the toggle is on, the WCAG 1.4.12 overrides stay visible in the preview.
  if (opts.textSpacing) api.applyTextSpacing(doc);
  const res = api.inspect({ element: reg.element, selector: reg.selector, regionMethod: reg.method });
  const xh = res.observations.find((o) => o.metric === "font.xHeightPx");
  return {
    observations: res.observations,
    regionError: null,
    regionSelector: reg.selector,
    fit,
    xHeightRatio: (xh?.details as { xHeightRatio?: number } | undefined)?.xHeightRatio ?? null,
    timingMs: res.timingMs,
  };
}

/** Remove any text-spacing overrides left in the preview. */
export function clearTextSpacing(win: Window): void {
  for (const s of Array.from(win.document.querySelectorAll('style[data-readability-lab="wcag-1-4-12"]'))) s.remove();
  for (const el of Array.from(win.document.querySelectorAll("*"))) {
    const sr = (el as HTMLElement).shadowRoot;
    if (sr) for (const s of Array.from(sr.querySelectorAll('style[data-readability-lab="wcag-1-4-12"]'))) s.remove();
  }
}
