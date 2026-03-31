import { useState } from "react";
import { getAuth, setAuth } from "../services/api.js";

const REQUIREMENTS_KEY = "user_requirements";
const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function Settings() {
  const auth = getAuth();
  const [email, setEmail] = useState(auth?.email || "");
  const [savedMsg, setSavedMsg] = useState("");

  function saveProfile() {
    setSavedMsg("");
    // Only save display name — role is controlled by the backend JWT, not editable client-side
    setAuth({ ...auth, email: email.trim() });
    setSavedMsg("Profile saved.");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  function saveRequirements() {
    localStorage.setItem(REQUIREMENTS_KEY, requirements);
    setSavedMsg("Requirements saved.");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  const [requirements, setRequirements] = useState(() => localStorage.getItem(REQUIREMENTS_KEY) || "");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your profile and preferences.</p>
      </div>

      {/* Profile section */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <div className={`${INPUT} bg-gray-50 text-gray-500 cursor-not-allowed`}>{auth?.role || "—"}</div>
              <p className="mt-1 text-xs text-gray-400">Role is set at registration and cannot be changed here.</p>
            </div>
          </div>
          <button type="button" onClick={saveProfile}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
            Save profile
          </button>
        </div>
      </div>

      {/* Requirements section */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Requirements</h2>
          <p className="mt-0.5 text-xs text-gray-500">Re-authenticate to unlock editing.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements</label>
            <textarea
              className={`${INPUT} h-36 resize-none`}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Edit requirements here..."
            />
            <button type="button" onClick={saveRequirements}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              Save requirements
            </button>
          </div>
        </div>
      </div>

      {savedMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ {savedMsg}
        </div>
      ) : null}
    </div>
  );
}
