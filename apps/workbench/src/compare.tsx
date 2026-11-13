import { decodeSettings, encodeSettings, getPreset, summarizePreferences, type PreferenceSession, type TypographySettings } from "@camasuvi/readability-lab-core";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { fontLabel, SettingsEditor, type PaneConfig } from "./editor.js";
import { buildRecipe, cliCommand, download, exportAll } from "./exports.js";
import { applyAndMeasure, DEVICES, PREVIEW_SANDBOX, withCsp, type Device, type PaneMeasurement } from "./frame.js";
import { Metrics } from "./metrics.js";
import { SAMPLES, safeSetHTML, sampleFromHtmlFile, sampleFromMarkdown, type Sample } from "./samples.js";

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function describe(s: TypographySettings | null, original: boolean): string {
  if (original || !s || !Object.keys(s).length) return "Original page";
  const parts = [s.fontFamily ? s.fontFamily.split(",")[0]!.replace(/"/g, "") : null, s.fontSizePx ? `${s.fontSizePx}px` : null, s.lineHeight ? `lh ${s.lineHeight}` : null, s.measure?.unit === "cpl" ? `≈${s.measure.value} CPL` : null, s.theme ? s.theme.name : null].filter(Boolean);
  return parts.join(", ") || "Recipe";
}

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode: keep in memory only */
    }
  },
};

function Pane(props: { sample: Sample; device: Device; settings: TypographySettings | null; textSpacing: boolean; label: string; onMeasure: (m: PaneMeasurement) => void; testId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [frameLoads, setFrameLoads] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [scale, setScale] = useState(1);
  const doc = useMemo(() => withCsp(props.sample.html), [props.sample.html]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / props.device.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.device.width]);
  // Pasted and imported text shares one trusted shell, so the frame does not reload when the
  // text changes: insert the sanitized body whenever the frame loads or the text is replaced.
  useEffect(() => {
    const win = frame.current?.contentWindow;
    if (!win || !frameLoads) return;
    let cancelled = false;
    (async () => {
      if (props.sample.untrustedBody !== undefined) {
        const target = win.document.querySelector(props.sample.region);
        if (target) await safeSetHTML(target, props.sample.untrustedBody);
      }
      if (!cancelled) setLoaded((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [frameLoads, props.sample.untrustedBody, props.sample.region]);
  useEffect(() => {
    const win = frame.current?.contentWindow;
    if (!win || !loaded) return;
    let cancelled = false;
    // Wait for layout at the new size before measuring.
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        try {
          const m = await applyAndMeasure(win, props.sample.region, props.settings, { textSpacing: props.textSpacing });
          if (!cancelled) props.onMeasure(m);
        } catch (e) {
          if (!cancelled) props.onMeasure({ observations: [], regionError: (e as Error).message, regionSelector: props.sample.region, fit: null, xHeightRatio: null, timingMs: 0 });
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [loaded, JSON.stringify(props.settings), props.textSpacing, props.device.id]);
  return (
    <div class="pane-frame" ref={box} style={{ height: `${Math.round(props.device.height * scale) + 2}px` }}>
      <iframe
        ref={frame}
        title={`${props.label} preview`}
        data-testid={props.testId}
        srcdoc={doc}
        sandbox={PREVIEW_SANDBOX}
        width={props.device.width}
        height={props.device.height}
        style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}
        onLoad={() => setFrameLoads((n) => n + 1)}
      />
    </div>
  );
}

function readHash(): URLSearchParams {
  const q = location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q);
}

function initialPane(code: string | null, fallbackPreset: string | null, mode: PaneConfig["mode"]): PaneConfig {
  if (code) {
    try {
      return { mode: "recipe", settings: decodeSettings(code), presetId: null };
    } catch {
      /* fall through */
    }
  }
  const p = fallbackPreset ? getPreset(fallbackPreset) : undefined;
  return { mode, settings: p ? { ...p.settings } : {}, presetId: p?.id ?? null };
}

export function Compare() {
  const q = readHash();
  const [custom, setCustom] = useState<Sample | null>(null);
  const [sampleId, setSampleId] = useState(q.get("s") ?? "article");
  const [deviceId, setDeviceId] = useState<Device["id"]>((q.get("d") as Device["id"]) ?? "desktop");
  const [a, setA] = useState<PaneConfig>(initialPane(q.get("a"), null, q.get("a") ? "recipe" : "original"));
  const [b, setB] = useState<PaneConfig>(initialPane(q.get("b"), "balanced", "recipe"));
  const [blind, setBlind] = useState(q.get("blind") === "1");
  const [matchApparent, setMatchApparent] = useState(q.get("m") === "1");
  const [textSpacing, setTextSpacing] = useState(q.get("ts") === "1");
  const [ma, setMa] = useState<PaneMeasurement | null>(null);
  const [mb, setMb] = useState<PaneMeasurement | null>(null);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("");
  const [prefs, setPrefs] = useState<PreferenceSession | null>(() => store.get<PreferenceSession | null>("rl-wb-prefs", null));

  const sample = sampleId === custom?.id && custom ? custom : SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!;
  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0]!;

  const aX = ma?.observations.find((o) => o.metric === "font.xHeightPx")?.value;
  const bSettings: TypographySettings = useMemo(() => {
    if (b.mode === "original") return {};
    if (matchApparent && typeof aX === "number" && mb?.xHeightRatio) return { ...b.settings, fontSizePx: Math.round((aX / mb.xHeightRatio) * 10) / 10 };
    return b.settings;
  }, [b, matchApparent, aX, mb?.xHeightRatio]);
  const aSettings = a.mode === "original" ? null : a.settings;

  useEffect(() => {
    const params = new URLSearchParams();
    if (sample.id !== "pasted" && sample.id !== "local") params.set("s", sample.id);
    params.set("d", device.id);
    if (a.mode === "recipe" && Object.keys(a.settings).length) params.set("a", encodeSettings(a.settings));
    if (b.mode === "recipe" && Object.keys(b.settings).length) params.set("b", encodeSettings(b.settings));
    if (blind) params.set("blind", "1");
    if (matchApparent) params.set("m", "1");
    if (textSpacing) params.set("ts", "1");
    history.replaceState(null, "", `#/compare?${params.toString()}`);
  }, [sample.id, device.id, JSON.stringify(a), JSON.stringify(b), blind, matchApparent, textSpacing]);

  const nameA = blind ? "Option 1" : a.mode === "original" ? "Original" : "Recipe A";
  const nameB = blind ? "Option 2" : "Recipe B";

  // Identity covers the text actually shown (pasted text lives in untrustedBody, not in the shell) and its region.
  const contentKey = `${sample.id}:${hash(`${sample.html}\u0000${sample.untrustedBody ?? ""}\u0000${sample.region}`)}`;
  const recordPreference = (choice: "left" | "right" | "no-preference") => {
    // Conditions are immutable: their id is a hash of the exact settings shown, so a later
    // edit creates a new condition instead of rewriting earlier votes.
    // Identity covers everything that changes what was seen: settings, device and spacing overrides.
    const cond = (settings: TypographySettings, original: boolean) => {
      const viewing = `${device.id}${textSpacing ? ", WCAG 1.4.12 spacing" : ""}`;
      return { id: `c-${hash(JSON.stringify({ settings, original, device: device.id, textSpacing }))}`, label: `${describe(settings, original)} · ${viewing}`, concealedLabel: "", settings };
    };
    const condA = cond(aSettings ?? {}, a.mode === "original");
    const condB = cond(bSettings, false);
    const base: PreferenceSession = prefs && prefs.sampleId === contentKey ? prefs : { format: "readability-lab/preference-session", formatVersion: 1, id: `pref-${Date.now()}`, createdAt: new Date().toISOString(), seed: Date.now() % 100000, concealFontNames: blind, sampleId: contentKey, conditions: [], comparisons: [] };
    const conditions = [...base.conditions];
    for (const c of [condA, condB]) if (!conditions.some((x) => x.id === c.id)) conditions.push({ ...c, concealedLabel: `Option ${conditions.length + 1}` });
    const next = { ...base, conditions, comparisons: [...base.comparisons, { left: condA.id, right: condB.id, choice, at: new Date().toISOString() }] };
    setPrefs(next);
    store.set("rl-wb-prefs", next);
    setStatus("Preference recorded (stored in this browser only).");
  };

  const recipeFor = (which: "A" | "B") =>
    buildRecipe({
      name: which === "A" ? "Workbench recipe A" : "Workbench recipe B",
      settings: which === "A" ? aSettings ?? {} : bSettings,
      presetId: which === "A" ? a.presetId : b.presetId,
      region: sample.region,
      measurement: which === "A" ? ma : mb,
      sampleId: sample.id,
      viewport: device,
    });

  const regionDialog = useRef<HTMLDialogElement>(null);
  const regionInput = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<{ name: string; text: string } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const onFile = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const text = await f.text();
    if (/\.md$|\.markdown$|\.txt$/i.test(f.name)) {
      const s = sampleFromMarkdown(text, f.name);
      setCustom(s);
      setSampleId(s.id);
      return;
    }
    // HTML pages: ask for the reading region in a native modal dialog.
    pendingFile.current = { name: f.name, text };
    setPendingName(f.name);
    if (regionInput.current) regionInput.current.value = "";
    regionDialog.current?.showModal();
  };
  const onRegionClose = async () => {
    const dlg = regionDialog.current;
    const file = pendingFile.current;
    const choice = dlg?.returnValue ?? "";
    if (dlg) dlg.returnValue = ""; // Esc sets no value; reset so a stale choice never leaks
    pendingFile.current = null;
    if (!file || choice !== "open") return;
    const s = await sampleFromHtmlFile(file.name, file.text, regionInput.current?.value.trim() || null);
    setCustom(s);
    setSampleId(s.id);
  };

  const prefSummary = prefs && prefs.sampleId === contentKey && prefs.conditions.length >= 2 ? summarizePreferences(prefs) : null;

  return (
    <div class="compare">
      <section class="toolbar" aria-label="Content and conditions">
        <div class="field">
          <label for="sample">Content</label>
          <select id="sample" value={sample.id} onChange={(e) => setSampleId((e.target as HTMLSelectElement).value)}>
            {SAMPLES.map((s) => (
              <option value={s.id}>
                {s.title} — {s.kind}
              </option>
            ))}
            {custom ? <option value={custom.id}>{custom.title}</option> : null}
          </select>
        </div>
        <div class="seg" role="radiogroup" aria-label="Device">
          {DEVICES.map((d) => (
            <label title={d.note}>
              <input type="radio" name="device" checked={d.id === device.id} onChange={() => setDeviceId(d.id)} /> {d.label}
            </label>
          ))}
        </div>
        <label class="check">
          <input type="checkbox" checked={textSpacing} onChange={(e) => setTextSpacing((e.target as HTMLInputElement).checked)} /> WCAG 1.4.12 spacing overrides
        </label>
        <label class="check">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind((e.target as HTMLInputElement).checked)} /> Hide font names
        </label>
        <label class="check">
          <input type="checkbox" checked={matchApparent} onChange={(e) => setMatchApparent((e.target as HTMLInputElement).checked)} /> Match B's apparent size to A (estimate)
        </label>
      </section>
      <p class="banner">
        You are comparing the <strong>same text</strong> side by side. This shows layout consequences and what you prefer to look at; it does not measure reading speed or comprehension. Those need fresh passages — see <a href="#/explore">Explore</a>. {device.id === "zoom200" ? device.note : ""} {sample.note ?? ""}
      </p>
      <details class="paste">
        <summary>Use your own text</summary>
        <label for="paste">Paste prose or Markdown (stays in this browser; never uploaded)</label>
        <textarea id="paste" rows={5} value={paste} onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)} />
        <div class="row">
          <button type="button" onClick={() => {
            if (!paste.trim()) return;
            const s = sampleFromMarkdown(paste);
            setCustom(s);
            setSampleId(s.id);
          }}>
            Preview pasted text
          </button>
          <label class="file">
            Open a local .html or .md file <input type="file" accept=".html,.htm,.md,.markdown,.txt" onChange={onFile} />
          </label>
        </div>
        <p class="hint">Pasted text and local files are sanitized (scripts removed) and rendered without network access. They are never included in share links. Only use text you are allowed to use.</p>
      </details>
      <dialog class="ask" ref={regionDialog} aria-labelledby="region-dialog-title" onClose={onRegionClose}>
        <form method="dialog">
          <h2 id="region-dialog-title">Where is the main text?</h2>
          <p class="hint">CSS selector of the reading region in “{pendingName}”. Leave it empty to detect the region automatically.</p>
          <label for="region-input">Reading region selector</label>
          <input id="region-input" ref={regionInput} name="region" autoFocus placeholder="article, main, .post-content" spellcheck={false} />
          <div class="row">
            <button type="submit" value="cancel" formNoValidate>Cancel</button>
            <button type="submit" value="open">Open file</button>
          </div>
        </form>
      </dialog>
      <div class="panes">
        {[
          { key: "A", name: nameA, cfg: a, set: setA, settings: aSettings, m: ma, setM: setMa, allowOriginal: true, index: 1 },
          { key: "B", name: nameB, cfg: b, set: setB, settings: bSettings, m: mb, setM: setMb, allowOriginal: false, index: 2 },
        ].map((p) => (
          <section class="pane" aria-label={p.name}>
            <h2>
              {p.name}
              {!blind && p.settings?.fontFamily ? <span class="hint"> · {fontLabel(p.settings.fontFamily, blind, p.index)}</span> : null}
            </h2>
            <Pane sample={sample} device={device} settings={p.settings && Object.keys(p.settings).length ? p.settings : null} textSpacing={textSpacing} label={p.name} onMeasure={p.setM} testId={`pane-${p.key}`} />
            <div class="pane-body">
              <SettingsEditor id={`ed-${p.key}`} label={`${p.name} settings`} value={p.key === "B" && matchApparent && bSettings.fontSizePx !== undefined ? { ...p.cfg, settings: { ...p.cfg.settings, fontSizePx: bSettings.fontSizePx } } : p.cfg} onChange={(v, source) => (p.key === "B" && matchApparent && source !== "preset" ? p.set({ ...v, settings: { ...v.settings, fontSizePx: b.settings.fontSizePx } }) : p.set(v))} blind={blind} allowOriginal={p.allowOriginal} apparentLocked={p.key === "B" && matchApparent} />
              <Metrics m={p.m} viewportWidth={device.width} target={p.settings?.measure?.unit === "cpl" ? p.settings.measure.value : null} blind={blind} index={p.index} />
              <div class="exports" role="group" aria-label={`Export ${p.name}`}>
                <button type="button" disabled={!p.settings} onClick={() => exportAll(recipeFor(p.key as "A" | "B"), "recipe")}>Recipe JSON</button>
                <button type="button" disabled={!p.settings} onClick={() => exportAll(recipeFor(p.key as "A" | "B"), "css")}>CSS</button>
                <button type="button" disabled={!p.settings} onClick={() => exportAll(recipeFor(p.key as "A" | "B"), "tokens")}>Design tokens</button>
                <button type="button" disabled={!p.settings} onClick={() => exportAll(recipeFor(p.key as "A" | "B"), "spec")}>Design spec</button>
                <button type="button" disabled={!p.m} onClick={() => download(`measurements-${p.key}.json`, JSON.stringify({ sample: sample.id, device, settings: p.settings, observations: p.m?.observations }, null, 2))}>Measurements</button>
              </div>
              {p.settings ? (
                <details>
                  <summary>Reference screenshots and verification</summary>
                  <p class="hint">Browser-rendered layout is the reference. Generate real-browser screenshots and a report with:</p>
                  <pre class="cmd">{cliCommand(recipeFor(p.key as "A" | "B"), device)}</pre>
                </details>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      <section class="prefbar" aria-label="Record a preference">
        <h2>Which do you prefer to look at?</h2>
        <div class="row">
          <button type="button" onClick={() => recordPreference("left")}>{nameA}</button>
          <button type="button" onClick={() => recordPreference("right")}>{nameB}</button>
          <button type="button" onClick={() => recordPreference("no-preference")}>No preference</button>
          <button type="button" class="link" onClick={() => {
            navigator.clipboard?.writeText(location.href).then(() => setStatus("Share link copied. It contains settings and the sample id only."), () => setStatus("Copy the address bar to share."));
          }}>
            Copy share link
          </button>
        </div>
        {prefSummary ? (
          <div class="hint">
            <p>Preference only, on this text ({prefSummary.comparisons} choice(s), {prefSummary.ties} without preference):</p>
            <ul>
              {prefs!.conditions.map((c) => (
                <li>
                  {blind ? c.concealedLabel : c.label}: chosen {prefSummary.wins[c.id] ?? 0} time(s)
                </li>
              ))}
            </ul>
            <p>{prefSummary.note}</p>
          </div>
        ) : null}
        <p role="status" aria-live="polite" class="hint">{status}</p>
      </section>
    </div>
  );
}
