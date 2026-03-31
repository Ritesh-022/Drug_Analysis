import { useMemo, useState } from "react";
import { patientPredict } from "../../services/api.js";
import { clamp01 } from "../../utils/score.js";

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const RISK_STYLE = {
  high:     "border-red-200 bg-red-50 text-red-700",
  moderate: "border-amber-200 bg-amber-50 text-amber-700",
  low:      "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function Patient() {
  const [smiles, setSmiles] = useState("CCO");
  const [age, setAge] = useState(60);
  const [weight, setWeight] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => smiles.trim() && !loading, [smiles, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null);
    const s = smiles.trim();
    if (!s) return;
    const ageNum = Number(age), weightNum = Number(weight);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) { setError("Age must be between 0 and 150."); return; }
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 500) { setError("Weight must be between 1 and 500 kg."); return; }
    setLoading(true);
    try {
      const data = await patientPredict(s, ageNum, weightNum);
      setResult({ adjusted_toxicity: clamp01(data.adjusted_toxicity), risk_level: data.risk_level });
    } catch (err) {
      console.warn("Patient API failed", err);
      setError(err?.message || "Patient prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Patient Risk</h1>
        <p className="mt-1 text-sm text-gray-500">Estimate adjusted toxicity risk using patient age and weight.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">SMILES string</label>
            <input className={`${INPUT} font-mono`} value={smiles} onChange={(e) => setSmiles(e.target.value)} maxLength={512} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Age (years)</label>
              <input type="number" className={INPUT} value={age} onChange={(e) => setAge(e.target.value)} min={0} max={150} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (kg)</label>
              <input type="number" className={INPUT} value={weight} onChange={(e) => setWeight(e.target.value)} min={1} max={500} />
            </div>
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <button type="submit" disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Computing..." : "Compute Risk"}
          </button>
        </form>
      </div>

      {result ? (
        <div className={`rounded-xl border p-6 ${RISK_STYLE[result.risk_level] || "border-gray-200 bg-gray-50"}`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Adjusted Toxicity</div>
          <div className="mt-1 font-mono text-3xl font-bold">{clamp01(result.adjusted_toxicity).toFixed(2)}</div>
          <div className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold">
            Risk Level: {result.risk_level}
          </div>
        </div>
      ) : null}
    </div>
  );
}
