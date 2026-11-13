import { createProfile, importProfile, type Observation, type Profile, type TypographySettings } from "@emrecamasuvi/readability-lab-core";

/** `browser` (Firefox) and `chrome` share the promise-based MV3 APIs we use. */
export const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

const PROFILE_KEY = "profile";
export const AUTO_HOSTS_KEY = "autoHosts";
/** Same event name as @emrecamasuvi/readability-lab-controls PROFILE_EVENT. */
export const PROFILE_EVENT_NAME = "readability-lab:profile";
const OPTIONS_KEY = "options";

export interface ExtOptions {
  /** Let page-embedded Readability Lab controls receive the profile (off: avoids fingerprinting). */
  shareWithPageControls: boolean;
  /** Omit text samples from inspection results. */
  privacy: boolean;
}
export const DEFAULT_OPTIONS: ExtOptions = { shareWithPageControls: false, privacy: true };

export async function loadProfile(): Promise<Profile> {
  const raw = (await ext.storage.local.get(PROFILE_KEY))[PROFILE_KEY];
  if (raw) {
    try {
      return importProfile(raw);
    } catch {
      /* corrupted: start fresh, keep the old value for recovery */
      await ext.storage.local.set({ "profile-corrupt-backup": raw });
    }
  }
  return createProfile({ name: "My reading profile" });
}

export async function saveProfile(p: Profile): Promise<void> {
  await ext.storage.local.set({ [PROFILE_KEY]: { ...p, updatedAt: new Date().toISOString() } });
}

export async function loadOptions(): Promise<ExtOptions> {
  return { ...DEFAULT_OPTIONS, ...((await ext.storage.local.get(OPTIONS_KEY))[OPTIONS_KEY] ?? {}) };
}
export async function saveOptions(o: ExtOptions): Promise<void> {
  await ext.storage.local.set({ [OPTIONS_KEY]: o });
}

export function hostOf(url: string | undefined): string | null {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : null;
  } catch {
    return null;
  }
}

/* Messages from popup/background to the content script. */
export type Msg =
  | { type: "ping" }
  | { type: "apply"; settings: TypographySettings; regionSelector: string | null }
  | { type: "reset" }
  | { type: "compare"; showOriginal?: boolean }
  | { type: "pick" }
  | { type: "inspect"; privacy: boolean }
  | { type: "reader"; open?: boolean; settings: TypographySettings }
  | { type: "status" }
  | { type: "share-profile"; profile: Profile };

export interface PageStatus {
  applied: boolean;
  showingOriginal: boolean;
  readerOpen: boolean;
  region: { selector: string | null; method: string | null; error: string | null };
  fit: { charsPerCh: number | null; achievedMedianCpl: number | null } | null;
}

export interface InspectSummary {
  status: PageStatus;
  observations: Observation[];
  findings: { kind: string; title: string; reason: string; claimIds: string[]; ruleId: string }[];
  viewportWidth: number;
}

export async function getAutoHosts(): Promise<string[]> {
  const v = (await ext.storage.local.get(AUTO_HOSTS_KEY))[AUTO_HOSTS_KEY];
  return Array.isArray(v) ? (v as string[]) : [];
}
