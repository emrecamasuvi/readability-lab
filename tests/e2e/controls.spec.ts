// Acceptance 6: reading controls work with the keyboard and with enlarged text.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectorSource } from "../../packages/cli/dist/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const demo = pathToFileURL(resolve(here, "../../packages/controls/demo/index.html")).href;
const axeSource = readFileSync(createRequire(resolve(here, "../../packages/cli/package.json")).resolve("axe-core/axe.min.js"), "utf8");

const storyFontSize = (page: Page) => page.$eval("#story p", (p) => parseFloat(getComputedStyle(p).fontSize));

test.beforeEach(async ({ page }) => {
  await page.goto(demo);
  await page.waitForFunction(() => !!document.querySelector("rl-reading-controls")?.shadowRoot?.querySelector("input[type=range]"));
});

test("publisher recipe applies, keyboard changes override it, and the original can be restored", async ({ page }) => {
  await expect.poll(() => storyFontSize(page)).toBe(17); // publisher recipe
  const size = page.locator("rl-reading-controls").locator('input[data-field="fontSizePx"]');
  await size.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => storyFontSize(page)).toBe(21);
  // Toggle to the original page and back with the keyboard.
  const enabled = page.locator("rl-reading-controls").getByLabel("Use my reading settings");
  await enabled.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => storyFontSize(page)).toBe(16); // page default: no recipe, no reader styles
  expect(await page.locator("style[data-readability-lab]").count()).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(() => storyFontSize(page)).toBe(21);
  // Settings persist across reloads (local storage only).
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector("rl-reading-controls")?.shadowRoot?.querySelector("input[type=range]"));
  await expect.poll(() => storyFontSize(page)).toBe(21);
  // Reset returns to the publisher recipe.
  await page.locator("rl-reading-controls").getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => storyFontSize(page)).toBe(17);
});

test("presets are reachable by keyboard and keep protected settings", async ({ page }) => {
  const c = page.locator("rl-reading-controls");
  await c.locator('input[data-field="fontSizePx"]').focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight"); // 26px
  await c.getByText("More spacing and protection").click();
  await c.locator('input[data-need="fontSizePx"]').check();
  await c.getByRole("radio", { name: "Compact" }).focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.$eval("#story p", (p) => getComputedStyle(p).lineHeight)).toBe(`${26 * 1.4}px`);
  expect(await storyFontSize(page)).toBe(26);
});

test("every control is reachable with Tab and shows a visible focus indicator", async ({ page }) => {
  const seen: { tag: string; outline: string }[] = [];
  await page.locator("body").focus();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const host = document.activeElement;
      const el = host?.shadowRoot?.activeElement ?? host;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return { tag: `${el.tagName}${(el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : ""}`, outline: `${cs.outlineStyle} ${cs.outlineWidth}` };
    });
    if (info) seen.push(info);
  }
  const controls = seen.filter((s) => /INPUT|SELECT|BUTTON|SUMMARY/.test(s.tag));
  expect(controls.length).toBeGreaterThan(10);
  for (const s of controls) expect(s.outline, s.tag).toMatch(/solid 3px/);
});

test("at 200% zoom (approximation) with WCAG 1.4.12 spacing the panel neither clips text nor scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await page.addScriptTag({ content: inspectorSource() });
  const result = await page.evaluate(() => {
    const api = (globalThis as unknown as { ReadabilityLabInspector: typeof import("../../packages/inspector/src/index.js") }).ReadabilityLabInspector;
    const host = document.querySelector("rl-reading-controls")!;
    host.shadowRoot!.querySelectorAll("details").forEach((d) => (d.open = true));
    const { undo } = api.applyTextSpacing(document);
    const panel = host.shadowRoot!.querySelector(".panel")!;
    const clip = api.findClipping(panel);
    const right = panel.getBoundingClientRect().right;
    const out = { which: clip.clipped.map((c) => `${c.element.className}|${c.element.tagName}|${c.mechanism}`), clipped: clip.clipped.length, spilling: clip.spilling.length, right, vw: document.documentElement.clientWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    undo();
    return out;
  });
  expect(result.which).toEqual([]);
  expect(result.clipped).toBe(0);
  expect(result.spilling).toBe(0);
  expect(result.right).toBeLessThanOrEqual(result.vw);
  expect(result.pageOverflow).toBe(false);
});

test("axe-core finds no WCAG A/AA violations in the controls", async ({ page }) => {
  await page.locator("rl-reading-controls").getByText("More spacing and protection").click();
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (globalThis as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    const r = await axe.run({ include: [["rl-reading-controls"]] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return r.violations.map((v) => `${v.id} ×${v.nodes.length}`);
  });
  expect(violations).toEqual([]);
});

test("a profile dispatched by another tool (e.g. the extension) is applied", async ({ page }) => {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("readability-lab:profile", { detail: { format: "readability-lab/profile", formatVersion: 1, id: "ext", updatedAt: new Date().toISOString(), settings: { fontSizePx: 24, lineHeight: 1.7 } } }));
  });
  await expect.poll(() => storyFontSize(page)).toBe(24);
});

test("two controllers on different regions do not disturb each other", async ({ page }) => {
  await page.setContent(`<!doctype html><html><body>
    <article id="a"><p>First region text that is long enough to wrap onto more than one line in the test page.</p></article>
    <article id="b"><p>Second region text that is long enough to wrap onto more than one line in the test page.</p></article>
    <rl-reading-controls id="ca" target="#a" storage-key="k-a"></rl-reading-controls>
    <rl-reading-controls id="cb" target="#b" storage-key="k-b"></rl-reading-controls></body></html>`);
  await page.addScriptTag({ path: resolve(here, "../../packages/controls/dist/reading-controls.iife.js") });
  await page.waitForFunction(() => document.querySelectorAll("rl-reading-controls").length === 2 && !!document.querySelector("#cb")?.shadowRoot?.querySelector("input"));
  await page.evaluate(() => {
    (document.querySelector("#ca") as unknown as { preferences: { set: (s: object) => void } }).preferences.set({ fontSizePx: 22 });
    (document.querySelector("#cb") as unknown as { preferences: { set: (s: object) => void } }).preferences.set({ fontSizePx: 26 });
  });
  const sizes = () => page.evaluate(() => ["#a p", "#b p"].map((s) => getComputedStyle(document.querySelector(s)!).fontSize));
  await expect.poll(sizes).toEqual(["22px", "26px"]);
  await page.evaluate(() => (document.querySelector("#cb") as unknown as { preferences: { setEnabled: (v: boolean) => void } }).preferences.setEnabled(false));
  await expect.poll(sizes).toEqual(["22px", "16px"]);
});
