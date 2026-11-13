// Builds dist/chromium and dist/firefox. `--test` adds host permissions so automated tests
// can script pages without a user gesture (never use the test build for distribution).
import { build } from "esbuild";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeLicenses } from "../../scripts/licenses.mjs";
const test = process.argv.includes("--test");
const zip = process.argv.includes("--zip");
const base = JSON.parse(readFileSync("manifest.base.json", "utf8"));
const targets = {
  chromium: { ...base, background: { service_worker: "background.js" }, minimum_chrome_version: "116" },
  firefox: {
    ...base,
    background: { scripts: ["background.js"] },
    browser_specific_settings: { gecko_android: { strict_min_version: "142.0" }, gecko: { id: "readability-lab@readability-lab.dev", strict_min_version: "142.0", data_collection_permissions: { required: ["none"] } } },
  },
};
for (const [name, manifest] of Object.entries(targets)) {
  const out = `dist/${name}${test ? "-test" : ""}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (test) manifest.host_permissions = ["http://*/*", "https://*/*"];
  await build({
    entryPoints: { background: "src/background.ts", content: "src/content.ts", popup: "src/popup.ts", options: "src/options.ts" },
    bundle: true,
    format: "iife",
    target: ["chrome116", "firefox142"],
    outdir: out,
    loader: { ".json": "json" },
    minify: !test,
    sourcemap: test ? "inline" : false,
    legalComments: "linked",
    logLevel: "warning",
    define: { __RL_TARGET__: JSON.stringify(name) },
  });
  cpSync("static", out, { recursive: true });
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
  writeLicenses(out, ["@mozilla/readability", "dompurify", "zod"]);
  copyFileSync("../../LICENSE", `${out}/LICENSE`);
  if (zip && !test) {
    // zip updates an existing archive in place, which would keep files that no longer exist: start fresh.
    const archive = `readability-lab-${name}-${base.version}.zip`;
    rmSync(`${out}/../${archive}`, { force: true });
    execFileSync("zip", ["-qr", `../${archive}`, "."], { cwd: out });
  }
}
console.log(`built ${Object.keys(targets).join(", ")}${test ? " (test)" : ""}`);
