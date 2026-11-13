# Color palettes

Every text color pair our interfaces use meets **7:1** (the WCAG AAA level and our own baseline target), in both light and dark themes. Non-text graphics meet at least 4.5:1. `tests/unit/palette.test.ts` reads the colors straight from the source files, so a palette edit cannot drift below these targets unnoticed.

Pairs were also checked in Clearleft's [This hue shall pass](https://thishueshallpass.clearleft.com/). Where a color fell short, only its **OKLCH lightness** was changed, the same approach as the tool's adjuster, so each hue stays within 0.3°.

| Palette | Colors | Check in the tool |
|---|---|---|
| Website (dark) | carbon `#0e0d0b`, raised `#161512`, card `#1e1c18`, paper `#efe9dc`, dim `#b4ab9c`, pencil `#ff8a6b`, pencil-deep `#d0441c`, highlighter `#d6f26b`, highlighter ink `#1a1f05`, index card `#f3ecdc` / `#231d14` | [open](https://thishueshallpass.clearleft.com/?colors=0e0d0b%2C161512%2C1e1c18%2Cefe9dc%2Cb4ab9c%2Cff8a6b%2Cd0441c%2Cd6f26b%2C1a1f05%2Cf3ecdc%2C231d14) |
| Workbench & extension (light) | text `#1b1b1b`, background `#ffffff`, panel `#f6f7f9`, muted `#525252`, accent `#014abb`, warn `#774702`, fail `#a5130f`, ok `#0d5f2a` | [open](https://thishueshallpass.clearleft.com/?colors=1b1b1b%2Cffffff%2Cf6f7f9%2C525252%2C014abb%2C774702%2Ca5130f%2C0d5f2a) |
| Workbench & extension (dark) | text `#e6e3de`, background `#16181b`, panel `#1f2226`, muted `#b0b0b0`, accent `#8ab4f8`, accent ink `#0b1b33`, warn `#f0b35a`, fail `#fa9289`, ok `#81c995` | [open](https://thishueshallpass.clearleft.com/?colors=e6e3de%2C16181b%2C1f2226%2Cb0b0b0%2C8ab4f8%2C0b1b33%2Cf0b35a%2Cfa9289%2C81c995) |

## Adjustments made (2026-11-12)

| Was | Now | Why | OKLCH L (hue kept) |
|---|---|---|---|
| `#e2552f` | `#d0441c` | White glyph on the wipe handle was 3.8:1, below AA | 0.632 → 0.582 |
| `#0b57d0` | `#014abb` | Light accent: 6.4:1 on white, 6.0:1 on panel | 0.495 → 0.450 |
| `#8a5300` | `#774702` | Light warn: 6.3:1 | 0.494 → ~0.45 |
| `#b3261e` | `#a5130f` | Light fail: 6.5:1 | 0.501 → ~0.47 |
| `#1e6b35` | `#0d5f2a` | Light ok: 6.5:1 | 0.468 → ~0.43 |
| `#555555` | `#525252` | Light muted: exactly 7.0:1 on panel; margin added | 0.450 → 0.440 |
| `#f28b82` | `#fa9289` | Dark fail on panel: 6.7:1 | 0.745 → 0.767 |

Reader themes (`THEMES` in `@emrecamasuvi/readability-lab-core`) are covered by the core unit tests: text ≥ 7:1 and links ≥ 4.5:1. The light-theme link now uses `#014abb`.

Fixtures in `fixtures/` imitate third-party pages and keep their own colors on purpose.
