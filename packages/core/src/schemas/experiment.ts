import * as z from "zod";
import { TypographySettings } from "./presentation.js";

export const ExperimentCondition = z.object({
  id: z.string(),
  label: z.string(),
  concealedLabel: z.string().describe("Neutral label shown during blind comparison, e.g. 'Option K'"),
  settings: TypographySettings,
});
export type ExperimentCondition = z.infer<typeof ExperimentCondition>;

export const Passage = z.object({
  id: z.string(),
  title: z.string(),
  words: z.number().int().positive(),
  language: z.string(),
  license: z.string().describe("SPDX id or 'original-cc-by-4.0'"),
  attribution: z.string(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        choices: z.array(z.string()).min(2),
        answerIndex: z.number().int().min(0),
        type: z.enum(["factual", "inferential"]),
      }),
    )
    .default([]),
});
export type Passage = z.infer<typeof Passage>;

/** Quick preference exploration. Results are valid as preferences only. */
export const PreferenceSession = z
  .object({
    format: z.literal("readability-lab/preference-session"),
    formatVersion: z.literal(1),
    id: z.string(),
    createdAt: z.string(),
    seed: z.number().int(),
    concealFontNames: z.boolean(),
    sampleId: z.string(),
    conditions: z.array(ExperimentCondition).min(2),
    comparisons: z.array(
      z.object({
        left: z.string(),
        right: z.string(),
        choice: z.enum(["left", "right", "no-preference"]),
        at: z.string(),
      }),
    ),
  })
  .meta({ id: "PreferenceSession" });
export type PreferenceSession = z.infer<typeof PreferenceSession>;

export const Trial = z.object({
  slot: z.number().int().min(0).describe("Index into the assignment schedule."),
  startedAt: z.string(),
  activeReadingMs: z.number().nonnegative().nullable(),
  comprehension: z.object({ correct: z.number().int().min(0), total: z.number().int().min(0) }).nullable(),
  comfort: z.number().min(0).max(10).nullable().describe("Exploratory 0–10 rating; not a validated instrument."),
  interruptions: z.array(z.object({ atMs: z.number(), durationMs: z.number(), note: z.string().default("") })).default([]),
  excluded: z.string().nullable().default(null).describe("Reason this trial is excluded from analysis, if any."),
});
export type Trial = z.infer<typeof Trial>;

/** Reading-performance experiment with fresh passages and a held-out confirmation phase. */
export const PerformanceExperiment = z
  .object({
    format: z.literal("readability-lab/performance-experiment"),
    formatVersion: z.literal(1),
    id: z.string(),
    createdAt: z.string(),
    seed: z.number().int(),
    design: z.enum(["latin-square", "randomized"]),
    conditions: z.array(ExperimentCondition).min(2),
    passages: z.array(Passage),
    schedule: z.array(
      z.object({
        session: z.number().int().min(1),
        conditionId: z.string(),
        passageId: z.string(),
        phase: z.enum(["exploration", "confirmation"]),
      }),
    ),
    trials: z.array(Trial),
    environment: z
      .object({
        device: z.string().nullable(),
        viewport: z.string().nullable(),
        viewingDistanceCm: z.number().nullable().describe("User-reported; never inferred."),
      })
      .default({ device: null, viewport: null, viewingDistanceCm: null }),
  })
  .meta({ id: "PerformanceExperiment" });
export type PerformanceExperiment = z.infer<typeof PerformanceExperiment>;
