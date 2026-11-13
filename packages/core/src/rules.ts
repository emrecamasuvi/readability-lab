import { contrastThresholds } from "./color.js";
import type { RuleException } from "./schemas/presentation.js";
import type { Finding, FindingInput, FindingKind, Observation, Policy, PolicyInput, Report } from "./schemas/report.js";
import { Policy as PolicySchema } from "./schemas/report.js";
import { NRQI } from "./version.js";

/** Metric names shared by the inspector (producer) and rules (consumer). */
export const METRICS = {
  cpl: "layout.cpl",
  finalLines: "layout.cpl.paragraphFinalLines",
  lineCount: "layout.lineCount",
  lineWidthPx: "layout.lineWidthPx",
  columnWidthPx: "layout.columnWidthPx",
  contentHeightPx: "layout.contentHeightPx",
  linePitchPx: "layout.linePitchPx",
  paragraphGapEm: "layout.paragraphGapEm",
  fontSizePx: "text.fontSizePx",
  lineHeightRatio: "text.lineHeightRatio",
  fontWeight: "text.fontWeight",
  letterSpacingEm: "text.letterSpacingEm",
  wordSpacingEm: "text.wordSpacingEm",
  textAlign: "text.align",
  fontDeclared: "font.declaredFamily",
  fontRendered: "font.firstAvailableFamily",
  contrastSample: "contrast.sample",
  clipped: "overflow.clippedText",
  overflowingBox: "overflow.overflowingFixedBox",
  pageHorizontalOverflow: "overflow.pageHorizontal",
  horizontalOverflowElement: "overflow.horizontalElement",
  canvas: "unsupported.canvasText",
  frame: "unsupported.frame",
  closedShadow: "unsupported.closedShadowRoot",
  readingControls: "controls.readingSettings",
  themePolarity: "theme.polarity",
  measurementError: "measurement.error",
  contentFingerprint: "region.contentFingerprint",
  script: "text.script",
  xHeightPx: "font.xHeightPx",
  scrollingProse: "overflow.scrollingProse",
  horizontalOverflowUnattributed: "overflow.pageHorizontalUnattributed",
  scenarioCompleted: "scenario.completed",
  overrideCoverage: "scenario.overridesNotApplied",
} as const;

export interface RuleMeta {
  id: string;
  title: string;
  kinds: FindingKind[];
  claimIds: string[];
  wcag?: { criterion: string; level: "A" | "AA" | "AAA" };
  description: string;
}

/** The rule catalog. Every rule names the claims it depends on, so claim revisions are traceable. */
export const RULES: readonly RuleMeta[] = [
  { id: "contrast-aa", title: "Text contrast (WCAG 1.4.3)", kinds: ["accessibility-failure", "needs-review", "pass"], claimIds: ["C-CONTRAST-001", "C-CONTRAST-004"], wcag: { criterion: "1.4.3", level: "AA" }, description: "Computed text/background contrast against the AA threshold (4.5:1, or 3:1 for large text)." },
  { id: "contrast-target", title: "Contrast below 7:1 baseline target", kinds: ["heuristic-deviation", "accessibility-failure"], claimIds: ["C-CONTRAST-002", "C-BASE-001", "C-CONTRAST-003"], wcag: { criterion: "1.4.6", level: "AAA" }, description: "Below the product baseline target (WCAG AAA 1.4.6 threshold). A failure only when the policy targets AAA." },
  { id: "cpl-range", title: "Line length outside the starting range", kinds: ["heuristic-deviation", "pass"], claimIds: ["C-BASE-002", "C-CPL-001", "C-CPL-002", "C-CPL-004", "C-CPL-005", "C-CPL-006", "C-CPL-007"], description: "Measured median characters per line compared with the 50–75 exploration range." },
  { id: "font-size-range", title: "Body text smaller than the starting range", kinds: ["heuristic-deviation"], claimIds: ["C-BASE-002", "C-SIZE-001", "C-SIZE-002"], description: "Nominal body size compared with the 16–22px exploration range. Apparent size is not measured." },
  { id: "line-height-range", title: "Line height outside the starting range", kinds: ["heuristic-deviation"], claimIds: ["C-BASE-002", "C-LH-001", "C-LH-002", "C-LH-003"], description: "Measured line pitch ÷ font size compared with the 1.4–1.7 exploration range." },
  { id: "paragraph-gap", title: "Paragraph separation outside heuristic range", kinds: ["heuristic-deviation"], claimIds: ["C-PARA-001"], description: "Extra gap between paragraphs compared with 0.5–1.0 × text size." },
  { id: "alignment", title: "Justified body text", kinds: ["heuristic-deviation"], claimIds: ["C-ALIGN-001", "C-WCAG-004"], description: "Justified text; start-aligned text is the heuristic default (WCAG AAA 1.4.8 asks for a way to avoid justification)." },
  { id: "weight", title: "Very light or heavy body weight", kinds: ["heuristic-deviation"], claimIds: ["C-WEIGHT-001"], description: "Body weight ≤300 or ≥700." },
  { id: "font-fallback", title: "Declared font appears unavailable", kinds: ["needs-review"], claimIds: ["C-SIZE-001", "C-FONT-004"], description: "The first declared family does not appear to render; apparent size and wrapping may differ from design." },
  { id: "clipping", title: "Clipped or truncated text at baseline", kinds: ["needs-review"], claimIds: ["C-ADAPT-001"], description: "Text cut off by overflow, ellipsis or line clamping. May be intentional; review whether content is available elsewhere." },
  { id: "text-spacing", title: "Content lost under text-spacing overrides (WCAG 1.4.12)", kinds: ["accessibility-failure", "needs-review", "pass"], claimIds: ["C-WCAG-001"], wcag: { criterion: "1.4.12", level: "AA" }, description: "Applies the 1.4.12 override values in a real browser and compares clipping with baseline." },
  { id: "reflow", title: "Two-direction scrolling at 320 CSS px (WCAG 1.4.10)", kinds: ["accessibility-failure", "needs-review", "pass"], claimIds: ["C-WCAG-002"], wcag: { criterion: "1.4.10", level: "AA" }, description: "Renders at 320×256 CSS px and finds elements forcing horizontal scrolling." },
  { id: "zoom-200", title: "Content loss at 200% page zoom (approximation of WCAG 1.4.4)", kinds: ["needs-review", "pass"], claimIds: ["C-WCAG-003"], wcag: { criterion: "1.4.4", level: "AA" }, description: "Approximates 200% page zoom with a half-width viewport at doubled device scale. Text-only zoom is not tested." },
  { id: "unsupported", title: "Content the inspector cannot measure", kinds: ["unsupported-check"], claimIds: ["C-UNKNOWN-001"], description: "Canvas text, inaccessible frames and closed shadow roots." },
  { id: "polarity", title: "Theme polarity is a preference", kinds: ["preference"], claimIds: ["C-THEME-001", "C-THEME-005", "C-THEME-006", "C-OUT-002"], description: "Reports light/dark polarity as context. Neither is universally better." },
  { id: "experiment-line-height", title: "Candidate experiment: 1.5 vs 1.6 line height", kinds: ["experiment-idea"], claimIds: ["C-LH-003", "C-METH-002"], description: "Test with fresh passages before changing a working value." },
  { id: "experiment-font", title: "Candidate experiment: font shortlist", kinds: ["experiment-idea"], claimIds: ["C-FONT-001", "C-FONT-004", "C-SIZE-001", "C-METH-002"], description: "Compare 2–3 text faces at matched apparent size." },
  { id: "script-scope", title: "Latin-derived ranges not applied", kinds: ["unsupported-check"], claimIds: ["C-BASE-002"], description: "Line-length, size and spacing ranges come from Latin-script research and are not applied to other scripts." },
  { id: "reading-controls", title: "Reader adjustment controls", kinds: ["pass", "unsupported-check"], claimIds: ["C-ADAPT-001"], description: "Detects Readability Lab controls. Other control implementations are not automatically detectable." },
];

export function getRule(id: string): RuleMeta | undefined {
  return RULES.find((r) => r.id === id);
}

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

interface Ctx {
  obs: Observation[];
  policy: Policy;
  viewportWidth: number;
  push: (f: Omit<FindingInput, "id" | "claimIds" | "wcag"> & { claimIds?: string[]; wcag?: FindingInput["wcag"] }) => void;
}

function first(obs: Observation[], metric: string, scenarioId = "baseline"): Observation | undefined {
  return obs.find((o) => o.metric === metric && o.scenarioId === scenarioId);
}
function all(obs: Observation[], metric: string, scenarioId = "baseline"): Observation[] {
  return obs.filter((o) => o.metric === metric && o.scenarioId === scenarioId);
}
const num = (o: Observation | undefined) => (o && typeof o.value === "number" && o.status !== "unknown" ? o.value : null);

function contrastRules(c: Ctx) {
  const samples = all(c.obs, METRICS.contrastSample);
  if (!samples.length) {
    c.push({ ruleId: "contrast-aa", kind: "needs-review", title: "No text contrast samples measured", reason: "The inspector found no measurable text in the region. Contrast is unknown, not passing.", verification: "not-tested", priority: "essential", suggestion: "Check the region selector." });
    return;
  }
  let measuredPass = 0;
  for (const s of samples) {
    const d = s.details as { large?: boolean; fg?: string; bg?: string; elementCount?: number };
    if (s.status === "unknown" || typeof s.value !== "number") {
      c.push({ ruleId: "contrast-aa", kind: "needs-review", title: "Contrast could not be resolved", reason: `Background could not be determined: ${s.unknownReason ?? "unknown reason"}. This is not treated as a pass.`, element: s.element, observationIds: [s.id], verification: "manual-review-required", priority: "essential", suggestion: "Check this text manually with a colour picker against the actual rendered background." });
      continue;
    }
    const th = contrastThresholds(!!d.large);
    if (s.status === "estimated") {
      c.push({ ruleId: "contrast-aa", kind: "needs-review", title: `Contrast ${fmt(s.value, 2)}:1 against an assumed background`, reason: `No opaque background was found, so the browser's default canvas was assumed (${d.fg} on ${d.bg}). Verify against the actual rendered background before relying on this.`, element: s.element, observationIds: [s.id], verification: "manual-review-required", priority: "essential", suggestion: "Set an explicit background color on the page or reading region." });
      continue;
    }
    const sizeNote = d.large ? "large-scale text (3:1 AA)" : "ordinary text (4.5:1 AA)";
    if (s.value < th.AA) {
      c.push({ ruleId: "contrast-aa", kind: "accessibility-failure", title: `Contrast ${fmt(s.value, 2)}:1 is below ${th.AA}:1`, reason: `${d.fg} on ${d.bg} measures ${fmt(s.value, 2)}:1 for ${sizeNote}. Affects ${d.elementCount ?? 1} element(s).`, element: s.element, observationIds: [s.id], verification: "computed-from-rendered-styles", priority: "essential", suggestion: `Darken the text or lighten the background to reach at least ${th.AA}:1; the baseline target is ${th.AAA}:1.` });
    } else if (s.value < th.AAA) {
      const aaa = c.policy.conformanceTarget === "AAA";
      c.push({ ruleId: "contrast-target", kind: aaa ? "accessibility-failure" : "heuristic-deviation", title: `Contrast ${fmt(s.value, 2)}:1 meets AA but not ${th.AAA}:1`, reason: `${d.fg} on ${d.bg} passes WCAG 1.4.3 AA. It is below the ${th.AAA}:1 baseline target (WCAG 1.4.6 AAA level). ${aaa ? "Your policy targets AAA." : "This is not an AA failure."} For a universal reading-speed or comprehension gain from more contrast: ${NRQI}`, element: s.element, observationIds: [s.id], verification: "computed-from-rendered-styles", priority: aaa ? "essential" : "recommended", suggestion: `Consider ${th.AAA}:1 for extra margin, especially for readers with reduced contrast sensitivity.`, wcag: { criterion: "1.4.6", level: "AAA" } });
      measuredPass++;
    } else measuredPass++;
  }
  // (Unrounded ratios are compared; rounding happens only for display.)
  if (measuredPass > 0 && !c.obs.some((o) => o.metric === METRICS.contrastSample && o.scenarioId === "baseline" && o.status === "measured" && typeof o.value === "number" && o.value < contrastThresholds(!!(o.details as { large?: boolean }).large).AA)) {
    c.push({ ruleId: "contrast-aa", kind: "pass", title: `${measuredPass} measured text colour pair(s) meet 1.4.3 AA`, reason: "Computed from rendered styles for the sampled text in the region. Unresolved samples are reported separately.", verification: "computed-from-rendered-styles", priority: "informational" });
  }
}

const LATIN_DERIVED_SCRIPTS = new Set(["Latin"]);

function rangeRules(c: Ctx) {
  const { ranges } = c.policy;
  const script = first(c.obs, METRICS.script);
  if (script && typeof script.value === "string" && !LATIN_DERIVED_SCRIPTS.has(script.value)) {
    c.push({ ruleId: "script-scope", kind: "unsupported-check", title: `Line-length and spacing ranges not applied to ${script.value} text`, reason: `The dominant script of this region is ${script.value}. The starting ranges in the registry come from Latin-script research and are not applied to other scripts; the registry records this as an evidence gap. Measurements are still reported.`, observationIds: [script.id], verification: "not-tested", priority: "informational" });
    return;
  }
  const cpl = first(c.obs, METRICS.cpl);
  const median = num(cpl);
  const phone = c.viewportWidth < 600;
  if (cpl && median === null) {
    c.push({ ruleId: "cpl-range", kind: "needs-review", title: "Line length could not be measured", reason: cpl.unknownReason ?? "No full-width lines found.", observationIds: [cpl.id], verification: "not-tested", priority: "informational" });
  } else if (cpl && median !== null) {
    const [lo, hi] = ranges.cpl;
    const dist = cpl.distribution;
    const spread = dist ? ` (10th–90th percentile ${dist.p10}–${dist.p90}, ${dist.count} lines)` : "";
    if (phone && median < lo) {
      c.push({ ruleId: "cpl-range", kind: "pass", title: `Median ${fmt(median, 0)} characters per line on a ${c.viewportWidth}px viewport`, reason: `Phones should keep a useful text size and use the available width rather than force a desktop line length${spread}.`, observationIds: [cpl.id], verification: "computed-from-rendered-styles", priority: "informational", claimIds: ["C-CPL-007"] });
    } else if (median < lo || median > hi) {
      c.push({ ruleId: "cpl-range", kind: "heuristic-deviation", title: `Median ${fmt(median, 0)} characters per line is outside ${lo}–${hi}`, reason: `Measured from rendered line boxes${spread}. ${lo}–${hi} is a starting range, not an accessibility limit or proven optimum. For a fixed improvement from changing line length: ${NRQI}`, element: cpl.element, observationIds: [cpl.id], verification: "computed-from-rendered-styles", priority: "recommended", suggestion: median > hi ? "Consider constraining the column (max-width) so typical lines fall near 60–70 characters, and verify the rendered result." : "Consider a wider column or smaller horizontal padding if space allows; keep text size readable." });
    } else {
      c.push({ ruleId: "cpl-range", kind: "pass", title: `Median ${fmt(median, 0)} characters per line is within ${lo}–${hi}`, reason: `Measured from rendered line boxes${spread}.`, observationIds: [cpl.id], verification: "computed-from-rendered-styles", priority: "informational" });
    }
  }

  const fs = first(c.obs, METRICS.fontSizePx);
  const size = num(fs);
  if (fs && size !== null && size < ranges.fontSizePx[0]) {
    c.push({ ruleId: "font-size-range", kind: "heuristic-deviation", title: `Body text is ${fmt(size)}px, below ${ranges.fontSizePx[0]}px`, reason: `Nominal size from computed styles. Apparent size also depends on the font's x-height and viewing distance, which this tool does not measure. For a transferable gain from a specific size change: ${NRQI}`, element: fs.element, observationIds: [fs.id], verification: "computed-from-rendered-styles", priority: "recommended", suggestion: "Consider 18px for long-form body text, and make sure enlargement remains available." });
  }

  const lh = first(c.obs, METRICS.lineHeightRatio);
  const ratio = num(lh);
  if (lh && ratio !== null && (ratio < ranges.lineHeight[0] || ratio > ranges.lineHeight[1])) {
    c.push({ ruleId: "line-height-range", kind: "heuristic-deviation", title: `Line height ${fmt(ratio, 2)} is outside ${ranges.lineHeight[0]}–${ranges.lineHeight[1]}`, reason: `Ratio of measured baseline distance to font size. This is a starting range, not a requirement. ${NRQI}`, element: lh.element, observationIds: [lh.id], verification: "computed-from-rendered-styles", priority: "recommended", suggestion: ratio < ranges.lineHeight[0] ? "Consider 1.5 as a conservative starting point." : "Very open spacing increases vertical travel; consider 1.5–1.7 unless readers chose it." });
  } else if (lh && ratio !== null) {
    c.push({ ruleId: "experiment-line-height", kind: "experiment-idea", title: "If you are considering 1.5 vs 1.6 line height, test it", reason: `Current ratio ${fmt(ratio, 2)} is inside the starting range. For changing 1.5→1.6: ${NRQI} Compare with fresh passages and separate speed, comprehension and comfort.`, observationIds: [lh.id], verification: "not-tested", priority: "experimental" });
  }

  const gap = first(c.obs, METRICS.paragraphGapEm);
  const g = num(gap);
  if (gap && g !== null && (g < ranges.paragraphGapEm[0] || g > ranges.paragraphGapEm[1] * 2)) {
    c.push({ ruleId: "paragraph-gap", kind: "heuristic-deviation", title: `Paragraph gap is ${fmt(g, 2)}× text size`, reason: `The extra gap between paragraphs is outside the heuristic ${ranges.paragraphGapEm[0]}–${ranges.paragraphGapEm[1]}× range (values up to 2× are tolerated before reporting). A heuristic only.`, observationIds: [gap.id], verification: "computed-from-rendered-styles", priority: "informational", suggestion: "About 0.75× text size separates ideas without fragmenting them." });
  }

  const align = first(c.obs, METRICS.textAlign);
  if (align && align.value === "justify") {
    c.push({ ruleId: "alignment", kind: "heuristic-deviation", title: "Body text is justified", reason: "Justification can create uneven word gaps. Start-aligned text is the heuristic default; WCAG 1.4.8 (AAA) asks for a way to avoid justified text.", element: align.element, observationIds: [align.id], verification: "computed-from-rendered-styles", priority: "recommended", suggestion: "Use start alignment (text-align: start) for body text.", wcag: { criterion: "1.4.8", level: "AAA" } });
  }

  const w = first(c.obs, METRICS.fontWeight);
  const weight = num(w);
  if (w && weight !== null && (weight <= 300 || weight >= 700)) {
    c.push({ ruleId: "weight", kind: "heuristic-deviation", title: `Body weight is ${weight}`, reason: "Very thin or heavy body text can lose stroke or counter detail. Regular/book weights are the heuristic default.", observationIds: [w.id], verification: "computed-from-rendered-styles", priority: "recommended", suggestion: "Use a regular (400) or book weight for body text and inspect at actual size." });
  }
}

function fontRules(c: Ctx) {
  const rendered = first(c.obs, METRICS.fontRendered);
  const declared = first(c.obs, METRICS.fontDeclared);
  if (rendered && declared && rendered.details && (rendered.details as { firstDeclaredAvailable?: boolean }).firstDeclaredAvailable === false) {
    c.push({ ruleId: "font-fallback", kind: "needs-review", title: `First declared font appears unavailable; likely rendering ${String(rendered.value)}`, reason: `Declared: ${String(declared.value)}. Detection compares rendered widths and is an estimate. Fallback fonts change apparent size and wrapping.`, observationIds: [rendered.id, declared.id], verification: "approximation", priority: "informational", suggestion: "Load the intended font or choose a stack whose fallbacks have similar proportions." });
  }
}

function clippingRules(c: Ctx) {
  for (const o of all(c.obs, METRICS.clipped)) {
    c.push({ ruleId: "clipping", kind: "needs-review", title: `About ${String(o.value)} characters of text are clipped`, reason: `${(o.details as { mechanism?: string }).mechanism ?? "overflow"} hides part of this text at baseline. It may be intentional; check that full content is available.`, element: o.element, observationIds: [o.id], verification: "computed-from-rendered-styles", priority: "recommended" });
  }
}

function scenarioRules(c: Ctx, scenarios: Report["scenarios"]) {
  const baselineHidden = new Map<string, number>();
  for (const o of all(c.obs, METRICS.clipped)) baselineHidden.set(o.element?.selector ?? "", Number(o.value) || 0);
  for (const sc of scenarios) {
    if (sc.kind === "baseline" || sc.kind === "recipe" || sc.kind === "profile" || sc.kind === "custom") continue;
    const ruleId = sc.kind === "text-spacing" ? "text-spacing" : sc.kind === "zoom-200" ? "zoom-200" : "reflow";
    const completed = first(c.obs, METRICS.scenarioCompleted, sc.id);
    const isApprox = sc.fidelity === "approximation";
    const verification = isApprox ? "approximation" : "automated-browser-test";
    if (!completed || completed.value !== true) {
      const err = all(c.obs, METRICS.measurementError, sc.id)[0];
      c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: `${sc.label} did not complete`, reason: err?.unknownReason ?? "No completed measurement was recorded for this scenario, so nothing can be concluded.", verification: "not-tested", priority: "essential" });
      continue;
    }
    let problems = 0;
    if (sc.kind === "text-spacing") {
      const cov = first(c.obs, METRICS.overrideCoverage, sc.id);
      if (!cov || typeof cov.value !== "number") {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: "Could not confirm the spacing overrides took effect", reason: "Override verification was not recorded.", verification: "not-tested", priority: "essential" });
      } else if (cov.value > 0) {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: `Spacing overrides did not apply to ${cov.value} element(s)`, reason: "Some elements kept their own spacing (for example inline !important styles), so the 1.4.12 test is incomplete for them. This is not a pass.", observationIds: [cov.id], verification, priority: "essential", suggestion: "Avoid inline !important spacing so user style sheets can override it." });
      }
    }
    if (sc.kind === "text-spacing") {
      const cov = first(c.obs, METRICS.overrideCoverage, sc.id);
      const unverifiable = Number((cov?.details as { unverifiable?: number } | undefined)?.unverifiable ?? 0);
      if (unverifiable > 0) {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: `${unverifiable} frame(s) or closed component(s) could not be tested`, reason: "The overrides cannot be applied or verified inside cross-origin frames or closed shadow roots. Test those parts separately.", observationIds: cov ? [cov.id] : [], verification: "not-tested", priority: "essential" });
      }
    }
    if (sc.kind === "text-spacing" || sc.kind === "zoom-200" || sc.kind === "reflow-320") {
      for (const o of all(c.obs, METRICS.clipped, sc.id)) {
        const before = baselineHidden.get(o.element?.selector ?? "") ?? 0;
        const after = Number(o.value) || 0;
        if (after <= before + 2) continue;
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: isApprox ? "needs-review" : "accessibility-failure", title: `About ${after - before} more characters become hidden under ${sc.label}`, reason: `${before} characters hidden at baseline, ${after} after ${sc.description}. ${isApprox ? "This scenario is an approximation; treat it as a lead for manual testing." : "Text is lost in a real browser test."}`, element: o.element, observationIds: [o.id], verification, priority: "essential", suggestion: "Avoid fixed heights and overflow: hidden on text containers; let boxes grow with their content." });
      }
      for (const o of all(c.obs, METRICS.overflowingBox, sc.id)) {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: `Text spills out of a fixed-size box under ${sc.label}`, reason: `About ${String(o.value)} characters render outside their box and may overlap other content.`, element: o.element, observationIds: [o.id], verification, priority: "essential", suggestion: "Use min-height instead of height for text containers." });
      }
    }
    if (sc.kind === "reflow-320" || sc.kind === "zoom-200") {
      for (const o of all(c.obs, METRICS.horizontalOverflowElement, sc.id)) {
        const d = o.details as { possibleException?: boolean; cause?: string; overflowPx?: number };
        problems++;
        const fail = !d.possibleException && sc.kind === "reflow-320";
        c.push({ ruleId, scenarioId: sc.id, kind: fail ? "accessibility-failure" : "needs-review", title: d.possibleException ? "Element needs horizontal scrolling (possible 2D-content exception)" : `${d.cause === "text" ? "Text" : "Content"} forces horizontal page scrolling`, reason: d.possibleException ? "Tables, code, images and similar content may legitimately need two-dimensional layout under WCAG 1.4.10. Confirm this element qualifies; prose around it must still reflow." : `This element${d.cause === "text" ? "'s text" : ""} extends ${fmt(Number(d.overflowPx ?? 0), 0)}px beyond the viewport, so reading requires scrolling in two directions.${isApprox ? " (Approximation scenario.)" : ""}`, element: o.element, observationIds: [o.id], verification, priority: "essential", suggestion: d.possibleException ? "Wrap the element in a container with overflow-x: auto so only it scrolls." : "Remove fixed widths/min-widths and white-space: nowrap; use max-width: 100% and overflow-wrap: anywhere for long strings." });
      }
      for (const o of all(c.obs, METRICS.scrollingProse, sc.id)) {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: "Prose scrolls horizontally inside a container", reason: `Paragraph text needs ${String(o.value)}px of horizontal scrolling inside its own scroll container. For prose this usually defeats reflow; confirm manually.`, element: o.element, observationIds: [o.id], verification, priority: "essential", suggestion: "Let prose wrap; reserve horizontal scrolling for tables or code." });
      }
      for (const o of all(c.obs, METRICS.horizontalOverflowUnattributed, sc.id)) {
        problems++;
        c.push({ ruleId, scenarioId: sc.id, kind: "needs-review", title: "Page scrolls horizontally; cause not attributed", reason: o.unknownReason ?? "Unattributed horizontal overflow.", observationIds: [o.id], verification, priority: "essential" });
      }
      const page = first(c.obs, METRICS.pageHorizontalOverflow, sc.id);
      if (page && page.value === true && !all(c.obs, METRICS.horizontalOverflowElement, sc.id).length && !all(c.obs, METRICS.horizontalOverflowUnattributed, sc.id).length) problems++;
    }
    if (!problems) {
      c.push({ ruleId, scenarioId: sc.id, kind: "pass", title: `No content loss detected under ${sc.label}`, reason: `Checked hidden text, spilled text and horizontal scrolling after ${sc.description}. Loss of functionality other than hidden text (e.g. broken interactions) is not detected automatically.`, observationIds: [completed.id], verification, priority: "informational" });
    }
  }
}

function unsupportedRules(c: Ctx) {
  for (const metric of [METRICS.canvas, METRICS.frame, METRICS.closedShadow, METRICS.measurementError]) {
    for (const o of all(c.obs, metric)) {
      c.push({ ruleId: "unsupported", kind: "unsupported-check", title: metric === METRICS.canvas ? "Canvas content cannot be inspected" : metric === METRICS.frame ? "Frame content not inspected" : metric === METRICS.closedShadow ? "Possible closed shadow root" : "Measurement failed", reason: o.unknownReason ?? "This content is outside what the inspector can measure.", element: o.element, observationIds: [o.id], verification: "not-tested", priority: "informational", suggestion: "Inspect this content manually or inspect the frame's own URL." });
    }
  }
  const controls = first(c.obs, METRICS.readingControls);
  if (controls && controls.value === true) {
    c.push({ ruleId: "reading-controls", kind: "pass", title: "Reader settings controls found", reason: "A Readability Lab controls element or [data-reading-controls] marker is present.", element: controls.element, observationIds: [controls.id], verification: "computed-from-rendered-styles", priority: "informational" });
  }
  const pol = first(c.obs, METRICS.themePolarity);
  if (pol && pol.value === "dark") {
    c.push({ ruleId: "polarity", kind: "preference", title: "Dark theme in use", reason: "Some experiments favour dark-on-light for some tasks, while some readers (for example some low-vision readers) do better with light-on-dark. Preference and performance can differ. Offer both rather than forcing one.", observationIds: [pol.id], verification: "computed-from-rendered-styles", priority: "informational" });
  }
}

export function isExceptionActive(e: RuleException, today: string): boolean {
  return e.reviewBy >= today;
}

/**
 * An exception without a selector covers every finding of its rule. One with a selector
 * covers a finding only if the browser resolved that selector against the affected element
 * (or an ancestor) during inspection — recorded in element.matchedSelectors.
 */
function matchException(f: Finding, exceptions: RuleException[]): RuleException | null {
  for (const e of exceptions) {
    if (e.ruleId !== f.ruleId) continue;
    if (e.selector === null) return e;
    if (f.element?.matchedSelectors?.includes(e.selector)) return e;
  }
  return null;
}

/** Turn observations into findings. Pure; no LLM, no network. */
export function evaluate(input: {
  observations: Observation[];
  scenarios: Report["scenarios"];
  policy?: PolicyInput;
  viewportWidth: number;
  extraExceptions?: RuleException[];
}): Finding[] {
  const policy = PolicySchema.parse(input.policy ?? { format: "readability-lab/policy", formatVersion: 1 });
  const out: Finding[] = [];
  let n = 0;
  const ctx: Ctx = {
    obs: input.observations,
    policy,
    viewportWidth: input.viewportWidth,
    push: (f) => {
      const meta = getRule(f.ruleId);
      if (policy.disabledRules.includes(f.ruleId)) return;
      out.push({
        id: `F${String(++n).padStart(3, "0")}`,
        scenarioId: "baseline",
        suggestion: null,
        element: null,
        observationIds: [],
        exception: null,
        ...f,
        claimIds: f.claimIds ?? meta?.claimIds ?? [],
        wcag: f.wcag ?? (f.kind === "accessibility-failure" || f.kind === "needs-review" || f.kind === "pass" ? meta?.wcag ?? null : null),
      } as Finding);
    },
  };
  contrastRules(ctx);
  rangeRules(ctx);
  fontRules(ctx);
  clippingRules(ctx);
  scenarioRules(ctx, input.scenarios);
  unsupportedRules(ctx);
  if (first(ctx.obs, METRICS.fontSizePx)) {
    ctx.push({ ruleId: "experiment-font", kind: "experiment-idea", title: "Compare a short list of text faces at matched apparent size", reason: `No typeface is established as universally fastest; individual results vary. For superiority of any named font: ${NRQI}`, verification: "not-tested", priority: "experimental" });
  }
  const exceptions = [...policy.exceptions, ...(input.extraExceptions ?? [])];
  for (const f of out) f.exception = matchException(f, exceptions);
  return out;
}

export interface GateResult {
  status: "pass" | "warn" | "fail";
  failing: Finding[];
  warnings: Finding[];
  excepted: Finding[];
  expiredExceptions: RuleException[];
}

/** CI gate: only kinds listed in policy.failOn can fail a build. Heuristics never do by default. */
export function gate(findings: Finding[], policyInput: PolicyInput | undefined, today: string): GateResult {
  const policy = PolicySchema.parse(policyInput ?? { format: "readability-lab/policy", formatVersion: 1 });
  const failing: Finding[] = [];
  const warnings: Finding[] = [];
  const excepted: Finding[] = [];
  const expired = new Map<string, RuleException>();
  for (const f of findings) {
    if (f.exception) {
      if (isExceptionActive(f.exception, today)) {
        excepted.push(f);
        continue;
      }
      expired.set(`${f.exception.ruleId}|${f.exception.selector}|${f.exception.reviewBy}`, f.exception);
    }
    if (policy.failOn.includes(f.kind)) failing.push(f);
    else if (policy.warnOn.includes(f.kind)) warnings.push(f);
  }
  return {
    status: failing.length ? "fail" : warnings.length || expired.size ? "warn" : "pass",
    failing,
    warnings,
    excepted,
    expiredExceptions: [...expired.values()],
  };
}
