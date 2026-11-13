/** sRGB color with 0–255 channels and 0–1 alpha. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseChannel(token: string, max: number): number {
  const t = token.trim();
  if (t.endsWith("%")) return clamp((parseFloat(t) / 100) * max, 0, max);
  return clamp(parseFloat(t), 0, max);
}

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1;
  const t = token.trim();
  if (t.endsWith("%")) return clamp(parseFloat(t) / 100, 0, 1);
  return clamp(parseFloat(t), 0, 1);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/**
 * Parse CSS colors that can be resolved without a browser: hex, rgb(a), hsl(a) and a few
 * names. Returns null for anything else (e.g. oklch, color-mix, currentColor) so callers
 * report it as unresolved rather than guessing. In a browser, prefer the inspector's
 * canvas-based normaliser, which handles every syntax the engine supports.
 */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s in NAMED) return { ...NAMED[s]! };
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    const expand = hex.length <= 4 ? hex.split("").map((c) => c + c).join("") : hex;
    if (expand.length !== 6 && expand.length !== 8) return null;
    const n = (i: number) => parseInt(expand.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: expand.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^(rgba?|hsla?)\((.*)\)$/.exec(s);
  if (!fn) return null;
  const [, name, body] = fn as unknown as [string, string, string];
  const parts = body.includes(",")
    ? body.split(",").map((p) => p.trim())
    : body.replace("/", " / ").split(/\s+/).filter((p) => p && p !== "/");
  if (parts.length < 3) return null;
  if (name.startsWith("rgb")) {
    return {
      r: parseChannel(parts[0]!, 255),
      g: parseChannel(parts[1]!, 255),
      b: parseChannel(parts[2]!, 255),
      a: parseAlpha(parts[3]),
    };
  }
  const h = parseFloat(parts[0]!);
  const sat = parseFloat(parts[1]!) / 100;
  const lig = parseFloat(parts[2]!) / 100;
  const [r, g, b] = hslToRgb(h, clamp(sat, 0, 1), clamp(lig, 0, 1));
  return { r, g, b, a: parseAlpha(parts[3]) };
}

/** Composite `top` over `bottom` (source-over). */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const ch = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: ch(top.r, bottom.r), g: ch(top.g, bottom.g), b: ch(top.b, bottom.b), a };
}

/** WCAG 2.x relative luminance (sRGB). Uses the 0.04045 threshold from IEC 61966-2-1. */
export function relativeLuminance(c: Rgba): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2.x contrast ratio (1–21). Both colors must be opaque; composite first. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex(c: Rgba): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${c.a < 1 ? h(c.a * 255) : ""}`;
}

/**
 * WCAG 2.2 "large scale" text: at least 18 point, or 14 point bold.
 * 1pt = 4/3 CSS px, so 24px, or 18.67px at weight ≥ 700. (Claim C-CONTRAST-004)
 */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 56 / 3 - 0.005 && fontWeight >= 700);
}

/** WCAG 2.2 thresholds for 1.4.3 (AA) and 1.4.6 (AAA). */
export function contrastThresholds(large: boolean): { AA: number; AAA: number } {
  return large ? { AA: 3, AAA: 4.5 } : { AA: 4.5, AAA: 7 };
}
