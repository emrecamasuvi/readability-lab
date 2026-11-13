import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getRegistry, VERSION } from "@camasuvi/readability-lab-core";
import { Atlas } from "./atlas.js";
import { Compare } from "./compare.js";
import { Explore } from "./explore.js";
import "./styles.css";

const ROUTES = [
  { id: "compare", label: "Compare layouts" },
  { id: "atlas", label: "Evidence atlas" },
  { id: "explore", label: "Explore preferences" },
  { id: "about", label: "About" },
] as const;

function route(): string {
  return location.hash.replace(/^#\/?/, "").split("?")[0] || "compare";
}

function About() {
  const reg = getRegistry();
  return (
    <div class="about">
      <h1>About the workbench</h1>
      <p>Readability Lab makes reading on the web adjustable, inspectable and reproducible. This workbench lets you compare reading layouts on the same text, measure what actually renders, and export a recipe that developers and readers can reuse.</p>
      <ul>
        <li>Everything runs in your browser. Pasted text and local files are not uploaded; previews have no network access.</li>
        <li>Measurements come from the rendered page (line boxes, computed styles), using the same engine as the CLI, extension and agent tools.</li>
        <li>No readability score is computed. Presets are starting choices, not proven optima.</li>
        <li>Browser-rendered layout is the verification reference. For design tools, export design tokens (DTCG format) and the design specification; a Figma plugin is on the roadmap.</li>
      </ul>
      <p class="hint">Workbench {VERSION} · evidence registry {reg.registryVersion} (checked {reg.checkedOn}).</p>
    </div>
  );
}

function App() {
  const [r, setR] = useState(route());
  useEffect(() => {
    const on = () => setR(route());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return (
    <>
      <a class="skip" href="#main">Skip to content</a>
      <header class="top">
        <a class="brand" href="#/compare">Readability Lab</a>
        <nav aria-label="Workbench">
          {ROUTES.map((x) => (
            <a href={`#/${x.id}`} aria-current={r === x.id ? "page" : undefined}>
              {x.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {r === "atlas" ? <Atlas /> : r === "explore" ? <Explore /> : r === "about" ? <About /> : <Compare />}
      </main>
    </>
  );
}

render(<App />, document.getElementById("app")!);
