# @emrecamasuvi/readability-lab-controls

Reading settings for publishers, using the portable Readability Lab profile.

## Web component

```html
<rl-reading-controls target="#story" recipe-src="/recipe.json" storage-key="my-site:reading"></rl-reading-controls>
<script type="module" src="@emrecamasuvi/readability-lab-controls/dist/reading-controls.js"></script>
<!-- or classic script: dist/reading-controls.iife.js -->
```

- Native, keyboard-operable controls. The layout wraps at any text size, and there are no fixed heights.
- The publisher recipe sets the defaults. Reader changes win, and settings the reader marks to keep survive presets.
- Settings are stored in `localStorage` on this device only. Profile files and share codes contain settings only.
- It listens for a `readability-lab:profile` window event. The browser extension sends this only if the reader enables it.

## Headless API

```ts
import { createReadingPreferences } from "@emrecamasuvi/readability-lab-controls";
const prefs = createReadingPreferences({ target: "#story", recipe });
prefs.subscribe(({ resolution }) => render(resolution.settings));
prefs.set({ fontSizePx: 20 });
prefs.applyPreset("larger-text");
prefs.setEnabled(false); // show the original
prefs.exportJson();      // portable profile
```

Bundle: about 133 KB minified, 40 KB gzip; most of it is the schema validator.
