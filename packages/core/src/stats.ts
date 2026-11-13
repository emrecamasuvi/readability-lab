import type { Distribution } from "./schemas/report.js";

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const round = (n: number | null, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Summarise numeric values. Empty input yields nulls, never zeros. */
export function summarize(values: number[], binWidth = 5): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const histogram: Distribution["histogram"] = [];
  if (n > 0) {
    const start = Math.floor(sorted[0]! / binWidth) * binWidth;
    const end = Math.floor(sorted[n - 1]! / binWidth) * binWidth;
    for (let from = start; from <= end; from += binWidth) {
      histogram.push({ from, to: from + binWidth, count: sorted.filter((v) => v >= from && v < from + binWidth).length });
    }
  }
  return {
    count: n,
    min: n ? sorted[0]! : null,
    p10: round(quantile(sorted, 0.1)),
    median: round(quantile(sorted, 0.5)),
    mean: n ? round(sorted.reduce((s, v) => s + v, 0) / n) : null,
    p90: round(quantile(sorted, 0.9)),
    max: n ? sorted[n - 1]! : null,
    histogram,
  };
}

export { round };
