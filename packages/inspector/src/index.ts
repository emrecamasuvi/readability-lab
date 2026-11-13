export { inspect, inspectWithTextSpacing, fingerprint, type InspectOptions, type InspectResult } from "./inspect.js";
export { findRegion, type RegionResult } from "./region.js";
export { measureLines, linePitch, scriptTally, LINE_METHOD, type Line, type LineMeasurement } from "./lines.js";
export { sampleContrast, resolveBackground, normalizeColor, CONTRAST_METHOD } from "./contrast.js";
export { firstAvailable, availability, parseFamilies, FONT_METHOD } from "./fonts.js";
export { findClipping, findHorizontalOverflow, textOutside, applyTextSpacing, verifyTextSpacing, TEXT_SPACING_CSS, OVERFLOW_METHOD } from "./overflow.js";
export { applySettings, clearSettings, injectCss, removeCss, markRegion, unmarkRegion, type FitResult } from "./apply.js";
export { selectorFor, textNodes, blockContainer } from "./dom.js";
