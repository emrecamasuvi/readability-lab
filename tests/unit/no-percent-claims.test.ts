// Acceptance 8: no interface or registry text invents percentage improvements.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRegistry } from "../../packages/core/src/index.js";

const ROOT = resolve(__dirname, "../..");
const UI_DIRS = ["packages/core/src", "packages/inspector/src", "packages/cli/src", "packages/controls/src", "packages/mcp/src", "apps/workbench/src", "apps/extension/src", "apps/site", "skills"];
// A percentage next to an improvement word, e.g. "20% faster", "improves comprehension by 10%".
const CLAIM = /(\d+(?:\.\d+)?\s?%[^.\n]{0,40}\b(faster|better|improv\w*|increase\w*|gain\w*|boost\w*|less (?:eye )?strain|more comprehension)\b)|\b(faster|improv\w*|boost\w*|gain\w*)\b[^.\n]{0,30}\bby\s+\d+(?:\.\d+)?\s?%/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|html|md|json)$/.test(e)) out.push(p);
  }
  return out;
}

describe("no invented percentage improvements", () => {
  it("plain-language claim text never promises a percentage", () => {
    for (const c of getRegistry().claims) expect(c.plain, c.id).not.toMatch(/%/);
  });
  it("UI and tool source text contains no percentage improvement promises", () => {
    const offenders: string[] = [];
    for (const d of UI_DIRS) for (const f of walk(join(ROOT, d))) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((l, i) => {
        if (CLAIM.test(l) && !/no-percent-claims-allow/.test(l)) offenders.push(`${f.replace(ROOT + "/", "")}:${i + 1}: ${l.trim().slice(0, 120)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
