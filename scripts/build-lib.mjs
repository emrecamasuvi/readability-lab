// Bundle a workspace library to dist/ as ESM. Usage: node build-lib.mjs src/index.ts [src/x.ts:name ...]
import { build } from "esbuild";
const entries = process.argv.slice(2).map((a) => {
  const [file, name] = a.split(":");
  return { in: file, out: name ?? file.replace(/^src\//, "").replace(/\.ts$/, "") };
});
await build({
  entryPoints: entries,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outdir: "dist",
  packages: "external",
  loader: { ".json": "json" },
  logLevel: "warning",
});
