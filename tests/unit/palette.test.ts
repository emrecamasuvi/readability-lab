// Every foreground/background pair our own UIs use must meet our 7:1 text target (WCAG AAA level)
// — the same pairs checked in "This hue shall pass" (thishueshallpass.clearleft.com).
// Colors are read from the source files so a palette edit can't silently drift below target.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor } from "../../packages/core/src/index.js";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const varsIn = (css: string) => Object.fromEntries(Array.from(css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g), (m) => [m[1]!, m[2]!]));
const ratio = (a: string, b: string) => contrastRatio(parseColor(a)!, parseColor(b)!);

describe("UI palettes meet the 7:1 text target", () => {
  it("website (dark)", () => {
    const v = varsIn(read("apps/site/index.html").split(":root {")[1]!.split("}")[0]!);
    const text = [["paper", "carbon"], ["dim", "carbon"], ["pencil", "carbon"], ["hi", "carbon"], ["paper", "carbon-2"], ["dim", "carbon-2"], ["hi", "carbon-2"], ["pencil", "carbon-2"], ["paper", "carbon-3"], ["dim", "carbon-3"], ["hi", "carbon-3"], ["hi-ink", "hi"], ["carbon", "paper"], ["card-ink", "card-paper"]];
    for (const [fg, bg] of text) expect(ratio(v[fg]!, v[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
    // Glyph on the wipe handle: non-text graphic, but kept at text AA.
    expect(ratio("#ffffff", v["pencil-deep"]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("workbench (light and dark)", () => {
    const css = read("apps/workbench/src/styles.css");
    const light = varsIn(css.split(":root {")[1]!.split("}")[0]!);
    const dark = varsIn(css.split(":root:not([data-theme=\"light\"]) {")[1]!.split("}")[0]!);
    for (const v of [light, dark]) {
      for (const fg of ["fg", "muted", "accent", "warn", "fail", "ok"]) {
        expect(ratio(v[fg]!, v.bg!), `${fg} on bg`).toBeGreaterThanOrEqual(7);
        expect(ratio(v[fg]!, v.panel!), `${fg} on panel`).toBeGreaterThanOrEqual(7);
      }
      expect(ratio(v["accent-fg"]!, v.accent!), "accent-fg on accent").toBeGreaterThanOrEqual(7);
    }
  });
  it("extension popup (light and dark)", () => {
    const css = read("apps/extension/static/popup.css");
    const light = varsIn(css.split(":root {")[1]!.split("}")[0]!);
    const dark = varsIn(css.split(":root {")[2]!.split("}")[0]!);
    for (const v of [light, dark]) for (const fg of ["fg", "muted", "accent"]) expect(ratio(v[fg]!, v.bg!), fg).toBeGreaterThanOrEqual(7);
    expect(ratio(light["accent-fg"]!, light.accent!)).toBeGreaterThanOrEqual(7);
  });
});
