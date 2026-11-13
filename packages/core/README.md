# @emrecamasuvi/readability-lab-core

DOM-free foundation shared by every Readability Lab interface.

- **Formats** (Zod; JSON Schemas in `/schemas`): `Profile`, `Recipe`, `Report`, `Policy`, `Observation`, `Finding`, `Claim`, `Source`, `EvidenceRegistry`, `PreferenceSession`, `PerformanceExperiment`.
- **Presentation:**
  - `PRESETS`, `THEMES`, `FONT_STACKS`;
  - `resolvePresentation` (publisher recipe < reader profile < per-site; protects needs and site-off);
  - `applyPreset`, `importProfile`/`exportProfile`, `encodeSettings`/`decodeSettings`;
  - `toCss`, `recipeToCss`, `recipeToTokens` (DTCG), `designSpec`.
- **Contrast:** `parseColor`, `contrastRatio`, `isLargeText`, `contrastThresholds` (WCAG 2.x, unrounded).
- **Rules and reports:** `RULES`, `evaluate`, `gate`, `buildReport`, `compareReports`, `reportToMarkdown`, `comparisonToMarkdown`.
- **Evidence:** `getRegistry`, `getClaim`, `searchClaims`, `dependentsOfClaim`, `staleClaimReferences`, `QUESTIONS`.
- **Experiments:** `planExploration`, `planConfirmation`, `analyzePerformance` (defaults to "inconclusive"), `preferencePairs`, `summarizePreferences`.

```ts
import { createProfile, resolvePresentation, toCss } from "@emrecamasuvi/readability-lab-core";
const profile = createProfile({ settings: { fontSizePx: 20 }, needs: ["fontSizePx"] });
const { settings } = resolvePresentation({ recipe, profile, viewportWidth: 390 });
const css = toCss(settings, { scope: "article", charsPerCh: recipe.calibration?.charsPerCh ?? null });
```
