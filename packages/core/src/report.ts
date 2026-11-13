import { claimRevisions, getClaim, getRegistry, sourcesForClaims } from "./registry/index.js";
import { evaluate, getRule, METRICS, type GateResult } from "./rules.js";
import type { Recipe, RuleException, TypographySettings } from "./schemas/presentation.js";
import {
  Policy as PolicySchema,
  Report,
  type Environment,
  type Finding,
  type FindingKind,
  type Observation,
  type PolicyInput,
  type Scenario,
} from "./schemas/report.js";
import { NRQI } from "./version.js";

export const ALWAYS_NOT_PERFORMED: { check: string; reason: string }[] = [
  { check: "Assistive technology (screen readers, voice control)", reason: "Not automated by this tool." },
  { check: "Keyboard operability and focus visibility of page controls", reason: "Not automated for arbitrary pages; Readability Lab's own controls are tested separately." },
  { check: "Browser text-only zoom", reason: "Automation cannot set the user text-size preference; page zoom is approximated instead." },
  { check: "Apparent size (x-height at viewing distance), display luminance, ambient light, glare", reason: "Cannot be inferred from page styles." },
  { check: "Reading speed, comprehension, comfort", reason: "Require experiments with readers; no score is computed." },
  { check: "Complete WCAG conformance", reason: "Only the checks listed under 'performed' were run." },
];

const SCENARIO_CHECKS: Record<Scenario["kind"], string> = {
  baseline: "Rendered line lengths, computed typography, contrast of sampled text, clipping at baseline",
  "text-spacing": "WCAG 1.4.12 text-spacing overrides in a real browser",
  "reflow-320": "WCAG 1.4.10 reflow at 320×256 CSS px in a real browser",
  "zoom-200": "200% page zoom (approximation)",
  recipe: "Recipe applied and re-measured",
  profile: "Reader profile applied and re-measured",
  custom: "Custom scenario",
};

export interface BuildReportInput {
  id?: string;
  target: Report["target"];
  environment: Environment;
  scenarios: Scenario[];
  observations: Observation[];
  policy?: PolicyInput;
  proposed?: { recipe?: Recipe | null; settings?: TypographySettings | null } | null;
  preferences?: string[];
  exceptions?: RuleException[];
  artifacts?: Report["artifacts"];
  uncertainty?: string[];
}

export function buildReport(input: BuildReportInput): Report {
  const findings = evaluate({
    observations: input.observations,
    scenarios: input.scenarios,
    policy: input.policy,
    viewportWidth: input.environment.viewport.width,
    extraExceptions: [...(input.exceptions ?? []), ...(input.proposed?.recipe?.exceptions ?? [])],
  });
  const claimIds = new Set<string>();
  for (const f of findings) f.claimIds.forEach((c) => claimIds.add(c));
  const completed = (id: string) => input.observations.some((o) => o.metric === METRICS.scenarioCompleted && o.scenarioId === id && o.value === true);
  const kinds = new Set(input.scenarios.map((s) => s.kind));
  const notPerformed = [...ALWAYS_NOT_PERFORMED];
  if (!kinds.has("text-spacing")) notPerformed.push({ check: "WCAG 1.4.12 text spacing", reason: "Scenario not requested." });
  if (!kinds.has("reflow-320")) notPerformed.push({ check: "WCAG 1.4.10 reflow", reason: "Scenario not requested." });
  if (!kinds.has("zoom-200")) notPerformed.push({ check: "200% zoom approximation", reason: "Scenario not requested." });
  const uncertainty = [...(input.uncertainty ?? [])];
  const unknowns = input.observations.filter((o) => o.status === "unknown");
  if (unknowns.length) uncertainty.push(`${unknowns.length} observation(s) are unknown and were not treated as passing.`);
  const estimated = input.observations.filter((o) => o.status === "estimated");
  if (estimated.length) uncertainty.push(`${estimated.length} observation(s) are estimates (e.g. font availability).`);
  uncertainty.push("Nominal font size is reported; apparent size depends on the font's x-height and viewing distance, which are not measured.");
  return Report.parse({
    format: "readability-lab/report",
    formatVersion: 1,
    id: input.id ?? `report-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    target: input.target,
    environment: input.environment,
    scenarios: input.scenarios,
    observations: input.observations,
    findings,
    proposed: input.proposed ? { recipe: input.proposed.recipe ?? null, settings: input.proposed.settings ?? null } : null,
    preferences: input.preferences ?? [],
    sourcesConsulted: sourcesForClaims([...claimIds]).map((s) => s.id),
    claimRevisions: claimRevisions(claimIds),
    coverage: {
      performed: input.scenarios.filter((s) => completed(s.id)).map((s) => `${SCENARIO_CHECKS[s.kind]}${s.fidelity === "approximation" ? " — approximation" : ""}`),
      notPerformed: [...notPerformed, ...input.scenarios.filter((s) => !completed(s.id)).map((s) => ({ check: SCENARIO_CHECKS[s.kind], reason: "Scenario was requested but did not complete." }))],
    },
    uncertainty,
    artifacts: input.artifacts ?? [],
    registryVersion: getRegistry().registryVersion,
    policy: PolicySchema.parse(input.policy ?? { format: "readability-lab/policy", formatVersion: 1 }),
  });
}

/* ------------------------------------------------------------------ */
/* Comparison                                                           */
/* ------------------------------------------------------------------ */

const COMPARED_METRICS = [
  METRICS.cpl,
  METRICS.lineCount,
  METRICS.columnWidthPx,
  METRICS.contentHeightPx,
  METRICS.fontSizePx,
  METRICS.lineHeightRatio,
  METRICS.paragraphGapEm,
  METRICS.fontWeight,
  METRICS.textAlign,
  METRICS.fontRendered,
] as const;

export interface MetricDelta {
  metric: string;
  before: Observation["value"];
  after: Observation["value"];
  unit: string | null;
  delta: number | null;
  beforeStatus: string | null;
  afterStatus: string | null;
}

export interface ReportComparison {
  comparable: boolean;
  conditionDifferences: string[];
  metrics: MetricDelta[];
  findingsResolved: Finding[];
  findingsIntroduced: Finding[];
  /** Findings from checks that ran before but not after (or not at the same fidelity): not resolved, untested. */
  findingsUntested: Finding[];
  findingCounts: { before: Record<string, number>; after: Record<string, number> };
  minContrast: { before: number | null; after: number | null };
}

function minContrast(r: Report): number | null {
  const v = r.observations.filter((o) => o.metric === METRICS.contrastSample && o.scenarioId === "baseline" && typeof o.value === "number").map((o) => o.value as number);
  return v.length ? Math.round(Math.min(...v) * 100) / 100 : null;
}

const findingKey = (f: Finding) => `${f.ruleId}|${f.kind}|${f.scenarioId}|${f.element?.selector ?? ""}|${f.kind === "pass" ? "" : f.title.replace(/[\d.]+/g, "#")}`;

function countKinds(fs: Finding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fs) out[f.kind] = (out[f.kind] ?? 0) + 1;
  return out;
}

/** Compare two reports. Flags differing conditions so results aren't over-read. */
export function compareReports(before: Report, after: Report): ReportComparison {
  const diffs: string[] = [];
  const vb = before.environment.viewport;
  const va = after.environment.viewport;
  if (vb.width !== va.width || vb.height !== va.height || vb.deviceScaleFactor !== va.deviceScaleFactor)
    diffs.push(`Viewport differs: ${vb.width}×${vb.height}@${vb.deviceScaleFactor} vs ${va.width}×${va.height}@${va.deviceScaleFactor}`);
  if (before.environment.browser !== after.environment.browser || before.environment.browserVersion !== after.environment.browserVersion)
    diffs.push(`Browser differs: ${before.environment.browser} ${before.environment.browserVersion} vs ${after.environment.browser} ${after.environment.browserVersion}`);
  if (before.target.regionSelector !== after.target.regionSelector) diffs.push(`Region selector differs: ${before.target.regionSelector} vs ${after.target.regionSelector}`);
  if (before.registryVersion !== after.registryVersion) diffs.push(`Evidence registry differs: ${before.registryVersion} vs ${after.registryVersion}`);
  const fp = (r: Report) => r.observations.find((o) => o.metric === METRICS.contentFingerprint && o.scenarioId === "baseline")?.value ?? null;
  if (fp(before) === null || fp(after) === null) diffs.push("Content fingerprint missing from one report; cannot confirm identical content.");
  else if (fp(before) !== fp(after)) diffs.push(`Content differs (fingerprint ${fp(before)} vs ${fp(after)}).`);
  if (before.environment.fontsStatus !== after.environment.fontsStatus) diffs.push(`Font loading state differs: ${before.environment.fontsStatus} vs ${after.environment.fontsStatus}`);

  const ran = (r: Report) => new Map(r.scenarios.filter((sc) => r.observations.some((o) => o.metric === METRICS.scenarioCompleted && o.scenarioId === sc.id && o.value === true)).map((sc) => [sc.id, `${sc.kind}|${sc.fidelity}|${sc.viewport ? `${sc.viewport.width}x${sc.viewport.height}@${sc.viewport.deviceScaleFactor}` : ""}`]));
  const ranB = ran(before);
  const ranA = ran(after);
  for (const [id, sig] of ranB) {
    if (!ranA.has(id)) diffs.push(`Scenario "${id}" ran before but not after; its findings are untested, not resolved.`);
    else if (ranA.get(id) !== sig) diffs.push(`Scenario "${id}" ran under different conditions (${sig} vs ${ranA.get(id)}).`);
  }
  for (const id of ranA.keys()) if (!ranB.has(id)) diffs.push(`Scenario "${id}" ran only after.`);
  if (JSON.stringify(before.policy) !== JSON.stringify(after.policy)) diffs.push("Policies differ between the reports.");
  const bothRan = (id: string) => ranB.has(id) && ranA.get(id) === ranB.get(id);

  const metrics: MetricDelta[] = COMPARED_METRICS.map((m) => {
    const b = before.observations.find((o) => o.metric === m && o.scenarioId === "baseline");
    const a = after.observations.find((o) => o.metric === m && o.scenarioId === "baseline");
    const bv = b?.value ?? null;
    const av = a?.value ?? null;
    return {
      metric: m,
      before: bv,
      after: av,
      unit: a?.unit ?? b?.unit ?? null,
      delta: typeof bv === "number" && typeof av === "number" ? Math.round((av - bv) * 100) / 100 : null,
      beforeStatus: b?.status ?? null,
      afterStatus: a?.status ?? null,
    };
  });
  const bk = new Map(before.findings.filter((f) => f.kind !== "pass" && f.kind !== "experiment-idea").map((f) => [findingKey(f), f]));
  const ak = new Map(after.findings.filter((f) => f.kind !== "pass" && f.kind !== "experiment-idea").map((f) => [findingKey(f), f]));
  return {
    comparable: diffs.length === 0,
    conditionDifferences: diffs,
    metrics,
    findingsResolved: [...bk].filter(([k, f]) => !ak.has(k) && bothRan(f.scenarioId)).map(([, f]) => f),
    findingsIntroduced: [...ak].filter(([k, f]) => !bk.has(k) && bothRan(f.scenarioId)).map(([, f]) => f),
    findingsUntested: [...bk].filter(([k, f]) => !ak.has(k) && !bothRan(f.scenarioId)).map(([, f]) => f),
    findingCounts: { before: countKinds(before.findings), after: countKinds(after.findings) },
    minContrast: { before: minContrast(before), after: minContrast(after) },
  };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                            */
/* ------------------------------------------------------------------ */

export const KIND_LABELS: Record<FindingKind, string> = {
  "accessibility-failure": "Accessibility failure (check performed)",
  "needs-review": "Needs review",
  "heuristic-deviation": "Heuristic deviation (not a WCAG failure)",
  "experiment-idea": "Experiment idea",
  preference: "Preference",
  "unsupported-check": "Unsupported check",
  pass: "Pass",
};

const KIND_ORDER: FindingKind[] = ["accessibility-failure", "needs-review", "heuristic-deviation", "unsupported-check", "preference", "experiment-idea", "pass"];

const esc = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function fmtValue(v: Observation["value"], unit: string | null): string {
  if (v === null) return "unknown";
  if (typeof v === "number") return `${Math.round(v * 100) / 100}${unit && unit !== "ratio" ? ` ${unit}` : ""}`;
  return String(v);
}

export function reportToMarkdown(r: Report, opts: { gate?: GateResult } = {}): string {
  const L: string[] = [];
  const obs = (m: string) => r.observations.find((o) => o.metric === m && o.scenarioId === "baseline");
  L.push(`# Readability Lab report`, "");
  L.push(`- **Target:** ${r.target.url}${r.target.title ? ` — ${r.target.title}` : ""}`);
  L.push(`- **Reading region:** \`${r.target.regionSelector ?? "(whole document)"}\` (${r.target.regionMethod})`);
  L.push(`- **Conditions:** ${r.environment.browser ?? "unknown browser"} ${r.environment.browserVersion ?? ""}, viewport ${r.environment.viewport.width}×${r.environment.viewport.height} @${r.environment.viewport.deviceScaleFactor}x, fonts ${r.environment.fontsStatus ?? "unknown"}`);
  L.push(`- **Tool:** ${r.environment.tool} ${r.environment.toolVersion}, evidence registry ${r.registryVersion}`);
  L.push(`- **Created:** ${r.createdAt}`);
  if (opts.gate) L.push(`- **Policy result:** **${opts.gate.status.toUpperCase()}** (${opts.gate.failing.length} failing, ${opts.gate.warnings.length} warnings, ${opts.gate.excepted.length} excepted)`);
  L.push("", "> Automated checks describe what was tested, not complete accessibility conformance. No readability score is computed.", "");

  L.push("## Measurements (baseline)", "", "| Metric | Value | Status | Method |", "|---|---|---|---|");
  for (const m of [METRICS.cpl, METRICS.lineCount, METRICS.columnWidthPx, METRICS.contentHeightPx, METRICS.fontSizePx, METRICS.lineHeightRatio, METRICS.paragraphGapEm, METRICS.fontWeight, METRICS.textAlign, METRICS.fontDeclared, METRICS.fontRendered]) {
    const o = obs(m);
    if (!o) continue;
    const dist = o.distribution ? ` (p10 ${o.distribution.p10}, p90 ${o.distribution.p90}, n=${o.distribution.count})` : "";
    L.push(`| ${m} | ${esc(fmtValue(o.value, o.unit))}${dist} | ${o.status}${o.unknownReason ? `: ${esc(o.unknownReason)}` : ""} | ${o.method} |`);
  }
  const contrast = r.observations.filter((o) => o.metric === METRICS.contrastSample && o.scenarioId === "baseline");
  if (contrast.length) {
    L.push("", "### Contrast samples", "", "| Element | Colors | Ratio | Large text | Status |", "|---|---|---|---|---|");
    for (const o of contrast) {
      const d = o.details as { fg?: string; bg?: string; large?: boolean };
      L.push(`| \`${esc(o.element?.selector)}\` | ${d.fg ?? "?"} on ${d.bg ?? "?"} | ${typeof o.value === "number" ? `${o.value.toFixed(2)}:1` : "unknown"} | ${d.large ? "yes" : "no"} | ${o.status}${o.unknownReason ? `: ${esc(o.unknownReason)}` : ""} |`);
    }
  }

  L.push("", "## Findings", "");
  for (const kind of KIND_ORDER) {
    const fs = r.findings.filter((f) => f.kind === kind);
    if (!fs.length) continue;
    L.push(`### ${KIND_LABELS[kind]} (${fs.length})`, "");
    for (const f of fs) {
      L.push(`- **${f.title}** — rule \`${f.ruleId}\`${f.wcag ? `, WCAG ${f.wcag.criterion} (${f.wcag.level})` : ""}, scenario \`${f.scenarioId}\`, verification: ${f.verification}`);
      if (f.element) L.push(`  - Region: \`${f.element.selector}\``);
      L.push(`  - Why: ${f.reason}`);
      if (f.suggestion) L.push(`  - Suggested action: ${f.suggestion}`);
      if (f.claimIds.length) L.push(`  - Evidence: ${f.claimIds.map((id) => `\`${id}\``).join(", ")}`);
      if (f.exception) L.push(`  - Accepted exception: ${f.exception.reason} (review by ${f.exception.reviewBy})`);
    }
    L.push("");
  }

  L.push("## Coverage", "", "**Performed:**", ...r.coverage.performed.map((c) => `- ${c}`), "", "**Not performed:**", ...r.coverage.notPerformed.map((c) => `- ${c.check} — ${c.reason}`), "");
  if (r.uncertainty.length) L.push("## Uncertainty", "", ...r.uncertainty.map((u) => `- ${u}`), "");
  if (r.sourcesConsulted.length) {
    L.push("## Evidence consulted", "");
    for (const [id, rev] of Object.entries(r.claimRevisions)) {
      const c = getClaim(id);
      L.push(`- \`${id}\` r${rev} (${c?.kind ?? "?"}) — ${c?.title ?? "missing from registry"}${c?.noReliableQuantitativeImprovement ? ` — ${NRQI}` : ""}`);
    }
    L.push("");
  }
  if (r.artifacts.length) L.push("## Artifacts", "", ...r.artifacts.map((a) => `- ${a.kind}: \`${a.path}\`${a.description ? ` — ${a.description}` : ""}`), "");
  return L.join("\n");
}

export function comparisonToMarkdown(cmp: ReportComparison, before: Report, after: Report): string {
  const L: string[] = ["# Readability Lab comparison", ""];
  L.push(`- **Before:** ${before.target.url} (${before.createdAt})`, `- **After:** ${after.target.url} (${after.createdAt})`);
  L.push(cmp.comparable ? "- **Conditions:** identical viewport, browser, region and registry." : `- **Conditions differ — interpret with care:**\n${cmp.conditionDifferences.map((d) => `  - ${d}`).join("\n")}`);
  L.push("", "## Measured changes", "", "| Metric | Before | After | Change |", "|---|---|---|---|");
  for (const m of cmp.metrics) L.push(`| ${m.metric} | ${esc(fmtValue(m.before, m.unit))} | ${esc(fmtValue(m.after, m.unit))} | ${m.delta === null ? (m.before === m.after ? "—" : "changed") : m.delta > 0 ? `+${m.delta}` : m.delta} |`);
  L.push(`| minimum contrast | ${cmp.minContrast.before ?? "unknown"} | ${cmp.minContrast.after ?? "unknown"} | |`);
  L.push("", "## Findings resolved", "", ...(cmp.findingsResolved.length ? cmp.findingsResolved.map((f) => `- [${f.kind}] ${f.title} (\`${f.ruleId}\`; ${f.claimIds.join(", ")})`) : ["- none"]));
  L.push("", "## Findings introduced", "", ...(cmp.findingsIntroduced.length ? cmp.findingsIntroduced.map((f) => `- [${f.kind}] ${f.title} (\`${f.ruleId}\`; ${f.claimIds.join(", ")})`) : ["- none"]));
  if (cmp.findingsUntested.length) L.push("", "## Not re-tested (check missing or changed in the after report)", "", ...cmp.findingsUntested.map((f) => `- [${f.kind}] ${f.title} (\`${f.ruleId}\`, scenario \`${f.scenarioId}\`)`));
  L.push("", "> These are layout measurements under fixed conditions. They are not reading-performance results: no speed, comprehension or comfort change is implied.", "");
  return L.join("\n");
}

export function ruleTitle(id: string): string {
  return getRule(id)?.title ?? id;
}
