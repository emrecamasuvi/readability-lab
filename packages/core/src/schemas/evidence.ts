import * as z from "zod";

/** ISO date (YYYY-MM-DD). */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const SourceId = z.string().regex(/^S-[a-z0-9-]+$/, "Source ids look like S-wcag22 or S-rello-2016");
export const ClaimId = z.string().regex(/^C-[A-Z0-9]+-\d{3}$/, "Claim ids look like C-CPL-001");

export const SourceType = z.enum([
  "standard",
  "standard-guidance",
  "journal-article",
  "conference-paper",
  "review",
  "book-chapter",
  "industry-guidance",
  "preprint",
  "secondary-synthesis",
]);

/**
 * Review status of a source record.
 * - unverified-secondary: extracted from a secondary synthesis; the original was not checked.
 * - verified-abstract: the original abstract/landing page was checked against the record.
 * - verified-full-text: the original full text was checked.
 * - verified-normative: a normative standard text was checked.
 */
export const SourceReviewStatus = z.enum([
  "unverified-secondary",
  "verified-abstract",
  "verified-full-text",
  "verified-normative",
  "retracted",
]);

export const Source = z
  .object({
    id: SourceId,
    type: SourceType,
    title: z.string().min(1),
    authors: z.array(z.string()).default([]),
    year: z.number().int().nullable(),
    publishedDate: IsoDate.nullable().default(null),
    venue: z.string().nullable().default(null),
    doi: z.string().nullable().default(null),
    url: z.string().url(),
    access: z.enum(["full-text", "abstract-only", "none", "unknown"]),
    review: z.object({
      status: SourceReviewStatus,
      checkedOn: IsoDate.nullable(),
      checkedBy: z.string().nullable().default(null),
      locator: z.string().nullable().default(null).describe("Where in the source the checked content lives (section, table, page)."),
      notes: z.string().nullable().default(null),
    }),
    rights: z.object({
      redistribution: z.enum(["link-only", "open-license", "public-domain", "w3c-document-license"]),
      license: z.string().nullable().default(null),
    }),
  })
  .meta({ id: "Source", title: "Readability Lab source record" });
export type Source = z.infer<typeof Source>;

export const ClaimKind = z.enum(["normative", "empirical", "heuristic", "hypothesis"]);
export type ClaimKind = z.infer<typeof ClaimKind>;

/** Outcome domains are kept separate on purpose. */
export const OutcomeDomain = z.enum([
  "legibility",
  "reading-speed",
  "comprehension",
  "recognition-accuracy",
  "comfort",
  "preference",
  "eye-movements",
  "accessibility-conformance",
  "layout-geometry",
  "usability",
]);
export type OutcomeDomain = z.infer<typeof OutcomeDomain>;

export const Estimate = z.object({
  measure: z.string().describe("What was estimated, e.g. 'mean WPM at 95 CPL'"),
  value: z.number().nullable(),
  unit: z.string().nullable().default(null),
  ci95: z.tuple([z.number(), z.number()]).nullable().default(null),
  p: z.string().nullable().default(null).describe("As reported, e.g. '.02' or '<.001'"),
  effectSize: z.string().nullable().default(null),
  missingReason: z
    .string()
    .nullable()
    .default(null)
    .describe("Required when value is null: why the statistic is missing."),
});
export type Estimate = z.infer<typeof Estimate>;

export const StudyExtraction = z.object({
  population: z.string().nullable(),
  sampleSize: z.string().nullable().describe("As reported, e.g. '20', '352 of 500 retained'"),
  language: z.string().nullable(),
  script: z.string().nullable(),
  task: z.string().nullable(),
  device: z.string().nullable(),
  typography: z.string().nullable(),
  outcomes: z.array(OutcomeDomain),
  comparator: z.string().nullable(),
  estimates: z.array(Estimate).default([]),
  missing: z.array(z.string()).default([]).describe("Fields not reported, with reasons."),
});
export type StudyExtraction = z.infer<typeof StudyExtraction>;

export const ClaimRevision = z.object({
  revision: z.number().int().positive(),
  date: IsoDate,
  change: z.string(),
  reason: z.string(),
  by: z.string().nullable().default(null),
});

export const Claim = z
  .object({
    id: ClaimId,
    revision: z.number().int().positive(),
    kind: ClaimKind,
    title: z.string(),
    statement: z.string().describe("Original summary written for this registry."),
    plain: z.string().describe("Plain-language version for everyday readers; no jargon."),
    topics: z.array(z.string()).min(1),
    outcomes: z.array(OutcomeDomain).default([]),
    scope: z.object({
      scripts: z.array(z.string()).default(["Latin"]),
      contexts: z.array(z.string()).default([]),
      notApplicableTo: z.array(z.string()).default([]),
    }),
    sources: z.array(z.object({ sourceId: SourceId, locator: z.string().nullable().default(null) })).min(1),
    study: StudyExtraction.nullable().default(null),
    wcag: z
      .object({ criterion: z.string(), level: z.enum(["A", "AA", "AAA", "advisory"]) })
      .nullable()
      .default(null),
    evidenceStrength: z
      .enum(["normative", "moderate", "low", "very-low", "not-established", "not-applicable"])
      .describe("Strength of evidence for the claim as stated. Separate from recommendation priority."),
    noReliableQuantitativeImprovement: z
      .boolean()
      .default(false)
      .describe("True when the registry explicitly records that no reliable quantitative improvement is established."),
    limitations: z.array(z.string()).default([]),
    conflictsWith: z.array(ClaimId).default([]),
    relatedClaims: z.array(ClaimId).default([]),
    status: z.enum(["draft", "extracted", "reviewed", "superseded", "withdrawn"]),
    history: z.array(ClaimRevision).min(1),
  })
  .meta({ id: "Claim", title: "Readability Lab claim" });
export type Claim = z.infer<typeof Claim>;

export const EvidenceRegistry = z
  .object({
    $schema: z.string().optional(),
    registryVersion: z.string(),
    checkedOn: IsoDate,
    synthesis: z.object({
      title: z.string(),
      note: z.string(),
    }),
    sources: z.array(Source),
    claims: z.array(Claim),
    gaps: z
      .array(z.object({ id: z.string(), description: z.string(), affects: z.array(z.string()).default([]) }))
      .default([]),
  })
  .meta({ id: "EvidenceRegistry", title: "Readability Lab evidence registry" });
export type EvidenceRegistry = z.infer<typeof EvidenceRegistry>;
