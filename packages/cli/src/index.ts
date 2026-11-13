import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildReport,
  resolvePresentation,
  Recipe,
  VERSION,
  type Environment,
  type Observation,
  type PolicyInput,
  type Profile,
  type Report,
  type RuleException,
  type Scenario,
  type TypographySettings,
} from "@camasuvi/readability-lab-core";
import type { Browser, BrowserContext, Page } from "playwright";

declare const __RL_INSPECTOR_SOURCE__: string | undefined;

/** Source of the in-page inspector bundle (inlined at build time, read from disk in dev). */
export function inspectorSource(): string {
  if (typeof __RL_INSPECTOR_SOURCE__ === "string") return __RL_INSPECTOR_SOURCE__;
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, "../../inspector/dist/inspector.iife.js");
  if (!existsSync(p)) throw new Error(`Inspector bundle not found at ${p}. Run \`pnpm --filter @camasuvi/readability-lab-inspector build\`.`);
  return readFileSync(p, "utf8");
}

export type ScenarioKind = "text-spacing" | "reflow-320" | "zoom-200";
export const ALL_SCENARIOS: ScenarioKind[] = ["text-spacing", "reflow-320", "zoom-200"];

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  laptop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2 },
  phone: { width: 390, height: 844, deviceScaleFactor: 3 },
} as const;
export type Viewport = { width: number; height: number; deviceScaleFactor: number };

export function parseViewport(v: string | undefined): Viewport {
  if (!v) return { ...VIEWPORTS.desktop };
  if (v in VIEWPORTS) return { ...VIEWPORTS[v as keyof typeof VIEWPORTS] };
  const m = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(v);
  if (!m) throw new Error(`Bad viewport "${v}". Use desktop|laptop|tablet|phone or WIDTHxHEIGHT[@DPR].`);
  return { width: +m[1]!, height: +m[2]!, deviceScaleFactor: m[3] ? +m[3] : 1 };
}

export function toUrl(target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
  return pathToFileURL(resolve(target)).href;
}

/** A failure of the run itself (browser, navigation), as opposed to a usage error. The CLI exits with 3. */
export class OperationalError extends Error {
  readonly exitCode = 3;
}
/** Bad arguments or input files. The CLI exits with 2. */
export class UsageError extends Error {
  readonly exitCode = 2;
}
export const BROWSERS = ["chromium", "firefox", "webkit"] as const;
/** Longest wait for web fonts before measuring with whatever has loaded (reported as fonts status). */
const FONT_WAIT_MS = 5000;

export interface InspectPageOptions {
  selector?: string | null;
  scenarioId?: string;
  privacy?: boolean;
  /** Settings to apply (recipe/profile) before measuring. */
  settings?: TypographySettings | null;
  /** Starting calibration for CPL targets (from a recipe). */
  charsPerCh?: number | null;
  exceptionSelectors?: string[];
  textSpacing?: boolean;
  pageOverflow?: boolean;
}

interface PageInspectResult {
  region: { selector: string; method: Report["target"]["regionMethod"]; candidates: { selector: string; score: number }[]; error: string | null };
  observations: Observation[];
  page: { url: string; title: string; viewport: Viewport; fontsStatus: string; userAgent: string; readyState: string };
  fit: { charsPerCh: number | null; achievedMedianCpl: number | null; iterations: number; css: string } | null;
}

async function ensureInspector(page: Page): Promise<void> {
  const has = await page.evaluate(() => typeof (globalThis as Record<string, unknown>).ReadabilityLabInspector !== "undefined").catch(() => false);
  if (!has) await page.addScriptTag({ content: inspectorSource() });
}

/** Run the in-page inspector on an already loaded Playwright page. Usable from Playwright tests. */
export async function inspectPage(page: Page, opts: InspectPageOptions = {}): Promise<PageInspectResult> {
  await ensureInspector(page);
  // Bounded: a font request that never finishes must not hang the run. The report's fonts status says "loading" then.
  await page.evaluate((ms) => Promise.race([document.fonts?.ready.then(() => undefined), new Promise<void>((r) => setTimeout(r, ms))]), FONT_WAIT_MS).catch(() => undefined);
  return page.evaluate((o: InspectPageOptions) => {
    const api = (globalThis as unknown as { ReadabilityLabInspector: typeof import("@camasuvi/readability-lab-inspector") }).ReadabilityLabInspector;
    const reg = api.findRegion(document, o.selector ?? null);
    const base = { scenarioId: o.scenarioId, privacy: o.privacy, exceptionSelectors: o.exceptionSelectors, pageOverflow: o.pageOverflow };
    // A missing explicit region is an error: never apply settings to, or measure, something else.
    if (reg.error) return { ...api.inspect({ ...base, selector: o.selector ?? null }), fit: null } as unknown as PageInspectResult;
    const fit = o.settings ? api.applySettings(reg.element, o.settings, { important: true, key: "cli", charsPerCh: o.charsPerCh ?? null }) : null;
    const opts = { ...base, element: reg.element, selector: reg.selector, regionMethod: reg.method };
    const res = o.textSpacing ? api.inspectWithTextSpacing(opts) : api.inspect(opts);
    return { ...res, fit } as unknown as PageInspectResult;
  }, opts) as Promise<PageInspectResult>;
}

export interface InspectUrlOptions {
  target: string;
  selector?: string | null;
  viewport?: Viewport;
  browser?: "chromium" | "firefox" | "webkit";
  scenarios?: ScenarioKind[];
  recipe?: Recipe | null;
  profile?: Profile | null;
  policy?: PolicyInput;
  privacy?: boolean;
  waitFor?: string | null;
  waitMs?: number;
  screenshots?: string | null;
  axe?: boolean;
  colorScheme?: "light" | "dark";
  timeoutMs?: number;
  exceptions?: RuleException[];
  /** Inspect the document even when the server answers with an HTTP error status. */
  allowHttpErrors?: boolean;
}

async function launch(kind: InspectUrlOptions["browser"]): Promise<Browser> {
  if (kind && !BROWSERS.includes(kind)) throw new UsageError(`Unknown browser "${kind}". Use ${BROWSERS.join(", ")}.`);
  const pw = await import("playwright");
  const type = kind === "firefox" ? pw.firefox : kind === "webkit" ? pw.webkit : pw.chromium;
  try {
    return await type.launch({ headless: true });
  } catch (e) {
    throw new OperationalError(`Could not start ${kind ?? "chromium"}: ${(e as Error).message.split("\n")[0]} (try: npx playwright install ${kind ?? "chromium"})`);
  }
}

async function openPage(ctx: BrowserContext, url: string, opts: InspectUrlOptions): Promise<{ page: Page; loadState: string }> {
  const page = await ctx.newPage();
  let loadState = "load";
  const response = await page.goto(url, { waitUntil: "load", timeout: opts.timeoutMs ?? 45000 });
  // An error page is not the requested content: measuring it would report on the wrong document.
  if (response && response.status() >= 400 && !opts.allowHttpErrors) throw new Error(`HTTP ${response.status()} for ${url} (use --allow-http-errors to inspect the error page itself)`);
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
    loadState = "networkidle";
  } catch {
    loadState = "load (network not idle after 5s)";
  }
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { timeout: opts.timeoutMs ?? 45000 });
  if (opts.waitMs) await page.waitForTimeout(opts.waitMs);
  return { page, loadState };
}

/** Settings to apply for a recipe and/or reader profile, resolved with the shared precedence. */
export function settingsFor(opts: { recipe?: Recipe | null; profile?: Profile | null; host?: string | null; viewportWidth: number }): TypographySettings | null {
  if (!opts.recipe && !opts.profile) return null;
  const { settings } = resolvePresentation({ recipe: opts.recipe ?? null, profile: opts.profile ?? null, host: opts.host ?? null, viewportWidth: opts.viewportWidth });
  return Object.keys(settings).length ? settings : null;
}

/** Open a URL or file in a real browser, run the requested scenarios, and build a report. */
export async function inspectUrl(opts: InspectUrlOptions): Promise<{ report: Report; screenshots: string[]; operationalErrors: string[] }> {
  const url = toUrl(opts.target);
  const viewport = opts.viewport ?? { ...VIEWPORTS.desktop };
  const browser = await launch(opts.browser);
  const browserName = browser.browserType().name();
  const browserVersion = browser.version();
  const scenarios: Scenario[] = [];
  const observations: Observation[] = [];
  const shots: string[] = [];
  const uncertainty: string[] = [];
  const host = (() => {
    try {
      return new URL(url).hostname || null;
    } catch {
      return null;
    }
  })();
  const exceptionSelectors = [...(opts.policy?.exceptions ?? []), ...(opts.recipe?.exceptions ?? []), ...(opts.exceptions ?? [])].map((e) => e.selector).filter((s): s is string => !!s);
  const settingsAt = (width: number) => settingsFor({ recipe: opts.recipe, profile: opts.profile, host, viewportWidth: width });
  const applied = settingsAt(viewport.width);
  const proposedLabel = opts.recipe ? `recipe "${opts.recipe.name}"` : opts.profile ? "reader profile" : null;
  let baseline: PageInspectResult | null = null;
  let loadStateAll = "load";
  try {
    const run = async (sc: Scenario, vp: Viewport, extra: Partial<InspectPageOptions>) => {
      // bypassCSP lets the inspector (and its measurement-only styles) run on CSP- and
      // Trusted-Types-hardened pages; CSP does not change layout, so measurements are unaffected.
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, colorScheme: opts.colorScheme ?? "light", reducedMotion: "reduce", bypassCSP: true });
      try {
        const { page, loadState } = await openPage(ctx, url, opts);
        loadStateAll = loadState;
        // Resolve recipe/profile at this scenario's viewport so responsive overrides apply.
        const settings = settingsAt(vp.width);
        const res = await inspectPage(page, { selector: opts.selector, scenarioId: sc.id, privacy: opts.privacy, settings, charsPerCh: opts.recipe?.calibration?.charsPerCh ?? null, exceptionSelectors, ...extra });
        if (res.fit && sc.id !== "baseline") sc.appliedCss = res.fit.css;
        scenarios.push(sc);
        observations.push(...res.observations);
        if (opts.screenshots) {
          const { mkdirSync } = await import("node:fs");
          mkdirSync(opts.screenshots, { recursive: true });
          const file = resolve(opts.screenshots, `${sc.id}.png`);
          await page.screenshot({ path: file, fullPage: true, animations: "disabled" }).catch(() => undefined);
          shots.push(file);
        }
        if (opts.axe && sc.kind === "baseline") await runAxe(page, res.region.selector, observations, uncertainty);
        return res;
      } catch (e) {
        scenarios.push(sc);
        observations.push({ id: `${sc.id}:error`, metric: "measurement.error", value: null, unit: null, status: "unknown", method: "cli@1", scenarioId: sc.id, element: null, distribution: null, unknownReason: `Scenario failed: ${(e as Error).message.split("\n")[0]}`, details: {} });
        return null;
      } finally {
        await ctx.close();
      }
    };
    const baseDesc = proposedLabel ? `Page with ${proposedLabel} applied` : "Page as published";
    baseline = await run({ id: "baseline", label: "Baseline", kind: "baseline", fidelity: "real-browser", description: baseDesc, viewport, appliedCss: null }, viewport, {});
    if (baseline?.fit && scenarios[0]) scenarios[0].appliedCss = baseline.fit.css;
    const wanted = opts.scenarios ?? [];
    if (wanted.includes("text-spacing"))
      await run({ id: "text-spacing", label: "WCAG 1.4.12 text spacing", kind: "text-spacing", fidelity: "real-browser", description: "applying line-height 1.5, paragraph spacing 2em, letter spacing 0.12em and word spacing 0.16em (document and open shadow roots)", viewport, appliedCss: null }, viewport, { textSpacing: true, pageOverflow: false });
    if (wanted.includes("reflow-320")) {
      const vp = { width: 320, height: 256, deviceScaleFactor: viewport.deviceScaleFactor };
      await run({ id: "reflow-320", label: "320 CSS px reflow", kind: "reflow-320", fidelity: "real-browser", description: "rendering at a 320×256 CSS px viewport", viewport: vp, appliedCss: null }, vp, {});
    }
    if (wanted.includes("zoom-200")) {
      const vp = { width: Math.round(viewport.width / 2), height: Math.round(viewport.height / 2), deviceScaleFactor: viewport.deviceScaleFactor * 2 };
      await run({ id: "zoom-200", label: "200% zoom (approximation)", kind: "zoom-200", fidelity: "approximation", description: `emulating 200% page zoom as a ${vp.width}×${vp.height} CSS px viewport at ${vp.deviceScaleFactor}x; browser text-only zoom is not tested`, viewport: vp, appliedCss: null }, vp, {});
    }
  } finally {
    await browser.close();
  }
  if (baseline?.fit?.charsPerCh) uncertainty.push(`Measure calibrated in ${browserName} ${browserVersion}: ${baseline.fit.charsPerCh} rendered characters per ch (median ${baseline.fit.achievedMedianCpl} CPL after ${baseline.fit.iterations} iteration(s)).`);
  if (baseline && baseline.page.fontsStatus !== "loaded") uncertainty.push(`Web fonts were still ${baseline.page.fontsStatus} after ${FONT_WAIT_MS / 1000}s; text was measured in the fonts available then, so line lengths may differ once they load.`);
  if (opts.profile) uncertainty.push("A reader profile was applied; results describe that reader's settings, not the published page.");
  const environment: Environment = {
    tool: "readability-lab-cli",
    toolVersion: VERSION,
    browser: browserName,
    browserVersion,
    userAgent: baseline?.page.userAgent ?? null,
    viewport,
    colorScheme: opts.colorScheme ?? "light",
    fontsStatus: baseline?.page.fontsStatus ?? null,
    loadState: loadStateAll,
  };
  const recipe = opts.recipe ?? null;
  const report = buildReport({
    target: {
      url,
      title: baseline?.page.title ?? null,
      regionSelector: baseline?.region.selector ?? opts.selector ?? null,
      regionMethod: baseline?.region.method ?? (opts.selector ? "explicit-selector" : "whole-document"),
    },
    environment,
    scenarios,
    observations,
    policy: opts.policy,
    // The calibration recorded is the one that produced the applied CSS in this run.
    proposed: recipe || applied ? { recipe: recipe && baseline?.fit?.charsPerCh ? { ...recipe, calibration: { charsPerCh: baseline.fit.charsPerCh, fontFamily: applied?.fontFamily ?? (baseline.observations.find((o) => o.metric === "font.firstAvailableFamily")?.value as string | null) ?? "page font", sampleId: url, measuredWith: `${browserName} ${browserVersion} at ${viewport.width}×${viewport.height}` } } : recipe, settings: applied } : null,
    preferences: opts.profile ? Object.keys(opts.profile.settings) : [],
    exceptions: opts.exceptions,
    artifacts: shots.map((p) => ({ kind: "screenshot", path: p, description: "Full-page screenshot" })),
    uncertainty,
  });
  const operationalErrors = observations.filter((o) => o.metric === "measurement.error").map((o) => o.unknownReason ?? "unknown error");
  return { report, screenshots: shots, operationalErrors };
}

async function runAxe(page: Page, selector: string, observations: Observation[], uncertainty: string[]): Promise<void> {
  try {
    const require = createRequire(import.meta.url);
    const src = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
    await page.addScriptTag({ content: src });
    const result = await page.evaluate(async (sel) => {
      const axe = (globalThis as unknown as { axe: { run: (ctx: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[]; incomplete: { id: string; nodes: unknown[] }[] }>; version: string } }).axe;
      const r = await axe.run(document.querySelector(sel) ?? document, { runOnly: { type: "rule", values: ["color-contrast", "color-contrast-enhanced", "meta-viewport", "link-in-text-block"] } });
      return { version: axe.version, violations: r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) })), incomplete: r.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })) };
    }, selector);
    observations.push({ id: "baseline:integration.axe:1", metric: "integration.axe", value: result.violations.reduce((s, v) => s + v.nodes.length, 0), unit: "violating nodes", status: "measured", method: `axe-core@${result.version}`, scenarioId: "baseline", element: null, distribution: null, unknownReason: null, details: result as unknown as Record<string, unknown> });
    uncertainty.push(`axe-core ${result.version} cross-check: ${result.violations.map((v) => `${v.id} ×${v.nodes.length}`).join(", ") || "no violations"}${result.incomplete.length ? `; incomplete: ${result.incomplete.map((i) => `${i.id} ×${i.count}`).join(", ")}` : ""}. axe results are reported alongside, not merged into findings.`);
  } catch (e) {
    uncertainty.push(`axe-core cross-check unavailable: ${(e as Error).message.split("\n")[0]}`);
  }
}

export { loadJson } from "./io.js";
