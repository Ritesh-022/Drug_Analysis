import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { clearAuth, getAuth, getHistory } from "../services/api.js";
import { clamp01, interpretationForFinalScore, scoreBand } from "../utils/score.js";

// Role → modules mapping
const ROLE_MODULES = {
  pharma: [
    { title: "Prediction",  desc: "Single SMILES scoring",     to: "/prediction/input" },
    { title: "Batch",       desc: "Upload CSV and score",       to: "/prediction/batch" },
    { title: "History",     desc: "Local prediction log",       to: "/utility/history" },
    { title: "Report",      desc: "Download JSON report",        to: "/utility/report" },
    { title: "Settings",    desc: "Profile & preferences",      to: "/settings" },
  ],
  medical: [
    { title: "Patient Risk", desc: "Age + weight risk analysis", to: "/medical/patient" },
    { title: "Prediction",   desc: "Single SMILES scoring",     to: "/prediction/input" },
    { title: "History",      desc: "Local prediction log",       to: "/utility/history" },
    { title: "Report",       desc: "Download JSON report",        to: "/utility/report" },
    { title: "Settings",     desc: "Profile & preferences",      to: "/settings" },
  ],
  forensic: [
    { title: "Forensic",    desc: "Classification + severity",  to: "/forensic" },
    { title: "Prediction",  desc: "Single SMILES scoring",     to: "/prediction/input" },
    { title: "History",     desc: "Local prediction log",       to: "/utility/history" },
    { title: "Report",      desc: "Download JSON report",        to: "/utility/report" },
    { title: "Settings",    desc: "Profile & preferences",      to: "/settings" },
  ],
  admin: [
    { title: "Prediction",   desc: "Single SMILES scoring",     to: "/prediction/input" },
    { title: "Batch",        desc: "Upload CSV and score",       to: "/prediction/batch" },
    { title: "Patient Risk", desc: "Age + weight risk analysis", to: "/medical/patient" },
    { title: "Forensic",     desc: "Classification + severity",  to: "/forensic" },
    { title: "History",      desc: "Local prediction log",       to: "/utility/history" },
    { title: "Report",       desc: "Download JSON report",        to: "/utility/report" },
    { title: "Settings",     desc: "Profile & preferences",      to: "/settings" },
  ],
};

const ROLE_LABEL = {
  pharma:   { label: "Pharma",   color: "bg-blue-100 text-blue-700" },
  medical:  { label: "Medical",  color: "bg-emerald-100 text-emerald-700" },
  forensic: { label: "Forensic", color: "bg-amber-100 text-amber-700" },
  admin:    { label: "Admin",    color: "bg-purple-100 text-purple-700" },
};

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function NavCard({ title, desc, to }) {
  return (
    <Link to={to} className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{desc}</div>
    </Link>
  );
}

const BAND_BADGE = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  bad:  "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export default function Dashboard() {
  const auth = getAuth();
  const role = auth?.role || "pharma";

  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    getHistory()
      .then((data) => setHistory(data.history || []))
      .catch((err) => {
        if (err?.message?.includes("not authenticated") || err?.message?.includes("401")) {
          clearAuth();
          navigate("/login", { replace: true });
        } else {
          setHistoryError("Failed to load recent predictions.");
        }
      });
  }, []);

  const total = history.length;
  const avg = total === 0 ? 0 :
    history.reduce((acc, h) => {
      const s = h.final_score ?? h.adjusted_toxicity ?? h.severity;
      return acc + (Number.isFinite(Number(s)) ? Number(s) : 0);
    }, 0) / total;

  const latest = history[0];
  const latestScore = latest ? clamp01(latest.final_score ?? latest.adjusted_toxicity ?? latest.severity ?? 0) : null;
  const recent = history.slice(0, 5);

  const modules = ROLE_MODULES[role] || ROLE_MODULES.pharma;
  const roleInfo = ROLE_LABEL[role] || ROLE_LABEL.pharma;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <p className="text-sm font-medium text-blue-600">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Signed in as <span className="font-semibold text-gray-900">{auth?.email || "user"}</span>
          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        </p>
      </div>

      {historyError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{historyError}</div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Predictions" value={total} hint="Stored in MongoDB" />
        <StatCard label="Avg Final Score" value={clamp01(avg).toFixed(2)} hint="Across all your predictions" />
        <StatCard
          label="Latest Score"
          value={latestScore === null ? "—" : latestScore.toFixed(2)}
          hint={latestScore === null ? "Run a prediction to populate" : interpretationForFinalScore(latestScore)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent predictions */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Predictions</h2>
            <Link className="text-xs font-semibold text-blue-600 hover:text-blue-700" to="/utility/history">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No predictions yet. Run one to get started.</div>
            ) : recent.map((h, idx) => {
              const raw = h.final_score ?? h.adjusted_toxicity ?? h.severity;
              const score = clamp01(typeof raw === "number" ? raw : 0);
              const band = scoreBand(score);
              return (
                <div key={`${h.smiles}-${idx}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <span className="font-mono text-sm text-gray-700">{h.smiles}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_BADGE[band]}`}>{score.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Role-specific modules */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Your Modules</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleInfo.color}`}>{roleInfo.label} access</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {modules.map((m) => <NavCard key={m.to} title={m.title} desc={m.desc} to={m.to} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
