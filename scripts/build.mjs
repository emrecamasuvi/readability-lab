// `pnpm build` entry point. pnpm appends any extra words to the script, and `pnpm -r run build`
// would forward them to every package's build (esbuild/vite would treat them as entry points).
// So extra arguments are ignored here, with a hint, instead of breaking the build.
import { spawnSync } from "node:child_process";

const extra = process.argv.slice(2);
if (extra.length) {
  console.warn(
    `\n⚠ "pnpm build" takes no arguments; ignoring: ${extra.join(" ")}\n` +
      `  If you pasted several commands on one line, run them one at a time (see README "Quickstart").\n`,
  );
}
const r = spawnSync("pnpm", ["-r", "run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
