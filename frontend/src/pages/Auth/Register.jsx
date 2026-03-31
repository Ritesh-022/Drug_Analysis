import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../../services/api.js";

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("pharma");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [agency, setAgency] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const dynamicFieldOk =
    (role === "pharma" && company.trim()) ||
    (role === "medical" && licenseId.trim()) ||
    (role === "forensic" && agency.trim());

  const canSubmit = useMemo(
    () => email.trim() && password.trim() && name.trim() && dynamicFieldOk && !loading,
    [email, password, name, dynamicFieldOk, loading]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!canSubmit) { setError("Please fill all required fields."); return; }
    setLoading(true);
    try {
      const organization = role === "pharma" ? company.trim() : role === "medical" ? licenseId.trim() : agency.trim();
      await register(email.trim(), password, role, name.trim(), organization);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a role to tailor your experience</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form className="space-y-5" onSubmit={onSubmit}>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {["pharma", "medical", "forensic"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition capitalize ${
                      role === r
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Email row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
                <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
              <input type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
              <input type="password" className={INPUT} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {/* Dynamic role field */}
            {role === "pharma" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company <span className="text-red-500">*</span></label>
                <input className={INPUT} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Pharma Ltd." />
              </div>
            )}
            {role === "medical" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Medical License ID <span className="text-red-500">*</span></label>
                <input className={INPUT} value={licenseId} onChange={(e) => setLicenseId(e.target.value)} placeholder="LIC-12345" />
              </div>
            )}
            {role === "forensic" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Agency / Department <span className="text-red-500">*</span></label>
                <input className={INPUT} value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Forensic Lab, City PD" />
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
