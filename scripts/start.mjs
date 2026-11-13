// One command to run everything locally:  pnpm start   (or: pnpm start -- --rebuild --open)
// Installs dependencies on first run, builds when outputs are missing or older than the source, then serves the website, workbench and demos.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(join(root, "node_modules"))) {
  console.log("› Installing dependencies (first run)…");
  run("pnpm", ["install"]);
}
const outputs = ["apps/site/dist/index.html", "apps/workbench/dist/index.html", "packages/controls/dist/reading-controls.iife.js", "packages/cli/dist/cli.js", "apps/extension/dist/chromium/manifest.json"];
/** Newest modification time under the source folders, so edits are picked up without --rebuild. */
function newestSource() {
  let newest = 0;
  const visit = (path) => {
    const st = statSync(path, { throwIfNoEntry: false });
    if (!st) return;
    if (!st.isDirectory()) return void (newest = Math.max(newest, st.mtimeMs));
    for (const e of readdirSync(path)) if (!["node_modules", "dist"].includes(e) && !e.startsWith(".")) visit(join(path, e));
  };
  for (const group of ["packages", "apps"]) for (const pkg of readdirSync(join(root, group))) for (const part of ["src", "static", "assets", "index.html", "build.mjs", "package.json"]) visit(join(root, group, pkg, part));
  visit(join(root, "evidence"));
  return newest;
}
const missing = outputs.some((p) => !existsSync(join(root, p)));
const stale = !missing && newestSource() > Math.min(...outputs.map((p) => statSync(join(root, p)).mtimeMs));
if (args.has("--rebuild") || missing || stale) {
  console.log(stale ? "› Source changed since the last build; rebuilding…" : "› Building packages and apps…");
  run("pnpm", ["build"]);
}

/** Listen on the preferred port, or the next free one. */
async function listen(dir, preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    try {
      await serve({ root: join(root, dir), port, dev: true, quiet: true });
      return port;
    } catch (e) {
      if (e.code !== "EADDRINUSE") throw e;
    }
  }
  throw new Error(`No free port near ${preferred}`);
}

const site = await listen("apps/site/dist", 4330);
const workbench = await listen("apps/workbench/dist", 4319);
const repo = await listen(".", 4320);
const u = (port, path = "/") => `http://localhost:${port}${path}`;

const rows = [
  ["Website", u(site)],
  ["Workbench", `${u(workbench, "/#/compare")}   evidence atlas: ${u(workbench, "/#/atlas")}`],
  ["Reading controls demo", u(repo, "/packages/controls/demo/")],
  ["Example docs site", u(repo, "/examples/docs-site/")],
  ["Fixtures", u(repo, "/fixtures/")],
  ["Browser extension", "chrome://extensions → Developer mode → Load unpacked → apps/extension/dist/chromium"],
  ["CLI", `node packages/cli/bin/rlab.mjs check ${u(repo, "/examples/docs-site/")} --selector ".doc-content"`],
];
const width = Math.max(...rows.map(([k]) => k.length));
console.log(`\nReadability Lab is running:\n\n${rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join("\n")}\n`);
try {
  const { chromium } = createRequire(join(root, "package.json"))("@playwright/test");
  if (!existsSync(chromium.executablePath())) throw new Error("missing");
} catch {
  console.log("  (The CLI needs a browser once: npx playwright install chromium)\n");
}
console.log("Press Ctrl+C to stop.");
// Stop cleanly however the launcher is ended (Ctrl+C, kill, closed terminal).
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => process.exit(0));

if (args.has("--open")) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawnSync(opener, [u(site)], { shell: process.platform === "win32", stdio: "ignore" });
}
