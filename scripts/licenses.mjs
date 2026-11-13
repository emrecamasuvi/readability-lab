// Ships licence material with a build output. Run from a workspace package:
//   node ../../scripts/licenses.mjs <outDir> [bundled-dependency ...]
// Copies NOTICE and LICENSE-CONTENT.md, and writes THIRD-PARTY-LICENSES.txt with the full
// licence text of each dependency that is bundled into that output.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Code embedded inside a dependency's own bundle, with no package of its own to read a licence from.
const EMBEDDED = {
  dompurify: `regenerator-runtime (embedded in DOMPurify's build)\nCopyright (c) 2014-present, Facebook, Inc.\nLicensed under the MIT License: https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE`,
};

/** A dependency's folder, looked up from this package and then from every other workspace package. */
function locate(dep, from) {
  const bases = [from, ...["packages", "apps"].flatMap((g) => readdirSync(join(root, g)).map((n) => join(root, g, n)))];
  for (const base of bases) {
    const dir = join(base, "node_modules", dep);
    if (existsSync(join(dir, "package.json"))) return realpathSync(dir);
  }
  throw new Error(`licenses: cannot find "${dep}" in any workspace package`);
}

export function writeLicenses(outDir, deps = [], from = process.cwd()) {
  const out = resolve(from, outDir);
  mkdirSync(out, { recursive: true });
  for (const f of ["NOTICE", "LICENSE-CONTENT.md"]) copyFileSync(join(root, f), join(out, f));
  if (!deps.length) return;
  const parts = deps.sort().map((dep) => {
    const dir = locate(dep, from);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const files = readdirSync(dir).filter((f) => /^(licen[cs]e|notice|copying)/i.test(f)).sort();
    if (!files.length) throw new Error(`licenses: "${dep}" ships no licence file`);
    const text = files.map((f) => readFileSync(join(dir, f), "utf8").trim()).join("\n\n");
    return `${"=".repeat(78)}\n${pkg.name} ${pkg.version} — ${pkg.license}\n${"=".repeat(78)}\n\n${text}${EMBEDDED[dep] ? `\n\n${"-".repeat(78)}\n${EMBEDDED[dep]}` : ""}`;
  });
  writeFileSync(join(out, "THIRD-PARTY-LICENSES.txt"), `Third-party software bundled in this build of Readability Lab.\nReadability Lab itself is licensed under the Apache License 2.0 (see LICENSE and NOTICE).\n\n${parts.join("\n\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [outDir, ...deps] = process.argv.slice(2);
  if (!outDir) throw new Error("Usage: node scripts/licenses.mjs <outDir> [bundled-dependency ...]");
  writeLicenses(outDir, deps);
}
