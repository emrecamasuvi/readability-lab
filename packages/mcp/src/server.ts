import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {
  compareReports,
  comparisonToMarkdown,
  dependentsOfClaim,
  designSpec,
  gate,
  getClaim,
  getRegistry,
  getSource,
  htmlDocument,
  importProfile,
  markdownToHtml,
  NRQI,
  Policy,
  QUESTIONS,
  Recipe,
  recipeToCss,
  recipeToTokens,
  Report,
  reportToMarkdown,
  RULES,
  searchClaims,
  staleClaimReferences,
  VERSION,
  type ClaimKind,
  type OutcomeDomain,
} from "@emrecamasuvi/readability-lab-core";
import { ALL_SCENARIOS, inspectUrl, parseViewport, type ScenarioKind } from "@emrecamasuvi/readability-lab-cli";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function loadMaybe<T>(value: unknown, parse: (v: unknown) => T): T | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return parse(JSON.parse(readFileSync(resolve(value), "utf8")));
  return parse(value);
}

const KINDS = ["accessibility-failure", "needs-review", "heuristic-deviation", "unsupported-check", "preference", "experiment-idea", "pass"] as const;

export function createServer(): McpServer {
  const server = new McpServer({ name: "readability-lab", version: VERSION });

  const inspectShape = {
    target: z.string().describe("URL (http/https/file) or local HTML path. Local dev servers are fine."),
    selector: z.string().optional().describe("CSS selector of the reading region. Strongly recommended; otherwise auto-detected."),
    viewport: z.string().optional().describe("desktop|laptop|tablet|phone|WIDTHxHEIGHT[@DPR]. Default desktop 1280x800."),
    scenarios: z.array(z.enum(["text-spacing", "reflow-320", "zoom-200"])).optional().describe("Extra scenarios. Default: all three."),
    recipe: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().describe("Recipe object or path to apply before measuring (for proposals)."),
    profile: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().describe("Reader profile object or path to apply."),
    policy: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().describe("Project policy object or path."),
    outDir: z.string().optional().describe("Write report.json/.md/.html and screenshots here (recommended for before/after)."),
    browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
    waitFor: z.string().optional().describe("Selector to wait for (dynamic content)."),
  };

  async function runInspect(args: { target: string; selector?: string; viewport?: string; scenarios?: ScenarioKind[]; recipe?: unknown; profile?: unknown; policy?: unknown; outDir?: string; browser?: "chromium" | "firefox" | "webkit"; waitFor?: string }) {
    const policy = loadMaybe(args.policy, (v) => Policy.parse(v)) ?? undefined;
    const out = args.outDir ? resolve(args.outDir) : null;
    const { report, operationalErrors } = await inspectUrl({
      target: args.target,
      selector: args.selector ?? null,
      viewport: parseViewport(args.viewport),
      browser: args.browser ?? "chromium",
      scenarios: args.scenarios ?? ALL_SCENARIOS,
      recipe: loadMaybe(args.recipe, (v) => Recipe.parse(v)),
      profile: loadMaybe(args.profile, (v) => importProfile(v)),
      policy,
      privacy: true,
      waitFor: args.waitFor ?? null,
      screenshots: out ? resolve(out, "screenshots") : null,
    });
    if (out) report.artifacts = report.artifacts.map((a) => ({ ...a, path: relative(out, a.path) }));
    const g = gate(report.findings, policy, new Date().toISOString().slice(0, 10));
    const md = reportToMarkdown(report, { gate: g });
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
      writeFileSync(resolve(out, "report.md"), md);
      writeFileSync(resolve(out, "report.html"), htmlDocument("Readability Lab report", markdownToHtml(md)));
    }
    return { report, gate: g, md, operationalErrors, out };
  }

  server.registerTool(
    "rl_inspect",
    {
      title: "Inspect a reading region in a real browser",
      description:
        "Measures rendered line lengths, typography, contrast, clipping and reflow for the reading region of a page, runs WCAG 1.4.12/1.4.10 checks (real browser) and a 200% zoom approximation, and returns findings separated into accessibility failures, needs-review, heuristic deviations, unsupported checks, preferences and experiment ideas, each with evidence claim IDs. Nothing is sent to remote services.",
      inputSchema: inspectShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const r = await runInspect(args as never);
      const head = r.operationalErrors.length ? `OPERATIONAL ERROR — the page could not be inspected as requested:\n${r.operationalErrors.map((e) => `- ${e}`).join("\n")}\n\n` : "";
      return text(`${head}${r.out ? `Artifacts written to ${r.out}\n\n` : ""}${r.md}`);
    },
  );

  server.registerTool(
    "rl_check",
    {
      title: "Check a page against project policy",
      description: "Like rl_inspect, but returns the policy gate verdict (pass/warn/fail). By default only performed accessibility failures fail; heuristic deviations never do.",
      inputSchema: inspectShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const r = await runInspect(args as never);
      return text(JSON.stringify({ status: r.operationalErrors.length ? "error" : r.gate.status, operationalErrors: r.operationalErrors, failing: r.gate.failing.map((f) => ({ title: f.title, ruleId: f.ruleId, wcag: f.wcag, element: f.element?.selector, claimIds: f.claimIds })), warnings: r.gate.warnings.length, excepted: r.gate.excepted.length, expiredExceptions: r.gate.expiredExceptions, artifacts: r.out }, null, 2));
    },
  );

  server.registerTool(
    "rl_compare",
    {
      title: "Compare two reports",
      description: "Compares before/after report.json files. Flags differing conditions (viewport, browser, content fingerprint, scenarios, policy) and separates resolved, introduced and untested findings. Layout measurements only — never reading-performance results.",
      inputSchema: { before: z.string().describe("Path to before report.json"), after: z.string().describe("Path to after report.json"), out: z.string().optional().describe("Write comparison markdown here") },
      annotations: { readOnlyHint: true },
    },
    async ({ before, after, out }) => {
      const b = Report.parse(JSON.parse(readFileSync(resolve(before), "utf8")));
      const a = Report.parse(JSON.parse(readFileSync(resolve(after), "utf8")));
      const cmp = compareReports(b, a);
      const md = comparisonToMarkdown(cmp, b, a);
      if (out) writeFileSync(resolve(out), md);
      return text(md);
    },
  );

  server.registerTool(
    "rl_claims",
    {
      title: "Search the evidence registry",
      description: `Search claims by words, kind (normative/empirical/heuristic/hypothesis) and outcome. Use claim IDs in proposals and reports. Entry questions: ${QUESTIONS.map((q) => `${q.id}: ${q.question}`).join(" | ")}`,
      inputSchema: {
        query: z.string().optional(),
        kinds: z.array(z.enum(["normative", "empirical", "heuristic", "hypothesis"])).optional(),
        outcomes: z.array(z.string()).optional(),
        questionId: z.string().optional(),
        nrqiOnly: z.boolean().optional().describe(`Only claims marked "${NRQI}"`),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, kinds, outcomes, questionId, nrqiOnly }) => {
      const q = QUESTIONS.find((x) => x.id === questionId);
      let list = searchClaims({ text: query, kinds: kinds as ClaimKind[] | undefined, outcomes: outcomes as OutcomeDomain[] | undefined, nrqiOnly });
      if (q?.claimIds.length) list = list.filter((c) => q.claimIds.includes(c.id));
      return text(list.map((c) => `${c.id} r${c.revision} [${c.kind}; evidence ${c.evidenceStrength}; ${c.status}] ${c.title}${c.noReliableQuantitativeImprovement ? ` — ${NRQI}` : ""}\n  ${c.plain}`).join("\n") || "No matching claims.");
    },
  );

  server.registerTool(
    "rl_claim",
    {
      title: "Get one claim with sources and dependents",
      description: "Full claim: statement, study extraction (missing statistics stay missing), limitations, conflicts, sources with verification status, and the rules/presets that depend on it.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const c = getClaim(id);
      if (!c) return text(`No claim ${id}.`);
      return text(JSON.stringify({ claim: c, sources: c.sources.map((s) => ({ ...s, source: getSource(s.sourceId) })), dependents: dependentsOfClaim(id) }, null, 2));
    },
  );

  server.registerTool(
    "rl_recipe",
    {
      title: "Export or validate a recipe",
      description: "Turn a recipe into scoped CSS, DTCG design tokens or a design spec, or validate it (including stale claim revisions). Prefer mapping values onto the project's existing tokens over pasting the CSS globally.",
      inputSchema: {
        recipe: z.union([z.string(), z.record(z.string(), z.unknown())]),
        format: z.enum(["css", "tokens", "spec", "validate"]),
        scope: z.string().optional(),
        important: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ recipe, format, scope, important }) => {
      const r = loadMaybe(recipe, (v) => Recipe.parse(v))!;
      if (format === "css") return text(recipeToCss(r, { scope, important }));
      if (format === "tokens") return text(JSON.stringify(recipeToTokens(r), null, 2));
      if (format === "spec") return text(designSpec(r));
      const stale = staleClaimReferences(r);
      return text(stale.length ? `Valid, but ${stale.length} claim reference(s) changed:\n${stale.map((s) => `- ${s.claimId}: r${s.recordedRevision} → ${s.currentRevision ?? "missing"} (${s.status})`).join("\n")}` : "Valid recipe; claim references are current.");
    },
  );

  server.registerTool(
    "rl_rules",
    {
      title: "List inspection rules",
      description: "Rules the inspector applies, their possible finding kinds, WCAG criteria and claim IDs.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => text(JSON.stringify({ registry: getRegistry().registryVersion, findingKinds: KINDS, rules: RULES }, null, 2)),
  );

  return server;
}

export async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
