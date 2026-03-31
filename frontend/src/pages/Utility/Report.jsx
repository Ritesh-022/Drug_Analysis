import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth, getHistory, visualize } from "../../services/api.js";
import { clamp01, scoreBand } from "../../utils/score.js";
import ResultCard from "../../components/ResultCard.jsx";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return clamp01(v).toFixed(3);
}

function scoreForRecord(h) {
  if (h.mode === "medical")  return { label: "Adj. Toxicity", value: h.adjusted_toxicity };
  if (h.mode === "forensic") return { label: "Severity",      value: h.severity };
  return { label: "Final Score", value: h.final_score };
}

function downloadJson(records, auth) {
  const payload = {
    generated_at: new Date().toISOString(),
    user: auth?.email,
    role: auth?.role,
    total_records: records.length,
    predictions: records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `pharma-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const MODE_COLOR = {
  pharma:   "#2563eb",
  medical:  "#059669",
  forensic: "#d97706",
  batch:    "#6b7280",
};

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad:  "bg-red-50 text-red-700 ring-1 ring-red-200",
};

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

// ── PDF via print ─────────────────────────────────────────────────────────────
function printReport(records, auth) {
  const rows = records.map((h, i) => {
    const { label, value } = scoreForRecord(h);
    const score = typeof value === "number" ? clamp01(value).toFixed(3) : "—";
    const date  = h.createdAt ? new Date(h.createdAt).toLocaleString() : "—";
    const modeColor = MODE_COLOR[h.mode] || "#6b7280";

    const llmSection = (h.interpretation || (h.causes?.length) || (h.domain_advice)) ? `
      <tr style="background:#f9fafb;">
        <td colspan="8" style="padding:10px 12px;">
          ${h.interpretation ? `<div style="font-size:12px;color:#374151;margin-bottom:6px;"><strong>Interpretation:</strong> ${h.interpretation}</div>` : ""}
          ${h.causes?.length ? `<div style="font-size:11px;color:#6b7280;"><strong>Causes:</strong> ${h.causes.join(" · ")}</div>` : ""}
          ${h.precautions?.length ? `<div style="font-size:11px;color:#92400e;"><strong>Precautions:</strong> ${h.precautions.join(" · ")}</div>` : ""}
          ${h.remedies?.length ? `<div style="font-size:11px;color:#065f46;"><strong>Remedies:</strong> ${h.remedies.join(" · ")}</div>` : ""}
          ${h.risks?.length ? `<div style="font-size:11px;color:#991b1b;"><strong>Risks:</strong> ${h.risks.join(" · ")}</div>` : ""}
          ${h.domain_advice ? `<div style="font-size:11px;color:#1e40af;"><strong>Domain Advice:</strong> ${h.domain_advice}</div>` : ""}
        </td>
      </tr>` : "";

    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;color:#6b7280;font-size:12px;white-space:nowrap;">${i + 1}</td>
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;">${date}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#111827;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${h.smiles}</td>
        <td style="padding:8px 12px;">
          <span style="background:${modeColor}18;color:${modeColor};border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:capitalize;">${h.mode}</span>
        </td>
        <td style="padding:8px 12px;font-weight:700;font-size:13px;color:#111827;">${score}</td>
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${label}</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#111827;">${h.risk_level || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#111827;">${h.classification || "—"}</td>
      </tr>
      ${llmSection}`;
  }).join("");

  const total = records.length;
  const scores = records.map((h) => scoreForRecord(h).value).filter((v) => typeof v === "number");
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) : "—";
  const max = scores.length ? Math.max(...scores).toFixed(3) : "—";
  const min = scores.length ? Math.min(...scores).toFixed(3) : "—";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pharma AI Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; padding: 40px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
    h1 { font-size: 22px; font-weight: 700; color: #111827; }
    .meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .stats { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 20px; min-width: 120px; }
    .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; }
    .stat-value { font-size: 22px; font-weight: 700; color: #111827; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f9fafb; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
    <div style="width:40px;height:40px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">P</div>
    <div>
      <h1>Pharma AI — Prediction Report</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; User: ${auth?.email || "—"} &nbsp;·&nbsp; Role: ${auth?.role || "—"}</div>
    </div>
  </div>

  <hr class="divider"/>

  <div class="stats">
    <div class="stat"><div class="stat-label">Total Records</div><div class="stat-value">${total}</div></div>
    <div class="stat"><div class="stat-label">Avg Score</div><div class="stat-value">${avg}</div></div>
    <div class="stat"><div class="stat-label">Max Score</div><div class="stat-value">${max}</div></div>
    <div class="stat"><div class="stat-label">Min Score</div><div class="stat-value">${min}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date / Time</th>
        <th>SMILES</th>
        <th>Mode</th>
        <th>Score</th>
        <th>Score Type</th>
        <th>Risk Level</th>
        <th>Classification</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">Pharma AI · Confidential · ${new Date().getFullYear()}</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) { alert("Please allow popups for this site to download the PDF."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Report() {
  const auth = getAuth();
  const role = auth?.role || "";
  const canDownloadPdf = role === "pharma" || role === "admin";
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    getHistory()
      .then((data) => {
        const list = data.history || [];
        setRecords(list);
        if (list.length) setSelectedId(list[0]._id);
      })
      .catch(() => setError("Failed to load predictions."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = modeFilter === "all"
    ? records
    : records.filter((r) => r.mode === modeFilter);

  const selected = filtered.find((r) => r._id === selectedId) || filtered[0] || null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and export your prediction history from MongoDB.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => downloadJson(filtered, auth)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
          >
            Download JSON
          </button>
          {canDownloadPdf ? (
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() => printReport(filtered, auth)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40"
            >
              Download PDF
            </button>
          ) : (
            <div className="hidden sm:flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              PDF export is available from hospital/forensic pages for your role.
            </div>
          )}
        </div>
      </div>

      {!canDownloadPdf ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">PDF export</div>
          <div className="mt-1 text-sm text-gray-500">
            Medical (hospital) PDFs are patient-specific. Forensic PDFs are case-specific.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/medical/patients"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Hospital Patients
            </Link>
            <Link
              to="/forensic"
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              Forensic Case Report
            </Link>
          </div>
        </div>
      ) : null}

      {/* Mode filter */}
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
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No predictions found.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* List */}
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {filtered.map((h) => {
                const { value } = scoreForRecord(h);
                const score = typeof value === "number" ? clamp01(value) : null;
                const band  = score !== null ? scoreBand(score) : "warn";
                const active = (selectedId || filtered[0]?._id) === h._id;
                return (
                  <button
                    key={h._id}
                    type="button"
                    onClick={() => setSelectedId(h._id)}
                    className={`w-full text-left px-4 py-3 transition ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-700 truncate">{h.smiles}</span>
                      {score !== null && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_BADGE[band]}`}>
                          {score.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize">{h.mode}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

	          {/* Detail */}
	          <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm">
	            {!selected ? (
	              <div className="p-8 text-center text-sm text-gray-400">Select a record to view details.</div>
	            ) : (
	              <>
                <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Prediction Detail</h2>
                  <span className="text-xs text-gray-400">
                    {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
	                <div className="p-5 space-y-4">
	                  {(selected.mode === "pharma" || selected.mode === "batch") ? (
	                    <div className="grid gap-6 lg:grid-cols-3">
	                      <div className="lg:col-span-2">
	                        <ResultCard result={selected} />
	                      </div>
	                      <div className="lg:col-span-1">
	                        <MoleculePanel smiles={selected.smiles} />
	                      </div>
	                    </div>
	                  ) : null}

	                  {(selected.mode === "pharma" || selected.mode === "batch") ? (
	                    <details className="group">
	                      <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 select-none">
	                        View raw JSON
	                      </summary>
	                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
	                        {JSON.stringify(selected, null, 2)}
	                      </pre>
	                    </details>
	                  ) : null}

		                  {(selected.mode === "pharma" || selected.mode === "batch") ? null : (
		                  <>
		                  {/* SMILES */}
	                  <div>
	                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">SMILES</div>
	                    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 font-mono text-sm text-gray-800 break-all">{selected.smiles}</div>
	                  </div>

                  {/* Mode */}
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mode</div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                      style={{ background: `${MODE_COLOR[selected.mode]}18`, color: MODE_COLOR[selected.mode] }}>
                      {selected.mode}
                    </span>
                  </div>

                  {/* Scores grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Final Score",    value: selected.final_score },
                      { label: "Toxicity Score", value: selected.toxicity_score },
                      { label: "Drug Score",     value: selected.drug_score },
                      { label: "Confidence",     value: selected.confidence },
                      { label: "Adj. Toxicity",  value: selected.adjusted_toxicity },
                      { label: "Severity",       value: selected.severity },
                    ].filter((f) => typeof f.value === "number").map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs text-gray-400">{label}</div>
                        <div className="mt-0.5 font-mono text-base font-bold text-gray-900">{fmt(value)}</div>
                      </div>
                    ))}
                    {selected.risk_level && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs text-gray-400">Risk Level</div>
                        <div className="mt-0.5 text-base font-bold text-gray-900">{selected.risk_level}</div>
                      </div>
                    )}
                    {selected.classification && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs text-gray-400">Classification</div>
                        <div className="mt-0.5 text-base font-bold text-gray-900">{selected.classification}</div>
                      </div>
                    )}
                  </div>

                  {/* ZINC drug properties */}
                  {selected.zinc && Object.keys(selected.zinc).length > 0 ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Drug Properties (ZINC)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[["logP", "logP"], ["qed", "QED"], ["SAS", "SAS"]].map(([key, label]) =>
                          typeof selected.zinc[key] === "number" ? (
                            <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <div className="text-xs text-gray-400">{label}</div>
                              <div className="mt-0.5 font-mono text-sm font-bold text-gray-900">{selected.zinc[key].toFixed(3)}</div>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* TOX21 breakdown */}
                  {selected.tox_labels && Object.keys(selected.tox_labels).length > 0 ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 select-none">TOX21 Endpoint Breakdown</summary>
                      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">Endpoint</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Prob</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Flag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {Object.entries(selected.tox_labels).map(([lbl, prob]) => {
                              const toxic = selected.tox_binary?.[lbl] === 1;
                              return (
                                <tr key={lbl}>
                                  <td className="px-3 py-1.5 font-mono text-gray-700">{lbl}</td>
                                  <td className="px-3 py-1.5 text-right font-mono">{typeof prob === "number" ? prob.toFixed(3) : "—"}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${
                                      toxic ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                                    }`}>{toxic ? "Toxic" : "Safe"}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ) : null}

                  {/* LLM Analysis */}
                  {(selected.interpretation || selected.causes?.length || selected.domain_advice) ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">AI Analysis (Ollama)</div>

                      {selected.interpretation && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                          {selected.interpretation}
                        </div>
                      )}

                      {selected.model_disagreement_note && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          ⚠ {selected.model_disagreement_note}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Causes",      items: selected.causes,      accent: "text-gray-700" },
                          { label: "Precautions", items: selected.precautions, accent: "text-amber-700" },
                          { label: "Remedies",    items: selected.remedies,    accent: "text-emerald-700" },
                          { label: "Risks",       items: selected.risks,       accent: "text-red-700" },
                        ].filter((s) => s.items?.length).map(({ label, items, accent }) => (
                          <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                            <ul className={`list-disc pl-4 space-y-0.5 text-xs ${accent}`}>
                              {items.map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {selected.domain_advice && (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                          <span className="font-semibold">Domain Advice: </span>{selected.domain_advice}
                        </div>
                      )}
                    </div>
                  ) : null}

		                  {/* Raw JSON */}
		                  <details className="group">
	                    <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 select-none">
	                      View raw JSON
	                    </summary>
	                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
	                      {JSON.stringify(selected, null, 2)}
	                    </pre>
		                  </details>
		                  </>
		                  )}
	                </div>
	              </>
	            )}
	          </div>
        </div>
      )}
    </div>
  );
}
