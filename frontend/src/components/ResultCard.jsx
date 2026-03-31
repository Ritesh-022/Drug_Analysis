import { clamp01, scoreBand } from "../utils/score.js";

const TOX_LABEL_ORDER = [
  "NR-AR", "NR-AR-LBD", "NR-AhR", "NR-Aromatase",
  "NR-ER", "NR-ER-LBD", "NR-PPAR-gamma", "SR-ARE", "SR-ATAD5",
];

function fmt(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  return score.toFixed(2);
}

function ProgressBar({ label, value }) {
  const v = clamp01(value);
  const band = scoreBand(v);
  const barColor = { good: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-red-500" }[band];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="font-mono text-sm font-semibold text-gray-900">{fmt(v)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

function ListSection({ title, items, emptyText, accent = "text-gray-700" }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      {items?.length ? (
        <ul className={`list-disc space-y-1 pl-4 text-sm ${accent}`}>
          {items.map((item, i) => <li key={i}>{String(item)}</li>)}
        </ul>
      ) : (
        <div className="text-sm text-gray-400">{emptyText}</div>
      )}
    </div>
  );
}

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad:  "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export default function ResultCard({ result }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-400">No result yet.</p>
      </div>
    );
  }

  const band = scoreBand(result.final_score ?? 0);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Prediction Results</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BAND_BADGE[band]}`}>
          Final: {fmt(clamp01(result.final_score ?? 0))}
        </span>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Disagreement warning */}
        {result.model_disagreement_note ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠ {result.model_disagreement_note}
          </div>
        ) : null}

        {/* Interpretation */}
        {result.interpretation ? (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            band === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
            band === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" :
            "border-red-200 bg-red-50 text-red-800"
          }`}>
            {result.interpretation}
          </div>
        ) : null}

        {/* Score bars */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ProgressBar label="Drug Score" value={result.drug_score} />
          <ProgressBar label="Toxicity Score" value={result.toxicity_score} />
          <ProgressBar label="Final Score" value={result.final_score} />
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">Confidence</span>
              <span className="font-mono text-sm font-semibold text-gray-900">{fmt(clamp01(result.confidence))}</span>
            </div>
            <p className="text-xs text-gray-400">GNN: {fmt(result.gnn_tox)} · XGB: {fmt(result.xgb_tox)}</p>
          </div>
        </div>

        {/* LLM grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ListSection title="Causes" items={result.causes} emptyText="No causes returned." />
          <ListSection title="Precautions" items={result.precautions} emptyText="No precautions returned." accent="text-amber-700" />
          <ListSection title="Remedies" items={result.remedies} emptyText="No remedies returned." accent="text-emerald-700" />
          <ListSection title="Risks" items={result.risks} emptyText="No risks returned." accent="text-red-700" />
        </div>

        {/* Domain advice */}
        {result.domain_advice ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-semibold">Domain Advice: </span>{result.domain_advice}
          </div>
        ) : null}

        {/* ZINC drug properties */}
        {result.zinc && Object.keys(result.zinc).length > 0 ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Drug Properties (ZINC)</div>
            <div className="grid grid-cols-3 gap-3">
              {[["logP", "Lipophilicity"], ["qed", "Drug-likeness (QED)"], ["SAS", "Synth. Accessibility"]].map(([key, label]) =>
                typeof result.zinc[key] === "number" ? (
                  <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-gray-900">{result.zinc[key].toFixed(3)}</div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        ) : null}

        {/* TOX21 per-label breakdown */}
        {result.tox_labels && Object.keys(result.tox_labels).length > 0 ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">TOX21 Endpoint Breakdown</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Endpoint</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Probability</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {TOX_LABEL_ORDER.filter((l) => result.tox_labels[l] !== undefined).map((label) => {
                    const prob = result.tox_labels[label];
                    const flag = result.tox_binary?.[label];
                    const toxic = flag === 1;
                    return (
                      <tr key={label} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-gray-700">{label}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-900">{typeof prob === "number" ? prob.toFixed(3) : "—"}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${
                            toxic ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {toxic ? "Toxic" : "Safe"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
