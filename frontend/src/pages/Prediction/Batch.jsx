import { useRef, useState } from "react";
import { predictBatch } from "../../services/api.js";
import { clamp01, interpretationForFinalScore, scoreBand } from "../../utils/score.js";
import ResultCard from "../../components/ResultCard.jsx";
import { visualize } from "../../services/api.js";

function parseCsvToSmiles(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t")
    ? "\t"
    : (headerLine.includes(",") ? "," : (headerLine.includes(";") ? ";" : ","));

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const smilesIdx = headers.findIndex((h) => h === "smiles" || h === "smile");

  const out = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const v = smilesIdx >= 0 ? cols[smilesIdx] : cols[0];
    if (!v) continue;
    if (String(v).toLowerCase() === "smiles") continue;
    // Skip common ID-like values (e.g., `_id` from datasets like pharma_ai.dk.csv)
    if (/^[0-9a-f]{24}$/i.test(v)) continue;
    out.push(v);
  }

  return out;
}

function MoleculePanel({ smiles }) {
  const [molecule, setMolecule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function render() {
    const s = String(smiles || "").trim();
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
      <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Molecule Viewer</h3>
        <button
          type="button"
          onClick={render}
          disabled={!String(smiles || "").trim() || loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Render"}
        </button>
      </div>
      <div className="p-5 space-y-3">
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 font-mono text-sm text-gray-800 break-all">
          {smiles || "—"}
        </div>

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
            Click Render to view structure
          </div>
        )}
      </div>
    </div>
  );
}

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const STATUS_STYLE = {
  pending:  "text-gray-400",
  running:  "text-blue-600 animate-pulse",
  done:     "",
  error:    "text-red-500",
};

export default function Batch() {
  const [smilesList, setSmilesList] = useState([]);   // parsed from CSV
  const [fileName, setFileName]     = useState("");
  const [rows, setRows]             = useState([]);   // { smiles, status, result, message }
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [error, setError]           = useState("");
  const [includeLlm, setIncludeLlm] = useState(false);
  const [selectedSmiles, setSelectedSmiles] = useState("");
  const fileRef                     = useRef(null);
  const cancelRef                   = useRef(false);

  // ── Step 1: parse CSV, show preview ──────────────────────────────────────
  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setRows([]);
    setSmilesList([]);
    setProgress({ done: 0, total: 0 });

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsed = parseCsvToSmiles(text).slice(0, 200);
      if (parsed.length === 0) {
        setError("No SMILES found in CSV. Make sure the first column contains SMILES strings.");
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setFileName(file.name);
      setSmilesList(parsed);
      // pre-fill rows as pending so the table shows immediately
      setRows(parsed.map((s) => ({ smiles: s, status: "pending", result: null, message: "" })));
      setSelectedSmiles(parsed[0] || "");
    };
    reader.readAsText(file);
  }

  // ── Step 2: run predictions one-by-one ───────────────────────────────────
  async function onRun() {
    if (!smilesList.length || loading) return;
    cancelRef.current = false;
    setLoading(true);
    setError("");
    setProgress({ done: 0, total: smilesList.length });
    if (!selectedSmiles && smilesList[0]) setSelectedSmiles(smilesList[0]);

    // mark all rows as running
    setRows(smilesList.map((s) => ({ smiles: s, status: "running", result: null, message: "" })));

    try {
      const data = await predictBatch(smilesList, includeLlm);
      const map = new Map((data.results || []).map((r) => [String(r.smiles || "").trim(), r]));

      setRows(smilesList.map((s) => {
        const r = map.get(s);
        if (!r || r.final_score == null) {
          return { smiles: s, status: "error", result: null, message: r?.error || "No score returned" };
        }

        const llm = r.llm_analysis || {};
        const finalScore = clamp01(r.final_score ?? 0);
        const result = {
          smiles: s,
          toxicity_score: clamp01(r.toxicity_score ?? 0),
          drug_score: clamp01(r.drug_score ?? 0),
          final_score: finalScore,
          confidence: clamp01(r.confidence ?? 0),
          gnn_tox: r.gnn_tox == null ? null : clamp01(r.gnn_tox),
          xgb_tox: r.xgb_tox == null ? null : clamp01(r.xgb_tox),
          tox_labels: r.tox_labels || {},
          tox_binary: r.tox_binary || {},
          zinc: r.zinc || {},
          interpretation: llm.interpretation || interpretationForFinalScore(finalScore),
          causes: Array.isArray(llm.causes) ? llm.causes : [],
          precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
          remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
          risks: Array.isArray(llm.risks) ? llm.risks : [],
          domain_advice: llm.domain_advice || "",
          model_disagreement_note: llm.model_disagreement_note || "",
        };

        return { smiles: s, status: "done", result, message: "" };
      }));
      setProgress({ done: smilesList.length, total: smilesList.length });
    } catch (err) {
      setError(err?.message || "Batch prediction failed.");
      setRows(smilesList.map((s) => ({ smiles: s, status: "error", result: null, message: err?.message || "Failed" })));
    } finally {
      setLoading(false);
    }
  }

  // ── Cancel: stop loop + clear everything ─────────────────────────────────
  function onCancel() {
    cancelRef.current = true;
    setLoading(false);
    setSmilesList([]);
    setRows([]);
    setFileName("");
    setError("");
    setProgress({ done: 0, total: 0 });
    setSelectedSmiles("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const csvLoaded = smilesList.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Batch Prediction</h1>
        <p className="mt-1 text-sm text-gray-500">Upload a CSV, run bulk scoring, then select a compound to view full details.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        {/* File input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">CSV file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 cursor-pointer"
            onChange={onFile}
            disabled={loading}
          />
          <p className="mt-1.5 text-xs text-gray-400">First column must be SMILES. Max 200 rows.</p>
        </div>

        {/* File info + Run / Cancel — only visible after CSV is loaded */}
        {csvLoaded && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{fileName}</span>
              <span className="ml-2 text-gray-400">— {smilesList.length} compound{smilesList.length !== 1 ? "s" : ""} ready</span>
              {loading && (
                <span className="ml-3 text-blue-600 font-medium">
                  {progress.done} / {progress.total} done
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <label className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm ${loading ? "opacity-50" : ""}`}>
                <input type="checkbox" disabled={loading} checked={includeLlm} onChange={(e) => setIncludeLlm(e.target.checked)} />
                Include AI narrative (slower)
              </label>
              <button
                type="button"
                onClick={onRun}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Running...
                  </>
                ) : "Run Predictions"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-50 hover:border-red-200 hover:text-red-700"
              >
                {loading ? "Stop & Clear" : "Clear"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      {/* Results table — shows pending rows immediately after CSV load */}
      {rows.length > 0 && (
	        <div className="grid gap-6 lg:grid-cols-5">
	          <div className="lg:col-span-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Results — {rows.filter((r) => r.status === "done").length} / {rows.length} scored
          </div>
	          <div className="max-h-[520px] overflow-y-auto">
	            <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">SMILES</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Final</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const finalScore = r.result?.final_score;
                const band = r.status === "done" ? scoreBand(finalScore) : "warn";
                const active = r.smiles === selectedSmiles;
                return (
                  <tr
                    key={`${r.smiles}-${i}`}
                    className={`cursor-pointer hover:bg-gray-50 ${active ? "bg-blue-50/40" : ""}`}
                    onClick={() => setSelectedSmiles(r.smiles)}
                  >
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-mono text-gray-800 max-w-xs truncate">{r.smiles}</td>
                    <td className="px-5 py-3">
                      {r.status === "done" ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_BADGE[band]}`}>
                          {clamp01(finalScore).toFixed(2)}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                          {r.status === "running" ? "Scoring..." : r.status === "error" ? "Error" : "Pending"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                        {r.status === "running" ? "Scoring..." : r.status === "error" ? "Error" : r.status === "done" ? "Done" : "Pending"}
                      </span>
                      {r.status === "error" && r.message ? (
                        <div className="mt-1 text-[11px] text-red-500 max-w-xs truncate">{r.message}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
	            </table>
	          </div>

	        </div>

	        <div className="lg:col-span-2 space-y-4">
	          {(() => {
	            const selected = rows.find((r) => r.smiles === selectedSmiles) || rows[0] || null;
	            if (!selected) return null;
	            if (selected.status !== "done" || !selected.result) {
	              return (
	                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-500">
	                  Select a completed row to view full details.
	                </div>
	              );
	            }
	            return (
	              <>
	                <ResultCard result={selected.result} />
	                <MoleculePanel smiles={selected.result.smiles} />
	              </>
	            );
	          })()}
	        </div>
	      </div>
	      )}
    </div>
  );
}
