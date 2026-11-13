import * as z from "zod";
import { ClaimId, IsoDate } from "./evidence.js";

export const MeasureUnit = z.enum(["cpl", "ch", "em", "px", "none"]);

/**
 * A measure (line width). `cpl` is a *target* in rendered characters per line;
 * it must be converted to CSS using a calibration measured in a real browser,
 * because `ch` widths are not measured CPL.
 */
export const Measure = z.object({ value: z.number().positive().max(400), unit: MeasureUnit });
export type Measure = z.infer<typeof Measure>;

/**
 * Values that end up in CSS are restricted to safe syntaxes so an imported profile or
 * share code can never inject declarations or rules.
 */
export const CssColor = z
  .string()
  .max(80)
  .regex(/^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([0-9a-zA-Z.,%\s/+-]*\)|[a-zA-Z]{3,30})$/, "Unsupported color syntax");
export const CssFontFamily = z
  .string()
  .min(1)
  .max(400)
  .regex(/^[\p{L}\p{N}\s"',._-]+$/u, "Font family lists may contain names, quotes, commas, spaces, dots, hyphens and underscores only");

export const ThemeName = z.enum(["light", "sepia", "dark", "high-contrast", "custom"]);
export const Theme = z.object({
  name: ThemeName,
  foreground: CssColor,
  background: CssColor,
  link: CssColor.nullable().default(null),
});
export type Theme = z.infer<typeof Theme>;

/** Every field is optional: absent means "keep what the page/publisher does". */
export const TypographySettings = z
  .object({
    fontFamily: CssFontFamily,
    fontSizePx: z.number().min(8).max(96),
    lineHeight: z.number().min(0.8).max(3.5).describe("Baseline-to-baseline distance divided by nominal font size."),
    fontWeight: z.number().int().min(100).max(900),
    letterSpacingEm: z.number().min(-0.1).max(0.5),
    wordSpacingEm: z.number().min(-0.2).max(1),
    measure: Measure,
    paragraphGapEm: z.number().min(0).max(4).describe("Additional gap after a paragraph, in multiples of font size."),
    textAlign: z.enum(["start", "justify"]),
    theme: Theme,
  })
  .partial()
  .meta({ id: "TypographySettings" });
export type TypographySettings = z.infer<typeof TypographySettings>;
export type SettingField = keyof TypographySettings;
export const SETTING_FIELDS = [
  "fontFamily",
  "fontSizePx",
  "lineHeight",
  "fontWeight",
  "letterSpacingEm",
  "wordSpacingEm",
  "measure",
  "paragraphGapEm",
  "textAlign",
  "theme",
] as const satisfies readonly SettingField[];

export const RuleException = z.object({
  ruleId: z.string(),
  selector: z.string().nullable().default(null),
  reason: z.string().min(3),
  approvedBy: z.string().nullable().default(null),
  reviewBy: IsoDate,
});
export type RuleException = z.infer<typeof RuleException>;

export const Rationale = z.object({
  field: z.string(),
  note: z.string(),
  claimIds: z.array(ClaimId).default([]),
});

export const ResponsiveOverride = z.object({
  label: z.string(),
  minWidthPx: z.number().nullable().default(null),
  maxWidthPx: z.number().nullable().default(null),
  settings: TypographySettings,
});
export type ResponsiveOverride = z.infer<typeof ResponsiveOverride>;

/** A publisher recipe: intended presentation for content someone publishes. */
export const Recipe = z
  .object({
    format: z.literal("readability-lab/recipe"),
    formatVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    scope: z.object({ selector: z.string().default("main, article, [data-reading-region]") }).default({
      selector: "main, article, [data-reading-region]",
    }),
    settings: TypographySettings,
    responsive: z.array(ResponsiveOverride).default([]),
    exceptions: z.array(RuleException).default([]),
    rationale: z.array(Rationale).default([]),
    claimRevisions: z.record(ClaimId, z.number().int().positive()).default({}),
    calibration: z
      .object({
        charsPerCh: z.number().positive().describe("Measured rendered characters per `ch` unit for the font and sample text."),
        fontFamily: z.string(),
        sampleId: z.string().nullable().default(null),
        measuredWith: z.string().describe("Browser and version used for calibration."),
      })
      .nullable()
      .default(null),
    provenance: z
      .object({
        tool: z.string(),
        toolVersion: z.string(),
        createdAt: z.string(),
        basedOn: z.string().nullable().default(null),
      })
      .nullable()
      .default(null),
  })
  .meta({ id: "Recipe", title: "Readability Lab publisher recipe" });
export type Recipe = z.infer<typeof Recipe>;
export type RecipeInput = z.input<typeof Recipe>;

export const SiteMode = z.enum(["off", "page", "reader"]);
export const SitePreference = z.object({
  mode: SiteMode.default("page"),
  settings: TypographySettings.default({}),
  regionSelector: z.string().nullable().default(null),
});
export type SitePreference = z.infer<typeof SitePreference>;

/** A reader's portable profile. It holds choices, never browsing content. */
export const Profile = z
  .object({
    format: z.literal("readability-lab/profile"),
    formatVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().default("My reading profile"),
    updatedAt: z.string(),
    presetId: z.string().nullable().default(null),
    settings: TypographySettings.default({}),
    needs: z
      .array(z.enum(SETTING_FIELDS))
      .default([])
      .describe("Fields the reader marks as access needs: presets and publisher recipes never override them."),
    sites: z.record(z.string(), SitePreference).default({}).describe("Keyed by host name only."),
  })
  .meta({ id: "Profile", title: "Readability Lab reader profile" });
export type Profile = z.infer<typeof Profile>;
export type ProfileInput = z.input<typeof Profile>;
