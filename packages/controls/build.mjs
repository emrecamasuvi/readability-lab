import { build } from "esbuild";
const common = { bundle: true, target: ["chrome110", "firefox115", "safari16"], loader: { ".json": "json" }, logLevel: "warning", legalComments: "none" };
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/index.js" });
await build({ ...common, entryPoints: ["src/element-auto.ts"], format: "esm", outfile: "dist/reading-controls.js", minify: true });
await build({ ...common, entryPoints: ["src/element-auto.ts"], format: "iife", globalName: "ReadabilityLabControls", outfile: "dist/reading-controls.iife.js", minify: true });
