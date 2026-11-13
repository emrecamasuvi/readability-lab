import { FONT_STACKS, PRESETS, Recipe, THEMES, type SettingField, type TypographySettings } from "@emrecamasuvi/readability-lab-core";
import { createReadingPreferences, type PreferencesState, type ReadingPreferences } from "./preferences.js";

const FONT_OPTIONS: { id: string; label: string; stack: string | null }[] = [
  { id: "", label: "Page font", stack: null },
  { id: "system-sans", label: "Sans serif", stack: FONT_STACKS["system-sans"] },
  { id: "system-serif", label: "Serif", stack: FONT_STACKS["system-serif"] },
  { id: "humanist-sans", label: "Humanist sans", stack: FONT_STACKS["humanist-sans"] },
  { id: "mono", label: "Monospace", stack: FONT_STACKS.mono },
];

const STYLE = `
:host { display: block; font: inherit; font-size: 1rem; line-height: 1.4; color: CanvasText; --rl-accent: #014abb; }
.panel { border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: 8px; padding: 0.75em 1em; background: Canvas; max-width: 100%; box-sizing: border-box; }
h2 { font-size: 1.05em; margin: 0 0 0.5em; }
fieldset { border: 0; padding: 0; margin: 0 0 0.75em; min-width: 0; }
legend { font-weight: 600; padding: 0; margin-bottom: 0.25em; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25em 0.75em; margin: 0.35em 0; }
.row label { flex: 1 1 9em; }
.row input[type=range] { flex: 2 1 10em; min-width: 8em; accent-color: var(--rl-accent); }
output { min-width: 5.5em; font-variant-numeric: tabular-nums; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4em; }
.chips label { border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 999px; padding: 0.2em 0.7em; cursor: pointer; }
.chips input { margin: 0 0.3em 0 0; }
button, select, input[type=text] { font: inherit; }
button { padding: 0.35em 0.8em; border-radius: 6px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
:focus-visible { outline: 3px solid var(--rl-accent); outline-offset: 2px; }
.note { font-size: 0.9em; opacity: 0.85; margin: 0.25em 0; }
details { margin: 0.5em 0; }
summary { cursor: pointer; font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5em; margin-top: 0.5em; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

let uid = 0;

/**
 * <rl-reading-controls target="article" recipe-src="/recipe.json" storage-key="...">
 * Keyboard operable with native controls; layout wraps at any text size.
 */
export class ReadingControlsElement extends HTMLElement {
  private prefs: ReadingPreferences | null = null;
  private root: ShadowRoot;
  private ids = `rl${++uid}`;
  private unsub: (() => void) | null = null;
  private _recipe: Recipe | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  get recipe(): Recipe | null {
    return this._recipe;
  }
  set recipe(r: Recipe | null) {
    this._recipe = r ? Recipe.parse(r) : null;
    if (this.isConnected) this.init();
  }
  get preferences(): ReadingPreferences | null {
    return this.prefs;
  }

  async connectedCallback() {
    this.setAttribute("data-reading-controls", "");
    const src = this.getAttribute("recipe-src");
    if (src && !this._recipe) {
      try {
        const res = await fetch(src);
        this._recipe = Recipe.parse(await res.json());
      } catch (e) {
        console.warn("rl-reading-controls: could not load recipe", e);
      }
    }
    this.init();
  }

  disconnectedCallback() {
    this.unsub?.();
    this.prefs?.destroy();
    this.prefs = null;
  }

  private init() {
    this.unsub?.();
    this.prefs?.destroy();
    this.prefs = createReadingPreferences({
      target: this.getAttribute("target") ?? "main, article, [data-reading-region]",
      recipe: this._recipe,
      storageKey: this.getAttribute("storage-key") ?? undefined,
      styleKey: `controls-${this.ids}`,
    });
    this.renderShell();
    this.unsub = this.prefs.subscribe((s) => this.sync(s));
  }

  private fid(name: string) {
    return `${this.ids}-${name}`;
  }

  private renderShell() {
    const i = (n: string) => this.fid(n);
    const range = (name: string, label: string, min: number, max: number, step: number) =>
      `<div class="row"><label for="${i(name)}">${label}</label><input type="range" id="${i(name)}" data-field="${name}" min="${min}" max="${max}" step="${step}" aria-describedby="${i(name)}-out"><output id="${i(name)}-out" for="${i(name)}"></output></div>`;
    this.root.innerHTML = `<style>${STYLE}</style>
<section class="panel" aria-labelledby="${i("title")}">
  <h2 id="${i("title")}">Reading settings</h2>
  <div class="row"><label><input type="checkbox" id="${i("enabled")}" checked> Use my reading settings</label></div>
  <fieldset><legend>Starting point</legend>
    <div class="chips" role="radiogroup" aria-describedby="${i("preset-note")}">
      ${PRESETS.map((p) => `<label title="${p.summary}"><input type="radio" name="${i("preset")}" value="${p.id}">${p.name}</label>`).join("")}
    </div>
    <p class="note" id="${i("preset-note")}">Starting choices to adjust, not tested best settings.</p>
  </fieldset>
  <fieldset><legend>Text</legend>
    ${range("fontSizePx", "Text size", 12, 40, 1)}
    ${range("lineHeight", "Line spacing", 1.1, 2.4, 0.05)}
    ${range("measure", "Line length", 35, 100, 1)}
    <div class="row"><label><input type="checkbox" id="${i("fullwidth")}"> Use the full width</label></div>
    ${range("paragraphGapEm", "Space between paragraphs", 0, 2.5, 0.05)}
    <div class="row"><label for="${i("font")}">Font</label><select id="${i("font")}">${FONT_OPTIONS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("")}</select></div>
    <div class="row"><label for="${i("weight")}">Weight</label><select id="${i("weight")}"><option value="">Page weight</option><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option></select></div>
  </fieldset>
  <fieldset><legend>Colors</legend>
    <div class="chips" role="radiogroup">
      <label><input type="radio" name="${i("theme")}" value="">Page colors</label>
      ${Object.entries(THEMES).map(([k, t]) => `<label><input type="radio" name="${i("theme")}" value="${k}">${t.name === "high-contrast" ? "High contrast" : t.name[0]!.toUpperCase() + t.name.slice(1)}</label>`).join("")}
    </div>
  </fieldset>
  <details><summary>More spacing and protection</summary>
    ${range("letterSpacingEm", "Letter spacing", 0, 0.25, 0.01)}
    ${range("wordSpacingEm", "Word spacing", 0, 0.5, 0.01)}
    <div class="row"><label for="${i("align")}">Alignment</label><select id="${i("align")}"><option value="">Page alignment</option><option value="start">Ragged edge</option><option value="justify">Justified</option></select></div>
    <fieldset><legend>Keep these when I pick a starting point</legend>
      <div class="chips">${(["fontSizePx", "lineHeight", "fontFamily", "theme"] as SettingField[]).map((f) => `<label><input type="checkbox" data-need="${f}">${{ fontSizePx: "Text size", lineHeight: "Line spacing", fontFamily: "Font", theme: "Colors" }[f as "fontSizePx"]}</label>`).join("")}</div>
    </fieldset>
  </details>
  <details><summary>Why these options?</summary>
    <p class="note">No single setting is best for everyone. These controls start from common defaults (about 65 characters per line, 18px text, 1.5 line spacing) and let you change them. Evidence: C-BASE-001, C-BASE-002, C-BASE-004, C-ADAPT-001.</p>
    <p class="note">Preferring a setting is useful information, but it is not proof that it makes reading faster or easier to understand (C-OUT-002). Dark and light themes suit different people (C-THEME-005, C-THEME-006).</p>
  </details>
  <div class="actions">
    <button type="button" id="${i("reset")}">Reset</button>
    <button type="button" id="${i("export")}">Save profile file</button>
    <label><span class="sr">Load profile file</span><input type="file" id="${i("import")}" accept="application/json,.json" aria-label="Load profile file"></label>
    <button type="button" id="${i("share")}">Copy share code</button>
  </div>
  <div class="row"><label for="${i("code")}">Share code</label><input type="text" id="${i("code")}" placeholder="rl1.…" spellcheck="false"><button type="button" id="${i("apply-code")}">Apply code</button></div>
  <p class="note">Settings stay on this device. Share codes and profile files contain settings only, never what you read.</p>
  <p class="sr" role="status" aria-live="polite" id="${i("status")}"></p>
</section>`;
    this.bind();
  }

  private $(name: string) {
    return this.root.getElementById(this.fid(name)) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null;
  }

  private status(msg: string) {
    const s = this.$("status");
    if (s) s.textContent = msg;
  }

  private bind() {
    const p = () => this.prefs!;
    for (const input of Array.from(this.root.querySelectorAll<HTMLInputElement>("input[type=range]"))) {
      input.addEventListener("input", () => {
        const f = input.dataset.field as SettingField;
        const v = Number(input.value);
        if (f === "measure") {
          (this.$("fullwidth") as HTMLInputElement).checked = false;
          p().set({ measure: { value: v, unit: "cpl" } });
        } else p().set({ [f]: v } as TypographySettings);
      });
    }
    this.$("enabled")!.addEventListener("change", (e) => {
      p().setEnabled((e.target as HTMLInputElement).checked);
      this.status((e.target as HTMLInputElement).checked ? "Reading settings on" : "Showing the original page");
    });
    this.$("fullwidth")!.addEventListener("change", (e) => {
      if ((e.target as HTMLInputElement).checked) p().set({ measure: { value: 1, unit: "none" } });
      else p().unset("measure");
    });
    for (const r of Array.from(this.root.querySelectorAll<HTMLInputElement>(`input[name="${this.fid("preset")}"]`)))
      r.addEventListener("change", () => {
        p().applyPreset(r.value);
        this.status(`${PRESETS.find((x) => x.id === r.value)?.name} applied`);
      });
    for (const r of Array.from(this.root.querySelectorAll<HTMLInputElement>(`input[name="${this.fid("theme")}"]`)))
      r.addEventListener("change", () => (r.value ? p().set({ theme: THEMES[r.value as keyof typeof THEMES] }) : p().unset("theme")));
    this.$("font")!.addEventListener("change", (e) => {
      const opt = FONT_OPTIONS.find((f) => f.id === (e.target as HTMLSelectElement).value);
      if (opt?.stack) p().set({ fontFamily: opt.stack });
      else p().unset("fontFamily");
    });
    this.$("weight")!.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v) p().set({ fontWeight: Number(v) });
      else p().unset("fontWeight");
    });
    this.$("align")!.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v) p().set({ textAlign: v as "start" | "justify" });
      else p().unset("textAlign");
    });
    for (const c of Array.from(this.root.querySelectorAll<HTMLInputElement>("input[data-need]"))) c.addEventListener("change", () => p().setNeed(c.dataset.need as SettingField, c.checked));
    this.$("reset")!.addEventListener("click", () => {
      p().reset();
      this.status("Settings reset to the page defaults");
    });
    this.$("export")!.addEventListener("click", () => {
      const blob = new Blob([p().exportJson()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "reading-profile.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.status("Profile file saved");
    });
    this.$("import")!.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        p().importJson(await file.text());
        this.status("Profile loaded");
      } catch (err) {
        this.status(`Could not load profile: ${(err as Error).message}`);
      }
    });
    this.$("share")!.addEventListener("click", async () => {
      const code = p().shareCode();
      (this.$("code") as HTMLInputElement).value = code;
      try {
        await navigator.clipboard.writeText(code);
        this.status("Share code copied");
      } catch {
        this.status("Share code shown in the field");
      }
    });
    this.$("apply-code")!.addEventListener("click", () => {
      try {
        p().applyShareCode((this.$("code") as HTMLInputElement).value);
        this.status("Share code applied");
      } catch (err) {
        this.status(`Could not apply code: ${(err as Error).message}`);
      }
    });
  }

  private sync(s: PreferencesState) {
    const eff = s.resolution.settings;
    const setRange = (f: string, v: number | undefined, fmt: (n: number) => string) => {
      const el = this.root.querySelector<HTMLInputElement>(`input[data-field="${f}"]`);
      const out = this.$(`${f}-out`);
      if (!el || !out) return;
      if (v === undefined) {
        out.textContent = "page default";
        return;
      }
      el.value = String(v);
      out.textContent = fmt(v);
    };
    setRange("fontSizePx", eff.fontSizePx, (n) => `${n}px`);
    setRange("lineHeight", eff.lineHeight, (n) => n.toFixed(2));
    const m = eff.measure;
    setRange("measure", m && m.unit === "cpl" ? m.value : undefined, (n) => `about ${n} characters`);
    if (m?.unit === "none") this.$("measure-out")!.textContent = "full width";
    (this.$("fullwidth") as HTMLInputElement).checked = m?.unit === "none";
    setRange("paragraphGapEm", eff.paragraphGapEm, (n) => `${n.toFixed(2)}× text size`);
    setRange("letterSpacingEm", eff.letterSpacingEm, (n) => (n === 0 ? "font default" : `${n.toFixed(2)} em`));
    setRange("wordSpacingEm", eff.wordSpacingEm, (n) => (n === 0 ? "font default" : `${n.toFixed(2)} em`));
    for (const r of Array.from(this.root.querySelectorAll<HTMLInputElement>(`input[name="${this.fid("preset")}"]`))) r.checked = s.profile.presetId === r.value;
    for (const r of Array.from(this.root.querySelectorAll<HTMLInputElement>(`input[name="${this.fid("theme")}"]`))) r.checked = (eff.theme?.name ?? "") === (r.value === "high-contrast" ? "high-contrast" : r.value);
    (this.$("font") as HTMLSelectElement).value = FONT_OPTIONS.find((f) => f.stack === eff.fontFamily)?.id ?? "";
    (this.$("weight") as HTMLSelectElement).value = eff.fontWeight ? String(eff.fontWeight) : "";
    (this.$("align") as HTMLSelectElement).value = eff.textAlign ?? "";
    for (const c of Array.from(this.root.querySelectorAll<HTMLInputElement>("input[data-need]"))) c.checked = s.profile.needs.includes(c.dataset.need as SettingField);
    (this.$("enabled") as HTMLInputElement).checked = s.enabled;
  }
}

export function defineReadingControls(tag = "rl-reading-controls") {
  if (!customElements.get(tag)) customElements.define(tag, ReadingControlsElement);
}
