# Release process

Releases are prepared locally and published only with separate authorization.

1. **Verify:** `pnpm verify`, then `pnpm -C apps/extension lint:firefox`. Update `docs/SUPPORT.md` with the date, browser versions and results.
2. **Evidence:** bump `registryVersion` (`YYYY.MM.patch`) when claims change. Then run `pnpm evidence:check` and `pnpm schemas`.
3. **Versions:** bump `version` in each package, in `manifest.base.json` and in `packages/core/src/version.ts`.
4. **Packages:** run `pnpm -r build`, then `pnpm -r publish --access public --dry-run` to inspect the tarballs. `publishConfig.exports` points to `dist/`.
5. **Extension:** `pnpm -C apps/extension package` produces `apps/extension/dist/readability-lab-{chromium,firefox}-<version>.zip`, each with its `LICENSE`, `NOTICE` and `THIRD-PARTY-LICENSES.txt`.
   - Never upload the `-test` builds; they carry broad host permissions for automation.
6. **Workbench:** `pnpm -C apps/workbench build` produces a static site in `apps/workbench/dist`, deployable to any static host.
7. **Notes:** update `CHANGELOG.md`. List what was verified, what is approximate and what is untested.

Store submission checklist:
- **Permissions justification:** `activeTab`, `scripting`, `storage`; optional per-site host access.
- **Privacy:** no data collection. The Firefox manifest declares `data_collection_permissions: none`.
- **No remote code.**
- Screenshots come from the workbench and the e2e artifacts.
