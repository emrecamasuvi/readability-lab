import { FONT_STACKS, preferencePairs, summarizePreferences, type ExperimentCondition, type PreferenceSession } from "@emrecamasuvi/readability-lab-core";
import { useMemo, useState } from "preact/hooks";
import { download } from "./exports.js";

const SAMPLE_TEXT = "Most of what we read now arrives in a rectangle of light. The rectangle changes size from one moment to the next: a phone held in one hand on a train, a laptop balanced on a kitchen table, a large monitor at work. Text has to survive all of these, and the people reading it bring their own eyes, habits, and patience to each one.";

const CANDIDATES: ExperimentCondition[] = [
  { id: "sans", label: "System sans", concealedLabel: "", settings: { fontFamily: FONT_STACKS["system-sans"], fontSizePx: 18, lineHeight: 1.5 } },
  { id: "serif", label: "System serif", concealedLabel: "", settings: { fontFamily: FONT_STACKS["system-serif"], fontSizePx: 18, lineHeight: 1.5 } },
  { id: "humanist", label: "Humanist sans", concealedLabel: "", settings: { fontFamily: FONT_STACKS["humanist-sans"], fontSizePx: 18, lineHeight: 1.5 } },
  { id: "lh16", label: "System serif, 1.6 line height", concealedLabel: "", settings: { fontFamily: FONT_STACKS["system-serif"], fontSizePx: 18, lineHeight: 1.6 } },
];

function store(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* memory only */
  }
}

function Specimen({ c }: { c: ExperimentCondition }) {
  const s = c.settings;
  return (
    <p class="specimen" style={{ fontFamily: s.fontFamily, fontSize: `${s.fontSizePx}px`, lineHeight: String(s.lineHeight), maxWidth: "34em" }}>
      {SAMPLE_TEXT}
    </p>
  );
}

export function Explore() {
  const [chosen, setChosen] = useState<string[]>(["sans", "serif", "humanist"]);
  const [session, setSession] = useState<PreferenceSession | null>(null);
  const [step, setStep] = useState(0);
  const conditions = useMemo(() => {
    const seedLabels = ["K", "M", "R", "T"];
    return CANDIDATES.filter((c) => chosen.includes(c.id)).map((c, i) => ({ ...c, concealedLabel: `Option ${seedLabels[i]}` }));
  }, [chosen]);
  const pairs = useMemo(() => (session ? preferencePairs(session.conditions, session.seed) : []), [session?.id]);
  const start = () => {
    const seed = Math.floor(Math.random() * 1e6);
    setSession({ format: "readability-lab/preference-session", formatVersion: 1, id: `pref-${Date.now()}`, createdAt: new Date().toISOString(), seed, concealFontNames: true, sampleId: "explore-paragraph", conditions, comparisons: [] });
    setStep(0);
  };
  const choose = (choice: "left" | "right" | "no-preference") => {
    if (!session) return;
    const p = pairs[step]!;
    const next = { ...session, comparisons: [...session.comparisons, { ...p, choice, at: new Date().toISOString() }] };
    setSession(next);
    store("rl-wb-explore", next);
    setStep(step + 1);
  };
  const done = session && step >= pairs.length;
  const summary = done ? summarizePreferences(session!) : null;
  const byId = (id: string) => session!.conditions.find((c) => c.id === id)!;
  return (
    <div class="explore">
      <h1>Explore what you prefer</h1>
      <div class="two">
        <section>
          <h2>Quick preference exploration</h2>
          <p>Compare short specimens side by side, with font names hidden. The result is a record of your preference on this text. It is useful for choosing what to try, but it does not show what you read faster or understand better.</p>
          {!session || done ? (
            <>
              <fieldset class="seg">
                <legend>Candidates (2–4)</legend>
                {CANDIDATES.map((c) => (
                  <label>
                    <input type="checkbox" checked={chosen.includes(c.id)} onChange={(e) => setChosen((e.target as HTMLInputElement).checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))} /> {c.label}
                  </label>
                ))}
              </fieldset>
              <button type="button" disabled={chosen.length < 2 || chosen.length > 4} onClick={start}>
                Start ({(chosen.length * (chosen.length - 1)) / 2} comparisons)
              </button>
            </>
          ) : (
            <div aria-live="polite">
              <p class="hint">
                Comparison {step + 1} of {pairs.length}
              </p>
              <div class="pair">
                {(["left", "right"] as const).map((side) => (
                  <figure>
                    <Specimen c={byId(pairs[step]![side])} />
                    <figcaption>
                      <button type="button" onClick={() => choose(side)}>Prefer {byId(pairs[step]![side]).concealedLabel}</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <button type="button" class="link" onClick={() => choose("no-preference")}>No preference</button>
            </div>
          )}
          {summary ? (
            <div class="result" role="status">
              <h3>Your preferences (preference only)</h3>
              <ul>
                {session!.conditions.map((c) => (
                  <li>
                    {c.concealedLabel} = {c.label}: chosen {summary.wins[c.id]} time(s)
                  </li>
                ))}
              </ul>
              <p class="hint">{summary.note}</p>
              <button type="button" onClick={() => download(`${session!.id}.json`, JSON.stringify(session, null, 2))}>Export session</button>
            </div>
          ) : null}
        </section>
        <section>
          <h2>Reading-performance experiments</h2>
          <p>
            Measuring speed or comprehension needs <strong>fresh passages</strong> for every condition, a counterbalanced order, comprehension questions, comfort ratings, recorded interruptions, and confirmation on held-out passages in a later session. A single fast trial is not a personal optimum, and results do not apply to other people.
          </p>
          <p>
            The data model and analysis (Latin-square scheduling, held-out confirmation, an explicit “inconclusive” outcome) are in <code>@emrecamasuvi/readability-lab-core</code>. The guided reading interface is planned for a later release and needs a set of licensed passages with questions; see the roadmap.
          </p>
          <p class="hint">Results would stay in this browser unless you export them.</p>
        </section>
      </div>
    </div>
  );
}
