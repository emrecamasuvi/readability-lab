# CI and pull-request integration

`rlab check` inspects a page in a real browser, applies a project policy, and exits with:

- `0` when the policy passes or only warns;
- `1` when the policy fails;
- `3` when the page could not be inspected as requested, for example a wrong selector or a navigation error. This is kept separate so a broken check can't look like a pass.

```sh
rlab check http://localhost:4173/docs/getting-started --selector "main .prose" \
  --policy readability-lab.policy.json --scenarios all --screenshots --out reports/getting-started
```

## Policy

See [`readability-lab.policy.json`](../readability-lab.policy.json) and the [policy schema](../schemas/policy-1.schema.json).

- `failOn` defaults to `["accessibility-failure"]`. Heuristic deviations, such as line length or font size outside the starting ranges, never fail a build unless you add `heuristic-deviation` to `failOn` on purpose.
- `conformanceTarget: "AAA"` makes 7:1 contrast a failure instead of a heuristic.
- `exceptions` need a `reason` and a `reviewBy` date.
  - An exception with a `selector` applies only to elements that selector matches in the browser during the run.
  - After `reviewBy` the exception stops excusing the finding, and the gate reports it as expired.

## GitHub Actions

[`docs/examples/reading-check.workflow.yml`](examples/reading-check.workflow.yml) is a template to copy into your own site's `.github/workflows/` and adapt (it does not run in this repository). It builds a site, serves it, runs `rlab check` on a list of pages, and uploads `reports/` (JSON, Markdown, HTML and screenshots) as an artifact. It also writes the Markdown summary to the job summary for reviewers.

To compare a branch with its base, run the same command on both builds with the same selector and viewport, then run `rlab compare base/report.json head/report.json`. The comparison refuses to call findings "resolved" when the scenarios, content fingerprint, viewport, browser or policy differ.

## Playwright tests

```ts
import { inspectPage } from "@emrecamasuvi/readability-lab-cli";
test("docs prose has no reading accessibility failures", async ({ page }) => {
  await page.goto("/docs/getting-started");
  const { observations } = await inspectPage(page, { selector: "main .prose" });
  // …or build a full report with buildReport/gate from @emrecamasuvi/readability-lab-core
});
```

Automated results describe the checks performed. They are not a WCAG certification; see the "Not performed" section in every report.
