import { useMemo, useRef, useState } from "react";
import { forensicPredict, forensicPredictBatch, getAuth } from "../../services/api.js";
import { clamp01 } from "../../utils/score.js";
import { extractPdfText, inferCaseTitleAndDetailsFromText } from "../../utils/pdfText.js";
import forensicIllustration from "../../assets/forensic-illustration.svg";

const CLASS_STYLE = {
  highly_toxic:     "border-red-200 bg-red-50 text-red-700",
  moderately_toxic: "border-amber-200 bg-amber-50 text-amber-700",
  low_toxicity:     "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function makeId() {
  try {
    // Modern browsers
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // ignore
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function printForensicReport({ auth, caseId, caseTitle, caseDetails, forensicInfo, casePdfName, casePdfMeta, casePdfText, results }) {
	  const esc = (v) =>
	    String(v ?? "")
	      .replace(/&/g, "&amp;")
	      .replace(/</g, "&lt;")
	      .replace(/>/g, "&gt;")
	      .replace(/"/g, "&quot;")
	      .replace(/'/g, "&#39;");

	  const rows = (results || []).map((r, i) => {
    const sev = typeof r.severity === "number" ? clamp01(r.severity).toFixed(3) : "—";
    const llm = r.interpretation || r.causes?.length || r.domain_advice ? `
      <tr style="background:#fff7ed;">
        <td colspan="5" style="padding:10px 12px;">
          ${r.interpretation ? `<div style="font-size:12px;color:#0f172a;margin-bottom:6px;"><strong>Interpretation:</strong> ${esc(r.interpretation)}</div>` : ""}
          ${r.causes?.length ? `<div style="font-size:11px;color:#7c2d12;"><strong>Causes:</strong> ${r.causes.map(esc).join(" · ")}</div>` : ""}
          ${r.precautions?.length ? `<div style="font-size:11px;color:#92400e;"><strong>Precautions:</strong> ${r.precautions.map(esc).join(" · ")}</div>` : ""}
          ${r.remedies?.length ? `<div style="font-size:11px;color:#065f46;"><strong>Remedies:</strong> ${r.remedies.map(esc).join(" · ")}</div>` : ""}
          ${r.risks?.length ? `<div style="font-size:11px;color:#991b1b;"><strong>Risks:</strong> ${r.risks.map(esc).join(" · ")}</div>` : ""}
          ${r.domain_advice ? `<div style="font-size:11px;color:#1e40af;"><strong>Domain Advice:</strong> ${esc(r.domain_advice)}</div>` : ""}
        </td>
      </tr>` : "";

    return `
      <tr style="border-bottom:1px solid #fed7aa;">
        <td style="padding:8px 12px;color:#9a3412;font-size:12px;white-space:nowrap;">${i + 1}</td>
        <td style="padding:8px 12px;color:#0f172a;font-family:monospace;font-size:12px;max-width:320px;overflow:hidden;text-overflow:ellipsis;">${esc(r.smiles)}</td>
        <td style="padding:8px 12px;color:#0f172a;font-weight:800;font-size:12px;">${esc(r.classification || "—")}</td>
        <td style="padding:8px 12px;color:#0f172a;font-weight:800;font-size:12px;">${sev}</td>
        <td style="padding:8px 12px;color:#334155;font-size:12px;">${esc(r.analyzedAt ? new Date(r.analyzedAt).toLocaleString() : "—")}</td>
      </tr>
      ${llm}
    `;
	  }).join("");

	  const infoFields = [
	    ["caseType", "Case Type"],
	    ["requisitionNo", "Requisition / Reference No."],
	    ["requestingUnit", "Requesting Unit / Department"],
	    ["policeStation", "Police Station"],
	    ["investigatingOfficer", "Investigating Officer"],
	    ["placeOfOccurrence", "Place of Occurrence"],
	    ["incidentDate", "Incident Date"],
	    ["receivedDate", "Received Date"],
	    ["exhibitsReceived", "Exhibits / Samples Received"],
	    ["sealCondition", "Seal Condition"],
	    ["chainOfCustody", "Chain of Custody"],
	    ["testsRequested", "Tests / Examination Requested"],
	    ["remarks", "Remarks"],
	  ];

	  const infoRows = infoFields
	    .map(([k, label]) => [label, forensicInfo?.[k]])
	    .filter(([, v]) => String(v || "").trim())
	    .map(([label, v]) => `
	      <tr style="border-bottom:1px solid #fed7aa;">
	        <td style="padding:8px 12px;color:#9a3412;font-size:11px;white-space:nowrap;width:220px;">${esc(label)}</td>
	        <td style="padding:8px 12px;color:#0f172a;font-size:12px;white-space:pre-wrap;">${esc(v)}</td>
	      </tr>
	    `)
	    .join("");

	  const hasInfo = Boolean(infoRows);
	  const pdfText = String(casePdfText || "").trim();
	  const pdfExtract = pdfText
	    ? (pdfText.length > 9000 ? `${pdfText.slice(0, 9000)}\n\n[Truncated]` : pdfText)
	    : "";
	  const hasPdf = Boolean(pdfExtract);

	  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${esc(caseTitle ? `Forensic Case Report - ${caseTitle}` : "Forensic Case Report")}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a; padding:24px; }
        .top { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
        .brand { font-weight:900; font-size:16px; letter-spacing:-0.02em; }
        .meta { color:#9a3412; font-size:12px; margin-top:6px; }
        .card { margin-top:14px; border:1px solid #fed7aa; border-radius:14px; padding:14px; background:#fff; }
        .k { color:#9a3412; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; }
        .v { font-weight:700; margin-top:2px; font-size:12px; white-space:pre-wrap; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th { text-align:left; font-size:11px; color:#9a3412; text-transform:uppercase; letter-spacing:0.06em; padding:8px 12px; border-bottom:1px solid #fed7aa; background:#fff7ed; }
        @media print { body { padding:0; } .card { border:none; } }
      </style>
    </head>
    <body>
      <div class="top">
        <div>
          <div class="brand">Forensic Case Report</div>
	          <div class="meta">Generated: ${esc(new Date().toLocaleString())} · Analyst: ${esc(auth?.email || "—")} · Role: ${esc(auth?.role || "—")}</div>
        </div>
        <div style="text-align:right;">
          <div class="k">Case ID</div>
          <div style="font-family:monospace;font-weight:900;">${esc(caseId || "—")}</div>
        </div>
      </div>

      <div class="card">
        <div class="k">Case Title</div>
        <div class="v">${esc(caseTitle || "—")}</div>
        <div style="margin-top:10px;" class="k">Case Details</div>
        <div class="v">${esc(caseDetails || "—")}</div>
      </div>

      ${hasInfo ? `
      <div class="card">
        <div style="font-weight:900;">Forensic Department Details</div>
        <table>
          <tbody>
            ${infoRows}
          </tbody>
        </table>
      </div>` : ""}

      ${hasPdf ? `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;">
          <div style="font-weight:900;">Uploaded Case PDF Extract</div>
          <div style="font-size:11px;color:#9a3412;">
            ${esc(casePdfName || "")}
            ${casePdfMeta?.pagesParsed ? ` · Pages: ${esc(casePdfMeta.pagesParsed)}/${esc(casePdfMeta.totalPages || casePdfMeta.pagesParsed)}${casePdfMeta.truncated ? " (first pages only)" : ""}` : ""}
          </div>
        </div>
        <div class="v" style="margin-top:10px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight:600;">
          ${esc(pdfExtract)}
        </div>
      </div>` : ""}

      <div class="card">
        <div style="font-weight:900;">Compounds Analyzed (${(results || []).length})</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>SMILES</th>
              <th>Classification</th>
              <th>Severity</th>
              <th>Analyzed</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="5" style="padding:12px;color:#9a3412;">No compounds analyzed.</td></tr>`}
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
  setTimeout(() => w.print(), 250);
}

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function Forensic() {
  const auth = getAuth();
  const [caseId, setCaseId] = useState(makeId());
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDetails, setCaseDetails] = useState("");
  const [forensicInfo, setForensicInfo] = useState({
    caseType: "",
    requestingUnit: "",
    policeStation: "",
    investigatingOfficer: "",
    requisitionNo: "",
    incidentDate: "",
    receivedDate: "",
    placeOfOccurrence: "",
    exhibitsReceived: "",
    sealCondition: "",
    chainOfCustody: "",
    testsRequested: "",
    remarks: "",
  });
  const [casePdf, setCasePdf] = useState(null);
  const [casePdfText, setCasePdfText] = useState("");
  const [casePdfMeta, setCasePdfMeta] = useState({ pagesParsed: 0, totalPages: 0, truncated: false });
  const [casePdfLoading, setCasePdfLoading] = useState(false);
  const [casePdfError, setCasePdfError] = useState("");
  const parseJobRef = useRef(0);

  const [smilesInput, setSmilesInput] = useState("CCO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [debugLastPayload, setDebugLastPayload] = useState(null);
  const [bulkMode, setBulkMode] = useState(true);
  const [bulkIncludeLlm, setBulkIncludeLlm] = useState(false);
  const [smilesFileName, setSmilesFileName] = useState("");
  const [smilesFileError, setSmilesFileError] = useState("");

  function normalizeSmiles(raw) {
    if (typeof raw !== "string") return "";
    // Remove any whitespace (including NBSP/zero-width) that often appears when pasting from PDFs/Word.
    const s = raw
      .replace(/\u00a0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, "")
      .trim();
    // Strip common trailing delimiters
    return s.replace(/[;,]+$/g, "");
  }

  function extractSmilesFromJson(text) {
    const t = String(text || "").trim();
    if (!t) return [];
    if (!(t.startsWith("[") || t.startsWith("{"))) return [];
    try {
      const parsed = JSON.parse(t);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((row) => row?.smiles)
        .filter((v) => typeof v === "string" && v.trim());
    } catch {
      return [];
    }
  }

  function extractSmilesFromTable(text) {
    const t = String(text || "").trim();
    if (!t) return [];

    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t")
      ? "\t"
      : (headerLine.includes(",") ? "," : (headerLine.includes(";") ? ";" : null));

    const splitRow = (line) => {
      if (delimiter) return line.split(delimiter);
      // Whitespace-table fallback (common when pasting from PDFs): split on 2+ spaces, else on any whitespace.
      if (/\s{2,}/.test(line)) return line.split(/\s{2,}/g);
      return line.split(/\s+/g);
    };

    const headers = splitRow(headerLine)
      .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

    const idx = headers.findIndex((h) => h === "smiles" || h === "smile");
    if (idx < 0) return [];

    const out = [];
    for (const line of lines.slice(1)) {
      const cols = splitRow(line).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (idx >= cols.length) continue;
      const v = cols[idx];
      if (v) out.push(v);
    }
    return out;
  }

  function extractSmilesCandidates(text) {
    // 1) JSON array of objects: [{ smiles: "CCO" }, ...]
    const jsonSmiles = extractSmilesFromJson(text);
    if (jsonSmiles.length) return jsonSmiles;

    // 2) TSV/CSV table with a header column named "smiles"
    const tableSmiles = extractSmilesFromTable(text);
    if (tableSmiles.length) return tableSmiles;

    // 3) Fallback: accept one-per-line / separated by comma/semicolon
    return (text || "")
      .split(/[\r\n]+/)
      .flatMap((line) => line.split(/[;,]+/g))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function looksLikeId(s) {
    const v = String(s || "").trim();
    if (!v) return false;
    if (/^[0-9a-f]{24}$/i.test(v)) return true; // MongoDB ObjectId-like
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) return true; // UUID
    return false;
  }

  const { smilesList, skippedIdLike } = useMemo(() => {
    const lines = extractSmilesCandidates(smilesInput)
      .map(normalizeSmiles)
      .filter(Boolean);
    // de-dupe while preserving order
    const seen = new Set();
    const unique = lines.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));

    let skipped = 0;
    const filtered = unique.filter((s) => (looksLikeId(s) ? (skipped++, false) : true));
    return { smilesList: filtered, skippedIdLike: skipped };
  }, [smilesInput]);

  const canSubmit = useMemo(() => smilesList.length > 0 && !loading, [smilesList.length, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    if (smilesList.length > 50) {
      setError("Too many SMILES at once (max 50).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const cid = (caseId || "").trim() || makeId();
      if (cid !== caseId) setCaseId(cid);

      const analyzedAt = new Date().toISOString();

      let newResults = [];

      if (bulkMode && smilesList.length > 1) {
        setDebugLastPayload({ smiles_list: smilesList, caseId: cid, caseTitle, caseDetails, include_llm: bulkIncludeLlm });
        const data = await forensicPredictBatch(smilesList, cid, caseTitle, caseDetails, bulkIncludeLlm);
        newResults = (data.results || []).map((r) => {
          const llm = r.llm_analysis || {};
          return {
            smiles: r.smiles,
            classification: r.classification,
            severity: clamp01(r.severity),
            analyzedAt,
            interpretation: llm.interpretation || "",
            causes: Array.isArray(llm.causes) ? llm.causes : [],
            precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
            remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
            risks: Array.isArray(llm.risks) ? llm.risks : [],
            domain_advice: llm.domain_advice || "",
          };
        });
      } else {
        newResults = [];
        for (const original of smilesList) {
          const s = normalizeSmiles(original);
          if (!s) continue;
          try {
            setDebugLastPayload({ smiles: s, caseId: cid, caseTitle, caseDetails });
            const data = await forensicPredict(s, cid, caseTitle, caseDetails);
            const llm = data.llm_analysis || {};
            newResults.push({
              smiles: s,
              classification: data.classification,
              severity: clamp01(data.severity),
              analyzedAt,
              interpretation: llm.interpretation || "",
              causes: Array.isArray(llm.causes) ? llm.causes : [],
              precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
              remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
              risks: Array.isArray(llm.risks) ? llm.risks : [],
              domain_advice: llm.domain_advice || "",
            });
          } catch (e2) {
            const msg = e2?.message || "Forensic prediction failed.";
            throw new Error(`SMILES "${s}" failed: ${msg}`);
          }
        }
      }

      setResults((prev) => [...newResults, ...prev]);
    } catch (err) {
      console.warn("Forensic API failed", err);
      setError(err?.message || "Forensic prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSelectCasePdf(file) {
    const jobId = Date.now();
    parseJobRef.current = jobId;

    if (!file) {
      setCasePdf(null);
      setCasePdfText("");
      setCasePdfMeta({ pagesParsed: 0, totalPages: 0, truncated: false });
      setCasePdfError("");
      return;
    }

    setCasePdf(file);
    setCasePdfError("");
    setCasePdfLoading(true);
    try {
      const extracted = await extractPdfText(file, { maxPages: 25 });
      if (parseJobRef.current !== jobId) return;

      setCasePdfMeta(extracted);
      setCasePdfText(extracted.text || "");

      const inferred = inferCaseTitleAndDetailsFromText(extracted.text || "");
      if (!caseTitle.trim() && inferred.title) setCaseTitle(inferred.title);
      if (!caseDetails.trim() && inferred.details) setCaseDetails(inferred.details);
    } catch (err) {
      if (parseJobRef.current !== jobId) return;
      console.warn("PDF extract failed", err);
      setCasePdfError("Could not extract text from this PDF. If the PDF is scanned (image-only), OCR is needed.");
      setCasePdfText("");
      setCasePdfMeta({ pagesParsed: 0, totalPages: 0, truncated: false });
    } finally {
      if (parseJobRef.current === jobId) setCasePdfLoading(false);
    }
  }

  async function onSelectSmilesFile(file) {
    if (!file) {
      setSmilesFileName("");
      setSmilesFileError("");
      return;
    }
    setSmilesFileName(file.name || "");
    setSmilesFileError("");
    try {
      const text = await file.text();
      const candidates = extractSmilesCandidates(text)
        .map(normalizeSmiles)
        .filter(Boolean);
      const seen = new Set();
      const unique = candidates.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
      const filtered = unique.filter((s) => !looksLikeId(s));
      if (!filtered.length) {
        setSmilesFileError('No "smiles" column found (or it is empty). Make sure the file has a header named "smiles".');
        return;
      }
      setSmilesInput(filtered.join("\n"));
    } catch (e) {
      setSmilesFileError("Could not read this file.");
    }
  }

  function setInfoField(key, value) {
    setForensicInfo((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Forensic Case Analysis</h1>
              <p className="mt-1 text-sm text-gray-500">
                Enter case details, analyze one or more compounds (SMILES), then export a case PDF.
              </p>
              <div className="mt-2 text-xs text-gray-400">
                Analyst: <span className="font-semibold text-gray-600">{auth?.email}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={results.length === 0}
                onClick={() => printForensicReport({
                  auth,
                  caseId,
                  caseTitle,
                  caseDetails,
                  forensicInfo,
                  casePdfName: casePdf?.name || "",
                  casePdfMeta,
                  casePdfText: casePdfText || "",
                  results,
                })}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-40"
              >
                Download Case PDF
              </button>
              <button
                type="button"
                onClick={() => { setResults([]); setError(""); }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Case ID (UUID)</label>
                <input className={`${INPUT} font-mono`} value={caseId} onChange={(e) => setCaseId(e.target.value)} />
                <div className="mt-1 text-[11px] text-gray-400">Use your own, or keep the auto-generated UUID.</div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Case Title</label>
                <input className={INPUT} value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="e.g., Unknown compound from evidence bag A" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Case Details</label>
              <textarea className={`${INPUT} resize-y`} rows={3} value={caseDetails} onChange={(e) => setCaseDetails(e.target.value)} placeholder="Notes, context, lab details, chain-of-custody summary..." />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Upload Case PDF (optional)</label>
              <input
                className={`${INPUT} p-2`}
                type="file"
                accept="application/pdf"
                onChange={(e) => onSelectCasePdf(e.target.files?.[0] || null)}
              />
              <div className="mt-1 text-[11px] text-gray-400">
                Upload a text-based PDF to auto-extract the case title/details and show the extracted text below.
              </div>
              {casePdf ? (
                <div className="mt-2 text-[11px] text-gray-500">
                  File: <span className="font-semibold">{casePdf.name}</span>
                  {casePdfMeta?.pagesParsed ? (
                    <>
                      {" "}Â· Pages: {casePdfMeta.pagesParsed}/{casePdfMeta.totalPages || casePdfMeta.pagesParsed}
                      {casePdfMeta.truncated ? " (first pages only)" : ""}
                    </>
                  ) : null}
                  {casePdfLoading ? " Â· Extracting..." : ""}
                </div>
              ) : null}
              {casePdfError ? (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{casePdfError}</div>
              ) : null}
              {casePdfText ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Extracted PDF Text</div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(casePdfText)}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea className={`${INPUT} font-mono resize-y`} rows={6} value={casePdfText} readOnly />
                </div>
              ) : null}
            </div>

            <details className="group rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 select-none">
                Forensic Department Details (optional)
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Case Type</label>
                  <input className={INPUT} value={forensicInfo.caseType} onChange={(e) => setInfoField("caseType", e.target.value)} placeholder="e.g., Toxicology / Narcotics / Unknown" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Requisition / Reference No.</label>
                  <input className={`${INPUT} font-mono`} value={forensicInfo.requisitionNo} onChange={(e) => setInfoField("requisitionNo", e.target.value)} placeholder="e.g., RFSL/2026/000123" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Requesting Unit / Department</label>
                  <input className={INPUT} value={forensicInfo.requestingUnit} onChange={(e) => setInfoField("requestingUnit", e.target.value)} placeholder="e.g., District Police / Hospital / Court" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Police Station</label>
                  <input className={INPUT} value={forensicInfo.policeStation} onChange={(e) => setInfoField("policeStation", e.target.value)} placeholder="e.g., Central PS" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Investigating Officer</label>
                  <input className={INPUT} value={forensicInfo.investigatingOfficer} onChange={(e) => setInfoField("investigatingOfficer", e.target.value)} placeholder="Name / Rank / Contact" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Place of Occurrence</label>
                  <input className={INPUT} value={forensicInfo.placeOfOccurrence} onChange={(e) => setInfoField("placeOfOccurrence", e.target.value)} placeholder="Location / address" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Incident Date</label>
                  <input className={INPUT} type="date" value={forensicInfo.incidentDate} onChange={(e) => setInfoField("incidentDate", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Received Date</label>
                  <input className={INPUT} type="date" value={forensicInfo.receivedDate} onChange={(e) => setInfoField("receivedDate", e.target.value)} />
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Exhibits / Samples Received</label>
                  <textarea className={`${INPUT} resize-y`} rows={3} value={forensicInfo.exhibitsReceived} onChange={(e) => setInfoField("exhibitsReceived", e.target.value)} placeholder="Item list, labels, quantity, packaging..." />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Seal Condition</label>
                    <input className={INPUT} value={forensicInfo.sealCondition} onChange={(e) => setInfoField("sealCondition", e.target.value)} placeholder="Intact / Broken / Not provided" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Chain of Custody</label>
                    <input className={INPUT} value={forensicInfo.chainOfCustody} onChange={(e) => setInfoField("chainOfCustody", e.target.value)} placeholder="Short summary / reference" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Tests / Examination Requested</label>
                  <textarea className={`${INPUT} resize-y`} rows={2} value={forensicInfo.testsRequested} onChange={(e) => setInfoField("testsRequested", e.target.value)} placeholder="What needs to be determined (e.g., screening, confirmatory analysis)..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Remarks</label>
                  <textarea className={`${INPUT} resize-y`} rows={2} value={forensicInfo.remarks} onChange={(e) => setInfoField("remarks", e.target.value)} placeholder="Any extra notes for the report." />
                </div>
              </div>

              <div className="mt-3 text-[11px] text-gray-500">
                These fields are included in the printable case report, but only `caseId`, `caseTitle`, and `caseDetails` are sent to the prediction API.
              </div>
            </details>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">SMILES to analyze</label>
              <textarea
                className={`${INPUT} font-mono resize-y`}
                rows={4}
                value={smilesInput}
                onChange={(e) => setSmilesInput(e.target.value)}
                placeholder={"Supports:\n- One SMILES per line\n- Comma/semicolon separated\n- TSV/CSV with a header column named smiles\n- JSON array like [{\"smiles\":\"CCO\"}]\n\nExample:\nsmiles\tname\nCCO\tethanol\nCC(=O)O\tacetic acid"}
              />
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Upload CSV/TSV (smiles column)</label>
                  <input
                    className={`${INPUT} p-2`}
                    type="file"
                    accept=".csv,.tsv,text/csv,text/tab-separated-values"
                    onChange={(e) => onSelectSmilesFile(e.target.files?.[0] || null)}
                  />
                  {smilesFileName ? (
                    <div className="mt-1 text-[11px] text-gray-500">File: <span className="font-semibold">{smilesFileName}</span></div>
                  ) : null}
                  {smilesFileError ? (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{smilesFileError}</div>
                  ) : null}
                </div>
                <div className="text-[11px] text-gray-500">
                  Tip: If you use `pharma_ai.dk.csv`, it has columns `_id, smiles, ...`. The app will use only the `smiles` column.
                </div>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                {smilesList.length} unique SMILES ready. (Whitespace inside a SMILES is ignored.)
                {skippedIdLike ? ` Skipped ${skippedIdLike} ID-like value(s).` : ""}
              </div>
              {smilesList.length ? (
                <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-700 select-none">
                    Preview parsed SMILES
                  </summary>
                  <div className="mt-2 grid gap-1">
                    {smilesList.slice(0, 20).map((s) => (
                      <div key={s} className="font-mono text-xs text-gray-700 break-all">{s}</div>
                    ))}
                    {smilesList.length > 20 ? (
                      <div className="text-[11px] text-gray-500">…and {smilesList.length - 20} more</div>
                    ) : null}
                  </div>
                </details>
              ) : null}
              {debugLastPayload ? (
                <details className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-700 select-none">
                    Debug: last request payload
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-700">
                    {JSON.stringify(debugLastPayload, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Analyze Compounds"}
              </button>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-gray-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} />
                  Bulk mode (single request)
                </label>
                <label className={`flex items-center gap-2 ${bulkMode ? "" : "opacity-50"}`}>
                  <input type="checkbox" disabled={!bulkMode} checked={bulkIncludeLlm} onChange={(e) => setBulkIncludeLlm(e.target.checked)} />
                  Include AI narrative (slower)
                </label>
              </div>
            </form>
          </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="text-sm font-semibold text-gray-900">Case workflow</div>
          <div className="mt-1 text-xs text-gray-500">Case details → SMILES → classification → printable PDF.</div>
          <img className="mt-4 w-full rounded-xl border border-gray-100 bg-gray-50" src={forensicIllustration} alt="Forensic illustration" />
          <div className="mt-3 text-xs text-gray-400">
            Saved to history automatically (per compound) with `caseId`, `caseTitle`, and `caseDetails`.
          </div>
        </div>
      </div>

      {results.length ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Results ({results.length})
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((r, idx) => (
              <div key={`${r.smiles}-${idx}`} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">SMILES</div>
                    <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 break-all">
                      {r.smiles}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">Analyzed: {r.analyzedAt ? new Date(r.analyzedAt).toLocaleString() : "—"}</div>
                  </div>
                  <div className={`shrink-0 rounded-xl border p-4 ${CLASS_STYLE[r.classification] || "border-gray-200 bg-gray-50 text-gray-700"}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Classification</div>
                    <div className="mt-1 text-2xl font-bold">{r.classification}</div>
                    <div className="mt-2 text-sm font-medium">
                      Severity: <span className="font-mono font-bold">{clamp01(r.severity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {(r.interpretation || r.causes?.length || r.domain_advice) ? (
                  <div className="mt-4 space-y-2">
                    {r.interpretation ? (
                      <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {r.interpretation}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Causes", items: r.causes, accent: "text-gray-700" },
                        { label: "Precautions", items: r.precautions, accent: "text-amber-700" },
                        { label: "Remedies", items: r.remedies, accent: "text-emerald-700" },
                        { label: "Risks", items: r.risks, accent: "text-red-700" },
                      ]
                        .filter((s) => s.items?.length)
                        .map(({ label, items, accent }) => (
                          <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                            <ul className={`list-disc pl-4 space-y-0.5 text-xs ${accent}`}>
                              {items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                    {r.domain_advice ? (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                        <span className="font-semibold">Domain Advice: </span>
                        {r.domain_advice}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No forensic results yet. Enter case details and analyze at least one SMILES.
        </div>
      )}
    </div>
  );
}
