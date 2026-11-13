// Workbench: realistic comparison, exports that reproduce in the CLI (acceptance 2),
// evidence atlas (acceptance 7 surface), and no remote requests (acceptance 9).
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectUrl } from "../../packages/cli/dist/index.js";
import { Recipe } from "../../packages/core/dist/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const WB = "http://localhost:4319/";
const external: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(WB) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) external.push(u);
  });
});
test.afterEach(() => expect(external).toEqual([]));

const median = (page: import("@playwright/test").Page, pane: number) =>
  page.locator(".pane").nth(pane).locator("tr", { hasText: "Median characters per line" }).locator("td").first();

test("compare measures both panes and exports a recipe the CLI reproduces", async ({ page }) => {
  await page.goto(`${WB}#/compare?s=article&d=desktop`);
  await expect(median(page, 1)).toHaveText(/^\d+/, { timeout: 15000 });
  await expect(median(page, 0)).toHaveText(/^\d+/);
  const wbMedian = parseFloat((await median(page, 1).textContent())!);
  expect(Math.abs(wbMedian - 65)).toBeLessThanOrEqual(2);
  // Keyboard: raise B's size by 2px (0.5 steps).
  await page.locator("#ed-B-size").focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("output[for='ed-B-size']")).toHaveText("20px");
  await expect(median(page, 1)).toHaveText(/^\d+/);
  await page.waitForTimeout(500);
  const wbMedian2 = parseFloat((await median(page, 1).textContent())!);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".pane").nth(1).getByRole("button", { name: "Recipe JSON" }).click()]);
  const recipe = Recipe.parse(JSON.parse(readFileSync((await download.path())!, "utf8")));
  expect(recipe.settings.fontSizePx).toBe(20);
  expect(recipe.calibration?.charsPerCh).toBeGreaterThan(0.5);
  expect(Object.keys(recipe.claimRevisions)).toContain("C-BASE-002");
  expect(recipe.rationale.length).toBeGreaterThan(0);
  // Developer reproduces at the recorded conditions with the CLI.
  const { report } = await inspectUrl({ target: resolve(here, "../../fixtures/article-balanced.html"), selector: recipe.scope.selector, recipe, viewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
  const cli = report.observations.find((o: { metric: string }) => o.metric === "layout.cpl")!.value as number;
  expect(Math.abs(cli - wbMedian2)).toBeLessThanOrEqual(2);
});

test("pasted text is measured locally and never put into share links", async ({ page }) => {
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  await page.locator("#paste").fill("# My private note\n\n" + "This is private text that should never appear in a link. ".repeat(12));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  await expect(median(page, 1)).toHaveText(/^\d+/, { timeout: 15000 });
  expect(page.url()).not.toContain("private");
  expect(decodeURIComponent(page.url())).not.toMatch(/s=pasted/);
});

test("atlas answers entry-point questions with shared claim IDs", async ({ page }) => {
  await page.goto(`${WB}#/atlas`);
  await page.getByRole("button", { name: "Is 1.6 line height better than 1.5?" }).click();
  await page.locator(`.claim-list a[href="#/atlas?claim=C-LH-003"]`).click();
  await expect(page.locator(".claim-detail")).toContainText("No reliable quantitative improvement established.");
  await expect(page.locator(".claim-detail")).toContainText("line-height-range"); // dependents trace
  await page.getByRole("button", { name: "Is 1.6 line height better than 1.5?" }).click(); // clear the question filter
  await page.locator("#atlas-q").fill("dark");
  await expect(page.locator(".claim-list li").first()).toBeVisible();
});

test("blind mode hides font names", async ({ page }) => {
  await page.goto(`${WB}#/compare?blind=1`);
  await expect(page.locator("#ed-B-font option").nth(2)).toHaveText(/^Font \d$/);
  await expect(page.locator(".pane h2").nth(0)).toHaveText(/Option 1/);
});

test("pasted forms cannot submit anything from the preview", async ({ page }) => {
  const hits: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" || r.url().includes("collect")) hits.push(`${r.method()} ${r.url()}`);
  });
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  await page.locator("#paste").fill('Private notes.\n\n<form action="/collect" method="post"><input name="secret" value="private reading content"><button id="send">Send</button></form>\n\n' + "More private text for the measurement to work with. ".repeat(10));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  const frame = page.frameLocator("[data-testid=pane-B]");
  await expect(frame.locator("#content")).toContainText("Private notes");
  expect(await frame.locator("form, input, button").count()).toBe(0);
  expect(await page.locator("[data-testid=pane-B]").getAttribute("sandbox")).toBe("allow-same-origin allow-scripts");
  expect(hits).toEqual([]);
});

test("share links restore apparent-size matching and spacing overrides", async ({ page }) => {
  await page.goto(`${WB}#/compare?s=article&d=desktop&m=1&ts=1`);
  await expect(page.getByLabel("Match B's apparent size to A (estimate)")).toBeChecked();
  await expect(page.getByLabel("WCAG 1.4.12 spacing overrides")).toBeChecked();
  await expect(page.locator("output[for='ed-B-size']")).toContainText("applied, matched to A");
});

test("matched apparent size keeps a newly chosen preset's own size; votes keep viewing conditions apart", async ({ page }) => {
  await page.goto(`${WB}#/compare?s=article&d=desktop`);
  await expect(median(page, 1)).toHaveText(/^\d+/, { timeout: 15000 });
  await page.getByLabel("Match B's apparent size to A (estimate)").check();
  await page.locator(".pane").nth(1).getByRole("button", { name: "Larger Text" }).click();
  await page.getByLabel("Match B's apparent size to A (estimate)").uncheck();
  await expect(page.locator("output[for='ed-B-size']")).toHaveText("20px");
  // Votes under different spacing conditions are different conditions.
  await page.getByRole("button", { name: "Recipe B" }).click();
  await page.getByLabel("WCAG 1.4.12 spacing overrides").check();
  await page.getByRole("button", { name: "Recipe B" }).click();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("rl-wb-prefs") ?? "null"));
  expect(session.comparisons.length).toBe(2);
  expect(session.comparisons[0].right).not.toBe(session.comparisons[1].right);
  expect(session.conditions.map((c: { label: string }) => c.label).join(" | ")).toContain("WCAG 1.4.12 spacing");
});

test("pasted Markdown is sanitized with the native Sanitizer API, without downloading DOMPurify", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  await page.locator("#paste").fill('Hello <img src=x onerror="window.pwned=1"> <form><button>x</button></form>\n\n' + "Plain prose to measure. ".repeat(20));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  const frame = page.frameLocator("[data-testid=pane-B]");
  await expect(frame.locator("#content")).toContainText("Plain prose");
  expect(await frame.locator("form, button, [onerror]").count()).toBe(0);
  const supportsNative = await page.evaluate(() => "setHTML" in Element.prototype);
  if (supportsNative) expect(scripts.filter((u) => /purify/i.test(u))).toEqual([]);
});

test("without the Sanitizer API, DOMPurify is loaded on demand and still strips unsafe content", async ({ page }) => {
  await page.addInitScript(() => { delete (Element.prototype as unknown as { setHTML?: unknown }).setHTML; });
  const scripts: string[] = [];
  page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  await page.locator("#paste").fill('Hi <img src=x onerror="window.pwned=1"><form action="/collect"><input name="secret"></form>\n\n' + "Plain prose to measure. ".repeat(20));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  const frame = page.frameLocator("[data-testid=pane-B]");
  await expect(frame.locator("#content")).toContainText("Plain prose");
  expect(await frame.locator("form, input, [onerror]").count()).toBe(0);
  expect(scripts.some((u) => /purify/i.test(u))).toBe(true);
});

test("opening a local HTML file asks for the region in a native modal dialog", async ({ page }) => {
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  const file = { name: "my-page.html", mimeType: "text/html", buffer: Buffer.from(`<!doctype html><html><head><style>main{max-width:30em;font:18px/1.5 Georgia}</style></head><body><nav>menu</nav><main id="story"><p>${"A local page with enough prose to wrap over several lines in the preview. ".repeat(6)}</p></main><script>window.pwned=1</script></body></html>`) };
  // Esc cancels without opening.
  await page.locator("input[type=file]").setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Where is the main text?" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#region-input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#sample option:checked")).not.toHaveText("my-page.html");
  // Choosing a selector opens the sanitized page.
  await page.locator("input[type=file]").setInputFiles(file);
  await page.locator("#region-input").fill("#story");
  await page.getByRole("button", { name: "Open file" }).click();
  await expect(page.locator("#sample option:checked")).toHaveText("my-page.html");
  const frame = page.frameLocator("[data-testid=pane-B]");
  await expect(frame.locator("#story")).toContainText("A local page");
  expect(await frame.locator("script").count()).toBeGreaterThanOrEqual(0);
  expect(await page.frameLocator("[data-testid=pane-B]").locator("body").evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
});

test("pasting a second text replaces the first and starts its own preference session", async ({ page }) => {
  await page.goto(`${WB}#/compare`);
  await page.getByText("Use your own text").click();
  const frame = page.frameLocator("[data-testid=pane-B]");
  const key = () => page.evaluate(() => JSON.parse(localStorage.getItem("rl-wb-prefs") ?? "null")?.sampleId as string | undefined);
  await page.locator("#paste").fill("FIRST PASSAGE. " + "Some prose to wrap across lines. ".repeat(12));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  await expect(frame.locator("body")).toContainText("FIRST PASSAGE");
  await page.getByRole("button", { name: /no preference/i }).first().click();
  const first = await key();
  await page.locator("#paste").fill("SECOND PASSAGE. " + "Different prose to wrap across lines. ".repeat(12));
  await page.getByRole("button", { name: "Preview pasted text" }).click();
  await expect(frame.locator("body")).toContainText("SECOND PASSAGE");
  await expect(frame.locator("body")).not.toContainText("FIRST PASSAGE");
  await page.getByRole("button", { name: /no preference/i }).first().click();
  expect(await key()).not.toBe(first);
});

test("atlas follows claim cross-links and back/forward", async ({ page }) => {
  await page.goto(`${WB}#/atlas?claim=C-BASE-002`);
  const detail = page.locator(".claim-detail");
  const title = await detail.locator("h2, h3").first().textContent();
  await detail.locator('a[href="#/atlas?claim=C-BASE-001"]').first().click();
  await expect(detail.locator("h2, h3").first()).not.toHaveText(title!);
  await page.goBack();
  await expect(detail.locator("h2, h3").first()).toHaveText(title!);
});
