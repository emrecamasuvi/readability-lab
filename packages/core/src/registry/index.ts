import raw from "../../../../evidence/registry.json";
import { PRESETS } from "../presentation.js";
import { RULES } from "../rules.js";
import { EvidenceRegistry, type Claim, type ClaimKind, type OutcomeDomain, type Source } from "../schemas/evidence.js";
import type { Recipe } from "../schemas/presentation.js";

let cached: EvidenceRegistry | null = null;

/** The validated registry bundled with this build. */
export function getRegistry(): EvidenceRegistry {
  if (!cached) cached = EvidenceRegistry.parse(raw);
  return cached;
}

export function getClaim(id: string): Claim | undefined {
  return getRegistry().claims.find((c) => c.id === id);
}
export function getSource(id: string): Source | undefined {
  return getRegistry().sources.find((s) => s.id === id);
}

export interface ClaimQuery {
  text?: string;
  kinds?: ClaimKind[];
  outcomes?: OutcomeDomain[];
  topics?: string[];
  nrqiOnly?: boolean;
}

function haystack(c: Claim): string {
  const study = c.study ? Object.values(c.study).flat().map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ") : "";
  return [c.id, c.title, c.statement, c.plain, c.topics.join(" "), c.limitations.join(" "), study].join(" ").toLowerCase();
}

/** Plain substring search over all words (AND), plus structured filters. Deterministic. */
export function searchClaims(q: ClaimQuery = {}): Claim[] {
  const words = (q.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return getRegistry().claims.filter((c) => {
    if (q.kinds?.length && !q.kinds.includes(c.kind)) return false;
    if (q.outcomes?.length && !c.outcomes.some((o) => q.outcomes!.includes(o))) return false;
    if (q.topics?.length && !c.topics.some((t) => q.topics!.includes(t))) return false;
    if (q.nrqiOnly && !c.noReliableQuantitativeImprovement) return false;
    if (!words.length) return true;
    const h = haystack(c);
    return words.every((w) => h.includes(w));
  });
}

export function sourcesForClaims(ids: string[]): Source[] {
  const set = new Set<string>();
  for (const id of ids) for (const s of getClaim(id)?.sources ?? []) set.add(s.sourceId);
  return [...set].map((id) => getSource(id)).filter((s): s is Source => !!s);
}

export function claimRevisions(ids: Iterable<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const c = getClaim(id);
    if (c) out[id] = c.revision;
  }
  return out;
}

export interface Dependents {
  claimId: string;
  rules: string[];
  presets: string[];
  recipes: string[];
  claims: string[];
}

/** Everything that depends on a claim: rules, presets, given recipes, and claims that cite it. */
export function dependentsOfClaim(claimId: string, recipes: Recipe[] = []): Dependents {
  return {
    claimId,
    rules: RULES.filter((r) => r.claimIds.includes(claimId)).map((r) => r.id),
    presets: PRESETS.filter((p) => p.claimIds.includes(claimId)).map((p) => p.id),
    recipes: recipes
      .filter((r) => claimId in r.claimRevisions || r.rationale.some((x) => x.claimIds.includes(claimId)))
      .map((r) => r.id),
    claims: getRegistry()
      .claims.filter((c) => c.relatedClaims.includes(claimId) || c.conflictsWith.includes(claimId))
      .map((c) => c.id),
  };
}

export interface StaleReference {
  claimId: string;
  recordedRevision: number;
  currentRevision: number | null;
  status: "revised" | "missing" | "withdrawn";
  latestChange: string | null;
}

/** Compare the claim revisions a recipe recorded with the current registry. */
export function staleClaimReferences(recipe: Recipe): StaleReference[] {
  const out: StaleReference[] = [];
  for (const [id, rev] of Object.entries(recipe.claimRevisions)) {
    const c = getClaim(id);
    if (!c) out.push({ claimId: id, recordedRevision: rev, currentRevision: null, status: "missing", latestChange: null });
    else if (c.status === "withdrawn" || c.status === "superseded")
      out.push({ claimId: id, recordedRevision: rev, currentRevision: c.revision, status: "withdrawn", latestChange: c.history.at(-1)?.change ?? null });
    else if (c.revision > rev)
      out.push({ claimId: id, recordedRevision: rev, currentRevision: c.revision, status: "revised", latestChange: c.history.at(-1)?.change ?? null });
  }
  return out;
}

/** Atlas entry points shared by the workbench atlas, docs and the MCP server. */
export const QUESTIONS: { id: string; question: string; claimIds: string[]; query?: ClaimQuery }[] = [
  { id: "cpl-65", question: "What do we know about 65 characters per line?", claimIds: ["C-BASE-001", "C-CPL-001", "C-CPL-002", "C-CPL-003", "C-CPL-004", "C-CPL-005", "C-CPL-006", "C-CPL-007"] },
  { id: "lh-16-vs-15", question: "Is 1.6 line height better than 1.5?", claimIds: ["C-LH-003", "C-LH-001", "C-LH-002", "C-LH-004", "C-BASE-003"] },
  { id: "dark-mode", question: "Why might dark-mode preference differ from performance?", claimIds: ["C-THEME-001", "C-THEME-002", "C-THEME-003", "C-THEME-005", "C-THEME-006", "C-OUT-002"] },
  { id: "outcomes", question: "Which findings concern comprehension, speed, recognition, or comfort?", claimIds: [], query: { outcomes: ["comprehension", "reading-speed", "recognition-accuracy", "comfort"] } },
  { id: "kinds", question: "Which recommendations are requirements, heuristics, or experiments?", claimIds: [], query: {} },
  { id: "fonts", question: "Is there a best font for reading?", claimIds: ["C-FONT-001", "C-FONT-002", "C-FONT-003", "C-FONT-004", "C-DYS-001"] },
  { id: "contrast", question: "Is AA contrast enough, and does more contrast help?", claimIds: ["C-CONTRAST-001", "C-CONTRAST-002", "C-CONTRAST-003", "C-CONTRAST-004", "C-APCA-001"] },
];
