// MCP server over stdio: tools are listed and operate the shared engine.
import { expect, test } from "@playwright/test";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "../../packages/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../../packages/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const bin = resolve(here, "../../packages/mcp/bin/readability-lab-mcp.mjs");

test("MCP tools list, search evidence and inspect a page", async () => {
  const client = new Client({ name: "rl-test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: [bin] }));
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(["rl_check", "rl_claim", "rl_claims", "rl_compare", "rl_inspect", "rl_recipe", "rl_rules"]);
    const claims = await client.callTool({ name: "rl_claims", arguments: { questionId: "lh-16-vs-15" } });
    expect(JSON.stringify(claims.content)).toContain("C-LH-003");
    const out = mkdtempSync(join(tmpdir(), "rl-mcp-"));
    const res = await client.callTool({ name: "rl_inspect", arguments: { target: resolve(here, "../../fixtures/broken-contrast.html"), selector: "#story", scenarios: ["text-spacing"], outDir: out } });
    const t = (res.content as { text: string }[])[0]!.text;
    expect(t).toContain("Accessibility failure (check performed)");
    expect(t).toContain("C-CONTRAST-001");
    expect(existsSync(join(out, "report.json"))).toBe(true);
    const chk = await client.callTool({ name: "rl_check", arguments: { target: resolve(here, "../../fixtures/wide-measure.html"), scenarios: [] } });
    expect(JSON.parse((chk.content as { text: string }[])[0]!.text).status).toBe("pass"); // heuristics never fail by default
  } finally {
    await client.close();
  }
});
