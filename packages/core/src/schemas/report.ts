import * as z from "zod";
import { ClaimId, IsoDate } from "./evidence.js";
import { Recipe, RuleException, TypographySettings } from "./presentation.js";

/** How an observation's value came to be. Unknown is never a pass. */
export const ObservationStatus = z.enum(["measured", "derived", "user-reported", "estimated", "unknown"]);
export type ObservationStatus = z.infer<typeof ObservationStatus>;

export const Distribution = z.object({
  count: z.number().int(),
  min: z.number().nullable(),
  p10: z.number().nullable(),
  median: z.number().nullable(),
  mean: z.number().nullable(),
  p90: z.number().nullable(),
  max: z.number().nullable(),
  histogram: z.array(z.object({ from: z.number(), to: z.number(), count: z.number().int() })).default([]),
});
export type Distribution = z.infer<typeof Distribution>;

export const ElementRef = z.object({
  selector: z.string(),
  box: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable().default(null),
  textSample: z.string().nullable().default(null).describe("At most 80 characters; omitted when privacy mode is on."),
  matchedSelectors: z.array(z.string()).default([]).describe("Exception selectors that match this element or an ancestor, resolved in the browser."),
});
export type ElementRef = z.infer<typeof ElementRef>;

export const Observation = z
  .object({
    id: z.string(),
    metric: z.string().describe("Dotted metric name, e.g. layout.cpl.median"),
    value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
    unit: z.string().nullable().default(null),
    status: ObservationStatus,
    method: z.string().describe("Method id from docs/measurement-method.md, e.g. 'rendered-line-rects@1'"),
    scenarioId: z.string().default("baseline"),
    element: ElementRef.nullable().default(null),
    distribution: Distribution.nullable().default(null),
    unknownReason: z.string().nullable().default(null),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .meta({ id: "Observation" });
export type Observation = z.infer<typeof Observation>;
export type ObservationInput = z.input<typeof Observation>;

/**
 * Finding kinds are deliberately separate. Only `accessibility-failure` describes a
 * failed WCAG check that the tool actually performed; every other kind is advisory.
 */
export const FindingKind = z.enum([
  "accessibility-failure",
  "needs-review",
  "heuristic-deviation",
  "experiment-idea",
  "preference",
  "unsupported-check",
  "pass",
]);
export type FindingKind = z.infer<typeof FindingKind>;

export const Verification = z.enum([
  "automated-browser-test",
  "computed-from-rendered-styles",
  "approximation",
  "manual-review-required",
  "not-tested",
]);
export type Verification = z.infer<typeof Verification>;

export const Finding = z
  .object({
    id: z.string(),
    ruleId: z.string(),
    kind: FindingKind,
    title: z.string(),
    reason: z.string(),
    suggestion: z.string().nullable().default(null),
    scenarioId: z.string().default("baseline"),
    element: ElementRef.nullable().default(null),
    observationIds: z.array(z.string()).default([]),
    claimIds: z.array(ClaimId).default([]),
    wcag: z.object({ criterion: z.string(), level: z.enum(["A", "AA", "AAA"]) }).nullable().default(null),
    verification: Verification,
    priority: z.enum(["essential", "recommended", "experimental", "informational"]),
    exception: RuleException.nullable().default(null),
  })
  .meta({ id: "Finding" });
export type Finding = z.infer<typeof Finding>;
export type FindingInput = z.input<typeof Finding>;

export const Environment = z.object({
  tool: z.string(),
  toolVersion: z.string(),
  browser: z.string().nullable(),
  browserVersion: z.string().nullable(),
  userAgent: z.string().nullable().default(null),
  viewport: z.object({ width: z.number(), height: z.number(), deviceScaleFactor: z.number() }),
  colorScheme: z.enum(["light", "dark", "no-preference"]).default("light"),
  fontsStatus: z.string().nullable().default(null).describe("document.fonts.status at measurement time"),
  loadState: z.string().nullable().default(null),
});
export type Environment = z.infer<typeof Environment>;

export const Scenario = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["baseline", "text-spacing", "reflow-320", "zoom-200", "recipe", "profile", "custom"]),
  fidelity: z.enum(["real-browser", "approximation"]),
  description: z.string(),
  viewport: z.object({ width: z.number(), height: z.number(), deviceScaleFactor: z.number() }).nullable().default(null),
  appliedCss: z.string().nullable().default(null),
});
export type Scenario = z.infer<typeof Scenario>;

export const Report = z
  .object({
    format: z.literal("readability-lab/report"),
    formatVersion: z.literal(1),
    id: z.string(),
    createdAt: z.string(),
    target: z.object({
      url: z.string(),
      title: z.string().nullable().default(null),
      regionSelector: z.string().nullable(),
      regionMethod: z.enum(["explicit-selector", "auto-detected", "user-picked", "whole-document"]),
    }),
    environment: Environment,
    scenarios: z.array(Scenario),
    observations: z.array(Observation),
    findings: z.array(Finding),
    proposed: z
      .object({ recipe: Recipe.nullable().default(null), settings: TypographySettings.nullable().default(null) })
      .nullable()
      .default(null),
    preferences: z.array(z.string()).default([]).describe("Reader/profile preferences involved, as field names."),
    sourcesConsulted: z.array(z.string()).default([]),
    claimRevisions: z.record(ClaimId, z.number().int()).default({}),
    coverage: z.object({
      performed: z.array(z.string()),
      notPerformed: z.array(z.object({ check: z.string(), reason: z.string() })),
    }),
    uncertainty: z.array(z.string()).default([]),
    artifacts: z.array(z.object({ kind: z.string(), path: z.string(), description: z.string().default("") })).default([]),
    registryVersion: z.string(),
    policy: z.lazy(() => Policy).nullable().default(null).describe("The policy the findings were evaluated with."),
  })
  .meta({ id: "Report", title: "Readability Lab inspection report" });
export type Report = z.infer<typeof Report>;
export type ReportInput = z.input<typeof Report>;

export const Policy = z
  .object({
    format: z.literal("readability-lab/policy"),
    formatVersion: z.literal(1),
    conformanceTarget: z.enum(["AA", "AAA"]).default("AA"),
    failOn: z.array(FindingKind).default(["accessibility-failure"]),
    warnOn: z.array(FindingKind).default(["needs-review", "unsupported-check"]),
    ranges: z
      .object({
        cpl: z.tuple([z.number(), z.number()]).default([50, 75]),
        fontSizePx: z.tuple([z.number(), z.number()]).default([16, 22]),
        lineHeight: z.tuple([z.number(), z.number()]).default([1.4, 1.7]),
        paragraphGapEm: z.tuple([z.number(), z.number()]).default([0.5, 1.0]),
      })
      .default({ cpl: [50, 75], fontSizePx: [16, 22], lineHeight: [1.4, 1.7], paragraphGapEm: [0.5, 1.0] }),
    contrastTarget: z.number().default(7),
    exceptions: z.array(RuleException).default([]),
    disabledRules: z.array(z.string()).default([]),
  })
  .meta({ id: "Policy", title: "Readability Lab project policy" });
export type Policy = z.infer<typeof Policy>;
export type PolicyInput = z.input<typeof Policy>;

export const ExceptionStatus = z.object({ exception: RuleException, expired: z.boolean(), today: IsoDate });
