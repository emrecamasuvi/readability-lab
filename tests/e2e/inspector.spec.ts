import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Built bundle (run `pnpm build` first); it inlines core + inspector.
import { inspectPage, inspectUrl } from "../../packages/cli/dist/index.js";

const fx = (name: string) => resolve(__dirname, "../../fixtures", name);
const url = (name: string) => pathToFileURL(fx(name)).href;

type Obs = { metric: string; value: unknown; status: string; scenarioId: string; element: { selector: string } | null; details: Record<string, unknown> };
type Fnd = { kind: string; ruleId: string; scenarioId: string; element: { selector: string } | null; claimIds: string[]; wcag: { criterion: string } | null };

test.describe("rendered line measurement (ground truth)", () => {
  test("counts characters per line exactly for forced lines", async ({ page }) => {
    await page.goto(url("ground-truth/lines-known.html"));
    await inspectPage(page, { selector: "#gt" });
    const perBlock = await page.evaluate(() => {
      const api = (globalThis as unknown as { ReadabilityLabInspector: { measureLines: (el: Element) => { lines: { block: number; chars: number; final: boolean }[]; blocks: Element[] } } }).ReadabilityLabInspector;
      const m = api.measureLines(document.querySelector("#gt")!);
      return m.blocks.map((b, i) => ({ id: b.id, chars: m.lines.filter((l) => l.block === i).map((l) => l.chars), finals: m.lines.filter((l) => l.block === i).map((l) => l.final) }));
    });
    const byId = Object.fromEntries(perBlock.map((b) => [b.id, b]));
    expect(byId.p1!.chars).toEqual([21, 32, 2]);
    expect(byId.p1!.finals).toEqual([false, false, true]);
    expect(byId.p2!.chars).toEqual([31, 31, 3]); // precomposed and combining é each count once; text split across <span>
    expect(byId.p3!.chars).toEqual([36, 3]); // ZWJ family and flag sequences count as one grapheme each
    expect(byId.p4!.chars).toEqual([32, 3]); // inline em/strong/code count, spaces between inline elements count
    expect(byId.p5!.chars).toEqual([32, 3]); // collapsed whitespace counts once
  });

  test("a 60ch monospace column never exceeds 60 characters per line", async ({ page }) => {
    await page.goto(url("ground-truth/mono-60ch.html"));
    const res = await inspectPage(page, { selector: "#mono" });
    const cpl = res.observations.find((o: Obs) => o.metric === "layout.cpl")!;
    expect(cpl.status).toBe("measured");
    expect(cpl.distribution!.max).toBeLessThanOrEqual(60);
    expect(cpl.distribution!.median).toBeGreaterThanOrEqual(52);
  });
});

test.describe("acceptance 4: broken fixtures and honest unknowns", () => {
  test("broken contrast is an accessibility failure with WCAG and claim ids", async () => {
    const { report } = await inspectUrl({ target: fx("broken-contrast.html") });
    const fails = report.findings.filter((f: Fnd) => f.kind === "accessibility-failure");
    const sel = fails.map((f: Fnd) => f.element?.selector);
    expect(sel).toEqual(expect.arrayContaining(["#low", "#callout"]));
    for (const f of fails) {
      expect(f.wcag?.criterion).toBe("1.4.3");
      expect(f.claimIds).toContain("C-CONTRAST-001");
    }
    // 26px #8a8a8a is large text: passes AA (3:1) but not the 7:1/4.5:1 target -> heuristic only
    const large = report.findings.filter((f: Fnd) => f.element?.selector === "#large");
    expect(large.every((f: Fnd) => f.kind !== "accessibility-failure")).toBe(true);
  });

  test("clipping under text spacing is detected in a real browser; reflow culprits are attributed", async () => {
    const { report } = await inspectUrl({ target: fx("broken-clipping.html"), scenarios: ["text-spacing", "reflow-320"] });
    const ts = report.findings.filter((f: Fnd) => f.scenarioId === "text-spacing");
    expect(ts.find((f: Fnd) => f.kind === "accessibility-failure" && f.element?.selector === "#card")).toBeTruthy();
    expect(ts.find((f: Fnd) => f.element?.selector === "#spill")?.kind).toBe("needs-review");
    expect(ts.some((f: Fnd) => f.kind === "pass")).toBe(false);
    const cov = report.observations.find((o: Obs) => o.metric === "scenario.overridesNotApplied" && o.scenarioId === "text-spacing")!;
    expect(cov.value).toBe(0);
    const rf = report.findings.filter((f: Fnd) => f.scenarioId === "reflow-320" && f.kind === "accessibility-failure").map((f: Fnd) => f.element?.selector);
    expect(rf.sort()).toEqual(["#card", "#nowrap", "#wide"]); // #card: fixed-height box loses text at 320px
    // The image clipped inside a text box is not reported as lost text.
    expect(report.findings.some((f: Fnd) => f.element?.selector === "#imgbox")).toBe(false);
  });

  test("gradients, opacity and overlapping layers are unresolved, never passing", async () => {
    const { report } = await inspectUrl({ target: fx("unresolved-background.html") });
    for (const sel of ["#hero > p", "#faded > p", "#overlay-text"]) {
      const obs = report.observations.find((o: Obs) => o.metric === "contrast.sample" && o.element?.selector === sel);
      expect(obs, sel).toBeTruthy();
      expect(obs!.status).toBe("unknown");
      expect(obs!.value).toBeNull();
      const f = report.findings.find((x: Fnd) => x.element?.selector === sel);
      expect(f?.kind).toBe("needs-review");
    }
  });

  test("canvas, opaque frames and closed shadow roots are reported as unsupported", async () => {
    const { report } = await inspectUrl({ target: fx("canvas-frame-shadow.html") });
    const unsupported = report.findings.filter((f: Fnd) => f.kind === "unsupported-check").map((f: Fnd) => f.element?.selector);
    expect(unsupported).toEqual(expect.arrayContaining(["#cv", "#xframe", "#closed"]));
  });

  test("an incomplete scenario is never reported as a pass", async () => {
    const { report } = await inspectUrl({ target: fx("article-balanced.html"), selector: "#does-not-exist", scenarios: ["text-spacing"] });
    expect(report.observations.some((o: Obs) => o.metric === "measurement.error")).toBe(true);
    expect(report.findings.some((f: Fnd) => f.kind === "pass")).toBe(false);
    expect(report.findings.find((f: Fnd) => f.ruleId === "text-spacing")?.kind).toBe("needs-review");
    expect(report.coverage.performed).toEqual([]);
  });
});

test.describe("acceptance 5: heuristics are not failures", () => {
  test("wide, small, tight text yields only heuristic deviations and passes the default policy", async () => {
    const { report } = await inspectUrl({ target: fx("wide-measure.html") });
    const kinds = new Set(report.findings.map((f: Fnd) => f.kind));
    expect(kinds.has("accessibility-failure")).toBe(false);
    const heur = report.findings.filter((f: Fnd) => f.kind === "heuristic-deviation").map((f: Fnd) => f.ruleId);
    expect(heur).toEqual(expect.arrayContaining(["cpl-range", "font-size-range", "line-height-range"]));
    for (const f of report.findings.filter((x: Fnd) => x.kind === "heuristic-deviation")) expect(f.wcag === null || f.wcag.criterion !== "1.4.3").toBe(true);
  });
});

test.describe("scripts and directions", () => {
  test("Latin-derived ranges are not applied to Japanese; Arabic RTL lines are measured", async () => {
    const ja = (await inspectUrl({ target: fx("cjk-japanese.html") })).report;
    expect(ja.findings.some((f: Fnd) => f.ruleId === "cpl-range")).toBe(false);
    expect(ja.findings.find((f: Fnd) => f.ruleId === "script-scope")?.kind).toBe("unsupported-check");
    const ar = (await inspectUrl({ target: fx("rtl-arabic.html") })).report;
    const cpl = ar.observations.find((o: Obs) => o.metric === "layout.cpl")!;
    expect(cpl.status).toBe("measured");
    const lines = ar.observations.find((o: Obs) => o.metric === "layout.lineCount")!;
    expect(Number(lines.value)).toBeGreaterThan(6);
    const tr = (await inspectUrl({ target: fx("turkish.html") })).report;
    expect(tr.observations.find((o: Obs) => o.metric === "text.script")!.value).toBe("Latin");
  });
});

test.describe("recipes are reproducible", () => {
  test("applying a 65 CPL recipe lands near 65 measured CPL and records calibration", async () => {
    const recipe = {
      format: "readability-lab/recipe", formatVersion: 1, id: "balanced-test", name: "Balanced test",
      settings: { fontSizePx: 18, lineHeight: 1.5, measure: { value: 65, unit: "cpl" }, paragraphGapEm: 0.75 },
    };
    const { Recipe } = await import("../../packages/core/dist/index.js");
    const r = Recipe.parse(recipe);
    const { report } = await inspectUrl({ target: fx("blog-post.html"), recipe: r, selector: ".post-content" });
    const cpl = report.observations.find((o: Obs) => o.metric === "layout.cpl")!;
    expect(Math.abs(Number(cpl.value) - 65)).toBeLessThanOrEqual(2);
    expect(report.proposed?.recipe?.calibration?.charsPerCh).toBeGreaterThan(0.8);
    const lh = report.observations.find((o: Obs) => o.metric === "text.lineHeightRatio")!;
    expect(lh.value).toBeCloseTo(1.5, 2);
    // Re-running with the calibrated recipe reproduces the measurement.
    const again = await inspectUrl({ target: fx("blog-post.html"), recipe: report.proposed!.recipe!, selector: ".post-content" });
    const cpl2 = again.report.observations.find((o: Obs) => o.metric === "layout.cpl")!;
    expect(Math.abs(Number(cpl2.value) - Number(cpl.value))).toBeLessThanOrEqual(1);
  });
});
