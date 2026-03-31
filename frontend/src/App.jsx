import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Login from "./pages/Auth/Login.jsx";
import Register from "./pages/Auth/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";

import PredictionInput from "./pages/Prediction/Input.jsx";
import PredictionResults from "./pages/Prediction/Results.jsx";
import PredictionBatch from "./pages/Prediction/Batch.jsx";

import Patient from "./pages/Medical/Patient.jsx";
import Patients from "./pages/Medical/Patients.jsx";
import PatientDetail from "./pages/Medical/PatientDetail.jsx";
import Forensic from "./pages/Forensic/Forensic.jsx";

import History from "./pages/Utility/History.jsx";
import Report from "./pages/Utility/Report.jsx";

import { clearAuth, getAuth, logout, verifyAuth } from "./services/api.js";

// Role → nav links (each role sees only its relevant pages)
const ROLE_NAV = {
  pharma: [
    { label: "Predict",  to: "/prediction/input" },
    { label: "Batch",    to: "/prediction/batch" },
    { label: "History",  to: "/utility/history" },
    { label: "Report",   to: "/utility/report" },
    { label: "Settings", to: "/settings" },
  ],
  medical: [
    { label: "Patients",     to: "/medical/patients" },
    { label: "Patient Risk", to: "/medical/patient" },
    { label: "Predict",      to: "/prediction/input" },
    { label: "History",      to: "/utility/history" },
    { label: "Report",       to: "/utility/report" },
    { label: "Settings",     to: "/settings" },
  ],
  forensic: [
    { label: "Forensic", to: "/forensic" },
    { label: "Predict",  to: "/prediction/input" },
    { label: "History",  to: "/utility/history" },
    { label: "Report",   to: "/utility/report" },
    { label: "Settings", to: "/settings" },
  ],
  admin: [
    { label: "Predict",      to: "/prediction/input" },
    { label: "Batch",        to: "/prediction/batch" },
    { label: "Patients",     to: "/medical/patients" },
    { label: "Patient Risk", to: "/medical/patient" },
    { label: "Forensic",     to: "/forensic" },
    { label: "History",      to: "/utility/history" },
    { label: "Report",       to: "/utility/report" },
    { label: "Settings",     to: "/settings" },
  ],
};

function RequireAuth({ children }) {
  const auth = getAuth();
  const location = useLocation();
  useEffect(() => {
    if (!auth?.email) return;
    verifyAuth().catch(() => { clearAuth(); window.location.replace("/login"); });
  }, [location.pathname]);
  if (!auth?.email) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function AppShell({ children }) {
  const auth = getAuth();
  const location = useLocation();
  const role = auth?.role || "pharma";
  const navLinks = ROLE_NAV[role] || ROLE_NAV.pharma;

  return (
    <div className="min-h-full bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="text-base font-bold tracking-tight text-gray-900">
            Pharma AI
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {navLinks.map(({ label, to }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-3 py-2 font-medium transition ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-xs text-gray-500 md:block">
              {auth?.email ? `${auth.email} · ${role}` : "Guest"}
            </div>
            {auth?.email ? (
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50"
                onClick={async () => { await logout(); window.location.href = "/login"; }}
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <AppShell>
                <Dashboard />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/prediction/input"
          element={
            <RequireAuth>
              <AppShell>
                <PredictionInput />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/prediction/results"
          element={
            <RequireAuth>
              <AppShell>
                <PredictionResults />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/prediction/batch"
          element={
            <RequireAuth>
              <AppShell>
                <PredictionBatch />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/medical/patient"
          element={
            <RequireAuth>
              <AppShell>
                <Patient />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/medical/patients"
          element={
            <RequireAuth>
              <AppShell>
                <Patients />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/medical/patients/:patientId"
          element={
            <RequireAuth>
              <AppShell>
                <PatientDetail />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/forensic"
          element={
            <RequireAuth>
              <AppShell>
                <Forensic />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/utility/history"
          element={
            <RequireAuth>
              <AppShell>
                <History />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/utility/report"
          element={
            <RequireAuth>
              <AppShell>
                <Report />
              </AppShell>
            </RequireAuth>
          }
        />
<Route
          path="/settings"
          element={
            <RequireAuth>
              <AppShell>
                <Settings />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
