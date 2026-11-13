import { build } from "esbuild";
await build({
  entryPoints: ["src/iife.ts"],
  bundle: true,
  format: "iife",
  target: ["chrome110", "firefox115", "safari16"],
  outfile: "dist/inspector.iife.js",
  legalComments: "none",
  minify: true,
  logLevel: "warning",
});
