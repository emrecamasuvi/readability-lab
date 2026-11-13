import { evaluate, getPreset, resolvePresentation, type Profile, type TypographySettings } from "@emrecamasuvi/readability-lab-core";
import { applySettings, clearSettings, findRegion, inspect, selectorFor } from "@emrecamasuvi/readability-lab-inspector";
import { openReader, closeReader, isReaderOpen } from "./reader.js";
import { startPicker, stopPicker } from "./picker.js";
import { ext, getAutoHosts, hostOf, loadOptions, loadProfile, PROFILE_EVENT_NAME, saveProfile, type InspectSummary, type Msg, type PageStatus } from "./shared.js";

declare global {
  interface Window {
    __readabilityLabContent?: boolean;
  }
}

const KEY = "ext";

const state: {
  region: Element | null;
  regionSelector: string | null;
  regionMethod: string | null;
  regionError: string | null;
  settings: TypographySettings | null;
  applied: boolean;
  showingOriginal: boolean;
  fit: PageStatus["fit"];
} = { region: null, regionSelector: null, regionMethod: null, regionError: null, settings: null, applied: false, showingOriginal: false, fit: null };

function status(): PageStatus {
  return {
    applied: state.applied,
    showingOriginal: state.showingOriginal,
    readerOpen: isReaderOpen(),
    region: { selector: state.regionSelector, method: state.regionMethod, error: state.regionError },
    fit: state.fit,
  };
}

function resolveRegion(selector: string | null): Element | null {
  if (state.region && state.region.isConnected && (!selector || selector === state.regionSelector)) return state.region;
  const r = findRegion(document, selector);
  state.regionError = r.error ?? null;
  if (r.error) return null;
  state.region = r.element;
  state.regionSelector = r.selector;
  state.regionMethod = r.method;
  return r.element;
}

function apply(settings: TypographySettings, selector: string | null): PageStatus {
  const region = resolveRegion(selector);
  if (!region) {
    state.applied = false;
    return status();
  }
  state.settings = settings;
  if (!Object.keys(settings).length) {
    clearSettings(document, KEY);
    state.applied = false;
    state.fit = null;
    return status();
  }
  const fit = applySettings(region, settings, { important: true, key: KEY });
  state.fit = { charsPerCh: fit.charsPerCh, achievedMedianCpl: fit.achievedMedianCpl };
  state.applied = true;
  setOriginal(state.showingOriginal);
  return status();
}

function setOriginal(show: boolean) {
  state.showingOriginal = show;
  const el = document.getElementById(`rl-style-${KEY}`) as HTMLStyleElement | null;
  if (el) el.media = show ? "not all" : "all";
}

/** Remove every trace of Readability Lab from the page. */
function reset(): PageStatus {
  stopPicker();
  closeReader();
  // Only extension-owned styles: publisher controls on the page keep theirs.
  clearSettings(document, KEY);
  for (const s of Array.from(document.querySelectorAll('style[data-readability-lab="hit-test"], style[data-readability-lab="ext-reader-lock"]'))) s.remove();
  state.applied = false;
  state.showingOriginal = false;
  state.settings = null;
  state.fit = null;
  return status();
}

function summary(privacy: boolean): InspectSummary {
  const region = resolveRegion(state.regionSelector);
  const res = region
    ? inspect({ element: region, selector: state.regionSelector, regionMethod: (state.regionMethod as "auto-detected") ?? "auto-detected", privacy })
    : inspect({ selector: state.regionSelector, privacy });
  const findings = evaluate({ observations: res.observations, scenarios: [{ id: "baseline", label: "Current page", kind: "baseline", fidelity: "real-browser", description: "as currently displayed", viewport: null, appliedCss: null }], viewportWidth: res.page.viewport.width });
  return {
    status: status(),
    observations: res.observations,
    findings: findings.map((f) => ({ kind: f.kind, title: f.title, reason: f.reason, claimIds: f.claimIds, ruleId: f.ruleId })),
    viewportWidth: res.page.viewport.width,
  };
}

/**
 * What a page may receive when the reader opts in: the settings that apply here and their
 * needs — no site list, no region selectors, no stable identifier, no timestamps.
 */
function pageSafeProfile(profile: Profile): Profile {
  const host = hostOf(location.href);
  const r = resolvePresentation({ profile, host, viewportWidth: innerWidth });
  return { format: "readability-lab/profile", formatVersion: 1, id: "readability-lab-extension", name: "Reader settings", updatedAt: "1970-01-01T00:00:00.000Z", presetId: null, settings: r.readerEnabled ? r.settings : {}, needs: profile.needs, sites: {} };
}

async function settingsForThisSite(): Promise<{ settings: TypographySettings; mode: string; selector: string | null }> {
  const profile = await loadProfile();
  const host = hostOf(location.href);
  const site = host ? profile.sites[host] : undefined;
  const r = resolvePresentation({ profile, host, viewportWidth: innerWidth });
  const settings = Object.keys(r.settings).length ? r.settings : { ...getPreset("balanced")!.settings };
  return { settings: r.readerEnabled ? settings : {}, mode: site?.mode ?? "page", selector: site?.regionSelector ?? null };
}

async function onPicked(el: Element) {
  state.region = el;
  state.regionSelector = selectorFor(el);
  state.regionMethod = "user-picked";
  state.regionError = null;
  const host = hostOf(location.href);
  const profile = await loadProfile();
  if (host) {
    const site = profile.sites[host] ?? { mode: "page" as const, settings: {}, regionSelector: null };
    await saveProfile({ ...profile, sites: { ...profile.sites, [host]: { ...site, regionSelector: state.regionSelector } } });
  }
  const { settings } = await settingsForThisSite();
  apply(state.settings ?? settings, state.regionSelector);
}

function handle(msg: Msg): unknown {
  switch (msg.type) {
    case "ping":
      return { ok: true };
    case "status":
      return status();
    case "apply":
      return apply(msg.settings, msg.regionSelector);
    case "reset":
      return reset();
    case "compare":
      setOriginal(msg.showOriginal ?? !state.showingOriginal);
      return status();
    case "pick":
      startPicker(state.region ?? findRegion(document, null).element, (el) => void onPicked(el));
      return status();
    case "inspect":
      return summary(msg.privacy);
    case "reader":
      if (msg.open === false || (msg.open === undefined && isReaderOpen())) closeReader();
      else openReader(msg.settings);
      return status();
    case "share-profile":
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: pageSafeProfile(msg.profile) }));
      return { ok: true };
  }
}

if (!window.__readabilityLabContent) {
  window.__readabilityLabContent = true;
  ext.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
    try {
      sendResponse({ ok: true, result: handle(msg) });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
    return false;
  });
  // Auto-apply when injected by a registered content script for a site the reader enabled.
  void (async () => {
    const host = hostOf(location.href);
    if (!host) return;
    const profile = await loadProfile();
    const site = profile.sites[host];
    // Only sites the reader explicitly set to apply automatically.
    const auto: string[] = await getAutoHosts();
    if (!site || site.mode === "off" || !auto.includes(host)) return;
    const { settings, mode, selector } = await settingsForThisSite();
    if (mode === "reader") openReader(settings);
    else apply(settings, selector);
    const opts = await loadOptions();
    if (opts.shareWithPageControls) window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: pageSafeProfile(profile) }));
  })();
}
