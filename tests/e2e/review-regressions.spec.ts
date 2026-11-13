// Regression tests for issues found in navigator review 2 (GPT-6-astra).
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectorSource, inspectPage, inspectUrl } from "../../packages/cli/dist/index.js";
import { compareReports, Recipe, recipeToCss } from "../../packages/core/dist/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const fx = (n: string) => resolve(here, "../../fixtures", n);
type Obs = { metric: string; value: unknown; status: string; scenarioId: string; element: { selector: string } | null; details: Record<string, unknown> };
type Fnd = { kind: string; ruleId: string; scenarioId: string; title: string; element: { selector: string } | null; exception: unknown };

test("short lines and column boundaries are separate lines", async ({ page }) => {
  await page.goto(pathToFileURL(fx("ground-truth/lines-known.html")).href);
  await page.addScriptTag({ content: inspectorSource() });
  const r = await page.evaluate(() => {
    const api = (globalThis as unknown as { ReadabilityLabInspector: { measureLines: (el: Element) => { lines: { block: number; chars: number }[]; blocks: Element[] } } }).ReadabilityLabInspector;
    const m = api.measureLines(document.querySelector("#gt")!);
    const of = (id: string) => m.lines.filter((l) => m.blocks[l.block]!.id === id).map((l) => l.chars);
    return { p6: of("p6"), p7: of("p7") };
  });
  expect(r.p6).toEqual([1, 1, 1, 1]);
  expect(r.p7).toEqual([7, 7, 11, 9, 9, 7]);
});

test.describe("adversarial fixture", () => {
  let report: Awaited<ReturnType<typeof inspectUrl>>["report"];
  test.beforeAll(async () => {
    const policy = { format: "readability-lab/policy" as const, formatVersion: 1 as const, exceptions: [{ ruleId: "contrast-aa", selector: "#twin-a", reason: "Pending redesign", reviewBy: "2099-01-01", approvedBy: null }] };
    report = (await inspectUrl({ target: fx("adversarial.html"), selector: "#adv", scenarios: ["text-spacing", "reflow-320"], policy })).report;
  });
  const sample = (sel: string) => report.observations.find((o: Obs) => o.metric === "contrast.sample" && (o.element?.selector === sel || ((o.details.otherSelectors as string[] | undefined) ?? []).includes(sel)));

  test("hidden text (closed details, sr-only ancestors) is neither sampled nor failed", () => {
    expect(sample("#hidden-low")).toBeUndefined();
    expect(sample("#sr-low")).toBeUndefined();
    expect(sample("#summary")).toBeTruthy();
  });
  test("overlays above or siblings behind text make contrast unknown, including off-screen text", () => {
    expect(sample("#under-overlay")?.status).toBe("unknown");
    expect(sample("#white-on-sibling")?.status).toBe("unknown");
    expect(report.findings.find((f: Fnd) => f.element?.selector === "#white-on-sibling")?.kind).toBe("needs-review");
  });
  test("an exception on one element does not excuse an identical element", () => {
    const a = report.findings.find((f: Fnd) => f.element?.selector === "#twin-a" && f.ruleId === "contrast-aa")!;
    const b = report.findings.find((f: Fnd) => f.element?.selector === "#twin-b" && f.ruleId === "contrast-aa")!;
    expect(a.kind).toBe("accessibility-failure");
    expect(a.exception).toBeTruthy();
    expect(b.kind).toBe("accessibility-failure");
    expect(b.exception).toBeNull();
  });
  test("text spacing: inline !important spacing is reported as incomplete; button and open-shadow clipping are caught", () => {
    const ts = report.findings.filter((f: Fnd) => f.scenarioId === "text-spacing");
    expect(ts.some((f: Fnd) => f.kind === "pass")).toBe(false);
    expect(ts.find((f: Fnd) => /did not apply/.test(f.title))?.kind).toBe("needs-review");
    const failed = ts.filter((f: Fnd) => f.kind === "accessibility-failure").map((f: Fnd) => f.element?.selector);
    expect(failed).toEqual(expect.arrayContaining(["#clip-btn"]));
    expect(failed.some((s: string | undefined) => s?.includes("div"))).toBe(true); // div inside the open shadow root
  });
  test("reflow decisions include text hidden at 320px", () => {
    const rf = report.findings.filter((f: Fnd) => f.scenarioId === "reflow-320");
    expect(rf.find((f: Fnd) => f.element?.selector === "#reflow-clip")?.kind).toBe("accessibility-failure");
    expect(rf.some((f: Fnd) => f.kind === "pass")).toBe(false);
  });
});

test("a missing region with settings is an error and is not measured or styled", async ({ page }) => {
  await page.goto(pathToFileURL(fx("article-balanced.html")).href);
  const res = await inspectPage(page, { selector: "#missing", settings: { fontSizePx: 30 } });
  expect(res.region.error).toMatch(/matched no element/);
  expect(res.observations.map((o: Obs) => o.metric)).toEqual(["measurement.error"]);
  expect(await page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("18px");
});

test("the CLI exits 3 when a page cannot be inspected as requested", () => {
  const bin = resolve(here, "../../packages/cli/bin/rlab.mjs");
  let code = 0;
  try {
    execFileSync("node", [bin, "check", fx("does-not-exist.html"), "--scenarios", "none"], { stdio: "pipe" });
  } catch (e) {
    code = (e as { status: number }).status;
  }
  expect(code).toBe(3);
});

test("responsive recipe overrides are applied at each scenario's viewport", async () => {
  const recipe = Recipe.parse({ format: "readability-lab/recipe", formatVersion: 1, id: "r", name: "R", settings: { fontSizePx: 18 }, responsive: [{ label: "Phone", minWidthPx: null, maxWidthPx: 600, settings: { fontSizePx: 30 } }] });
  const { report } = await inspectUrl({ target: fx("article-balanced.html"), selector: "article", recipe, scenarios: ["reflow-320"] });
  const size = (sc: string) => report.observations.find((o: Obs) => o.metric === "text.fontSizePx" && o.scenarioId === sc)?.value;
  expect(size("baseline")).toBe(18);
  expect(size("reflow-320")).toBe(30);
});

test("exported CSS reproduces the measured line length without re-fitting", async ({ page }) => {
  const recipe = Recipe.parse({ format: "readability-lab/recipe", formatVersion: 1, id: "c", name: "C", scope: { selector: ".post-content" }, settings: { fontSizePx: 18, lineHeight: 1.5, measure: { value: 65, unit: "cpl" } }, calibration: { charsPerCh: 5, fontFamily: "stale", sampleId: null, measuredWith: "stale" } });
  const { report } = await inspectUrl({ target: fx("blog-post.html"), selector: ".post-content", recipe });
  const exported = report.proposed!.recipe!;
  expect(exported.calibration!.charsPerCh).not.toBe(5);
  await page.goto(pathToFileURL(fx("blog-post.html")).href);
  await page.addStyleTag({ content: recipeToCss(exported, { important: true }) });
  const res = await inspectPage(page, { selector: ".post-content" });
  const cpl = res.observations.find((o: Obs) => o.metric === "layout.cpl")!;
  expect(Math.abs(Number(cpl.value) - 65)).toBeLessThanOrEqual(2);
});

test("omitting a check in the after report leaves its findings untested, not resolved", async () => {
  const before = (await inspectUrl({ target: fx("broken-clipping.html"), scenarios: ["reflow-320"] })).report;
  const after = (await inspectUrl({ target: fx("broken-clipping.html"), scenarios: [] })).report;
  const cmp = compareReports(before, after);
  expect(cmp.comparable).toBe(false);
  expect(cmp.findingsResolved.filter((f: Fnd) => f.scenarioId === "reflow-320")).toEqual([]);
  expect(cmp.findingsUntested.length).toBeGreaterThan(0);
});

test("decoration below an opaque ancestor does not block contrast; decoration directly behind text does", async () => {
  const { report } = await inspectUrl({ target: fx("layer-behind-opaque.html"), selector: "#m" });
  const s = (sel: string) => report.observations.find((o: Obs) => o.metric === "contrast.sample" && (o.element?.selector === sel || ((o.details.otherSelectors as string[] | undefined) ?? []).includes(sel)));
  expect(s("#in-card")?.status).toBe("measured");
  expect(s("#on-glow")?.status).toBe("unknown");
  expect(s("#own-bg")?.status).toBe("measured"); // its own opaque background hides the glow
  expect(s("#cv-text")?.status).toBe("measured"); // content-visibility: auto section far below the fold
});

/* ---------- review 4: scripts, CLI exit codes, hangs ---------- */
const rlab = (args: string[], env: Record<string, string> = {}) => {
  const bin = resolve(here, "../../packages/cli/bin/rlab.mjs");
  try {
    return { code: 0, out: execFileSync("node", [bin, ...args], { stdio: "pipe", env: { ...process.env, ...env } }).toString() };
  } catch (e) {
    const err = e as { status: number; stderr: Buffer; stdout: Buffer };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
};

test("the static server refuses symlinks out of its root and survives malformed requests", async () => {
  const { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const http = await import("node:http");
  const { serve } = (await import(pathToFileURL(resolve(here, "../../scripts/serve.mjs")).href)) as { serve: (o: { root: string; port: number; quiet: boolean }) => Promise<import("node:http").Server> };
  const dir = mkdtempSync(resolve(tmpdir(), "rl-serve-"));
  mkdirSync(resolve(dir, "public"));
  writeFileSync(resolve(dir, "secret.txt"), "OUTSIDE");
  writeFileSync(resolve(dir, "public/ok.txt"), "INSIDE");
  symlinkSync(resolve(dir, "secret.txt"), resolve(dir, "public/escape.txt"));
  symlinkSync(dir, resolve(dir, "public/up"));
  const server = await serve({ root: resolve(dir, "public"), port: 4398, quiet: true });
  const get = (path: string) => new Promise<{ status: number; body: string }>((ok, fail) => http.get({ host: "localhost", port: 4398, path }, (res) => { let body = ""; res.on("data", (d) => (body += d)); res.on("end", () => ok({ status: res.statusCode ?? 0, body })); }).on("error", fail));
  try {
    expect((await get("/escape.txt")).status).toBe(403);
    expect((await get("/up/secret.txt")).status).toBe(403);
    for (const bad of ["/%", "/%E0%A4%A", "//["]) expect((await get(bad)).status).toBe(400);
    // Still serving after the malformed requests.
    expect(await get("/ok.txt")).toEqual({ status: 200, body: "INSIDE" });
  } finally {
    server.close();
  }
});

test("the CLI tells usage errors (2) from operational failures (3)", async () => {
  const http = await import("node:http");
  expect(rlab(["inspect", fx("article-balanced.html"), "--browser", "safari"])).toMatchObject({ code: 2, out: expect.stringContaining('Unknown browser "safari"') });
  expect(rlab(["inspect", fx("article-balanced.html")], { PLAYWRIGHT_BROWSERS_PATH: "/nonexistent-rl-browsers" })).toMatchObject({ code: 3, out: expect.stringContaining("Could not start chromium") });
  // An HTTP error page is not the requested document.
  const server = http.createServer((_q, res) => res.writeHead(404, { "content-type": "text/html" }).end(`<main><h1>Page not found</h1><p>${"Nothing here. ".repeat(40)}</p></main>`));
  await new Promise<void>((ok) => server.listen(4397, "localhost", ok));
  try {
    const { execFile } = await import("node:child_process");
    const run = (extra: string[]) => new Promise<number>((ok) => execFile("node", [resolve(here, "../../packages/cli/bin/rlab.mjs"), "check", "http://localhost:4397/missing", "--scenarios", "none", ...extra], (e) => ok(e ? ((e as { code?: number }).code ?? 1) : 0)));
    expect(await run([])).toBe(3);
    expect(await run(["--allow-http-errors"])).not.toBe(3);
  } finally {
    server.close();
  }
});

test("a web font that never finishes loading does not hang the inspection", async ({ page }) => {
  await page.route("**/never.woff2", () => undefined); // never answered
  await page.route("http://rl.test/", (r) => r.fulfill({ contentType: "text/html", body: `<style>@font-face{font-family:Never;src:url(/never.woff2)}</style><main><p>${"Text that wraps over several lines for the measurement. ".repeat(12)}</p></main><script>addEventListener("load",()=>{document.querySelector("p").style.fontFamily="Never, serif"})</script>` }));
  await page.goto("http://rl.test/");
  const started = Date.now();
  const res = await inspectPage(page, { selector: "main" });
  expect(Date.now() - started).toBeLessThan(12000);
  expect((res.observations as Obs[]).some((o) => o.metric === "layout.cpl")).toBe(true);
});
