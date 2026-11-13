import { build } from "esbuild";
import { readFileSync } from "node:fs";
const inspectorSource = readFileSync(new URL("../inspector/dist/inspector.iife.js", import.meta.url), "utf8");
await build({
  entryPoints: { server: "src/server.ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: "dist",
  external: ["playwright", "playwright-core", "axe-core", "zod", "@modelcontextprotocol/sdk"],
  define: { __RL_INSPECTOR_SOURCE__: JSON.stringify(inspectorSource) },
  loader: { ".json": "json" },
  logLevel: "warning",
});
