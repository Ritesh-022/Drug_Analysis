import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHistory } from "../../services/api.js";
import { clamp01, scoreBand } from "../../utils/score.js";

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad:  "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const MODE_BADGE = {
  pharma:   "bg-blue-50 text-blue-700",
  medical:  "bg-emerald-50 text-emerald-700",
  forensic: "bg-amber-50 text-amber-700",
  batch:    "bg-gray-100 text-gray-600",
};

function scoreForRecord(h) {
  if (h.mode === "medical") return h.adjusted_toxicity;
  if (h.mode === "forensic") return h.severity;
  return h.final_score;
}

export default function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    setError("");
    getHistory(modeFilter !== "all" ? modeFilter : undefined)
      .then((data) => setRecords(data.history || []))
      .catch((err) => setError(err?.message || "Failed to load history."))
      .finally(() => setLoading(false));
  }, [modeFilter]);

  const filtered = records;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">History</h1>
          <p className="mt-1 text-sm text-gray-500">
            All your predictions — stored in MongoDB, user-specific.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            to="/utility/report"
          >
            Export Report
          </Link>
        </div>
      </div>

      {/* Mode filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pharma", "medical", "forensic", "batch"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModeFilter(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              modeFilter === m
                ? "bg-blue-600 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m === "all" ? "All" : m}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">No predictions yet.</p>
          <Link className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700" to="/prediction/input">
            Run your first prediction →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3 text-xs text-gray-400">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">SMILES</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((h) => {
                const raw = scoreForRecord(h);
                const score = typeof raw === "number" ? clamp01(raw) : null;
                const band = score !== null ? scoreBand(score) : "warn";
                return (
                  <tr key={h._id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-800 max-w-xs truncate">{h.smiles}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${MODE_BADGE[h.mode] || "bg-gray-100 text-gray-600"}`}>
                        {h.mode}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {score !== null ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_BADGE[band]}`}>
                          {score.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
