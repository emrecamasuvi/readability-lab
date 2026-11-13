import {
  applyPreset as applyPresetToProfile,
  createProfile,
  decodeSettings,
  encodeSettings,
  exportProfile,
  importProfile,
  resolvePresentation,
  type Profile,
  type Recipe,
  type Resolution,
  type SettingField,
  type TypographySettings,
} from "@camasuvi/readability-lab-core";
import { applySettings, clearSettings, type FitResult } from "@camasuvi/readability-lab-inspector";

export const DEFAULT_STORAGE_KEY = "readability-lab:profile";
/** Window event other tools (e.g. the browser extension) can dispatch with a profile in `detail`. */
export const PROFILE_EVENT = "readability-lab:profile";

export interface PreferencesOptions {
  /** Reading region element or selector. */
  target: Element | string;
  /** Publisher recipe providing the page's intended presentation. */
  recipe?: Recipe | null;
  storageKey?: string;
  /** Storage implementation; `null` disables persistence. Defaults to localStorage when available. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** Accept profiles dispatched on window via the PROFILE_EVENT. Default true. */
  acceptExternalProfiles?: boolean;
  /** Style key so several controllers can coexist. */
  styleKey?: string;
}

export interface PreferencesState {
  profile: Profile;
  resolution: Resolution;
  fit: FitResult | null;
  enabled: boolean;
}

export interface ReadingPreferences {
  getState(): PreferencesState;
  set(patch: TypographySettings): void;
  unset(field: SettingField): void;
  setNeed(field: SettingField, isNeed: boolean): void;
  applyPreset(id: string): void;
  setEnabled(enabled: boolean): void;
  reset(): void;
  exportJson(opts?: { includeSites?: boolean }): string;
  importJson(json: string | object): void;
  shareCode(): string;
  applyShareCode(code: string): void;
  subscribe(fn: (s: PreferencesState) => void): () => void;
  destroy(): void;
}

function safeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    const s = globalThis.localStorage;
    const k = "__rl_probe__";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

/**
 * Headless reading preferences. Same Profile format as the extension and workbench.
 * Precedence: publisher recipe < reader profile (needs are protected from presets).
 * Everything stays in the page; nothing is sent anywhere.
 */
export function createReadingPreferences(opts: PreferencesOptions): ReadingPreferences {
  const key = opts.storageKey ?? DEFAULT_STORAGE_KEY;
  const storage = opts.storage === undefined ? safeStorage() : opts.storage;
  const styleKey = opts.styleKey ?? "controls";
  const listeners = new Set<(s: PreferencesState) => void>();
  const target = (): Element | null => (typeof opts.target === "string" ? document.querySelector(opts.target) : opts.target);

  let profile: Profile = load() ?? createProfile({ name: "Reading preferences" });
  let enabled = true;
  let fit: FitResult | null = null;
  let resolution = resolve();

  function load(): Profile | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      return raw ? importProfile(raw) : null;
    } catch {
      return null;
    }
  }
  function save() {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(profile));
    } catch {
      /* storage full or blocked: settings still apply for this page view */
    }
  }
  function resolve(): Resolution {
    return resolvePresentation({ recipe: opts.recipe ?? null, profile, host: typeof location !== "undefined" ? location.hostname : null, viewportWidth: typeof innerWidth === "number" ? innerWidth : null });
  }
  function render() {
    resolution = resolve();
    const el = target();
    if (!el) return;
    if (!enabled || !Object.keys(resolution.settings).length) {
      clearSettings(el.ownerDocument, styleKey);
      fit = null;
    } else {
      fit = applySettings(el, resolution.settings, { important: true, key: styleKey });
    }
  }
  function commit(next: Profile) {
    profile = { ...next, updatedAt: new Date().toISOString() };
    save();
    render();
    emit();
  }
  function emit() {
    const s = api.getState();
    for (const fn of listeners) fn(s);
  }
  const onExternal = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    try {
      commit(importProfile(detail));
    } catch {
      /* ignore malformed profiles */
    }
  };
  if (opts.acceptExternalProfiles !== false && typeof window !== "undefined") window.addEventListener(PROFILE_EVENT, onExternal);
  // Publisher responsive overrides depend on viewport width: re-resolve when it changes.
  let lastWidth = typeof innerWidth === "number" ? innerWidth : 0;
  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (innerWidth === lastWidth) return;
      lastWidth = innerWidth;
      render();
      emit();
    });
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  const api: ReadingPreferences = {
    getState: () => ({ profile, resolution, fit, enabled }),
    set(patch) {
      commit({ ...profile, presetId: null, settings: { ...profile.settings, ...patch } });
    },
    unset(field) {
      const settings = { ...profile.settings };
      delete settings[field];
      commit({ ...profile, settings, needs: profile.needs.filter((n) => n !== field) });
    },
    setNeed(field, isNeed) {
      const needs = new Set(profile.needs);
      if (isNeed) needs.add(field);
      else needs.delete(field);
      commit({ ...profile, needs: [...needs] });
    },
    applyPreset(id) {
      commit(applyPresetToProfile(profile, id));
    },
    setEnabled(v) {
      enabled = v;
      render();
      emit();
    },
    reset() {
      commit(createProfile({ id: profile.id, name: profile.name }));
    },
    exportJson(o) {
      return JSON.stringify(exportProfile(profile, o), null, 2);
    },
    importJson(json) {
      commit(importProfile(json));
    },
    shareCode() {
      return encodeSettings(profile.settings);
    },
    applyShareCode(code) {
      commit({ ...profile, presetId: null, settings: decodeSettings(code) });
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(api.getState());
      return () => listeners.delete(fn);
    },
    destroy() {
      listeners.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener(PROFILE_EVENT, onExternal);
        window.removeEventListener("resize", onResize);
      }
      const el = target();
      if (el) clearSettings(el.ownerDocument, styleKey);
    },
  };
  render();
  return api;
}
