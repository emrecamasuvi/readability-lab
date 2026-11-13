// Renders the extension icon SVG to PNGs (run once; outputs are committed).
import { chromium } from "@playwright/test";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#014abb"/><path d="M8 10h16M8 16h12M8 22h14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const size of [16, 32, 48, 128]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `apps/extension/static/icons/icon-${size}.png`, omitBackground: true });
}
await b.close();
console.log("icons written");
