import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAuth, getPatient, patientPredict } from "../../services/api.js";
import { clamp01, scoreBand } from "../../utils/score.js";

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function printPatientReport({ patient, predictions, auth }) {
  const rows = (predictions || [])
    .map((h, i) => {
      const score = typeof h.adjusted_toxicity === "number" ? clamp01(h.adjusted_toxicity).toFixed(3) : "—";
      const date = h.createdAt ? new Date(h.createdAt).toLocaleString() : "—";
      const ai = h.interpretation || h.causes?.length || h.domain_advice
        ? `
      <tr style="background:#f8fafc;">
        <td colspan="6" style="padding:10px 12px;">
          ${h.interpretation ? `<div style="font-size:12px;color:#0f172a;margin-bottom:6px;"><strong>Interpretation:</strong> ${h.interpretation}</div>` : ""}
          ${h.causes?.length ? `<div style="font-size:11px;color:#475569;"><strong>Causes:</strong> ${h.causes.join(" · ")}</div>` : ""}
          ${h.precautions?.length ? `<div style="font-size:11px;color:#92400e;"><strong>Precautions:</strong> ${h.precautions.join(" · ")}</div>` : ""}
          ${h.remedies?.length ? `<div style="font-size:11px;color:#065f46;"><strong>Remedies:</strong> ${h.remedies.join(" · ")}</div>` : ""}
          ${h.risks?.length ? `<div style="font-size:11px;color:#991b1b;"><strong>Risks:</strong> ${h.risks.join(" · ")}</div>` : ""}
          ${h.domain_advice ? `<div style="font-size:11px;color:#1e40af;"><strong>Domain Advice:</strong> ${h.domain_advice}</div>` : ""}
        </td>
      </tr>`
        : "";

      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 12px;color:#64748b;font-size:12px;white-space:nowrap;">${i + 1}</td>
        <td style="padding:8px 12px;color:#64748b;font-size:12px;white-space:nowrap;">${date}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#0f172a;max-width:260px;overflow:hidden;text-overflow:ellipsis;">${h.smiles}</td>
        <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:700;">${score}</td>
        <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:700;">${h.risk_level || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:#334155;">${h.age ?? "—"}y / ${h.weight ?? "—"}kg</td>
      </tr>
      ${ai}
    `;
    })
    .join("");

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Patient Report</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a; padding:24px; }
        .top { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
        .brand { font-weight:800; font-size:16px; letter-spacing:-0.02em; }
        .meta { color:#64748b; font-size:12px; margin-top:6px; }
        .card { margin-top:14px; border:1px solid #e2e8f0; border-radius:14px; padding:14px; background:#fff; }
        .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px; }
        .k { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; }
        .v { font-weight:700; margin-top:2px; font-size:12px; }
        table { width:100%; border-collapse:collapse; margin-top:14px; }
        th { text-align:left; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; padding:8px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; }
        @media print { body { padding:0; } .card { border:none; } }
      </style>
    </head>
    <body>
      <div class="top">
        <div>
          <div class="brand">Hospital Patient Report</div>
          <div class="meta">Generated: ${new Date().toLocaleString()} · Clinician: ${auth?.email || "—"} · Role: ${auth?.role || "—"}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Patient UUID</div>
          <div style="font-family:monospace;font-weight:800;">${patient.patientId}</div>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800;">Patient Information</div>
        <div class="grid">
          <div><div class="k">Name</div><div class="v">${patient.name || "—"}</div></div>
          <div><div class="k">Age / Gender</div><div class="v">${patient.age ?? "—"} / ${patient.gender || "—"}</div></div>
          <div><div class="k">Contact</div><div class="v">${patient.contact || "—"}</div></div>
          <div><div class="k">Email</div><div class="v">${patient.email || "—"}</div></div>
          <div><div class="k">Address</div><div class="v">${patient.address || "—"}</div></div>
          <div><div class="k">Created</div><div class="v">${patient.createdAt ? new Date(patient.createdAt).toLocaleString() : "—"}</div></div>
        </div>
        ${patient.medicalHistory ? `<div style="margin-top:10px;"><div class="k">Medical History</div><div class="v" style="font-weight:600;">${patient.medicalHistory}</div></div>` : ""}
        ${patient.allergies ? `<div style="margin-top:10px;"><div class="k">Allergies</div><div class="v" style="font-weight:600;">${patient.allergies}</div></div>` : ""}
        ${patient.currentMedications ? `<div style="margin-top:10px;"><div class="k">Current Medications</div><div class="v" style="font-weight:600;">${patient.currentMedications}</div></div>` : ""}
        ${patient.notes ? `<div style="margin-top:10px;"><div class="k">Notes</div><div class="v" style="font-weight:600;">${patient.notes}</div></div>` : ""}
      </div>

      <div class="card">
        <div style="font-weight:800;">Medical Predictions (${(predictions || []).length})</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>SMILES</th>
              <th>Adj. Toxicity</th>
              <th>Risk</th>
              <th>Age/Weight</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" style="padding:12px;color:#64748b;">No predictions yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

export default function PatientDetail() {
  const auth = getAuth();
  const { patientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patient, setPatient] = useState(null);
  const [predictions, setPredictions] = useState([]);

  const [smiles, setSmiles] = useState("CCO");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPatient() {
      setLoading(true);
      setError("");
      try {
        const data = await getPatient(patientId);
        if (cancelled) return;
        setPatient(data.patient);
        setPredictions(data.predictions || []);
        setAge(String(data.patient?.age ?? ""));
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load patient.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPatient();
    return () => { cancelled = true; };
  }, [patientId]);

  const canSubmit = useMemo(() => smiles.trim() && !submitting, [smiles, submitting]);

  async function onRun(e) {
    e.preventDefault();
    setSubmitError("");
    setLastResult(null);
    const s = smiles.trim();
    if (!s) return;
    const ageNum = Number(age);
    const weightNum = Number(weight);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) return setSubmitError("Age must be between 0 and 150.");
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 500) return setSubmitError("Weight must be between 1 and 500 kg.");

    setSubmitting(true);
    try {
      const data = await patientPredict(s, ageNum, weightNum, patientId);
      setLastResult({ adjusted_toxicity: clamp01(data.adjusted_toxicity), risk_level: data.risk_level });
      // Refresh predictions list
      const refreshed = await getPatient(patientId);
      setPatient(refreshed.patient);
      setPredictions(refreshed.predictions || []);
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e2) {
      setSubmitError(e2?.message || "Patient prediction failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const scores = predictions
    .map((p) => (typeof p.adjusted_toxicity === "number" ? clamp01(p.adjusted_toxicity) : null))
    .filter((x) => x !== null);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-gray-400">
            <Link className="text-emerald-700 hover:text-emerald-800 font-semibold" to="/medical/patients">
              Patients
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span className="font-mono">{patientId}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Patient Detail</h1>
          <p className="mt-1 text-sm text-gray-500">UUID-based record with history and printable PDF export.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!patient}
            onClick={() => printPatientReport({ patient, predictions, auth })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
          >
            Download Patient PDF
          </button>
          <Link
            to="/utility/report"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Go to Report
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : !patient ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          Patient not found.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Patient Information</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900">{patient.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Age</span>
                  <span className="font-semibold text-gray-900">{patient.age}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Gender</span>
                  <span className="font-semibold text-gray-900 capitalize">{patient.gender}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Contact</span>
                  <span className="font-semibold text-gray-900">{patient.contact}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Email</span>
                  <span className="font-semibold text-gray-900">{patient.email || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Created</span>
                  <span className="font-semibold text-gray-900">{fmtDate(patient.createdAt)}</span>
                </div>
              </div>
              {patient.medicalHistory || patient.allergies || patient.currentMedications || patient.notes ? (
                <div className="mt-4 space-y-3 text-xs text-gray-700">
                  {patient.medicalHistory ? (
                    <div>
                      <div className="text-gray-400 uppercase tracking-wide font-semibold text-[11px]">Medical history</div>
                      <div className="mt-1">{patient.medicalHistory}</div>
                    </div>
                  ) : null}
                  {patient.allergies ? (
                    <div>
                      <div className="text-gray-400 uppercase tracking-wide font-semibold text-[11px]">Allergies</div>
                      <div className="mt-1">{patient.allergies}</div>
                    </div>
                  ) : null}
                  {patient.currentMedications ? (
                    <div>
                      <div className="text-gray-400 uppercase tracking-wide font-semibold text-[11px]">Current medications</div>
                      <div className="mt-1">{patient.currentMedications}</div>
                    </div>
                  ) : null}
                  {patient.notes ? (
                    <div>
                      <div className="text-gray-400 uppercase tracking-wide font-semibold text-[11px]">Notes</div>
                      <div className="mt-1">{patient.notes}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Run New Analysis</div>
              <p className="mt-1 text-xs text-gray-500">This prediction is saved and linked to the patient UUID.</p>

              <form onSubmit={onRun} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">SMILES</label>
                  <input
                    className={`${INPUT} font-mono`}
                    value={smiles}
                    onChange={(e) => setSmiles(e.target.value)}
                    maxLength={512}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Age (years)</label>
                    <input className={INPUT} type="number" min={0} max={150} value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Weight (kg)</label>
                    <input className={INPUT} type="number" min={1} max={500} value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                </div>

                {submitError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Computing..." : "Compute Risk"}
                </button>
              </form>

              {lastResult ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Latest Result</div>
                  <div className="mt-1 font-mono text-3xl font-bold text-emerald-900">
                    {clamp01(lastResult.adjusted_toxicity).toFixed(2)}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-emerald-900">Risk Level: {lastResult.risk_level}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Prediction History</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {predictions.length} record{predictions.length !== 1 ? "s" : ""}
                    {avg !== null ? ` · Avg: ${avg.toFixed(2)}` : ""}
                  </div>
                </div>
              </div>
            </div>

            <div ref={listRef} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Records (newest first)
              </div>
              {predictions.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">No predictions yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">SMILES</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Adj. Tox</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {predictions.map((h) => {
                      const score = typeof h.adjusted_toxicity === "number" ? clamp01(h.adjusted_toxicity) : null;
                      const band = score !== null ? scoreBand(score) : "warn";
                      return (
                        <tr key={h._id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                          <td className="px-5 py-3 font-mono text-gray-800 max-w-md truncate">{h.smiles}</td>
                          <td className="px-5 py-3">
                            {score !== null ? (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_BADGE[band]}`}>
                                {score.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">{h.risk_level || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

