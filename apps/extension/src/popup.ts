import {
  applyPreset,
  decodeSettings,
  encodeSettings,
  exportProfile,
  FONT_STACKS,
  getPreset,
  importProfile,
  KIND_LABELS,
  METRICS,
  PRESETS,
  resolvePresentation,
  THEMES,
  type FindingKind,
  type Profile,
  type TypographySettings,
} from "@camasuvi/readability-lab-core";
import { AUTO_HOSTS_KEY, ext, getAutoHosts, hostOf, loadOptions, loadProfile, saveProfile, type InspectSummary, type PageStatus } from "./shared.js";
import { activeTab, send } from "./tabs.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const FONTS: [string, string | null][] = [
  ["Page font", null],
  ["Sans serif", FONT_STACKS["system-sans"]],
  ["Serif", FONT_STACKS["system-serif"]],
  ["Humanist sans", FONT_STACKS["humanist-sans"]],
  ["Monospace", FONT_STACKS.mono],
];

let profile: Profile;
let tabId: number | null = null;
let host: string | null = null;
let page: PageStatus | null = null;

function say(msg: string) {
  $("status").textContent = msg;
}

function effective(): TypographySettings {
  const r = resolvePresentation({ profile, host });
  return r.readerEnabled ? r.settings : {};
}

function siteOnly(): boolean {
  return ($("site-only") as HTMLInputElement).checked;
}

async function persist(patch: TypographySettings | null, remove?: keyof TypographySettings) {
  if (siteOnly() && host) {
    const site = profile.sites[host] ?? { mode: "page" as const, settings: {}, regionSelector: null };
    const settings = { ...site.settings, ...(patch ?? {}) };
    if (remove) delete settings[remove];
    profile = { ...profile, sites: { ...profile.sites, [host]: { ...site, settings } } };
  } else {
    const settings = { ...profile.settings, ...(patch ?? {}) };
    if (remove) delete settings[remove];
    profile = { ...profile, presetId: null, settings };
  }
  await saveProfile(profile);
  await applyNow();
}

let timer: ReturnType<typeof setTimeout> | undefined;
function applySoon() {
  clearTimeout(timer);
  timer = setTimeout(() => void applyNow(), 120);
}

function siteOff(): boolean {
  return !!(host && profile.sites[host]?.mode === "off");
}

async function applyNow() {
  sync();
  if (tabId === null || !($("enabled") as HTMLInputElement).checked) return;
  if (siteOff()) {
    ($("enabled") as HTMLInputElement).checked = false;
    say(`${host} is set to never be adjusted. Uncheck “Never adjust this site” first.`);
    return;
  }
  const s = effective();
  try {
    page = await send<PageStatus>(tabId, { type: "apply", settings: Object.keys(s).length ? s : { ...getPreset("balanced")!.settings }, regionSelector: host ? profile.sites[host]?.regionSelector ?? null : null });
    showRegion();
  } catch (e) {
    say(`Can't adjust this page: ${(e as Error).message}`);
  }
}

function showRegion() {
  if (!page) return;
  const r = page.region;
  $("region").textContent = r.error ? `Reading region problem: ${r.error}` : r.selector ? `Reading region: ${r.selector} (${r.method === "user-picked" ? "picked by you" : "found automatically"})${page.fit?.achievedMedianCpl ? ` · about ${page.fit.achievedMedianCpl} characters per line` : ""}` : "";
}

function sync() {
  const s = effective();
  const setR = (id: string, v: number | undefined, fallback: number, fmt: (n: number) => string) => {
    ($(id) as HTMLInputElement).value = String(v ?? fallback);
    $(`${id}-out`).textContent = v === undefined ? "page default" : fmt(v);
  };
  setR("size", s.fontSizePx, 18, (n) => `${n}px`);
  setR("measure", s.measure?.unit === "cpl" ? s.measure.value : undefined, 65, (n) => `about ${n} characters`);
  setR("lh", s.lineHeight, 1.5, (n) => n.toFixed(2));
  setR("gap", s.paragraphGapEm, 0.75, (n) => `${n.toFixed(2)}× size`);
  ($("font") as HTMLSelectElement).value = String(Math.max(0, FONTS.findIndex(([, st]) => st === (s.fontFamily ?? null))));
  ($("weight") as HTMLSelectElement).value = s.fontWeight ? String(s.fontWeight) : "";
  for (const r of Array.from(document.querySelectorAll<HTMLInputElement>('input[name="theme"]'))) r.checked = (s.theme?.name ?? "") === r.value;
  for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>("#presets button"))) b.setAttribute("aria-pressed", String(profile.presetId === b.dataset.id));
  ($("site-off") as HTMLInputElement).checked = !!(host && profile.sites[host]?.mode === "off");
}

function renderInspect(sum: InspectSummary) {
  const o = sum.observations;
  const v = (m: string, d = 1) => {
    const x = o.find((y) => y.metric === m);
    return x && typeof x.value === "number" ? String(Math.round(x.value * 10 ** d) / 10 ** d) : x?.value === null || !x ? "unknown" : String(x.value);
  };
  const cpl = o.find((x) => x.metric === METRICS.cpl);
  const contrasts = o.filter((x) => x.metric === METRICS.contrastSample && typeof x.value === "number" && x.status === "measured").map((x) => x.value as number);
  const rows = [
    ["Characters per line (median)", cpl?.distribution ? `${v(METRICS.cpl, 0)} (p10 ${cpl.distribution.p10}, p90 ${cpl.distribution.p90})` : "unknown"],
    ["Text size", `${v(METRICS.fontSizePx)}px`],
    ["Line height", v(METRICS.lineHeightRatio, 2)],
    ["Paragraph gap", `${v(METRICS.paragraphGapEm, 2)}× size`],
    ["Lowest measured contrast", contrasts.length ? `${Math.min(...contrasts).toFixed(2)}:1` : "unknown"],
    ["Font (estimate)", v(METRICS.fontRendered)],
  ];
  const counts: Record<string, number> = {};
  for (const f of sum.findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  const out = $("inspect-out");
  out.replaceChildren();
  const t = document.createElement("table");
  for (const [k, val] of rows) {
    const tr = t.insertRow();
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = k!;
    tr.append(th);
    tr.insertCell().textContent = val!;
  }
  out.append(t);
  const ul = document.createElement("ul");
  for (const f of sum.findings.filter((x) => x.kind !== "pass")) {
    const li = document.createElement("li");
    const k = document.createElement("span");
    k.className = `kind ${f.kind}`;
    k.textContent = KIND_LABELS[f.kind as FindingKind];
    li.append(k, ` ${f.title}`);
    const ids = document.createElement("div");
    ids.className = "ids";
    ids.textContent = f.claimIds.join(" · ");
    li.append(ids);
    ul.append(li);
  }
  const p = document.createElement("p");
  p.className = "hint";
  p.textContent = `${Object.entries(counts).map(([k, n]) => `${KIND_LABELS[k as FindingKind].split(" (")[0]}: ${n}`).join(" · ")}. Automated checks cover only what is listed; they are not an accessibility certification.`;
  out.append(p, ul);
}

async function init() {
  profile = await loadProfile();
  const tab = await activeTab();
  tabId = tab?.id ?? null;
  host = hostOf(tab?.url);
  $("site").textContent = host ?? "This page can't be adjusted (browser page or local file without access).";
  // Read the page state before any control is interactive, so it can't overwrite user input.
  if (tabId !== null && host) {
    try {
      page = await send<PageStatus>(tabId, { type: "status" });
      ($("enabled") as HTMLInputElement).checked = page.applied;
      $("compare").setAttribute("aria-pressed", String(page.showingOriginal));
      showRegion();
    } catch {
      ($("enabled") as HTMLInputElement).disabled = true;
      say("This page can't be adjusted (browser pages and some stores block extensions).");
    }
  }
  // Presets
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.name;
    b.dataset.id = p.id;
    b.title = `${p.summary} ${p.caveat}`;
    b.addEventListener("click", async () => {
      if (siteOff()) {
        say(`${host} is set to never be adjusted. Uncheck “Never adjust this site” first.`);
        return;
      }
      profile = applyPreset(profile, p.id);
      await saveProfile(profile);
      ($("enabled") as HTMLInputElement).checked = true;
      await applyNow();
      say(`${p.name} applied.`);
    });
    $("presets").append(b);
  }
  const fontSel = $("font") as HTMLSelectElement;
  FONTS.forEach(([label], i) => fontSel.add(new Option(label, String(i))));
  for (const [value, label] of [["", "Page colors"], ["light", "Light"], ["sepia", "Sepia"], ["dark", "Dark"], ["high-contrast", "High contrast"]] as const) {
    const l = document.createElement("label");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "theme";
    r.value = value;
    r.addEventListener("change", () => void (value ? persist({ theme: THEMES[value] }) : persist(null, "theme")));
    l.append(r, ` ${label}`);
    $("themes").append(l);
  }
  const range = (id: string, make: (n: number) => TypographySettings) =>
    $(id).addEventListener("input", (e) => {
      const n = Number((e.target as HTMLInputElement).value);
      const patch = make(n);
      if (siteOnly() && host) {
        const site = profile.sites[host] ?? { mode: "page" as const, settings: {}, regionSelector: null };
        profile = { ...profile, sites: { ...profile.sites, [host]: { ...site, settings: { ...site.settings, ...patch } } } };
      } else profile = { ...profile, presetId: null, settings: { ...profile.settings, ...patch } };
      ($("enabled") as HTMLInputElement).checked = true;
      sync();
      void saveProfile(profile);
      applySoon();
    });
  range("size", (n) => ({ fontSizePx: n }));
  range("measure", (n) => ({ measure: { value: n, unit: "cpl" } }));
  range("lh", (n) => ({ lineHeight: n }));
  range("gap", (n) => ({ paragraphGapEm: n }));
  fontSel.addEventListener("change", () => {
    const st = FONTS[Number(fontSel.value)]![1];
    void (st ? persist({ fontFamily: st }) : persist(null, "fontFamily"));
  });
  $("weight").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    void (v ? persist({ fontWeight: Number(v) }) : persist(null, "fontWeight"));
  });
  $("enabled").addEventListener("change", async (e) => {
    if (tabId === null) return;
    if ((e.target as HTMLInputElement).checked) await applyNow();
    else {
      page = await send<PageStatus>(tabId, { type: "reset" });
      say("Original page restored.");
    }
  });
  $("reset").addEventListener("click", async () => {
    if (tabId === null) return;
    page = await send<PageStatus>(tabId, { type: "reset" });
    ($("enabled") as HTMLInputElement).checked = false;
    ($("compare") as HTMLElement).setAttribute("aria-pressed", "false");
    say("Original page restored.");
  });
  $("compare").addEventListener("click", async () => {
    if (tabId === null) return;
    page = await send<PageStatus>(tabId, { type: "compare" });
    $("compare").setAttribute("aria-pressed", String(page.showingOriginal));
    say(page.showingOriginal ? "Showing the original page." : "Showing your settings.");
  });
  $("pick").addEventListener("click", async () => {
    if (tabId === null) return;
    await send(tabId, { type: "pick" });
    say("Choose the text on the page: click it, or use the arrow keys and Enter. Esc cancels.");
    window.close();
  });
  $("reader").addEventListener("click", async () => {
    if (tabId === null) return;
    const s = effective();
    if (siteOff()) {
      say(`${host} is set to never be adjusted. Uncheck “Never adjust this site” first.`);
      return;
    }
    page = await send<PageStatus>(tabId, { type: "reader", settings: s });
    window.close();
  });
  $("site-off").addEventListener("change", async (e) => {
    if (!host) return;
    const off = (e.target as HTMLInputElement).checked;
    const site = profile.sites[host] ?? { mode: "page" as const, settings: {}, regionSelector: null };
    profile = { ...profile, sites: { ...profile.sites, [host]: { ...site, mode: off ? "off" : "page" } } };
    await saveProfile(profile);
    if (off && tabId !== null) await send(tabId, { type: "reset" });
    say(off ? `Readability Lab will not adjust ${host}.` : `Readability Lab can adjust ${host} again.`);
  });
  const autoBox = $("auto") as HTMLInputElement;
  const autoHosts: string[] = await getAutoHosts();
  autoBox.checked = !!host && autoHosts.includes(host);
  autoBox.disabled = !host;
  autoBox.addEventListener("change", async () => {
    if (!host) return;
    const origins = [`https://${host}/*`, `http://${host}/*`];
    let list: string[] = await getAutoHosts();
    if (autoBox.checked) {
      const granted = await ext.permissions.request({ origins });
      if (!granted) {
        autoBox.checked = false;
        say("Access to this site was not granted, so settings will apply only when you open this panel.");
        return;
      }
      list = [...new Set([...list, host])];
      if (!profile.sites[host]) profile = { ...profile, sites: { ...profile.sites, [host]: { mode: "page", settings: {}, regionSelector: page?.region.selector ?? null } } };
      await saveProfile(profile);
    } else {
      list = list.filter((h) => h !== host);
      await ext.permissions.remove({ origins }).catch(() => undefined);
    }
    await ext.storage.local.set({ [AUTO_HOSTS_KEY]: list });
    say(autoBox.checked ? `Settings will apply automatically on ${host}.` : `Automatic mode off for ${host}.`);
  });
  $("inspect").addEventListener("toggle", async (e) => {
    if (!(e.target as HTMLDetailsElement).open || tabId === null) return;
    const opts = await loadOptions();
    try {
      renderInspect(await send<InspectSummary>(tabId, { type: "inspect", privacy: opts.privacy }));
    } catch (err) {
      $("inspect-out").textContent = `Inspection unavailable: ${(err as Error).message}`;
    }
  });
  $("export").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exportProfile(profile), null, 2)], { type: "application/json" }));
    a.download = "reading-profile.json";
    a.click();
    say("Profile saved without your site list.");
  });
  $("import").addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const incoming = importProfile(await f.text());
      profile = { ...incoming, sites: { ...profile.sites, ...incoming.sites } };
      await saveProfile(profile);
      await applyNow();
      say("Profile loaded.");
    } catch (err) {
      say(`Could not load profile: ${(err as Error).message}`);
    }
  });
  $("share").addEventListener("click", async () => {
    const code = encodeSettings(profile.settings);
    ($("code") as HTMLInputElement).value = code;
    await navigator.clipboard?.writeText(code).catch(() => undefined);
    say("Share code copied. It contains settings only.");
  });
  $("apply-code").addEventListener("click", async () => {
    try {
      profile = { ...profile, presetId: null, settings: decodeSettings(($("code") as HTMLInputElement).value) };
      await saveProfile(profile);
      ($("enabled") as HTMLInputElement).checked = true;
      await applyNow();
      say("Share code applied.");
    } catch (err) {
      say(`Could not use that code: ${(err as Error).message}`);
    }
  });
  sync();
}

void init();
