// Bundles core + inspector into the CLI so the published package has no workspace deps.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
const inspectorSource = readFileSync(new URL("../inspector/dist/inspector.iife.js", import.meta.url), "utf8");
const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["playwright", "playwright-core", "axe-core", "zod"],
  define: { __RL_INSPECTOR_SOURCE__: JSON.stringify(inspectorSource) },
  loader: { ".json": "json" },
  logLevel: "warning",
};
await build({ ...common, entryPoints: { index: "src/index.ts", cli: "src/cli.ts" }, outdir: "dist" });
