import {
  claimRevisions,
  createRecipe,
  designSpec,
  getPreset,
  recipeToCss,
  recipeToTokens,
  SETTING_FIELDS,
  type Recipe,
  type TypographySettings,
} from "@emrecamasuvi/readability-lab-core";
import type { PaneMeasurement } from "./frame.js";

export function browserLabel(): string {
  const ua = navigator.userAgent;
  const m = /(Firefox|Edg|Chrome|Safari)\/([\d.]+)/.exec(ua);
  return m ? `${m[1] === "Edg" ? "Edge" : m[1]} ${m[2]}` : "unknown browser";
}

const FIELD_NOTES: Partial<Record<keyof TypographySettings, { note: string; claims: string[] }>> = {
  measure: { note: "Starting line-length range is about 50–75 characters; the exact value is a design choice.", claims: ["C-BASE-002", "C-CPL-006"] },
  fontSizePx: { note: "16–22px is a starting range; apparent size depends on the font and viewing distance.", claims: ["C-BASE-002", "C-SIZE-001", "C-SIZE-002"] },
  lineHeight: { note: "1.4–1.7 is a starting range; no value in it is established as best.", claims: ["C-BASE-002", "C-LH-003"] },
  paragraphGapEm: { note: "About 0.75× text size is a heuristic.", claims: ["C-PARA-001"] },
  fontWeight: { note: "Regular/book weights preserve stroke detail.", claims: ["C-WEIGHT-001"] },
  theme: { note: "Theme colors are at least 7:1; readers can switch polarity.", claims: ["C-CONTRAST-002", "C-THEME-006"] },
  textAlign: { note: "Start alignment keeps word spacing even.", claims: ["C-ALIGN-001"] },
  fontFamily: { note: "No typeface is established as universally fastest.", claims: ["C-FONT-004"] },
};

/** Build a recipe that keeps its reasoning and the browser calibration it was measured with. */
export function buildRecipe(input: { name: string; settings: TypographySettings; presetId: string | null; region: string; measurement: PaneMeasurement | null; sampleId: string; viewport: { width: number; height: number } }): Recipe {
  const rationale = SETTING_FIELDS.filter((f) => input.settings[f] !== undefined && FIELD_NOTES[f]).map((f) => ({ field: f, note: FIELD_NOTES[f]!.note, claimIds: FIELD_NOTES[f]!.claims }));
  const preset = input.presetId ? getPreset(input.presetId) : undefined;
  const claims = new Set<string>([...rationale.flatMap((r) => r.claimIds), ...(preset?.claimIds ?? [])]);
  const fit = input.measurement?.fit;
  return createRecipe({
    name: input.name,
    description: `Created in the Readability Lab workbench${preset ? ` from the ${preset.name} starting choice` : ""}. Browser-rendered layout is the verification reference.`,
    settings: input.settings,
    scope: { selector: input.region },
    rationale,
    claimRevisions: claimRevisions(claims),
    calibration: fit?.charsPerCh
      ? { charsPerCh: fit.charsPerCh, fontFamily: input.settings.fontFamily ?? "page font", sampleId: input.sampleId, measuredWith: `${browserLabel()} at ${input.viewport.width}×${input.viewport.height} CSS px` }
      : null,
  });
}

export function download(name: string, content: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportAll(recipe: Recipe, kind: "recipe" | "css" | "tokens" | "spec") {
  if (kind === "recipe") download(`${recipe.id}.recipe.json`, JSON.stringify(recipe, null, 2));
  if (kind === "css") download(`${recipe.id}.css`, recipeToCss(recipe), "text/css");
  if (kind === "tokens") download(`${recipe.id}.tokens.json`, JSON.stringify(recipeToTokens(recipe), null, 2));
  if (kind === "spec") download(`${recipe.id}.spec.md`, designSpec(recipe), "text/markdown");
}

export function cliCommand(recipe: Recipe, device: { width: number; height: number }): string {
  return `rlab inspect <your-page-url> --selector "${recipe.scope.selector}" --recipe ${recipe.id}.recipe.json --viewport ${device.width}x${device.height} --scenarios all --screenshots --out reports/${recipe.id}`;
}
