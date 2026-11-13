# @emrecamasuvi/readability-lab-inspector

Runs inside a page (content script, iframe, Playwright, devtools) and returns `Observation[]` using the shared metric names. See `docs/measurement-method.md`.

```ts
import { inspect, inspectWithTextSpacing, applySettings, findRegion } from "@emrecamasuvi/readability-lab-inspector";
const { observations, region } = inspect({ selector: "article" });
```

`dist/inspector.iife.js` exposes `window.ReadabilityLabInspector` for injection with `page.addScriptTag`.
