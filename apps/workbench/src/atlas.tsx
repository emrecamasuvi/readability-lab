import { dependentsOfClaim, getClaim, getRegistry, getSource, NRQI, QUESTIONS, searchClaims, type Claim, type ClaimKind, type OutcomeDomain } from "@emrecamasuvi/readability-lab-core";
import { useEffect, useMemo, useState } from "preact/hooks";

const KIND_TEXT: Record<ClaimKind, string> = {
  normative: "Requirement (WCAG)",
  empirical: "Study finding",
  heuristic: "Heuristic",
  hypothesis: "Hypothesis to test",
};
const OUTCOMES: OutcomeDomain[] = ["reading-speed", "comprehension", "recognition-accuracy", "comfort", "preference", "eye-movements", "legibility", "accessibility-conformance", "layout-geometry", "usability"];

function hashParam(k: string): string | null {
  return new URLSearchParams(location.hash.split("?")[1] ?? "").get(k);
}

function ClaimDetail({ c }: { c: Claim }) {
  const deps = dependentsOfClaim(c.id);
  return (
    <article class="claim-detail" aria-labelledby={`h-${c.id}`}>
      <h2 id={`h-${c.id}`}>
        <span class={`badge ${c.kind}`}>{KIND_TEXT[c.kind]}</span> {c.title}
      </h2>
      <p class="hint">
        {c.id} · revision {c.revision} · evidence strength: {c.evidenceStrength} · status: {c.status}
      </p>
      <p class="plain">{c.plain}</p>
      {c.noReliableQuantitativeImprovement ? <p class="nrqi">{NRQI}</p> : null}
      <h3>Summary</h3>
      <p>{c.statement}</p>
      {c.study ? (
        <>
          <h3>Study details</h3>
          <div class="table-wrap" tabindex={0} role="region" aria-label={`Study details for ${c.id}`}>
          <table>
            <tbody>
              {(["population", "sampleSize", "language", "script", "task", "device", "typography", "comparator"] as const).map((k) => (
                <tr>
                  <th scope="row">{k}</th>
                  <td>{c.study![k] ?? <em>not recorded</em>}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">outcomes</th>
                <td>{c.study.outcomes.join(", ")}</td>
              </tr>
            </tbody>
          </table>
          </div>
          {c.study.estimates.length ? (
            <div class="table-wrap" tabindex={0} role="region" aria-label={`Reported estimates for ${c.id}`}>
            <table>
              <thead>
                <tr>
                  <th>Estimate</th>
                  <th>Value</th>
                  <th>95% CI</th>
                  <th>p</th>
                  <th>Effect</th>
                </tr>
              </thead>
              <tbody>
                {c.study.estimates.map((e) => (
                  <tr>
                    <td>{e.measure}</td>
                    <td>{e.value === null ? <em>missing: {e.missingReason}</em> : `${e.value}${e.unit ? ` ${e.unit}` : ""}`}</td>
                    <td>{e.ci95 ? `${e.ci95[0]} to ${e.ci95[1]}` : "—"}</td>
                    <td>{e.p ?? "—"}</td>
                    <td>{e.effectSize ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : null}
        </>
      ) : null}
      {c.limitations.length ? (
        <>
          <h3>Limitations</h3>
          <ul>{c.limitations.map((l) => <li>{l}</li>)}</ul>
        </>
      ) : null}
      {c.conflictsWith.length ? (
        <p>
          <strong>Conflicting evidence:</strong> {c.conflictsWith.map((id) => <a href={`#/atlas?claim=${id}`}>{id} </a>)}
        </p>
      ) : null}
      {c.relatedClaims.length ? (
        <p>
          <strong>Related:</strong> {c.relatedClaims.map((id) => <a href={`#/atlas?claim=${id}`}>{id} </a>)}
        </p>
      ) : null}
      <p>
        <strong>Scope:</strong> scripts {c.scope.scripts.join(", ") || "—"}
        {c.scope.notApplicableTo.length ? `; not applicable to ${c.scope.notApplicableTo.join(", ")}` : ""}
      </p>
      <h3>Sources</h3>
      <ul>
        {c.sources.map((s) => {
          const src = getSource(s.sourceId);
          if (!src) return <li>{s.sourceId} (missing)</li>;
          const href = src.doi ? `https://doi.org/${src.doi}` : src.url;
          return (
            <li>
              {src.authors.slice(0, 3).join(", ")}
              {src.authors.length > 3 ? " et al." : ""} ({src.year ?? "n.d."}). {href.startsWith("http") ? <a href={href} rel="noreferrer">{src.title}</a> : src.title}
              {src.venue ? `. ${src.venue}` : ""}. <span class={`badge review ${src.review.status}`}>{src.review.status.replace(/-/g, " ")}</span>
              {s.locator ? <span class="hint"> · {s.locator}</span> : null}
              {src.review.notes ? <div class="hint">{src.review.notes}</div> : null}
            </li>
          );
        })}
      </ul>
      <h3>Used by</h3>
      <p class="hint">
        Rules: {deps.rules.join(", ") || "none"} · Presets: {deps.presets.join(", ") || "none"} · Citing claims: {deps.claims.join(", ") || "none"}
      </p>
      <h3>History</h3>
      <ul>
        {c.history.map((h) => (
          <li>
            r{h.revision} {h.date}: {h.change} <span class="hint">({h.reason})</span>
          </li>
        ))}
      </ul>
      <p class="hint">
        Found a problem? Propose a correction or a new study extraction using the evidence forms described in the repository's CONTRIBUTING.md (no code needed). Community submissions are reviewed before they are marked verified.
      </p>
    </article>
  );
}

export function Atlas() {
  const reg = getRegistry();
  const [text, setText] = useState("");
  const [kinds, setKinds] = useState<ClaimKind[]>([]);
  const [outcome, setOutcome] = useState<OutcomeDomain | "">("");
  const [nrqi, setNrqi] = useState(false);
  const [question, setQuestion] = useState<string | null>(hashParam("q"));
  const [selected, setSelected] = useState<string | null>(hashParam("claim"));
  // Cross-links between claims and back/forward change only the hash: follow it.
  useEffect(() => {
    const sync = () => {
      if (!location.hash.startsWith("#/atlas")) return;
      setSelected(hashParam("claim"));
      const asked = hashParam("q");
      if (asked) setQuestion(asked); // a claim link carries no question: keep the current filter
    };
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  const q = QUESTIONS.find((x) => x.id === question);
  const results = useMemo(() => {
    let list = searchClaims({ text, kinds, outcomes: outcome ? [outcome] : undefined, nrqiOnly: nrqi });
    if (q && q.claimIds.length) list = list.filter((c) => q.claimIds.includes(c.id));
    else if (q?.query?.outcomes) list = list.filter((c) => c.outcomes.some((o) => q.query!.outcomes!.includes(o)));
    return list;
  }, [text, kinds, outcome, nrqi, question]);
  const sel = selected ? getClaim(selected) : undefined;
  const verified = reg.sources.filter((s) => s.review.status !== "unverified-secondary").length;
  return (
    <div class="atlas">
      <header>
        <h1>Evidence atlas</h1>
        <p>
          Registry {reg.registryVersion}, checked {reg.checkedOn}: {reg.claims.length} claims from {reg.sources.length} sources ({verified} checked against the original). The tools use these same claim IDs. {reg.synthesis.note}
        </p>
      </header>
      <section aria-label="Start with a question" class="questions">
        {QUESTIONS.map((x) => (
          <button type="button" aria-pressed={question === x.id} onClick={() => {
            setQuestion(question === x.id ? null : x.id);
            if (x.id === "kinds") setKinds([]);
          }}>
            {x.question}
          </button>
        ))}
      </section>
      <section class="filters" aria-label="Filter claims">
        <div class="field">
          <label for="atlas-q">Search</label>
          <input id="atlas-q" type="search" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} placeholder="e.g. line length, dark mode, dyslexia" />
        </div>
        <fieldset class="seg">
          <legend>Kind</legend>
          {(Object.keys(KIND_TEXT) as ClaimKind[]).map((k) => (
            <label>
              <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((e.target as HTMLInputElement).checked ? [...kinds, k] : kinds.filter((x) => x !== k))} /> {KIND_TEXT[k]}
            </label>
          ))}
        </fieldset>
        <div class="field">
          <label for="atlas-o">Outcome</label>
          <select id="atlas-o" value={outcome} onChange={(e) => setOutcome((e.target as HTMLSelectElement).value as OutcomeDomain | "")}>
            <option value="">Any outcome</option>
            {OUTCOMES.map((o) => <option value={o}>{o.replace(/-/g, " ")}</option>)}
          </select>
        </div>
        <label class="check">
          <input type="checkbox" checked={nrqi} onChange={(e) => setNrqi((e.target as HTMLInputElement).checked)} /> Only “{NRQI}”
        </label>
      </section>
      <div class="atlas-body">
        <section aria-label={`${results.length} claims`} class="claim-list">
          <p class="hint">{results.length} claims</p>
          {question === "kinds" ? (
            (Object.keys(KIND_TEXT) as ClaimKind[]).map((k) => (
              <div>
                <h3>{KIND_TEXT[k]}</h3>
                <ul>{results.filter((c) => c.kind === k).map((c) => <li><a href={`#/atlas?claim=${c.id}`} onClick={() => setSelected(c.id)}>{c.title}</a></li>)}</ul>
              </div>
            ))
          ) : (
            <ul>
              {results.map((c) => (
                <li>
                  <a href={`#/atlas?claim=${c.id}`} aria-current={selected === c.id ? "true" : undefined} onClick={() => setSelected(c.id)}>
                    <span class={`badge ${c.kind}`}>{KIND_TEXT[c.kind]}</span> {c.title}
                  </a>
                  <div class="hint">
                    {c.id} · {c.outcomes.join(", ") || "—"}
                    {c.noReliableQuantitativeImprovement ? " · no reliable quantitative improvement" : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section class="claim-pane" aria-live="polite">
          {sel ? <ClaimDetail c={sel} /> : (
            <div>
              <h2>Known gaps</h2>
              <ul>{reg.gaps.map((g) => <li><strong>{g.id}</strong>: {g.description}</li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
