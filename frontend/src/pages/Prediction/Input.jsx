import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { predict, saveLastPrediction, visualize } from "../../services/api.js";
import { calculateFinalScore, clamp01, interpretationForFinalScore } from "../../utils/score.js";

export default function Input() {
  const navigate = useNavigate();
  const [smiles, setSmiles] = useState("CCO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => smiles.trim().length > 0 && !loading, [smiles, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const s = smiles.trim();
    if (!s) { setError("SMILES is required."); return; }
    setLoading(true);
    try {
      const [pred, viz] = await Promise.all([predict(s), visualize(s)]);
      const llm = pred.llm_analysis || {};
      const result = {
        smiles: s,
        toxicity_score: clamp01(pred.toxicity_score),
        drug_score: clamp01(pred.drug_score),
        final_score: clamp01(pred.final_score),
        confidence: clamp01(pred.confidence ?? 0),
        gnn_tox: clamp01(pred.gnn_tox ?? 0),
        xgb_tox: clamp01(pred.xgb_tox ?? 0),
        tox_labels: pred.tox_labels || {},
        tox_binary: pred.tox_binary || {},
        zinc: pred.zinc || {},
        interpretation: llm.interpretation || interpretationForFinalScore(clamp01(pred.final_score)),
        causes: Array.isArray(llm.causes) ? llm.causes : [],
        precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
        remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
        risks: Array.isArray(llm.risks) ? llm.risks : [],
        domain_advice: llm.domain_advice || "",
        model_disagreement_note: llm.model_disagreement_note || "",
      };
      saveLastPrediction(result);
      navigate("/prediction/results", { replace: false, state: { result, molecule: viz?.image ? { image: viz.image, format: viz.format || "png" } : null } });
    } catch (err) {
      setError(err?.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Prediction Input</h1>
        <p className="mt-1 text-sm text-gray-500">Submit a SMILES string to score toxicity, drug-likeness, and final.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">SMILES string</label>
            <input
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-mono text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              placeholder="e.g. CCO"
              maxLength={512}
            />
            <p className="mt-1 text-xs text-gray-400">Max 512 characters</p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Scoring...
              </span>
            ) : "Run Prediction"}
          </button>
        </form>
      </div>
    </div>
  );
}
