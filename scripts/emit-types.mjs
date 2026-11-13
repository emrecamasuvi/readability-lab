// Emits .d.ts files into dist/ for a workspace package, mirroring src/. Run from the package:
//   node ../../scripts/emit-types.mjs
// Workspace imports resolve to sibling packages' sources, so tsc is rooted at the repo and
// only this package's own declarations are kept.
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = process.cwd();
const tmp = join(pkg, "dist", ".types");
rmSync(tmp, { recursive: true, force: true });
execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.json", "--noEmit", "false", "--emitDeclarationOnly", "--declaration", "--rootDir", root, "--outDir", tmp], { cwd: pkg, stdio: "inherit" });
cpSync(join(tmp, relative(root, pkg), "src"), join(pkg, "dist"), { recursive: true });
rmSync(tmp, { recursive: true, force: true });
