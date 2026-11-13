// Writes JSON Schemas for the open formats to schemas/ (generated from the Zod source of truth).
import { mkdirSync, writeFileSync } from "node:fs";
import * as z from "zod";
import * as core from "../packages/core/dist/index.js";

const out = new URL("../schemas/", import.meta.url);
mkdirSync(out, { recursive: true });
const items = {
  "profile-1.schema.json": core.Profile,
  "recipe-1.schema.json": core.Recipe,
  "report-1.schema.json": core.Report,
  "policy-1.schema.json": core.Policy,
  "evidence-registry.schema.json": core.EvidenceRegistry,
  "preference-session-1.schema.json": core.PreferenceSession,
  "performance-experiment-1.schema.json": core.PerformanceExperiment,
  "typography-settings.schema.json": core.TypographySettings,
};
for (const [file, schema] of Object.entries(items)) {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  json.$id = `urn:readability-lab:schema:${file.replace(".schema.json", "")}`;
  writeFileSync(new URL(file, out), JSON.stringify(json, null, 2) + "\n");
}
console.log(`wrote ${Object.keys(items).length} schemas to schemas/`);
