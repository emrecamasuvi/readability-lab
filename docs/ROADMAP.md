# Roadmap

The core release covers the full loop: inspect → compare → recipe → apply/export → verify. The stages below build on it.

## Next (0.2)
- **Firefox runtime verification:** an automated `web-ext run` smoke test, plus a manual test record. Today Firefox builds and passes `web-ext lint` only.
- **Safari:** package with `xcrun safari-web-extension-converter`, then test the reader view and the permissions model.
- **Guided reading-performance experiments** on the existing core model: licensed passage sets with comprehension questions, Latin-square schedules, held-out confirmation sessions, an "inconclusive" outcome by default, and local-only storage.
- **Figma plugin** that imports a recipe's DTCG tokens as variables and shows the browser-measured CPL calibration. Today the handoff is the tokens and spec export.
- **Publish packages to npm**, and the extension to Chrome Web Store and AMO. Each needs separate authorization.

## Later
- Framework adapters: React/Vue wrappers for the controls; a Tailwind/Style Dictionary token mapping in recipe exports.
- EPUB and document support: inspect EPUB content documents, and export recipes as EPUB CSS.
- Branch comparison helpers in CI: comment the comparison on pull requests.
- Translations of the plain-language claim text and UI. Better CJK and RTL evidence coverage (registry gap GAP-006).
- A community evidence review workflow with reviewer sign-off recorded in claim history.
- Profile interoperability: import from browser reader-mode settings where formats are documented.

## Research gaps that block stronger recommendations
These are recorded in `evidence/registry.json` under `gaps`:
- the references of the 44-reference report that are not among the roughly 30 linked from the summary (GAP-001);
- long-session comfort evidence;
- non-Latin scripts;
- verification of a small number of statistics from the secondary synthesis.
