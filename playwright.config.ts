import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: true,
  workers: 4,
  reporter: [["list"], ["html", { open: "never", outputFolder: "artifacts/playwright-report" }]],
  outputDir: "artifacts/test-results",
  webServer: [
    { command: "pnpm -C apps/workbench exec vite preview --port 4319 --strictPort", url: "http://localhost:4319", reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm -C apps/site build && node scripts/serve.mjs apps/site/dist 4330", url: "http://localhost:4330/", reuseExistingServer: true, timeout: 60_000 },
    { command: "node scripts/serve.mjs . 4320", url: "http://localhost:4320/fixtures/article-balanced.html", reuseExistingServer: true, timeout: 30_000 },
  ],
});
