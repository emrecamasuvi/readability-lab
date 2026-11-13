export const FONT_METHOD = "width-comparison-and-fontfaceset@1";

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong", "-apple-system", "blinkmacsystemfont"]);

export function parseFamilies(stack: string): string[] {
  return stack
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

let canvas: CanvasRenderingContext2D | null = null;
function width(font: string): number {
  if (!canvas) canvas = document.createElement("canvas").getContext("2d");
  if (!canvas) return 0;
  canvas.font = font;
  return canvas.measureText("mmmmmmmmmlli1WQ@#Ğşİıçö").width;
}

export type FontAvailability = "available" | "unavailable" | "generic" | "unknown";

/**
 * Estimate whether a family renders. Web fonts are read from document.fonts (status).
 * Local fonts are detected by comparing text widths against two different fallbacks;
 * identical widths in both suggest the family is absent. This is an estimate.
 */
export function availability(family: string): FontAvailability {
  if (GENERIC.has(family.toLowerCase())) return "generic";
  try {
    const faces = Array.from(document.fonts as unknown as Iterable<FontFace>).filter((f) => f.family.replace(/^['"]|['"]$/g, "") === family);
    if (faces.some((f) => f.status === "loaded")) return "available";
    if (faces.length && faces.every((f) => f.status === "error")) return "unavailable";
  } catch {
    /* ignore */
  }
  const q = `"${family.replace(/"/g, "")}"`;
  const a = width(`72px ${q}, monospace`) !== width("72px monospace");
  const b = width(`72px ${q}, serif`) !== width("72px serif");
  if (a || b) return "available";
  return "unavailable";
}

export function firstAvailable(stack: string): { family: string | null; firstDeclaredAvailable: boolean; checked: { family: string; availability: FontAvailability }[] } {
  const fams = parseFamilies(stack);
  const checked: { family: string; availability: FontAvailability }[] = [];
  let found: string | null = null;
  for (const f of fams) {
    const av = availability(f);
    checked.push({ family: f, availability: av });
    if (!found && (av === "available" || av === "generic")) found = f;
  }
  return { family: found, firstDeclaredAvailable: checked[0]?.availability === "available" || checked[0]?.availability === "generic", checked };
}
