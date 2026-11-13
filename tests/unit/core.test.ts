import { describe, expect, it } from "vitest";
import {
  analyzePerformance,
  applyPreset,
  contrastRatio,
  createProfile,
  createRecipe,
  decodeSettings,
  dependentsOfClaim,
  encodeSettings,
  evaluate,
  exportProfile,
  gate,
  getClaim,
  getRegistry,
  importProfile,
  isLargeText,
  parseColor,
  planConfirmation,
  planExploration,
  PRESETS,
  resolvePresentation,
  RULES,
  staleClaimReferences,
  summarizePreferences,
  THEMES,
  toCss,
  williamsRow,
  type Observation,
  type Passage,
  type Scenario,
} from "../../packages/core/src/index.js";

const obs = (o: Partial<Observation> & Pick<Observation, "metric" | "value">): Observation => ({
  id: `${o.scenarioId ?? "baseline"}:${o.metric}:${Math.random()}`,
  unit: null,
  status: "measured",
  method: "test",
  scenarioId: "baseline",
  element: null,
  distribution: null,
  unknownReason: null,
  details: {},
  ...o,
});
const el = (selector: string, matched: string[] = []) => ({ selector, box: null, textSample: null, matchedSelectors: matched });

describe("WCAG contrast math", () => {
  it("matches known reference ratios", () => {
    const white = parseColor("#fff")!;
    expect(contrastRatio(parseColor("#000")!, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor("#767676")!, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseColor("#777777")!, white)).toBeLessThan(4.5); // 4.48: must not round up to pass
    expect(contrastRatio(parseColor("rgb(89 89 89)")!, white)).toBeCloseTo(7.0, 1);
  });
  it("uses the WCAG large-text definition (18pt, or 14pt bold)", () => {
    expect(isLargeText(18, 400)).toBe(false); // 18px body text is not large
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.67, 700)).toBe(true);
    expect(isLargeText(18.67, 600)).toBe(false);
  });
  it("every built-in theme pair is at least 7:1", () => {
    for (const t of Object.values(THEMES)) {
      expect(contrastRatio(parseColor(t.foreground)!, parseColor(t.background)!), t.name).toBeGreaterThanOrEqual(7);
      if (t.link) expect(contrastRatio(parseColor(t.link)!, parseColor(t.background)!), `${t.name} link`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("profiles and recipes", () => {
  const recipe = createRecipe({ name: "Publisher", settings: { fontSizePx: 17, lineHeight: 1.4, measure: { value: 70, unit: "cpl" } }, responsive: [{ label: "Phone", minWidthPx: null, maxWidthPx: 600, settings: { fontSizePx: 18 } }] });
  it("reader choices beat publisher layers, including responsive overrides", () => {
    const profile = createProfile({ settings: { fontSizePx: 22 }, needs: ["fontSizePx"] });
    const r = resolvePresentation({ recipe, profile, viewportWidth: 390 });
    expect(r.settings.fontSizePx).toBe(22);
    expect(r.origins.fontSizePx).toBe("reader-need");
    expect(r.settings.lineHeight).toBe(1.4);
    expect(r.origins.lineHeight).toBe("publisher");
  });
  it("applies publisher responsive overrides only at matching widths", () => {
    expect(resolvePresentation({ recipe, viewportWidth: 390 }).settings.fontSizePx).toBe(18);
    expect(resolvePresentation({ recipe, viewportWidth: 1280 }).settings.fontSizePx).toBe(17);
  });
  it("per-site reader settings override global reader settings", () => {
    const profile = createProfile({ settings: { lineHeight: 1.5 }, sites: { "example.org": { mode: "page", settings: { lineHeight: 1.8 }, regionSelector: null } } });
    expect(resolvePresentation({ profile, host: "example.org" }).settings.lineHeight).toBe(1.8);
    expect(resolvePresentation({ profile, host: "other.org" }).settings.lineHeight).toBe(1.5);
  });
  it("presets keep declared access needs", () => {
    const p = createProfile({ settings: { fontSizePx: 26, lineHeight: 1.9 }, needs: ["fontSizePx"] });
    const after = applyPreset(p, "compact");
    expect(after.settings.fontSizePx).toBe(26);
    expect(after.settings.lineHeight).toBe(1.4);
  });
  it("exports for sharing without site history and round-trips", () => {
    const p = createProfile({ settings: { fontSizePx: 20 }, sites: { "bank.example": { mode: "page", settings: {}, regionSelector: null } } });
    const shared = exportProfile(p);
    expect(Object.keys(shared.sites)).toEqual([]);
    expect(importProfile(JSON.stringify(shared)).settings.fontSizePx).toBe(20);
    expect(() => importProfile({ format: "readability-lab/profile", formatVersion: 2 })).toThrow(/formatVersion/);
    expect(decodeSettings(encodeSettings({ fontSizePx: 19, theme: THEMES.sepia }))).toEqual({ fontSizePx: 19, theme: THEMES.sepia });
  });
  it("scopes CSS correctly for selector lists", () => {
    const css = toCss({ paragraphGapEm: 0.75, fontSizePx: 18 }, { scope: "main, article" });
    expect(css).toContain(":is(main, article) :is(p)");
    expect(css).not.toMatch(/^main, article p/m);
  });
  it("starting presets are labelled as starting choices and cite claims", () => {
    for (const p of PRESETS) {
      expect(p.caveat).toContain("No reliable quantitative improvement established.");
      for (const id of p.claimIds) expect(getClaim(id), `${p.id} → ${id}`).toBeTruthy();
    }
  });
});

describe("rules: honesty invariants", () => {
  const scen = (kind: Scenario["kind"], id: string, fidelity: Scenario["fidelity"] = "real-browser"): Scenario => ({ id, label: id, kind, fidelity, description: id, viewport: null, appliedCss: null });
  it("heuristic deviations are never accessibility failures and do not fail the default gate", () => {
    const f = evaluate({
      observations: [obs({ metric: "layout.cpl", value: 120 }), obs({ metric: "text.fontSizePx", value: 13 }), obs({ metric: "text.lineHeightRatio", value: 1.15 }), obs({ metric: "text.align", value: "justify" }), obs({ metric: "contrast.sample", value: 5.2, details: { large: false, fg: "#666", bg: "#fff" } })],
      scenarios: [scen("baseline", "baseline")],
      viewportWidth: 1280,
    });
    expect(f.some((x) => x.kind === "accessibility-failure")).toBe(false);
    expect(f.filter((x) => x.kind === "heuristic-deviation").map((x) => x.ruleId)).toEqual(expect.arrayContaining(["cpl-range", "font-size-range", "line-height-range", "alignment", "contrast-target"]));
    expect(gate(f, undefined, "2026-11-12").status).toBe("pass");
  });
  it("contrast just below 4.5 fails; unknown and estimated backgrounds need review", () => {
    const f = evaluate({
      observations: [
        obs({ metric: "contrast.sample", value: 4.499, details: { large: false, fg: "#777", bg: "#fff" }, element: el("#a") }),
        obs({ metric: "contrast.sample", value: null, status: "unknown", unknownReason: "gradient", element: el("#b") }),
        obs({ metric: "contrast.sample", value: 12, status: "estimated", details: { large: false }, element: el("#c") }),
      ],
      scenarios: [scen("baseline", "baseline")],
      viewportWidth: 1280,
    });
    expect(f.find((x) => x.element?.selector === "#a")?.kind).toBe("accessibility-failure");
    expect(f.find((x) => x.element?.selector === "#b")?.kind).toBe("needs-review");
    expect(f.find((x) => x.element?.selector === "#c")?.kind).toBe("needs-review");
    expect(f.some((x) => x.ruleId === "contrast-aa" && x.kind === "pass")).toBe(false);
  });
  it("scenarios without a completion record or with unapplied overrides never pass", () => {
    const f = evaluate({ observations: [obs({ metric: "scenario.completed", value: true, scenarioId: "text-spacing" }), obs({ metric: "scenario.overridesNotApplied", value: 3, scenarioId: "text-spacing" })], scenarios: [scen("text-spacing", "text-spacing"), scen("reflow-320", "reflow-320")], viewportWidth: 1280 });
    expect(f.filter((x) => x.kind === "pass")).toEqual([]);
    expect(f.find((x) => x.ruleId === "reflow")?.title).toMatch(/did not complete/);
  });
  it("approximation scenarios produce needs-review, not failures", () => {
    const f = evaluate({
      observations: [obs({ metric: "scenario.completed", value: true, scenarioId: "zoom-200" }), obs({ metric: "overflow.clippedText", value: 50, scenarioId: "zoom-200", element: el("#x") })],
      scenarios: [scen("zoom-200", "zoom-200", "approximation")],
      viewportWidth: 640,
    });
    expect(f.find((x) => x.element?.selector === "#x")?.kind).toBe("needs-review");
  });
  it("exceptions match only browser-resolved selectors and expire", () => {
    const observations = [obs({ metric: "contrast.sample", value: 3, details: { large: false }, element: el("#intro-extra", []) }), obs({ metric: "contrast.sample", value: 3.1, details: { large: false }, element: el("#intro", ["#intro"]) })];
    const policy = { format: "readability-lab/policy" as const, formatVersion: 1 as const, exceptions: [{ ruleId: "contrast-aa", selector: "#intro", reason: "Brand banner pending redesign", reviewBy: "2026-12-31", approvedBy: null }] };
    const f = evaluate({ observations, scenarios: [scen("baseline", "baseline")], viewportWidth: 1280, policy });
    expect(f.find((x) => x.element?.selector === "#intro")?.exception).toBeTruthy();
    expect(f.find((x) => x.element?.selector === "#intro-extra")?.exception).toBeNull();
    expect(gate(f, policy, "2026-11-12").failing.length).toBe(1);
    expect(gate(f, policy, "2027-01-15").failing.length).toBe(2); // expired exception no longer excuses
  });
});

describe("evidence registry traceability", () => {
  it("every claim id referenced by rules and presets exists", () => {
    for (const r of RULES) for (const id of r.claimIds) expect(getClaim(id), `${r.id} → ${id}`).toBeTruthy();
  });
  it("a revised claim is traced to dependent rules, presets and recipes", () => {
    const recipe = createRecipe({ name: "Docs", settings: { lineHeight: 1.6 }, claimRevisions: { "C-LH-003": 1 }, rationale: [{ field: "lineHeight", note: "Hypothesis to test", claimIds: ["C-LH-003"] }] });
    const d = dependentsOfClaim("C-LH-003", [recipe]);
    expect(d.rules).toContain("line-height-range");
    expect(d.presets).toContain("larger-text");
    expect(d.recipes).toEqual([recipe.id]);
    // Simulate a revision in the registry and confirm the recipe is flagged as stale.
    const claim = getClaim("C-LH-003")!;
    const original = claim.revision;
    claim.revision = original + 1;
    claim.history.push({ revision: original + 1, date: "2026-12-01", change: "New replication added", reason: "test", by: null });
    try {
      expect(staleClaimReferences(recipe)).toEqual([expect.objectContaining({ claimId: "C-LH-003", status: "revised", recordedRevision: 1 })]);
    } finally {
      claim.revision = original;
      claim.history.pop();
    }
  });
  it("registry statements use the exact NRQI wording when flagged", () => {
    for (const c of getRegistry().claims.filter((x) => x.noReliableQuantitativeImprovement)) expect(c.statement, c.id).toContain("No reliable quantitative improvement established.");
  });
});

describe("personal experiments", () => {
  it("Williams rows balance first-order carryover for even n", () => {
    const n = 4;
    const pairs = new Map<string, number>();
    for (let r = 0; r < n; r++) {
      const row = williamsRow(n, r);
      expect(new Set(row).size).toBe(n);
      for (let i = 1; i < n; i++) pairs.set(`${row[i - 1]}>${row[i]}`, (pairs.get(`${row[i - 1]}>${row[i]}`) ?? 0) + 1);
    }
    expect([...pairs.values()].every((v) => v === 1)).toBe(true);
  });
  const passages: Passage[] = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, title: `P${i}`, words: 600, language: "en", license: "original-cc-by-4.0", attribution: "Readability Lab", questions: [] }));
  const conditions = [
    { id: "a", label: "A", concealedLabel: "Option K", settings: { lineHeight: 1.4 } },
    { id: "b", label: "B", concealedLabel: "Option M", settings: { lineHeight: 1.6 } },
  ];
  it("refuses to reuse passages and stays inconclusive without held-out confirmation", () => {
    expect(() => planExploration({ id: "e", seed: 1, conditions, passages: passages.slice(0, 3) })).toThrow(/distinct passages/);
    let exp = planExploration({ id: "e", seed: 7, conditions, passages });
    const ids = exp.schedule.map((s) => s.passageId);
    expect(new Set(ids).size).toBe(ids.length);
    exp = { ...exp, trials: exp.schedule.map((s, slot) => ({ slot, startedAt: "", activeReadingMs: s.conditionId === "a" ? 120000 : 150000, comprehension: { correct: 5, total: 6 }, comfort: 6, interruptions: [], excluded: null })) };
    const v1 = analyzePerformance(exp);
    expect(v1.verdict).toBe("inconclusive");
    exp = planConfirmation(exp);
    const confirmSlots = exp.schedule.map((s, i) => ({ s, i })).filter((x) => x.s.phase === "confirmation");
    expect(confirmSlots.every((x) => !ids.includes(x.s.passageId))).toBe(true);
    exp = { ...exp, trials: [...exp.trials, ...confirmSlots.map(({ s, i }) => ({ slot: i, startedAt: "", activeReadingMs: s.conditionId === "a" ? 121000 : 149000, comprehension: { correct: 5, total: 6 }, comfort: 6, interruptions: [], excluded: null }))] };
    const v2 = analyzePerformance(exp);
    expect(v2.verdict).toBe("consistent-personal-difference");
    expect(v2.disclaimer).toMatch(/not an optimal setting/);
  });
  it("preference summaries are labelled as preference only", () => {
    const s = summarizePreferences({ format: "readability-lab/preference-session", formatVersion: 1, id: "x", createdAt: "", seed: 1, concealFontNames: true, sampleId: "s", conditions, comparisons: [{ left: "a", right: "b", choice: "left", at: "" }] });
    expect(s.validAs).toBe("preference only");
    expect(s.mostPreferred).toEqual(["a"]);
  });
});

describe("review 2 regressions (pure)", () => {
  it("rejects CSS injection through imported settings", async () => {
    const { TypographySettings } = await import("../../packages/core/src/index.js");
    expect(TypographySettings.safeParse({ fontFamily: "x; } body { display:none" }).success).toBe(false);
    expect(TypographySettings.safeParse({ theme: { name: "custom", foreground: "red;}*{display:none", background: "#fff", link: null } }).success).toBe(false);
    expect(() => toCss({ fontFamily: "Georgia }" } as never, { scope: "main" })).toThrow();
    for (const bad of ["main } body {", "main</style><script>", "main; x", "main /* x */"]) expect(() => toCss({ fontSizePx: 18 }, { scope: bad })).toThrow(/Unsafe scope/);
    // Responsive labels are free text: they must not end the comment, the rule or a <style> element.
    const { Recipe, recipeToCss } = await import("../../packages/core/src/index.js");
    for (const label of ["*/ } body { background: red } /*", "</style><script>x</script><style>"]) {
      const css = recipeToCss(Recipe.parse({ format: "readability-lab/recipe", formatVersion: 1, id: "x", name: "x", settings: { fontSizePx: 18 }, responsive: [{ label, maxWidthPx: 600, settings: { fontSizePx: 16 } }] }));
      expect(css).not.toMatch(/<|body \{|\*\/ \}/);
      expect(css).toContain("@media (max-width: 600px)");
    }
    // Child combinators are ordinary selectors (real pages need them, e.g. "#postContent > article").
    expect(toCss({ fontSizePx: 18 }, { scope: "#postContent > article" })).toContain("#postContent > article :is(p");
    expect(() => importProfile({ format: "readability-lab/profile", formatVersion: 1, id: "x", updatedAt: "", settings: { fontFamily: "a{}" } })).toThrow(/Invalid profile/);
    expect(TypographySettings.safeParse({ fontFamily: '"Source Serif 4", Georgia, serif', theme: THEMES.dark }).success).toBe(true);
  });
  it("a site turned off applies no reader layers", () => {
    const profile = createProfile({ settings: { fontSizePx: 24 }, sites: { "news.example": { mode: "off", settings: {}, regionSelector: null } } });
    const recipe = createRecipe({ name: "P", settings: { lineHeight: 1.5 } });
    const r = resolvePresentation({ recipe, profile, host: "news.example" });
    expect(r.readerEnabled).toBe(false);
    expect(r.settings).toEqual({ lineHeight: 1.5 });
  });
});
