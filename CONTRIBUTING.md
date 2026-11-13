# Contributing

Thank you for helping make reading on the web adjustable, inspectable and reproducible.

## Without writing code

Use the issue forms. Maintainers turn accepted submissions into registry changes.

- **Evidence correction:** a number, limitation, link or classification in a claim or source is wrong.
- **New study extraction:** a study we should add. Keep outcome domains separate.
- **Contradicting evidence:** findings that conflict with a claim.
- **Translation:** plain-language claim text or UI strings.
- **Rendering fixture:** a realistic page the inspector should handle, with the expected result.

### Evidence rules

1. Write original summaries. Link to papers rather than copying them; a short quote with a locator is fine in an issue.
2. Missing statistics stay missing, with a reason. Never estimate a CI or p-value the paper did not report.
3. Keep outcomes separate: speed, comprehension, recognition accuracy, comfort, preference and eye movements.
4. Classify claims as `normative` (WCAG), `empirical` (a measured study result), `heuristic` or `hypothesis`. Evidence strength is not recommendation priority.
5. Where an effect is not established, use the exact sentence: "No reliable quantitative improvement established."
6. Community submissions start as `extracted`. A maintainer marks a source as verified only after checking the original, and records `checkedOn`, the locator and access level (full text or abstract).
7. Every change to a claim bumps its `revision` and adds a `history` entry. `rlab claim <ID> --dependents` lists the affected rules, presets and recipes. `rlab recipe validate` flags recipes that recorded an older revision.

Run `pnpm build && pnpm evidence:check` before opening a pull request that edits `evidence/registry.json`.

## Code

```sh
pnpm install
npx playwright install chromium
pnpm verify          # build, typecheck, unit, evidence integrity, browser tests
```

- **Measurement or rule changes:**
  - Add a fixture under `fixtures/` with a test that pins the expected result.
  - A new rule must name its claim IDs and must not emit `accessibility-failure` unless it actually performs the WCAG check.
- **UI changes:**
  - Keep controls keyboard operable and usable at 200% zoom and under WCAG 1.4.12 spacing; tests check this.
  - Do not add percentage improvement claims; `tests/unit/no-percent-claims.test.ts` enforces this.
- **Text you add:** fixture text must be original or openly licensed. Record the license in a comment.

## Commit and review

Use small commits with plain imperative subjects. Pull requests should say which acceptance scenario or support-matrix row they affect, and update `docs/SUPPORT.md` when the verification status changes.

By contributing you agree that:
- code is licensed under Apache-2.0;
- evidence, fixture text and docs are licensed under CC BY 4.0.
