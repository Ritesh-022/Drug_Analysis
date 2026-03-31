import { Link, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import ResultCard from "../../components/ResultCard.jsx";
import { visualize, loadLastPrediction } from "../../services/api.js";

function MoleculePanel({ initialSmiles, initialMolecule }) {
  const [smiles, setSmiles] = useState(initialSmiles || "");
  const [molecule, setMolecule] = useState(initialMolecule || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function render(e) {
    e.preventDefault();
    const s = smiles.trim();
    if (!s) return;
    setError(""); setLoading(true);
    try {
      const data = await visualize(s);
      if (!data?.image) throw new Error("No image returned.");
      setMolecule({ image: data.image, format: data.format || "png" });
    } catch (err) {
      setError(err?.message || "Visualization failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Molecule Viewer</h3>
      </div>
      <div className="p-5 space-y-3">
        <form onSubmit={render} className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="SMILES"
            maxLength={512}
          />
          <button
            type="submit"
            disabled={!smiles.trim() || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "..." : "Render"}
          </button>
        </form>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}

        {molecule ? (
          <img
            alt="Molecule"
            className="w-full rounded-lg border border-gray-100 bg-gray-50"
            src={`data:image/${molecule.format === "svg" ? "svg+xml" : molecule.format};base64,${molecule.image}`}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
            Enter a SMILES string and click Render
          </div>
        )}
      </div>
    </div>
  );
}

export default function Results() {
  const location = useLocation();
  const state = location.state || {};
  const result = useMemo(() => state.result || loadLastPrediction(), [state.result]);
  const molecule = state.molecule || null;

  if (!result) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        <p className="text-sm text-gray-500">
          No prediction found.{" "}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/prediction/input">
            Run a new prediction.
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Results</h1>
          <p className="mt-1 text-sm text-gray-500">Review the latest prediction result.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            to="/prediction/input"
          >
            New prediction
          </Link>
          <Link
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            to="/utility/report"
          >
            Report
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResultCard result={result} />
        </div>

        <div className="space-y-4">
          <MoleculePanel
            initialSmiles={result.smiles}
            initialMolecule={molecule}
          />
          {result.zinc && Object.keys(result.zinc).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-900">Drug Property Glossary</h3>
              </div>
              <div className="divide-y divide-gray-100 px-5 py-2">
                <div className="py-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Lipophilicity (logP)</span>
                    <span className="font-mono text-xs font-bold text-gray-900">{result.zinc.logP?.toFixed(3) ?? "—"}</span>
                  </div>
                  <p className="text-xs text-gray-500">Measures how well the compound dissolves in fats vs. water. Values between −0.4 and 5.6 are ideal for oral drugs. Negative values indicate high water solubility; very high values suggest poor absorption.</p>
                </div>
                <div className="py-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Drug-likeness (QED)</span>
                    <span className="font-mono text-xs font-bold text-gray-900">{result.zinc.qed?.toFixed(3) ?? "—"}</span>
                  </div>
                  <p className="text-xs text-gray-500">Quantitative Estimate of Drug-likeness (0–1). Combines molecular weight, logP, H-bond donors/acceptors, and other properties. Scores above 0.67 are considered drug-like; below 0.34 are generally unfavorable.</p>
                </div>
                <div className="py-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Synthetic Accessibility (SAS)</span>
                    <span className="font-mono text-xs font-bold text-gray-900">{result.zinc.SAS?.toFixed(3) ?? "—"}</span>
                  </div>
                  <p className="text-xs text-gray-500">Estimates how easy the compound is to synthesize in a lab (1–10). Scores of 1–3 are easy to make; 4–6 are moderately complex; above 6 are very difficult or impractical to synthesize.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
