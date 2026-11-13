import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  comparisonToMarkdown,
  compareReports,
  dependentsOfClaim,
  gate,
  getClaim,
  getRegistry,
  getSource,
  htmlDocument,
  importProfile,
  markdownToHtml,
  NRQI,
  Policy,
  Recipe,
  recipeToCss,
  recipeToTokens,
  Report,
  reportToMarkdown,
  searchClaims,
  staleClaimReferences,
  VERSION,
  designSpec,
  type ClaimKind,
} from "@emrecamasuvi/readability-lab-core";
import { ALL_SCENARIOS, BROWSERS, UsageError, inspectUrl, loadJson, parseViewport, type ScenarioKind } from "./index.js";

const HELP = `rlab ${VERSION} — Readability Lab command line

Usage:
  rlab inspect <url|file> [options]     Measure a reading region in a real browser and write a report
  rlab check <url|file> [options]       Inspect + apply project policy; exit 1 on policy failure (CI)
  rlab compare <before.json> <after.json> [--out file.md]
  rlab recipe css|tokens|spec|validate <recipe.json> [--scope sel]
  rlab claims [search words] [--kind normative|empirical|heuristic|hypothesis] [--nrqi]
  rlab claim <C-ID> [--dependents] [--recipe recipe.json]
  rlab registry                         Registry version and counts

Inspect/check options:
  --selector, -s <css>      Reading region (recommended). Without it, the region is auto-detected.
  --viewport <v>            desktop|laptop|tablet|phone|WxH[@DPR] (default desktop 1280x800)
  --browser <b>             chromium (default) | firefox | webkit
  --scenarios <list>        text-spacing,reflow-320,zoom-200 | all | none (default: all for check, none for inspect)
  --recipe <file>           Apply a publisher recipe before measuring
  --profile <file>          Apply a reader profile before measuring
  --policy <file>           Project policy (readability-lab/policy)
  --out <dir>               Write report.json, report.md, report.html (+ screenshots with --screenshots)
  --screenshots             Save a full-page screenshot per scenario
  --axe                     Cross-check contrast with axe-core (reported alongside, not merged)
  --privacy                 Omit text samples from reports
  --wait-for <css>          Wait for a selector (dynamic content)
  --wait-ms <n>             Extra wait after load
  --allow-http-errors       Inspect the document even if the server answers 4xx/5xx (default: exit 3)
  --json                    Print the JSON report to stdout

Exit codes: 0 ok · 1 policy failure (check) · 2 usage error · 3 page could not be inspected as requested
(navigation failed, region selector matched nothing, measurement error).

Automated checks cover only what the report lists under "performed". They are not a WCAG certification.`;

function readRecipe(path: string): Recipe {
  return Recipe.parse(loadJson(path));
}

function scenarioList(v: string | undefined, dflt: ScenarioKind[]): ScenarioKind[] {
  if (!v) return dflt;
  if (v === "all") return ALL_SCENARIOS;
  if (v === "none") return [];
  const list = v.split(",").map((s) => s.trim()) as ScenarioKind[];
  for (const s of list) if (!ALL_SCENARIOS.includes(s)) throw new Error(`Unknown scenario ${s}`);
  return list;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function inspectCommand(args: string[], isCheck: boolean): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      selector: { type: "string", short: "s" },
      viewport: { type: "string" },
      browser: { type: "string" },
      scenarios: { type: "string" },
      recipe: { type: "string" },
      profile: { type: "string" },
      policy: { type: "string" },
      out: { type: "string" },
      screenshots: { type: "boolean" },
      axe: { type: "boolean" },
      privacy: { type: "boolean" },
      "wait-for": { type: "string" },
      "wait-ms": { type: "string" },
      json: { type: "boolean" },
      "color-scheme": { type: "string" },
      "allow-http-errors": { type: "boolean" },
    },
  });
  const target = positionals[0];
  if (!target) throw new Error("Missing <url|file>.");
  if (values["color-scheme"] && !["light", "dark"].includes(values["color-scheme"])) throw new UsageError(`Unknown color scheme "${values["color-scheme"]}". Use light or dark.`);
  if (values["wait-ms"] && !(Number(values["wait-ms"]) >= 0)) throw new UsageError(`--wait-ms needs a number of milliseconds, got "${values["wait-ms"]}".`);
  const policy = values.policy ? Policy.parse(loadJson(values.policy)) : undefined;
  const out = values.out ? resolve(values.out) : null;
  const { report, operationalErrors } = await inspectUrl({
    target,
    selector: values.selector ?? null,
    viewport: parseViewport(values.viewport),
    browser: values.browser as (typeof BROWSERS)[number] | undefined, // validated by inspectUrl
    scenarios: scenarioList(values.scenarios, isCheck ? ALL_SCENARIOS : []),
    recipe: values.recipe ? readRecipe(values.recipe) : null,
    profile: values.profile ? importProfile(loadJson(values.profile)) : null,
    policy,
    privacy: values.privacy,
    waitFor: values["wait-for"] ?? null,
    waitMs: values["wait-ms"] ? Number(values["wait-ms"]) : 0,
    screenshots: values.screenshots && out ? resolve(out, "screenshots") : null,
    axe: values.axe,
    colorScheme: values["color-scheme"] === "dark" ? "dark" : "light",
    allowHttpErrors: values["allow-http-errors"],
  });
  // Keep artifact paths relative to the report so reports can be shared without local paths.
  if (out) report.artifacts = report.artifacts.map((a) => ({ ...a, path: relative(out, a.path) }));
  const g = gate(report.findings, policy, today());
  const md = reportToMarkdown(report, { gate: isCheck ? g : undefined });
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(resolve(out, "report.md"), md);
    writeFileSync(resolve(out, "report.html"), htmlDocument("Readability Lab report", markdownToHtml(md)));
  }
  if (values.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    const counts: Record<string, number> = {};
    for (const f of report.findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
    const cpl = report.observations.find((o) => o.metric === "layout.cpl" && o.scenarioId === "baseline");
    console.log(`Region: ${report.target.regionSelector} (${report.target.regionMethod})`);
    console.log(`Median CPL: ${cpl?.value ?? "unknown"}${cpl?.distribution ? ` (p10 ${cpl.distribution.p10}, p90 ${cpl.distribution.p90}, ${cpl.distribution.count} lines)` : ""}`);
    console.log(`Findings: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
    for (const f of report.findings.filter((x) => x.kind === "accessibility-failure" || x.kind === "needs-review")) console.log(`  [${f.kind}] ${f.title}${f.element ? ` — ${f.element.selector}` : ""}`);
    if (out) console.log(`Report: ${resolve(out, "report.md")}`);
    if (isCheck) {
      console.log(`Policy: ${g.status.toUpperCase()} (${g.failing.length} failing, ${g.warnings.length} warnings, ${g.excepted.length} excepted${g.expiredExceptions.length ? `, ${g.expiredExceptions.length} expired exception(s)` : ""})`);
    }
  }
  if (operationalErrors.length) {
    console.error(`Inspection could not run as requested:\n${operationalErrors.map((e) => `  - ${e}`).join("\n")}`);
    return 3; // operational failure, distinct from policy failure (1) and usage errors (2)
  }
  return isCheck && g.status === "fail" ? 1 : 0;
}

function compareCommand(args: string[]): number {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { out: { type: "string" }, json: { type: "boolean" } } });
  const [a, b] = positionals;
  if (!a || !b) throw new Error("Usage: rlab compare <before.json> <after.json>");
  const before = Report.parse(loadJson(a));
  const after = Report.parse(loadJson(b));
  const cmp = compareReports(before, after);
  const md = comparisonToMarkdown(cmp, before, after);
  if (values.out) writeFileSync(values.out, md);
  process.stdout.write(values.json ? JSON.stringify(cmp, null, 2) + "\n" : md);
  return 0;
}

function recipeCommand(args: string[]): number {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { scope: { type: "string" }, important: { type: "boolean" } } });
  const [sub, file] = positionals;
  if (!sub || !file) throw new Error("Usage: rlab recipe css|tokens|spec|validate <recipe.json>");
  const raw = loadJson(file);
  const parsed = Recipe.safeParse(raw);
  if (!parsed.success) {
    console.error(`Invalid recipe:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    return 1;
  }
  const recipe = parsed.data;
  if (sub === "validate") {
    const stale = staleClaimReferences(recipe);
    console.log(`Valid recipe "${recipe.name}" (format v${recipe.formatVersion}).`);
    if (!recipe.calibration && recipe.settings.measure?.unit === "cpl") console.log("Note: no calibration recorded; CPL→ch conversion uses an uncalibrated estimate until measured in a browser.");
    for (const s of stale) console.log(`Claim ${s.claimId}: recorded r${s.recordedRevision}, registry ${s.currentRevision === null ? "missing" : `r${s.currentRevision}`} (${s.status})${s.latestChange ? ` — ${s.latestChange}` : ""}`);
    return stale.length ? 1 : 0;
  }
  if (sub === "css") process.stdout.write(recipeToCss(recipe, { scope: values.scope, important: values.important }));
  else if (sub === "tokens") process.stdout.write(JSON.stringify(recipeToTokens(recipe), null, 2) + "\n");
  else if (sub === "spec") process.stdout.write(designSpec(recipe));
  else throw new Error(`Unknown recipe subcommand ${sub}`);
  return 0;
}

function claimsCommand(args: string[]): number {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { kind: { type: "string", multiple: true }, nrqi: { type: "boolean" }, json: { type: "boolean" } } });
  const res = searchClaims({ text: positionals.join(" "), kinds: values.kind as ClaimKind[] | undefined, nrqiOnly: values.nrqi });
  if (values.json) process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  else for (const c of res) console.log(`${c.id} r${c.revision} [${c.kind}, evidence: ${c.evidenceStrength}] ${c.title}${c.noReliableQuantitativeImprovement ? ` — ${NRQI}` : ""}`);
  return 0;
}

function claimCommand(args: string[]): number {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { dependents: { type: "boolean" }, recipe: { type: "string", multiple: true }, json: { type: "boolean" } } });
  const c = getClaim(positionals[0] ?? "");
  if (!c) {
    console.error(`No claim ${positionals[0]}`);
    return 1;
  }
  if (values.dependents) {
    const recipes = (values.recipe ?? []).map(readRecipe);
    const d = dependentsOfClaim(c.id, recipes);
    if (values.json) process.stdout.write(JSON.stringify(d, null, 2) + "\n");
    else console.log(`${c.id} r${c.revision} is used by:\n  rules: ${d.rules.join(", ") || "none"}\n  presets: ${d.presets.join(", ") || "none"}\n  recipes: ${d.recipes.join(", ") || "none"}\n  claims: ${d.claims.join(", ") || "none"}`);
    return 0;
  }
  if (values.json) {
    process.stdout.write(JSON.stringify({ claim: c, sources: c.sources.map((s) => getSource(s.sourceId)) }, null, 2) + "\n");
    return 0;
  }
  console.log(`${c.id} (revision ${c.revision}, ${c.kind}, evidence strength: ${c.evidenceStrength}, status: ${c.status})\n${c.title}\n\n${c.statement}\n\nIn plain words: ${c.plain}`);
  if (c.limitations.length) console.log(`\nLimitations:\n${c.limitations.map((l) => `  - ${l}`).join("\n")}`);
  if (c.conflictsWith.length) console.log(`\nConflicts with: ${c.conflictsWith.join(", ")}`);
  console.log(`\nSources:`);
  for (const s of c.sources) {
    const src = getSource(s.sourceId);
    console.log(`  - ${src ? `${src.authors.slice(0, 3).join(", ")}${src.authors.length > 3 ? " et al." : ""} (${src.year ?? "n.d."}). ${src.title}. ${src.doi ? `https://doi.org/${src.doi}` : src.url} [${src.review.status}]` : s.sourceId}${s.locator ? ` — ${s.locator}` : ""}`);
  }
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "inspect":
      return inspectCommand(rest, false);
    case "check":
      return inspectCommand(rest, true);
    case "compare":
      return compareCommand(rest);
    case "recipe":
      return recipeCommand(rest);
    case "claims":
      return claimsCommand(rest);
    case "claim":
      return claimCommand(rest);
    case "registry": {
      const r = getRegistry();
      console.log(`Evidence registry ${r.registryVersion} (checked ${r.checkedOn}): ${r.sources.length} sources, ${r.claims.length} claims, ${r.gaps.length} recorded gaps.`);
      return 0;
    }
    case "--version":
    case "-v":
      console.log(VERSION);
      return 0;
    default:
      console.log(HELP);
      return cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h" ? 2 : 0;
  }
}
