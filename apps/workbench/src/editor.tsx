import { FONT_STACKS, PRESETS, THEMES, type TypographySettings } from "@camasuvi/readability-lab-core";

export interface PaneConfig {
  /** "original" shows the page as published; "recipe" applies settings. */
  mode: "original" | "recipe";
  settings: TypographySettings;
  presetId: string | null;
}

const FONTS: { id: string; label: string; stack: string | null }[] = [
  { id: "", label: "Page font", stack: null },
  { id: "system-sans", label: "System sans", stack: FONT_STACKS["system-sans"] },
  { id: "system-serif", label: "System serif", stack: FONT_STACKS["system-serif"] },
  { id: "humanist-sans", label: "Humanist sans", stack: FONT_STACKS["humanist-sans"] },
  { id: "slab-serif", label: "Slab serif", stack: FONT_STACKS["slab-serif"] },
  { id: "mono", label: "Monospace", stack: FONT_STACKS.mono },
  { id: "georgia", label: "Georgia", stack: "Georgia, serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana, sans-serif" },
];

export function fontLabel(stack: string | undefined, blind: boolean, index: number): string {
  if (!stack) return "Page font";
  if (blind) return `Font ${index}`;
  return FONTS.find((f) => f.stack === stack)?.label ?? stack.split(",")[0]!.replace(/"/g, "");
}

interface Props {
  id: string;
  label: string;
  value: PaneConfig;
  /** `source` is "preset" when a starting choice was picked (its values replace the current ones). */
  onChange: (v: PaneConfig, source?: "preset" | "field") => void;
  blind: boolean;
  allowOriginal: boolean;
  apparentLocked?: boolean;
}

function Range(p: { id: string; label: string; min: number; max: number; step: number; value: number | undefined; fallback: number; fmt: (n: number) => string; onInput: (n: number) => void; onReset: () => void; disabled?: boolean }) {
  const v = p.value ?? p.fallback;
  return (
    <div class="field">
      <label for={p.id}>{p.label}</label>
      <input id={p.id} type="range" min={p.min} max={p.max} step={p.step} value={v} disabled={p.disabled} onInput={(e) => p.onInput(Number((e.target as HTMLInputElement).value))} />
      <output for={p.id}>{p.value === undefined ? "page default" : p.fmt(v)}</output>
      {p.value !== undefined && !p.disabled ? (
        <button type="button" class="link" onClick={p.onReset} aria-label={`Use page default ${p.label.toLowerCase()}`}>
          reset
        </button>
      ) : null}
    </div>
  );
}

export function SettingsEditor({ id, label, value, onChange, blind, allowOriginal, apparentLocked }: Props) {
  const s = value.settings;
  const set = (patch: TypographySettings) => onChange({ ...value, mode: "recipe", presetId: null, settings: { ...s, ...patch } });
  const unset = (k: keyof TypographySettings) => {
    const next = { ...s };
    delete next[k];
    onChange({ ...value, presetId: null, settings: next });
  };
  const off = value.mode === "original";
  return (
    <fieldset class="editor">
      <legend>{label}</legend>
      {allowOriginal ? (
        <div class="seg" role="radiogroup" aria-label={`${label} presentation`}>
          <label>
            <input type="radio" name={`${id}-mode`} checked={off} onChange={() => onChange({ ...value, mode: "original" })} /> Original page
          </label>
          <label>
            <input type="radio" name={`${id}-mode`} checked={!off} onChange={() => onChange({ ...value, mode: "recipe" })} /> Recipe
          </label>
        </div>
      ) : null}
      <div class="presets" aria-label="Starting choices">
        {PRESETS.map((p) => (
          <button type="button" aria-pressed={value.presetId === p.id} title={`${p.summary} ${p.caveat}`} onClick={() => onChange({ mode: "recipe", presetId: p.id, settings: { ...p.settings, ...(s.theme ? { theme: s.theme } : {}), ...(s.fontFamily ? { fontFamily: s.fontFamily } : {}) } }, "preset")}>
            {p.name}
          </button>
        ))}
      </div>
      <p class="hint">Presets are starting choices, not tested optima.</p>
      <div class="field">
        <label for={`${id}-font`}>Font</label>
        <select id={`${id}-font`} disabled={off} value={FONTS.find((f) => f.stack === s.fontFamily)?.id ?? ""} onChange={(e) => {
          const f = FONTS.find((x) => x.id === (e.target as HTMLSelectElement).value);
          f?.stack ? set({ fontFamily: f.stack }) : unset("fontFamily");
        }}>
          {FONTS.map((f, i) => (
            <option value={f.id}>{blind && f.stack ? `Font ${i}` : f.label}</option>
          ))}
        </select>
      </div>
      <Range id={`${id}-size`} label="Size" min={12} max={32} step={0.5} value={s.fontSizePx} fallback={18} fmt={(n) => `${n}px${apparentLocked ? " (applied, matched to A)" : ""}`} onInput={(n) => set({ fontSizePx: n })} onReset={() => unset("fontSizePx")} disabled={off || apparentLocked} />
      <Range id={`${id}-measure`} label="Line length (target)" min={30} max={110} step={1} value={s.measure?.unit === "cpl" ? s.measure.value : undefined} fallback={65} fmt={(n) => `≈${n} CPL`} onInput={(n) => set({ measure: { value: n, unit: "cpl" } })} onReset={() => unset("measure")} disabled={off} />
      <Range id={`${id}-lh`} label="Line height" min={1} max={2.2} step={0.05} value={s.lineHeight} fallback={1.5} fmt={(n) => n.toFixed(2)} onInput={(n) => set({ lineHeight: n })} onReset={() => unset("lineHeight")} disabled={off} />
      <Range id={`${id}-weight`} label="Weight" min={300} max={700} step={100} value={s.fontWeight} fallback={400} fmt={(n) => String(n)} onInput={(n) => set({ fontWeight: n })} onReset={() => unset("fontWeight")} disabled={off} />
      <Range id={`${id}-gap`} label="Paragraph gap" min={0} max={2} step={0.05} value={s.paragraphGapEm} fallback={0.75} fmt={(n) => `${n.toFixed(2)}× size`} onInput={(n) => set({ paragraphGapEm: n })} onReset={() => unset("paragraphGapEm")} disabled={off} />
      <Range id={`${id}-ls`} label="Letter spacing" min={0} max={0.2} step={0.01} value={s.letterSpacingEm} fallback={0} fmt={(n) => (n ? `${n.toFixed(2)}em` : "font default")} onInput={(n) => set({ letterSpacingEm: n })} onReset={() => unset("letterSpacingEm")} disabled={off} />
      <Range id={`${id}-ws`} label="Word spacing" min={0} max={0.4} step={0.01} value={s.wordSpacingEm} fallback={0} fmt={(n) => (n ? `${n.toFixed(2)}em` : "font default")} onInput={(n) => set({ wordSpacingEm: n })} onReset={() => unset("wordSpacingEm")} disabled={off} />
      <div class="field">
        <label for={`${id}-theme`}>Theme</label>
        <select id={`${id}-theme`} disabled={off} value={s.theme?.name ?? ""} onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value as keyof typeof THEMES | "";
          v ? set({ theme: THEMES[v] }) : unset("theme");
        }}>
          <option value="">Page colors</option>
          <option value="light">Light</option>
          <option value="sepia">Sepia</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High contrast</option>
        </select>
      </div>
      <div class="field">
        <label for={`${id}-align`}>Alignment</label>
        <select id={`${id}-align`} disabled={off} value={s.textAlign ?? ""} onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          v ? set({ textAlign: v as "start" | "justify" }) : unset("textAlign");
        }}>
          <option value="">Page alignment</option>
          <option value="start">Start (ragged)</option>
          <option value="justify">Justified</option>
        </select>
      </div>
    </fieldset>
  );
}
