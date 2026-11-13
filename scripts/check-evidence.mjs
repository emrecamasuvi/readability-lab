// Evidence registry integrity: schema, references, wording rules, and claims used by tools.
import { readFileSync } from "node:fs";
import * as core from "../packages/core/dist/index.js";

const NRQI = "No reliable quantitative improvement established.";
const errors = [];
const raw = JSON.parse(readFileSync(new URL("../evidence/registry.json", import.meta.url), "utf8"));
const parsed = core.EvidenceRegistry.safeParse(raw);
if (!parsed.success) {
  console.error(parsed.error.issues.slice(0, 20));
  process.exit(1);
}
const reg = parsed.data;
const claimIds = new Set(reg.claims.map((c) => c.id));
const sourceIds = new Set(reg.sources.map((s) => s.id));
if (claimIds.size !== reg.claims.length) errors.push("Duplicate claim ids");
if (sourceIds.size !== reg.sources.length) errors.push("Duplicate source ids");
for (const c of reg.claims) {
  for (const s of c.sources) if (!sourceIds.has(s.sourceId)) errors.push(`${c.id}: unknown source ${s.sourceId}`);
  for (const id of [...c.conflictsWith, ...c.relatedClaims]) if (!claimIds.has(id)) errors.push(`${c.id}: unknown linked claim ${id}`);
  for (const id of c.conflictsWith) if (!reg.claims.find((x) => x.id === id)?.conflictsWith.includes(c.id)) errors.push(`${c.id}: conflict with ${id} is not recorded on both sides`);
  if (c.noReliableQuantitativeImprovement && !c.statement.includes(NRQI)) errors.push(`${c.id}: flagged NRQI but statement lacks the exact sentence`);
  if (/%/.test(c.plain)) errors.push(`${c.id}: plain text contains a percentage`);
  if (c.history.at(-1)?.revision !== c.revision) errors.push(`${c.id}: latest history entry does not match revision ${c.revision}`);
  for (const e of c.study?.estimates ?? []) if (e.value === null && !e.missingReason) errors.push(`${c.id}: missing estimate without a reason (${e.measure})`);
  if (c.status === "reviewed" && c.sources.every((s) => raw.sources.find((x) => x.id === s.sourceId)?.review.status === "unverified-secondary"))
    errors.push(`${c.id}: marked reviewed but all its sources are unverified`);
}
for (const s of reg.sources) {
  if (/utm_|chatgpt\.com/.test(s.url)) errors.push(`${s.id}: tracking or private link in URL`);
  if (s.review.status !== "unverified-secondary" && !s.review.checkedOn) errors.push(`${s.id}: verified without checkedOn date`);
}
const used = new Set([...core.RULES.flatMap((r) => r.claimIds), ...core.PRESETS.flatMap((p) => p.claimIds), ...core.QUESTIONS.flatMap((q) => q.claimIds)]);
for (const id of used) if (!claimIds.has(id)) errors.push(`Tool references missing claim ${id}`);
// Claim IDs mentioned in UI and skill text must exist too.
const texts = ["apps/extension/static/popup.html", "packages/controls/src/element.ts", "apps/workbench/src/exports.ts", "skills/readability-lab/SKILL.md", "examples/agent-run/REPORT.md"];
for (const f of texts) {
  const t = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  for (const m of t.matchAll(/C-[A-Z]+-\d{3}/g)) if (!claimIds.has(m[0])) errors.push(`${f}: unknown claim ${m[0]}`);
}
const verified = reg.sources.filter((s) => s.review.status !== "unverified-secondary").length;
console.log(`Registry ${reg.registryVersion}: ${reg.sources.length} sources (${verified} verified against originals), ${reg.claims.length} claims, ${reg.gaps.length} gaps; ${used.size} claim ids used by tools.`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("✓ evidence integrity checks passed");
