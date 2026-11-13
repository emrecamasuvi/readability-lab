import { evaluate, KIND_LABELS, METRICS, type Distribution, type Finding, type Observation } from "@camasuvi/readability-lab-core";
import type { PaneMeasurement } from "./frame.js";

const get = (obs: Observation[], m: string) => obs.find((o) => o.metric === m && o.scenarioId === "baseline");
const num = (o: Observation | undefined, d = 1) => (o && typeof o.value === "number" ? (Math.round(o.value * 10 ** d) / 10 ** d).toString() : "—");

export function Histogram({ dist, label, target }: { dist: Distribution; label: string; target?: number | null }) {
  const bins = dist.histogram;
  if (!bins.length) return <p class="hint">No full lines to chart.</p>;
  const max = Math.max(...bins.map((b) => b.count));
  const w = 280;
  const h = 90;
  const bw = w / bins.length;
  const lo = bins[0]!.from;
  const hi = bins[bins.length - 1]!.to;
  const x = (v: number) => ((v - lo) / (hi - lo)) * w;
  return (
    <figure class="hist">
      <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={`${label}: ${bins.map((b) => `${b.from}–${b.to}: ${b.count} lines`).join(", ")}`}>
        {bins.map((b, i) => (
          <rect x={i * bw + 1} y={h - (b.count / max) * h} width={Math.max(1, bw - 2)} height={(b.count / max) * h} class="bar" />
        ))}
        {target && target >= lo && target <= hi ? <line x1={x(target)} x2={x(target)} y1={0} y2={h} class="target" /> : null}
        <text x={0} y={h + 14} class="axis">{lo}</text>
        <text x={w} y={h + 14} class="axis" text-anchor="end">{hi}</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function Metrics({ m, viewportWidth, target, blind, index }: { m: PaneMeasurement | null; viewportWidth: number; target: number | null; blind: boolean; index: number }) {
  if (!m) return <p class="hint">Measuring…</p>;
  if (m.regionError) return <p class="error" role="alert">Measurement failed: {m.regionError}</p>;
  const o = m.observations;
  const cpl = get(o, METRICS.cpl);
  const contrasts = o.filter((x) => x.metric === METRICS.contrastSample);
  const measured = contrasts.filter((c) => c.status === "measured" && typeof c.value === "number").map((c) => c.value as number);
  const findings: Finding[] = evaluate({ observations: o, scenarios: [{ id: "baseline", label: "Baseline", kind: "baseline", fidelity: "real-browser", description: "workbench preview", viewport: null, appliedCss: null }], viewportWidth });
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  const rendered = get(o, METRICS.fontRendered);
  const script = get(o, METRICS.script);
  const rows: [string, string, string][] = [
    ["Median characters per line", cpl?.distribution ? `${num(cpl, 0)} (p10 ${cpl.distribution.p10 ?? "—"}, p90 ${cpl.distribution.p90 ?? "—"})` : "unknown", "measured from rendered lines"],
    ["Lines", num(get(o, METRICS.lineCount), 0), "includes paragraph-final lines"],
    ["Content height", `${num(get(o, METRICS.contentHeightPx), 0)} px`, "reading region"],
    ["Column width", `${num(get(o, METRICS.columnWidthPx), 0)} px`, ""],
    ["Font size (nominal)", `${num(get(o, METRICS.fontSizePx))} px`, "computed style"],
    ["Rendered x-height", `${num(get(o, METRICS.xHeightPx), 2)} px`, "apparent size depends on viewing distance too"],
    ["Line height", num(get(o, METRICS.lineHeightRatio), 2), get(o, METRICS.lineHeightRatio)?.status ?? ""],
    ["Paragraph gap", `${num(get(o, METRICS.paragraphGapEm), 2)}× size`, ""],
    ["Font in use", blind ? `Font ${index} (hidden)` : String(rendered?.value ?? "unknown"), rendered?.status === "estimated" ? "estimate" : ""],
    ["Lowest measured contrast", measured.length ? `${Math.min(...measured).toFixed(2)}:1` : "unknown", contrasts.some((c) => c.status !== "measured") ? `${contrasts.filter((c) => c.status !== "measured").length} unresolved` : ""],
    ["Clipped text", String(o.filter((x) => x.metric === METRICS.clipped).length), "elements"],
    ["Horizontal page overflow", get(o, METRICS.pageHorizontalOverflow)?.value ? "yes" : "no", ""],
    ["Script", String(script?.value ?? "unknown"), ""],
  ];
  return (
    <div class="metrics">
      {cpl?.distribution ? <Histogram dist={cpl.distribution} label="Characters per line (full lines)" target={target} /> : null}
      <table>
        <tbody>
          {rows.map(([k, v, n]) => (
            <tr>
              <th scope="row">{k}</th>
              <td>{v}</td>
              <td class="hint">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>
          Findings: {Object.entries(counts).map(([k, v]) => `${KIND_LABELS[k as keyof typeof KIND_LABELS].split(" (")[0]} ${v}`).join(" · ") || "none"}
        </summary>
        <ul class="findings">
          {findings.filter((f) => f.kind !== "pass").map((f) => (
            <li>
              <span class={`kind ${f.kind}`}>{KIND_LABELS[f.kind]}</span> {f.title}
              <div class="hint">{f.reason}</div>
              <div class="hint">Evidence: {f.claimIds.map((c) => <a href={`#/atlas?claim=${c}`}>{c} </a>)}</div>
            </li>
          ))}
        </ul>
      </details>
      {m.fit?.charsPerCh ? <p class="hint">Calibrated: {m.fit.charsPerCh} characters per ch, achieved median {m.fit.achievedMedianCpl} CPL.</p> : null}
    </div>
  );
}
