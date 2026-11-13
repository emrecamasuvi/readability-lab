# Readability Lab

**Website:** https://camasuvi.net/readability/

**Make reading on the web adjustable, inspectable, and reproducible.**

Readability Lab is an open-source toolkit, grounded in digital-reading research, for:

- **readers:** adjust articles in the browser and keep a portable profile;
- **designers:** compare reading layouts on real text;
- **developers:** measure and verify real pages;
- **coding agents:** make reading changes and report measured before/after results with evidence IDs.

Choose real content → inspect its presentation → compare alternatives → save a reading recipe → apply or export it → verify what changed.

> No universal optimal typography configuration has been established. Readability Lab does not compute a readability score and does not promise speed, comprehension or comfort gains. It measures what renders, separates accessibility failures from heuristics and preferences, and links every recommendation to a versioned evidence registry.

## What's in the box (v0.1.0)

| Part | What it does | Where |
|---|---|---|
| **Evidence registry** | 40 sources and 69 claims. Each claim is typed as normative, empirical, heuristic or hypothesis, and records its study details, limitations, conflicts, verification status and revision history. | [`evidence/`](evidence/) |
| **Core** | Open formats for profiles, recipes, reports and policies. Also contrast math, presets, how a publisher recipe and a reader profile combine, the rule engine, report comparison and the experiment model. No DOM, no LLM, no network. | [`packages/core`](packages/core) |
| **Inspector** | In-page measurement: rendered line lengths, computed typography, x-height, contrast (with unresolved cases reported honestly), clipping, reflow culprits, and unsupported content. | [`packages/inspector`](packages/inspector) |
| **CLI and Playwright library** | `rlab inspect / check / compare / recipe / claims`. Runs real-browser WCAG 1.4.12 text-spacing and 1.4.10 reflow checks, plus a 200% zoom approximation. Uses CI exit codes, an optional axe-core cross-check, and writes JSON, Markdown and HTML reports with screenshots. | [`packages/cli`](packages/cli) |
| **Reading controls** | `<rl-reading-controls>` web component and a headless API for publishers, using the same profile format. | [`packages/controls`](packages/controls) |
| **Workbench** | Compare same-text layouts across desktop, tablet, phone and enlarged conditions, with measured line-length distributions. Supports apparent-size matching, blind fonts, exports (recipe, CSS, DTCG tokens, spec), share links, an evidence atlas and preference exploration. | [`apps/workbench`](apps/workbench) |
| **Browser extension** | MV3 for Chromium and Firefox. Adjusts the page or opens a reader view (Mozilla Readability), with presets, region picker, per-site settings, shortcuts, compare and reset, profile import/export and share codes, and Why?/Inspect views. Local only. | [`apps/extension`](apps/extension) |
| **MCP server and agent skill** | Tools around the same engine, plus a portable skill for "inspect → propose → change → verify" work. | [`packages/mcp`](packages/mcp), [`skills/`](skills/) |
| **Website** | Dark, self-contained project page. It proofreads itself: an X-ray mode measures every line and contrast ratio, and a stress test applies WCAG spacing live. It passes its own `rlab check` at three viewports. | [`apps/site`](apps/site) |
| **Examples** | Realistic fixtures (article, docs, newsletter, mixed code, tables, footnotes, Turkish, Arabic RTL, Japanese) , a recorded agent run with before/after reports, and a live published article re-set with a recipe. | [`fixtures/`](fixtures/), [`examples/`](examples/) |

See [`docs/SUPPORT.md`](docs/SUPPORT.md) for the support matrix and what was verified, and how.

## Quickstart

Requirements: Node 20+ (tested on 24), pnpm 10.

**One command:**

```sh
pnpm start
```

On first run it installs dependencies and builds everything. Then it serves the website, the workbench, the reading-controls demo, the example docs site and the fixtures on localhost, and prints their links. Ctrl+C stops it. It rebuilds by itself when source files are newer than the last build; `pnpm start --rebuild` forces a build, and `pnpm start --open` opens the website in your browser. If a port is in use, it picks the next free one.

**Step by step** (run each command on its own line, one at a time):

```sh
pnpm install
```
```sh
npx playwright install chromium
```
```sh
pnpm build
```

The second command installs the browser used by the CLI and tests. The third builds all packages and apps; it takes no arguments.

**Try it:**

```sh
node packages/cli/bin/rlab.mjs check fixtures/broken-clipping.html --out reports/demo
```
```sh
pnpm -C apps/workbench dev
```

The first writes `reports/demo/report.md`. The `check` command exits with code 1 here because that fixture is deliberately broken. The second starts the workbench; open the URL it prints.

**Inspect a page** (local files, dev servers and public URLs):

```sh
node packages/cli/bin/rlab.mjs inspect fixtures/broken-contrast.html --selector "#story" --scenarios all --out reports/demo
node packages/cli/bin/rlab.mjs check http://localhost:3000/docs --selector "main article" --policy readability-lab.policy.json
node packages/cli/bin/rlab.mjs compare reports/before/report.json reports/after/report.json
node packages/cli/bin/rlab.mjs claims "line length" ; node packages/cli/bin/rlab.mjs claim C-LH-003
```

Exit codes: `0` ok, `1` policy failure (`check`), `2` usage error, `3` page could not be inspected as requested.

**Workbench:** `pnpm -C apps/workbench dev`, then open the URL Vite prints (`#/compare`, `#/atlas`, `#/explore`).

**Extension:** `pnpm -C apps/extension build`, then load the unpacked extension:
- Chromium: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select `apps/extension/dist/chromium`.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on** and select `apps/extension/dist/firefox/manifest.json`.

**Embed reading controls:**

```html
<article id="story">…</article>
<rl-reading-controls target="#story" recipe-src="/reading-recipe.json"></rl-reading-controls>
<script type="module" src="/node_modules/@camasuvi/readability-lab-controls/dist/reading-controls.js"></script>
```

For the headless API, see [`packages/controls/README.md`](packages/controls/README.md). For a live demo, see [`packages/controls/demo/index.html`](packages/controls/demo/index.html).

**Agents:** see [`skills/readability-lab/SKILL.md`](skills/readability-lab/SKILL.md) and [`skills/adapters/README.md`](skills/adapters/README.md). To run the MCP server over stdio: `node packages/mcp/bin/readability-lab-mcp.mjs`.

## How the pieces agree

The extension, workbench, controls, CLI, MCP server and skill all share one foundation:
- **`Profile`:** a reader's choices, never their browsing content;
- **`Recipe`:** a publisher's intended presentation, with rationale, claim revisions and browser calibration;
- **`Report`:** observations, findings, scenarios, coverage and uncertainty;
- **`Policy`:** CI rules, with exceptions that carry reasons and review dates.

JSON Schemas for these formats are in [`schemas/`](schemas/).

Layers combine predictably, from lowest to highest priority:

page styles < publisher recipe < publisher responsive override < reader profile < reader per-site setting.

Reader access needs are never overridden by presets or by publisher recipes.

## Verification

```sh
pnpm verify    # build, typecheck, unit tests, evidence integrity, browser tests
```

The test suites map to the acceptance scenarios in [`docs/PLAN.md`](docs/PLAN.md#acceptance-matrix-verification-paths). Results for this release are recorded in [`docs/SUPPORT.md`](docs/SUPPORT.md).

## Documentation

- [Architecture and decisions](docs/ARCHITECTURE.md), including the evaluation of existing projects
- [Measurement method](docs/measurement-method.md)
- [Support matrix and verification results](docs/SUPPORT.md)
- [Color palettes](docs/palette.md) · [Privacy](docs/PRIVACY.md) · [CI integration](docs/ci.md) · [Roadmap](docs/ROADMAP.md) · [Release process](docs/RELEASE.md)
- [Contributing](CONTRIBUTING.md): code, evidence corrections and fixtures (no code needed)

## Licensing

- Code is licensed under [Apache-2.0](LICENSE).
- Original evidence summaries, study extractions, fixture text and docs are licensed under [CC BY 4.0](LICENSE-CONTENT.md).
- Third-party papers are linked, not redistributed. Rights are tracked per source in the registry.
- Third-party components are listed in [NOTICE](NOTICE).

"Readability Lab" is a working name.
