# Agent adapters

The portable instructions live in [`../readability-lab/SKILL.md`](../readability-lab/SKILL.md). They work with any agent that can run shell commands (CLI) or call MCP tools.

| Environment | How to install | Status in v0.1 |
|---|---|---|
| Any MCP client (stdio) | Run `node packages/mcp/bin/readability-lab-mcp.mjs` as a stdio server. Tools: `rl_inspect`, `rl_check`, `rl_compare`, `rl_claims`, `rl_claim`, `rl_recipe`, `rl_rules`. | **Tested** with the official MCP TypeScript SDK client (`tests/e2e/mcp.spec.ts`). |
| Claude Code (skill) | Copy `skills/readability-lab/` to `.claude/skills/readability-lab/` in your project (or `~/.claude/skills/`). | Skill format follows Claude Code's `SKILL.md` convention. Used to produce `examples/agent-run/`. |
| Claude Code (MCP) | `claude mcp add readability-lab -- node /abs/path/to/readability-lab/packages/mcp/bin/readability-lab-mcp.mjs` | Configuration documented; not exercised in automated tests. |
| Other agents reading `AGENTS.md` | Add the snippet below to your repository's `AGENTS.md`. | Instructions only; uses the CLI. Not tested per agent. |

## AGENTS.md snippet

```md
## Reading presentation changes
When asked to improve readability/typography of a page, follow skills/readability-lab/SKILL.md
(from https://github.com/<org>/readability-lab). Measure before and after with
`rlab inspect <url> --selector "<prose selector>" --scenarios all --out reports/<name>`
and `rlab compare`, keep accessibility failures separate from heuristic adjustments, and cite claim IDs.
```

Do not describe an adapter as supported until it has a verification entry in `docs/SUPPORT.md`.
