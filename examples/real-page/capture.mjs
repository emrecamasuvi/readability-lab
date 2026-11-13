// Captures the before/after frames used by the website's wipe.
//   node examples/real-page/capture.mjs [outDir]
// The "after" frame applies recipe.json via the CLI's own inspectPage (same calibration loop as
// `rlab check --recipe`), so the picture shows exactly what the reports in ./reports measured.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPage } from "../../packages/cli/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "frames"));
const URL = "https://tip.org.tr/raporlar-belgeler/habas-toplu-isci-katliami-duzenin-aynasidir";
const REGION = "#postContent > article";
const recipe = JSON.parse(readFileSync(join(here, "recipe.json"), "utf8"));
const W = 1280, H = 760;

const browser = await chromium.launch();
for (const [name, settings] of [["before", null], ["after", recipe.settings]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce", bypassCSP: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const res = await inspectPage(page, { selector: REGION, settings, scenarioId: name, privacy: true });
  // Frame both shots on the article card, starting just above the article heading, at the
  // wipe's 1280:760 aspect ratio; the 2x capture is downscaled to 1280 px wide afterwards.
  const frame = await page.evaluate(([sel, ratio]) => {
    const card = document.querySelector("#postContent").getBoundingClientRect();
    const heading = document.querySelector(`${sel} > p`).previousElementSibling.getBoundingClientRect();
    const pad = 22; // the white card margin around #postContent
    return { x: Math.round(card.left - pad), y: Math.round(heading.top + scrollY - 6), width: Math.round(card.width + 2 * pad), height: Math.round((card.width + 2 * pad) * ratio) };
  }, [REGION, H / W]);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true, clip: frame, animations: "disabled" });
  console.log(`${name}: frame ${JSON.stringify(frame)}${res.fit ? `, median CPL ${res.fit.achievedMedianCpl}` : ""}`);
  await ctx.close();
}
await browser.close();
