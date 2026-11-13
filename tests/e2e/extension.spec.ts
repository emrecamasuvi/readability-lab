// Extension (Chromium, test build with host permissions so scripts run without a user gesture).
// Acceptance 1: save settings, reuse on another article, restore the original.
// Acceptance 9: no requests leave localhost.
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = fileURLToPath(new URL(".", import.meta.url));
const extPath = resolve(here, "../../apps/extension/dist/chromium-test");
const BASE = "http://localhost:4320/fixtures/";
const axeSource = readFileSync(createRequire(resolve(here, "../../packages/cli/package.json")).resolve("axe-core/axe.min.js"), "utf8");

let ctx: BrowserContext;
let extId: string;
const external: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "rl-ext-")), {
    channel: "chromium",
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
    viewport: { width: 1280, height: 900 },
  });
  ctx.on("request", (r) => {
    const u = r.url();
    if (!/^(http:\/\/localhost:4320|chrome-extension:|data:|blob:|about:|chrome:)/.test(u)) external.push(u);
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent("serviceworker");
  extId = new URL(sw.url()).host;
});
test.afterAll(async () => {
  expect(external).toEqual([]);
  await ctx.close();
});

async function tabIdFor(url: string): Promise<number> {
  const sw = ctx.serviceWorkers()[0]!;
  return sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0]!.id!, url);
}

async function openPopup(page: Page): Promise<Page> {
  const id = await tabIdFor(page.url());
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html?tabId=${id}`);
  await popup.waitForFunction(() => document.querySelectorAll("#presets button").length === 3);
  return popup;
}

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("article p, article h1, main, article"));
    return {
      styles: els.map((e) => {
        const cs = getComputedStyle(e);
        return [cs.fontSize, cs.lineHeight, cs.maxWidth, cs.marginBottom, cs.color, cs.backgroundColor, cs.fontFamily].join("|");
      }),
      injected: document.querySelectorAll("style[data-readability-lab]").length,
      markers: Array.from(document.querySelectorAll("*")).filter((e) => Array.from(e.attributes).some((a) => a.name.startsWith("data-rl-region"))).length,
      reader: !!document.getElementById("rl-reader-host"),
    };
  });

test("reader saves settings, reuses them on another article, and restores the original exactly", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}article-balanced.html`);
  const before = await snapshot(page);
  const popup = await openPopup(page);
  await popup.getByRole("button", { name: "Larger Text" }).click();
  await expect.poll(() => page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("20px");
  await expect(popup.locator("#region")).toContainText("Reading region");
  // Compare with the original and back.
  await popup.getByRole("button", { name: "Show original" }).click();
  await expect.poll(() => page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("18px");
  await popup.getByRole("button", { name: "Show original" }).click();
  await expect.poll(() => page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("20px");
  // Reset restores the page exactly.
  await popup.getByRole("button", { name: "Reset page" }).click();
  await expect.poll(() => snapshot(page)).toEqual(before);
  await popup.close();

  // Another supported article with different markup reuses the saved profile.
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}blog-post.html`);
  const before2 = await snapshot(page2);
  const popup2 = await openPopup(page2);
  await popup2.getByLabel("Adjust this page").check();
  await expect.poll(() => page2.$eval("#post p", (p) => getComputedStyle(p).fontSize)).toBe("20px");
  await expect.poll(() => page2.$eval("#post p", (p) => getComputedStyle(p).lineHeight)).toBe("32px");
  await popup2.getByLabel("Adjust this page").uncheck();
  await expect.poll(() => snapshot(page2)).toEqual(before2);
  await popup2.close();
  await page.close();
  await page2.close();
});

test("reader view keeps structure and attribution, closes with Escape and restores the page", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}article-balanced.html`);
  const before = await snapshot(page);
  const popup = await openPopup(page);
  await popup.getByRole("button", { name: "Reader view" }).click().catch(() => undefined); // popup closes itself
  await page.waitForSelector("#rl-reader-host");
  const info = await page.evaluate(() => {
    const sr = document.getElementById("rl-reader-host")!.shadowRoot!;
    const art = sr.querySelector("article.rl-article")!;
    return {
      title: sr.querySelector("#rl-title")?.textContent,
      links: art.querySelectorAll("a[href]").length,
      blockquote: art.querySelectorAll("blockquote").length,
      footnoteBack: !!art.querySelector('a[href*="#r1"]'),
      figure: art.querySelectorAll("figure, svg").length,
      attribution: sr.querySelector("footer.attribution")?.textContent ?? "",
      fontSize: getComputedStyle(art.querySelector("p")!).fontSize,
      focused: sr.activeElement?.id,
    };
  });
  expect(info.title).toContain("Reading at the edge of the screen");
  expect(info.links).toBeGreaterThan(0);
  expect(info.blockquote).toBe(1);
  expect(info.footnoteBack).toBe(true);
  expect(info.figure).toBeGreaterThan(0);
  expect(info.attribution).toContain("Content from");
  expect(info.fontSize).toBe("20px"); // profile from the previous test
  expect(info.focused).toBe("close");
  await page.keyboard.press("Escape");
  await expect.poll(() => snapshot(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  await page.close();
});

test("extraction failure is identified clearly", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}not-an-article.html`);
  const popup = await openPopup(page);
  await popup.getByRole("button", { name: "Reader view" }).click().catch(() => undefined);
  await page.waitForSelector("#rl-reader-host");
  const msg = await page.evaluate(() => document.getElementById("rl-reader-host")!.shadowRoot!.querySelector("[role=alert]")?.textContent ?? "");
  expect(msg).toMatch(/not available/);
  expect(msg).toMatch(/Pick region/);
  await page.close();
});

test("inspect view reports measurements and separates finding kinds", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}broken-contrast.html`);
  const popup = await openPopup(page);
  await popup.getByText("Inspect this page").click();
  await expect(popup.locator("#inspect-out table")).toContainText("Characters per line");
  await expect(popup.locator("#inspect-out")).toContainText("Accessibility failure (check performed)");
  await expect(popup.locator("#inspect-out")).toContainText("C-CONTRAST-001");
  await page.close();
});

test("popup is keyboard operable and has no axe A/AA violations", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}article-balanced.html`);
  const popup = await openPopup(page);
  await popup.locator("#size").focus();
  await popup.keyboard.press("ArrowRight");
  await expect(popup.locator("#size-out")).toHaveText("21px");
  await expect.poll(() => page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("21px");
  await popup.addScriptTag({ content: axeSource }).catch(async () => {
    // Extension CSP blocks inline scripts; evaluate the source instead.
    await popup.evaluate(axeSource);
  });
  const violations = await popup.evaluate(async () => {
    const axe = (globalThis as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((v) => v.id);
  });
  expect(violations).toEqual([]);
  // Exported profiles contain no site list.
  const [download] = await Promise.all([popup.waitForEvent("download"), popup.getByRole("button", { name: "Save profile file" }).click()]);
  const json = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(json.format).toBe("readability-lab/profile");
  expect(json.sites).toEqual({});
  await page.close();
});

// ---- Release-candidate review regressions (navigator review 3) ----

test("reset leaves page-owned Readability Lab controls untouched", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}article-balanced.html`);
  // Simulate an embedded publisher controls owner styling the same article.
  await page.evaluate(() => {
    const art = document.querySelector("article")!;
    art.setAttribute("data-rl-region-controls-rl1", "");
    const st = document.createElement("style");
    st.id = "rl-style-controls-rl1";
    st.setAttribute("data-readability-lab", "controls-rl1");
    st.textContent = "[data-rl-region-controls-rl1] p { font-size: 24px !important; }";
    document.head.append(st);
  });
  const popup = await openPopup(page);
  await popup.getByRole("button", { name: "Balanced" }).click();
  await popup.getByRole("button", { name: "Reset page" }).click();
  expect(await page.locator("#rl-style-controls-rl1").count()).toBe(1);
  expect(await page.$eval("article p:nth-of-type(2)", (p) => getComputedStyle(p).fontSize)).toBe("24px");
  expect(await page.locator("#rl-style-ext").count()).toBe(0);
  await page.close();
});

test("reader view: modal focus stays inside, Escape closes after traversal, no new requests, inline styles restored", async () => {
  const requested: string[] = [];
  const page = await ctx.newPage();
  page.on("request", (r) => requested.push(r.url()));
  await page.goto(`${BASE}reader-media.html`);
  await page.waitForLoadState("networkidle");
  const styleBefore = await page.evaluate(() => document.documentElement.getAttribute("style"));
  requested.length = 0;
  const popup = await openPopup(page);
  await popup.getByRole("button", { name: "Reader view" }).click().catch(() => undefined);
  await page.waitForSelector("#rl-reader-host");
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    const outside = await page.evaluate(() => document.activeElement?.id === "page-button" || !!document.activeElement?.closest?.("article"));
    expect(outside).toBe(false);
  }
  const info = await page.evaluate(() => {
    const sr = document.getElementById("rl-reader-host")!.shadowRoot!;
    return { imgs: Array.from(sr.querySelectorAll("article img")).map((i) => i.getAttribute("src")), notes: sr.querySelectorAll(".media-note").length, footer: sr.querySelector("footer")?.textContent ?? "" };
  });
  // The already-loaded (no-store) image is copied from memory, never refetched.
  expect(info.imgs.some((s) => s?.startsWith("data:image/png"))).toBe(true);
  expect(requested.filter((u) => u.includes("nostore-seen.svg"))).toEqual([]);
  expect(info.imgs.some((s) => s?.includes("late.svg"))).toBe(false);
  expect(info.notes).toBeGreaterThan(0);
  expect(info.footer).toMatch(/no new requests/);
  expect(requested.filter((u) => u.includes("late.svg"))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.locator("#rl-reader-host").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.getAttribute("style"))).toBe(styleBefore);
  expect(await page.locator("style[data-readability-lab]").count()).toBe(0);
  await page.close();
});

test("'Never adjust this site' blocks presets, reader view and shortcuts from styling the page", async () => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}article-balanced.html`);
  const popup = await openPopup(page);
  await popup.getByLabel("Never adjust this site").check();
  await popup.getByRole("button", { name: "Balanced" }).click();
  await popup.waitForTimeout(300);
  expect(await page.locator("style[data-readability-lab]").count()).toBe(0);
  await expect(popup.locator("#status")).toContainText("never be adjusted");
  await popup.getByLabel("Never adjust this site").uncheck();
  await page.close();
});

test("profiles shared with page controls contain only this site's settings", async () => {
  const sw = ctx.serviceWorkers()[0]!;
  await sw.evaluate(async () => {
    const { profile } = await chrome.storage.local.get("profile");
    const sites = { ...(profile.sites ?? {}), "private-medical.example": { mode: "page", settings: { fontSizePx: 30 }, regionSelector: "#diagnosis" }, localhost: { mode: "page", settings: {}, regionSelector: null } };
    await chrome.storage.local.set({ profile: { ...profile, sites }, options: { shareWithPageControls: true, privacy: true }, autoHosts: ["localhost"] });
  });
  await new Promise((r) => setTimeout(r, 500)); // background re-registers content scripts
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.addEventListener("readability-lab:profile", (e) => ((window as unknown as { __got: unknown }).__got = (e as CustomEvent).detail));
  });
  await page.goto(`${BASE}article-balanced.html`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __got?: unknown }).__got ?? null), { timeout: 10000 }).not.toBeNull();
  const got = await page.evaluate(() => (window as unknown as { __got: { sites: object; id: string; settings: object } }).__got);
  expect(got.sites).toEqual({});
  expect(got.id).toBe("readability-lab-extension");
  expect(JSON.stringify(got)).not.toContain("private-medical");
  // Auto mode applied the reader's settings on load.
  expect(await page.locator("#rl-style-ext").count()).toBe(1);
  await sw.evaluate(async () => chrome.storage.local.set({ options: { shareWithPageControls: false, privacy: true }, autoHosts: [] }));
  await page.close();
});
