# Readability Lab extension

Manifest V3 for Chromium (116+) and Firefox (142+).

```sh
pnpm -C apps/extension build      # dist/chromium, dist/firefox
pnpm -C apps/extension package    # store zips (needs `zip`)
pnpm -C apps/extension lint:firefox
```

**Load it:**
- Chromium: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select `dist/chromium`.
- Firefox: open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on** and select `dist/firefox/manifest.json`.

**Features:**
- Adjust the page, or open a reader view built with Mozilla Readability.
- Presets as starting choices; size, line length, line spacing, paragraph gap, font, weight and theme.
- Pick a reading region with the mouse or keyboard.
- Per-site "never adjust" and "apply automatically". Automatic mode requests access to that site only.
- Keyboard shortcuts: Alt+Shift+R, Alt+Shift+V, Alt+Shift+C.
- Compare with the original, and reset to it.
- Profile file import/export and share codes, with no site list.
- "Why?" and "Inspect" views.

`dist/*-test` builds add broad host permissions for automated tests only. Never distribute them.
