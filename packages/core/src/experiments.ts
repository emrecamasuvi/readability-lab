import type { ExperimentCondition, Passage, PerformanceExperiment, PreferenceSession, Trial } from "./schemas/experiment.js";

/** Deterministic PRNG so schedules are reproducible from their seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Balanced Latin square (Williams design) row `r` for `n` conditions. */
export function williamsRow(n: number, r: number): number[] {
  const row: number[] = [];
  for (let i = 0, j = 0, h = 0; i < n; i++) {
    let v: number;
    if (i < 2 || i % 2 !== 0) v = j++;
    else v = n - ++h;
    row.push((v + r) % n);
  }
  if (n % 2 !== 0 && r % 2 !== 0) row.reverse();
  return row;
}

/* ------------------------------------------------------------------ */
/* Preference exploration                                               */
/* ------------------------------------------------------------------ */

/** All unordered pairs, shuffled, with sides randomised. */
export function preferencePairs(conditions: ExperimentCondition[], seed: number): { left: string; right: string }[] {
  const rand = mulberry32(seed);
  const pairs: { left: string; right: string }[] = [];
  for (let i = 0; i < conditions.length; i++)
    for (let j = i + 1; j < conditions.length; j++) {
      const swap = rand() < 0.5;
      pairs.push({ left: conditions[swap ? j : i]!.id, right: conditions[swap ? i : j]!.id });
    }
  return shuffle(pairs, rand);
}

export interface PreferenceSummary {
  kind: "preference";
  validAs: "preference only";
  wins: Record<string, number>;
  ties: number;
  comparisons: number;
  mostPreferred: string[] | null;
  note: string;
}

export function summarizePreferences(s: PreferenceSession): PreferenceSummary {
  const wins: Record<string, number> = Object.fromEntries(s.conditions.map((c) => [c.id, 0]));
  let ties = 0;
  for (const c of s.comparisons) {
    if (c.choice === "no-preference") ties++;
    else wins[c.choice === "left" ? c.left : c.right]! += 1;
  }
  const max = Math.max(...Object.values(wins));
  const top = Object.keys(wins).filter((k) => wins[k] === max);
  return {
    kind: "preference",
    validAs: "preference only",
    wins,
    ties,
    comparisons: s.comparisons.length,
    mostPreferred: s.comparisons.length && max > 0 ? top : null,
    note: "This records what you preferred looking at the same text. Preference is not a measure of reading speed or comprehension.",
  };
}

/* ------------------------------------------------------------------ */
/* Reading-performance experiments                                      */
/* ------------------------------------------------------------------ */

/**
 * Exploration schedule: each condition gets `perCondition` fresh passages; order is
 * counterbalanced with a Williams row chosen by seed, passages randomly assigned.
 * Remaining passages are held out for confirmation.
 */
export function planExploration(input: {
  id: string;
  seed: number;
  conditions: ExperimentCondition[];
  passages: Passage[];
  perCondition?: number;
  holdOut?: number;
}): PerformanceExperiment {
  const per = input.perCondition ?? 2;
  const holdOut = input.holdOut ?? 4;
  const needed = input.conditions.length * per + holdOut;
  if (input.passages.length < needed)
    throw new Error(`Need at least ${needed} distinct passages (${per} per condition + ${holdOut} held out); got ${input.passages.length}. Never reuse a passage across conditions.`);
  const rand = mulberry32(input.seed);
  const passages = shuffle(input.passages, rand);
  const schedule: PerformanceExperiment["schedule"] = [];
  let p = 0;
  for (let round = 0; round < per; round++) {
    const order = williamsRow(input.conditions.length, Math.floor(rand() * input.conditions.length * 2));
    for (const ci of order) schedule.push({ session: 1, conditionId: input.conditions[ci]!.id, passageId: passages[p++]!.id, phase: "exploration" });
  }
  return {
    format: "readability-lab/performance-experiment",
    formatVersion: 1,
    id: input.id,
    createdAt: new Date().toISOString(),
    seed: input.seed,
    design: "latin-square",
    conditions: input.conditions,
    passages: input.passages,
    schedule,
    trials: [],
    environment: { device: null, viewport: null, viewingDistanceCm: null },
  };
}

export interface ConditionStats {
  conditionId: string;
  trials: number;
  medianWpm: number | null;
  comprehension: number | null;
  meanComfort: number | null;
  interruptions: number;
}

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function usable(t: Trial): boolean {
  if (t.excluded || t.activeReadingMs === null || t.activeReadingMs <= 0) return false;
  const interrupted = t.interruptions.reduce((s, i) => s + i.durationMs, 0);
  return interrupted <= t.activeReadingMs * 0.1;
}

export function conditionStats(exp: PerformanceExperiment, phase: "exploration" | "confirmation"): ConditionStats[] {
  return exp.conditions.map((c) => {
    const ts = exp.trials.filter((t) => {
      const slot = exp.schedule[t.slot];
      return slot && slot.phase === phase && slot.conditionId === c.id && usable(t);
    });
    const words = (t: Trial) => exp.passages.find((p) => p.id === exp.schedule[t.slot]!.passageId)?.words ?? 0;
    const wpm = ts.map((t) => words(t) / (t.activeReadingMs! / 60000));
    const comp = ts.filter((t) => t.comprehension && t.comprehension.total > 0);
    const comf = ts.filter((t) => t.comfort !== null);
    return {
      conditionId: c.id,
      trials: ts.length,
      medianWpm: wpm.length ? Math.round(median(wpm)!) : null,
      comprehension: comp.length ? comp.reduce((s, t) => s + t.comprehension!.correct, 0) / comp.reduce((s, t) => s + t.comprehension!.total, 0) : null,
      meanComfort: comf.length ? Math.round((comf.reduce((s, t) => s + t.comfort!, 0) / comf.length) * 10) / 10 : null,
      interruptions: exp.trials.filter((t) => exp.schedule[t.slot]?.conditionId === c.id).reduce((s, t) => s + t.interruptions.length, 0),
    };
  });
}

/** Add a later-session confirmation phase for the two fastest exploration conditions using held-out passages. */
export function planConfirmation(exp: PerformanceExperiment, perCondition = 2): PerformanceExperiment {
  const stats = conditionStats(exp, "exploration").filter((s) => s.medianWpm !== null).sort((a, b) => b.medianWpm! - a.medianWpm!);
  if (stats.length < 2) throw new Error("Need usable exploration trials for at least two conditions before planning confirmation.");
  const used = new Set(exp.schedule.map((s) => s.passageId));
  const heldOut = exp.passages.filter((p) => !used.has(p.id));
  if (heldOut.length < perCondition * 2) throw new Error("Not enough held-out passages for confirmation.");
  const rand = mulberry32(exp.seed + 1);
  const pool = shuffle(heldOut, rand);
  const pair = [stats[0]!.conditionId, stats[1]!.conditionId];
  const schedule = [...exp.schedule];
  let p = 0;
  for (let i = 0; i < perCondition; i++) {
    const order = i % 2 === 0 ? pair : [...pair].reverse();
    for (const c of order) schedule.push({ session: 2, conditionId: c, passageId: pool[p++]!.id, phase: "confirmation" });
  }
  return { ...exp, schedule };
}

export interface PerformanceVerdict {
  verdict: "inconclusive" | "consistent-personal-difference";
  speed: { exploration: ConditionStats[]; confirmation: ConditionStats[] };
  leader: string | null;
  reasons: string[];
  disclaimer: string;
}

/**
 * Speed, comprehension and comfort stay separate. A personal difference is reported only
 * when the same condition leads in exploration AND on held-out passages in a later session,
 * by at least `minSpeedRatio`, without lower comprehension. Otherwise: inconclusive.
 */
export function analyzePerformance(exp: PerformanceExperiment, opts: { minSpeedRatio?: number; maxComprehensionDrop?: number } = {}): PerformanceVerdict {
  const minRatio = opts.minSpeedRatio ?? 1.05;
  const maxDrop = opts.maxComprehensionDrop ?? 0.1;
  const exploration = conditionStats(exp, "exploration");
  const confirmation = conditionStats(exp, "confirmation");
  const reasons: string[] = [];
  const disclaimer = "These results describe your readings of these passages under these conditions. They are not an optimal setting, a diagnosis, or evidence about other readers.";
  const ranked = exploration.filter((s) => s.medianWpm !== null).sort((a, b) => b.medianWpm! - a.medianWpm!);
  if (ranked.length < 2) return { verdict: "inconclusive", speed: { exploration, confirmation }, leader: null, reasons: ["Fewer than two conditions have usable exploration trials."], disclaimer };
  const leader = ranked[0]!.conditionId;
  const runner = ranked[1]!.conditionId;
  const cl = confirmation.find((s) => s.conditionId === leader);
  const cr = confirmation.find((s) => s.conditionId === runner);
  if (!cl?.medianWpm || !cr?.medianWpm || cl.trials < 1 || cr.trials < 1) {
    reasons.push("No held-out confirmation trials in a later session yet.");
    return { verdict: "inconclusive", speed: { exploration, confirmation }, leader, reasons, disclaimer };
  }
  if (cl.medianWpm < cr.medianWpm * minRatio) reasons.push(`The exploration leader was not at least ${Math.round((minRatio - 1) * 100)}% faster on held-out passages.`);
  if (cl.comprehension !== null && cr.comprehension !== null && cl.comprehension < cr.comprehension - maxDrop) reasons.push("Comprehension was lower for the faster condition.");
  if (cl.comprehension === null) reasons.push("Comprehension was not recorded for confirmation trials.");
  return { verdict: reasons.length ? "inconclusive" : "consistent-personal-difference", speed: { exploration, confirmation }, leader, reasons, disclaimer };
}
