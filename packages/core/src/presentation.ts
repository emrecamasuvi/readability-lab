import {
  Profile,
  Recipe,
  SETTING_FIELDS,
  TypographySettings,
  type Measure,
  type ProfileInput,
  type RecipeInput,
  type SettingField,
  type Theme,
} from "./schemas/presentation.js";
import { VERSION } from "./version.js";

export const FONT_STACKS = {
  "system-sans": 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  "system-serif": 'Charter, "Bitstream Charter", "Iowan Old Style", Georgia, Cambria, "Times New Roman", serif',
  "humanist-sans": '"Atkinson Hyperlegible", Verdana, "Trebuchet MS", "Segoe UI", sans-serif',
  "slab-serif": '"Roboto Slab", Rockwell, "Courier New", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;
export type FontStackId = keyof typeof FONT_STACKS;

/** Theme palettes. Each foreground/background pair is ≥ 7:1 (tested in core tests). */
export const THEMES: Record<"light" | "sepia" | "dark" | "high-contrast", Theme> = {
  light: { name: "light", foreground: "#1b1b1b", background: "#ffffff", link: "#014abb" },
  sepia: { name: "sepia", foreground: "#3a2c1a", background: "#f5ecd9", link: "#7a3b00" },
  dark: { name: "dark", foreground: "#e6e3de", background: "#16181b", link: "#8ab4f8" },
  "high-contrast": { name: "high-contrast", foreground: "#000000", background: "#ffffff", link: "#0000c8" },
};

export interface Preset {
  id: "balanced" | "larger-text" | "compact";
  name: string;
  summary: string;
  settings: TypographySettings;
  claimIds: string[];
  caveat: string;
}

const PRESET_CAVEAT =
  "A starting choice to adjust, not a tested optimum. No reliable quantitative improvement established.";

/** Descriptive starting presets. They are starting choices, never performance promises. */
export const PRESETS: readonly Preset[] = [
  {
    id: "balanced",
    name: "Balanced",
    summary: "18px text, about 65 characters per line, 1.5 line height.",
    settings: { fontSizePx: 18, lineHeight: 1.5, measure: { value: 65, unit: "cpl" }, paragraphGapEm: 0.75, fontWeight: 400, letterSpacingEm: 0, wordSpacingEm: 0, textAlign: "start" },
    claimIds: ["C-BASE-001", "C-BASE-002", "C-BASE-004", "C-PARA-001", "C-ALIGN-001"],
    caveat: PRESET_CAVEAT,
  },
  {
    id: "larger-text",
    name: "Larger Text",
    summary: "20px text, about 60 characters per line, 1.6 line height.",
    settings: { fontSizePx: 20, lineHeight: 1.6, measure: { value: 60, unit: "cpl" }, paragraphGapEm: 0.75, fontWeight: 400, letterSpacingEm: 0, wordSpacingEm: 0, textAlign: "start" },
    claimIds: ["C-BASE-003", "C-SIZE-002", "C-LH-003", "C-BASE-004"],
    caveat: `${PRESET_CAVEAT} Fewer characters at a larger size need not mean a narrower column.`,
  },
  {
    id: "compact",
    name: "Compact",
    summary: "16px text, about 70 characters per line, 1.4 line height.",
    settings: { fontSizePx: 16, lineHeight: 1.4, measure: { value: 70, unit: "cpl" }, paragraphGapEm: 0.5, fontWeight: 400, letterSpacingEm: 0, wordSpacingEm: 0, textAlign: "start" },
    claimIds: ["C-BASE-002", "C-LH-004", "C-BASE-004"],
    caveat: `${PRESET_CAVEAT} More text fits on screen; the trade-off is smaller text and tighter lines.`,
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export function createProfile(input: Partial<ProfileInput> = {}): Profile {
  return Profile.parse({
    format: "readability-lab/profile",
    formatVersion: 1,
    id: input.id ?? `profile-${Math.random().toString(36).slice(2, 10)}`,
    updatedAt: new Date().toISOString(),
    ...input,
  });
}

/** Validate and migrate an imported profile. Throws a readable error when invalid. */
export function importProfile(json: unknown): Profile {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  if (!obj || typeof obj !== "object") throw new Error("Profile must be a JSON object.");
  const o = obj as Record<string, unknown>;
  if (o.format !== "readability-lab/profile") throw new Error("Not a Readability Lab profile (format field missing or different).");
  if (o.formatVersion !== 1) throw new Error(`Unsupported profile formatVersion ${String(o.formatVersion)}; this build reads version 1.`);
  const parsed = Profile.safeParse(o);
  if (!parsed.success) throw new Error(`Invalid profile: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return parsed.data;
}

/** Export for sharing. Site keys are removed unless explicitly requested, so no browsing history leaves. */
export function exportProfile(profile: Profile, opts: { includeSites?: boolean } = {}): Profile {
  return { ...profile, sites: opts.includeSites ? profile.sites : {}, updatedAt: profile.updatedAt };
}

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Compact share code containing settings only (no sites, no content). */
export function encodeSettings(settings: TypographySettings): string {
  return `rl1.${base64UrlEncode(JSON.stringify(TypographySettings.parse(settings)))}`;
}
export function decodeSettings(code: string): TypographySettings {
  const trimmed = code.trim();
  if (!trimmed.startsWith("rl1.")) throw new Error("Unrecognised share code (expected rl1.…)");
  return TypographySettings.parse(JSON.parse(base64UrlDecode(trimmed.slice(4))));
}

/** Apply a preset while keeping the reader's declared access needs. */
export function applyPreset(profile: Profile, presetId: string): Profile {
  const preset = getPreset(presetId);
  if (!preset) throw new Error(`Unknown preset ${presetId}`);
  const kept: TypographySettings = {};
  for (const f of profile.needs) if (profile.settings[f] !== undefined) (kept as Record<string, unknown>)[f] = profile.settings[f];
  const theme = profile.settings.theme;
  return {
    ...profile,
    presetId,
    settings: { ...preset.settings, ...(theme ? { theme } : {}), ...kept },
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Combining publisher recipes and reader profiles                     */
/* ------------------------------------------------------------------ */

export type Origin = "page" | "publisher" | "publisher-responsive" | "reader" | "reader-site" | "reader-need";

export interface Resolution {
  /** False when the reader turned Readability Lab off for this site: reader layers are not applied. */
  readerEnabled: boolean;
  settings: TypographySettings;
  origins: Partial<Record<SettingField, Origin>>;
  notes: string[];
}

/**
 * Combine presentation layers. Precedence, lowest to highest:
 *   page styles < publisher recipe < publisher responsive override (matching viewport)
 *   < reader profile < reader per-site settings.
 * Reader access needs are never overridden by publisher layers; a reader's own
 * per-site choice may still change them because it is also a deliberate reader choice.
 */
export function resolvePresentation(input: {
  recipe?: Recipe | null;
  profile?: Profile | null;
  host?: string | null;
  viewportWidth?: number | null;
}): Resolution {
  const settings: Record<string, unknown> = {};
  const origins: Partial<Record<SettingField, Origin>> = {};
  const notes: string[] = [];
  const layer = (s: TypographySettings | undefined, origin: Origin) => {
    if (!s) return;
    for (const f of SETTING_FIELDS) {
      if (s[f] === undefined) continue;
      settings[f] = s[f];
      origins[f] = origin;
    }
  };
  if (input.recipe) {
    layer(input.recipe.settings, "publisher");
    const w = input.viewportWidth ?? null;
    if (w !== null) {
      for (const r of input.recipe.responsive) {
        if ((r.minWidthPx === null || w >= r.minWidthPx) && (r.maxWidthPx === null || w <= r.maxWidthPx)) {
          layer(r.settings, "publisher-responsive");
          notes.push(`Responsive override "${r.label}" applied at ${w}px.`);
        }
      }
    }
  }
  const p = input.profile;
  const site = p && input.host ? p.sites[input.host] : undefined;
  if (site?.mode === "off") {
    notes.push(`Reader turned Readability Lab off for ${input.host}; only the page's own presentation applies.`);
    return { readerEnabled: false, settings: settings as TypographySettings, origins, notes };
  }
  if (p) {
    layer(p.settings, "reader");
    for (const f of p.needs) if (p.settings[f] !== undefined) origins[f] = "reader-need";
    if (site) layer(site.settings, "reader-site");
  }
  return { readerEnabled: true, settings: settings as TypographySettings, origins, notes };
}

/* ------------------------------------------------------------------ */
/* CSS, tokens, specs                                                  */
/* ------------------------------------------------------------------ */

/**
 * Typical rendered characters per `ch` for Latin prose in proportional fonts. Used only
 * when no browser calibration is available; such output is labelled uncalibrated.
 */
export const UNCALIBRATED_CHARS_PER_CH = 1.15;

export function measureToCss(m: Measure, charsPerCh: number | null): { css: string; calibrated: boolean } {
  switch (m.unit) {
    case "none":
      return { css: "none", calibrated: true };
    case "px":
      return { css: `${m.value}px`, calibrated: true };
    case "em":
      return { css: `${m.value}em`, calibrated: true };
    case "ch":
      return { css: `${m.value}ch`, calibrated: true };
    case "cpl": {
      const factor = charsPerCh ?? UNCALIBRATED_CHARS_PER_CH;
      return { css: `${Math.round((m.value / factor) * 10) / 10}ch`, calibrated: charsPerCh !== null };
    }
  }
}

export interface CssOptions {
  /** Selector for the reading region. */
  scope: string;
  /** Use !important so reader overrides beat page styles (extension mode). */
  important?: boolean;
  /** Rendered characters per `ch`, measured in a browser for the target font. */
  charsPerCh?: number | null;
  /** Center the column when a measure is set. */
  center?: boolean;
}

const BODY_TEXT = "p, li, dd, dt, blockquote, figcaption, td, th, summary, label, address";

/** Generate scoped CSS for settings. Pure and deterministic. Rejects unsafe values. */
export function toCss(input: TypographySettings, opts: CssOptions): string {
  // Validate here too: callers may pass objects that never went through the schema.
  const s = TypographySettings.parse(input);
  // Braces, ";" and comments could end the rule; "<" could close a <style> element.
  // ">" is the child combinator and cannot break out of either, so it is allowed.
  if (/[{}<;]|\/\*|\*\//.test(opts.scope)) throw new Error("Unsafe scope selector");
  const imp = opts.important ? " !important" : "";
  // :is() keeps selector lists intact: ":is(main, article) :is(p, li)".
  const scope = /,/.test(opts.scope) ? `:is(${opts.scope})` : opts.scope;
  const within = (sel: string) => `${scope} :is(${sel})`;
  const vars: string[] = [];
  const root: string[] = [];
  const body: string[] = [];
  const heads: string[] = [];
  const extra: string[] = [];

  if (s.fontFamily) {
    vars.push(`--rl-font-family: ${s.fontFamily};`);
    root.push(`font-family: var(--rl-font-family)${imp};`);
    body.push(`font-family: var(--rl-font-family)${imp};`);
    heads.push(`font-family: var(--rl-font-family)${imp};`);
  }
  if (s.fontSizePx !== undefined) {
    vars.push(`--rl-font-size: ${s.fontSizePx}px;`);
    root.push(`font-size: var(--rl-font-size)${imp};`);
    body.push(`font-size: var(--rl-font-size)${imp};`);
  }
  if (s.lineHeight !== undefined) {
    vars.push(`--rl-line-height: ${s.lineHeight};`);
    root.push(`line-height: var(--rl-line-height)${imp};`);
    body.push(`line-height: var(--rl-line-height)${imp};`);
  }
  if (s.fontWeight !== undefined) {
    vars.push(`--rl-font-weight: ${s.fontWeight};`);
    body.push(`font-weight: var(--rl-font-weight)${imp};`);
  }
  if (s.letterSpacingEm !== undefined) {
    const v = s.letterSpacingEm === 0 ? "normal" : `${s.letterSpacingEm}em`;
    vars.push(`--rl-letter-spacing: ${v};`);
    body.push(`letter-spacing: var(--rl-letter-spacing)${imp};`);
  }
  if (s.wordSpacingEm !== undefined) {
    const v = s.wordSpacingEm === 0 ? "normal" : `${s.wordSpacingEm}em`;
    vars.push(`--rl-word-spacing: ${v};`);
    body.push(`word-spacing: var(--rl-word-spacing)${imp};`);
  }
  if (s.textAlign) {
    body.push(`text-align: ${s.textAlign}${imp};`);
    if (s.textAlign === "justify") body.push(`hyphens: auto${imp};`);
  }
  if (s.measure) {
    const m = measureToCss(s.measure, opts.charsPerCh ?? null);
    vars.push(`--rl-measure: ${m.css};${m.calibrated ? "" : " /* uncalibrated estimate: verify rendered CPL in a browser */"}`);
    root.push(`max-width: var(--rl-measure)${imp};`, `box-sizing: content-box${imp};`);
    if (opts.center !== false) root.push(`margin-inline: auto${imp};`);
  }
  if (s.paragraphGapEm !== undefined) {
    vars.push(`--rl-paragraph-gap: ${s.paragraphGapEm}em;`);
    extra.push(`${within("p")} { margin-block: 0 var(--rl-paragraph-gap)${imp}; }`);
  }
  if (s.theme) {
    vars.push(`--rl-fg: ${s.theme.foreground};`, `--rl-bg: ${s.theme.background};`);
    root.push(`color: var(--rl-fg)${imp};`, `background-color: var(--rl-bg)${imp};`);
    body.push(`color: var(--rl-fg)${imp};`);
    heads.push(`color: var(--rl-fg)${imp};`);
    if (s.theme.link) {
      vars.push(`--rl-link: ${s.theme.link};`);
      extra.push(`${within("a, a *")} { color: var(--rl-link)${imp}; text-decoration-line: underline${imp}; }`);
    }
  }

  const blocks: string[] = [];
  if (vars.length) blocks.push(`${scope} {\n  ${vars.join("\n  ")}\n  ${root.join("\n  ")}\n}`);
  if (body.length) blocks.push(`${within(BODY_TEXT)} {\n  ${body.join("\n  ")}\n}`);
  if (heads.length) blocks.push(`${within("h1, h2, h3, h4, h5, h6")} {\n  ${heads.join("\n  ")}\n}`);
  blocks.push(...extra);
  return `/* Readability Lab ${VERSION} — scoped reading styles */\n${blocks.join("\n")}\n`;
}

/** Recipe → CSS including responsive overrides as media queries. */
export function recipeToCss(recipe: Recipe, opts: Omit<CssOptions, "scope" | "charsPerCh"> & { scope?: string } = {}): string {
  const scope = opts.scope ?? recipe.scope.selector;
  const charsPerCh = recipe.calibration?.charsPerCh ?? null;
  let css = toCss(recipe.settings, { ...opts, scope, charsPerCh });
  for (const r of recipe.responsive) {
    const conds = [r.minWidthPx !== null ? `(min-width: ${r.minWidthPx}px)` : null, r.maxWidthPx !== null ? `(max-width: ${r.maxWidthPx}px)` : null].filter(Boolean);
    if (!conds.length) continue;
    // Labels are free text from imported files: keep only characters that cannot end a comment or a <style> element.
    const label = r.label.replace(/[^\p{L}\p{N} _.,()+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    css += `@media ${conds.join(" and ")} {\n/* ${label} */\n${toCss(r.settings, { ...opts, scope, charsPerCh }).replace(/^\/\*.*\*\/\n/, "")}}\n`;
  }
  return css;
}

/** Design Tokens Community Group (DTCG) format tokens for design tools. */
export function recipeToTokens(recipe: Recipe): Record<string, unknown> {
  const s = recipe.settings;
  const t: Record<string, unknown> = {};
  const ext = (extra: Record<string, unknown>) => ({ "dev.readability-lab": extra });
  if (s.fontFamily) t["font-family"] = { $type: "fontFamily", $value: s.fontFamily.split(",").map((f) => f.trim().replace(/^"|"$/g, "")) };
  if (s.fontSizePx !== undefined) t["font-size"] = { $type: "dimension", $value: { value: s.fontSizePx, unit: "px" } };
  if (s.lineHeight !== undefined)
    t["line-height"] = { $type: "number", $value: s.lineHeight, $description: "Baseline-to-baseline distance ÷ font size" };
  if (s.fontWeight !== undefined) t["font-weight"] = { $type: "fontWeight", $value: s.fontWeight };
  if (s.letterSpacingEm !== undefined && s.fontSizePx !== undefined)
    t["letter-spacing"] = { $type: "dimension", $value: { value: Math.round(s.letterSpacingEm * s.fontSizePx * 100) / 100, unit: "px" } };
  if (s.paragraphGapEm !== undefined && s.fontSizePx !== undefined)
    t["paragraph-gap"] = { $type: "dimension", $value: { value: Math.round(s.paragraphGapEm * s.fontSizePx * 100) / 100, unit: "px" }, $description: "Additional gap after paragraphs" };
  if (s.measure) {
    const m = measureToCss(s.measure, recipe.calibration?.charsPerCh ?? null);
    t["measure"] = {
      $type: "number",
      $value: parseFloat(m.css),
      $description: `Column max-width in CSS ${m.css.replace(/[\d.]/g, "") || "units"}${s.measure.unit === "cpl" ? `, targeting about ${s.measure.value} rendered characters per line` : ""}`,
      $extensions: ext({ measure: s.measure, css: m.css, calibrated: m.calibrated, calibration: recipe.calibration }),
    };
  }
  if (s.theme) {
    t["color"] = {
      foreground: { $type: "color", $value: s.theme.foreground },
      background: { $type: "color", $value: s.theme.background },
      ...(s.theme.link ? { link: { $type: "color", $value: s.theme.link } } : {}),
    };
  }
  return {
    reading: {
      $description: `${recipe.name} — exported by Readability Lab ${VERSION}. Browser-rendered layout is the verification reference.`,
      ...t,
      $extensions: ext({ recipeId: recipe.id, claimRevisions: recipe.claimRevisions }),
    },
  };
}

export function createRecipe(input: Partial<RecipeInput> & { name: string; settings: TypographySettings }): Recipe {
  return Recipe.parse({
    format: "readability-lab/recipe",
    formatVersion: 1,
    id: input.id ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    provenance: { tool: "readability-lab", toolVersion: VERSION, createdAt: new Date().toISOString(), basedOn: null },
    ...input,
  });
}

/** Map a recipe field to a human label. */
export const FIELD_LABELS: Record<SettingField, string> = {
  fontFamily: "Font",
  fontSizePx: "Text size",
  lineHeight: "Line height",
  fontWeight: "Weight",
  letterSpacingEm: "Letter spacing",
  wordSpacingEm: "Word spacing",
  measure: "Line length",
  paragraphGapEm: "Paragraph gap",
  textAlign: "Alignment",
  theme: "Theme",
};

export function formatSetting(field: SettingField, s: TypographySettings): string {
  const v = s[field];
  if (v === undefined) return "page default";
  switch (field) {
    case "fontSizePx":
      return `${v}px`;
    case "measure": {
      const m = v as Measure;
      return m.unit === "cpl" ? `about ${m.value} characters per line` : m.unit === "none" ? "no limit" : `${m.value}${m.unit}`;
    }
    case "letterSpacingEm":
    case "wordSpacingEm":
      return v === 0 ? "typeface default" : `${v}em`;
    case "paragraphGapEm":
      return `${v}× text size`;
    case "theme": {
      const t = v as Theme;
      return `${t.name} (${t.foreground} on ${t.background})`;
    }
    default:
      return String(v);
  }
}

/** Human-readable design specification that keeps the reasoning with the values. */
export function designSpec(recipe: Recipe): string {
  const s = recipe.settings;
  const L: string[] = [`# ${recipe.name} — reading design specification`, ""];
  if (recipe.description) L.push(recipe.description, "");
  L.push(`Scope: \`${recipe.scope.selector}\``, "", "| Setting | Value | Why |", "|---|---|---|");
  for (const f of SETTING_FIELDS) {
    if (s[f] === undefined) continue;
    const why = recipe.rationale.filter((r) => r.field === f).map((r) => `${r.note}${r.claimIds.length ? ` (${r.claimIds.join(", ")})` : ""}`).join("; ");
    L.push(`| ${FIELD_LABELS[f]} | ${formatSetting(f, s).replace(/\|/g, "\\|")} | ${why || "—"} |`);
  }
  if (s.measure?.unit === "cpl") {
    const m = measureToCss(s.measure, recipe.calibration?.charsPerCh ?? null);
    L.push("", `Line length is a target of about ${s.measure.value} rendered characters per line, implemented as \`max-width: ${m.css}\`${recipe.calibration ? ` (calibrated in ${recipe.calibration.measuredWith} for ${recipe.calibration.fontFamily}: ${recipe.calibration.charsPerCh} characters per ch)` : " (uncalibrated estimate — verify in a browser)"}. Phones should keep the text size and use the available width instead.`);
  }
  if (recipe.responsive.length) {
    L.push("", "## Responsive overrides", "");
    for (const r of recipe.responsive) L.push(`- **${r.label}** (${r.minWidthPx ?? 0}–${r.maxWidthPx ?? "∞"}px): ${SETTING_FIELDS.filter((f) => r.settings[f] !== undefined).map((f) => `${FIELD_LABELS[f]} ${formatSetting(f, r.settings)}`).join(", ")}`);
  }
  if (recipe.exceptions.length) {
    L.push("", "## Accepted exceptions", "");
    for (const e of recipe.exceptions) L.push(`- \`${e.ruleId}\`${e.selector ? ` on \`${e.selector}\`` : ""}: ${e.reason} — review by ${e.reviewBy}`);
  }
  L.push("", "## Verification", "", "Browser-rendered layout is the reference. Reproduce with:", "", "```", `rlab inspect <url> --selector "${recipe.scope.selector}" --recipe ${recipe.id}.json --scenarios all --out reports/${recipe.id}`, "```", "", "These values are starting choices, not proven optima. Readers can override them with their own profile.");
  if (Object.keys(recipe.claimRevisions).length) L.push("", `Evidence revisions: ${Object.entries(recipe.claimRevisions).map(([k, v]) => `${k} r${v}`).join(", ")}`);
  return L.join("\n") + "\n";
}
