// Website (production build): strict hash-based CSP + Trusted Types, copy buttons, X-ray, stress test.
import { expect, test } from "@playwright/test";

const SITE = "http://localhost:4330/";

test("runs under its strict CSP and Trusted Types without violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" || /Content Security Policy|TrustedHTML|Trusted Type/i.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto(SITE);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")).toMatch(/require-trusted-types-for 'script'/);
  await expect(page.locator("#d-cpl")).toHaveText(/^\d+$/);
  await page.locator("header [data-xray-toggle]").click();
  await expect(page.locator("#hud")).toContainText("rendered lines");
  await page.keyboard.press("Escape");
  await page.locator("#stress").click();
  await expect(page.locator("#stress-result")).toContainText("Spacing applied page-wide");
  // The overrides really apply under the CSP (0.12em letter spacing on 17px body text).
  expect(await page.$eval(".lede", (el) => parseFloat(getComputedStyle(el).letterSpacing) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(0.12, 2);
  await page.locator("#stress").click();
  expect(await page.$eval(".lede", (el) => getComputedStyle(el).letterSpacing)).toBe("normal");
  expect(problems).toEqual([]);
});

test("copy buttons copy their command and announce the result", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(SITE);
  const button = page.getByRole("button", { name: "Copy command: pnpm build" });
  await button.click();
  await expect(button.locator("xpath=following-sibling::*[@role='status']")).toHaveText(/Copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("pnpm build");
});

test("single-character keys do not trigger page actions (WCAG 2.1.4)", async ({ page }) => {
  await page.goto(SITE);
  await page.keyboard.press("x");
  await page.keyboard.press("s");
  await expect(page.locator("#hud")).not.toHaveClass(/on/);
  await expect(page.locator("#stress")).toHaveAttribute("aria-pressed", "false");
});

test("before/after wipe follows a mouse drag smoothly without starting a native image drag", async ({ page }) => {
  await page.goto(SITE);
  const wipe = page.locator("#wipe");
  await wipe.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>("#wipe img")).every((i) => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => {
    const w = document.getElementById("wipe")!;
    const log = ((window as unknown as { wipeLog: string[] }).wipeLog = []);
    for (const t of ["dragstart", "pointercancel"]) w.addEventListener(t, () => log.push(t), true);
  });
  const box = (await wipe.boundingBox())!;
  const y = box.y + box.height / 2;
  const cut = () => wipe.evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--cut")));
  // Grab on the image itself (not the divider), then drag right in small steps.
  await page.mouse.move(box.x + box.width * 0.3, y);
  await page.mouse.down();
  const seen: number[] = [];
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (0.3 + i * 0.0473), y);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    seen.push(await cut());
  }
  await page.mouse.up();
  // Every step moved the divider, by sub-percent amounts (no whole-percent snapping), and it ended under the pointer.
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
  expect(seen.some((v) => !Number.isInteger(v))).toBe(true);
  expect(seen.at(-1)).toBeCloseTo(77.3, 0);
  expect(await page.evaluate(() => (window as unknown as { wipeLog: string[] }).wipeLog)).toEqual([]);
  // The keyboard-operable range stays in sync, in whole percents.
  await expect(page.locator("#wipe-r")).toHaveValue("77");
});
