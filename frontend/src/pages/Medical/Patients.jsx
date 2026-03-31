import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPatient, deletePatient, getAllPatients, getAuth } from "../../services/api.js";
import medicalIllustration from "../../assets/medical-illustration.svg";

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

function safeDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

export default function Patients() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "male",
    contact: "",
    email: "",
    address: "",
    medicalHistory: "",
    allergies: "",
    currentMedications: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getAllPatients(search.trim());
      setPatients(data.patients || []);
    } catch (e) {
      setError(e?.message || "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.contact || "").toLowerCase().includes(q) ||
        (p.patientId || "").toLowerCase().includes(q)
    );
  }, [patients, search]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  }

  async function onCreate(e) {
    e.preventDefault();
    setFormError("");
    const name = form.name.trim();
    const contact = form.contact.trim();
    const ageNum = Number(form.age);
    if (!name) return setFormError("Name is required.");
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) return setFormError("Age must be between 0 and 150.");
    if (!contact) return setFormError("Contact is required.");

    setSubmitting(true);
    try {
      const data = await createPatient({ ...form, name, contact, age: ageNum });
      const created = data.patient;
      setPatients((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({
        name: "",
        age: "",
        gender: "male",
        contact: "",
        email: "",
        address: "",
        medicalHistory: "",
        allergies: "",
        currentMedications: "",
        notes: "",
      });
      navigate(`/medical/patients/${created.patientId}`);
    } catch (e2) {
      setFormError(e2?.message || "Failed to create patient.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(p) {
    if (!p?.patientId) return;
    const ok = window.confirm(`Delete patient "${p.name}"? This does not delete historical predictions.`);
    if (!ok) return;
    try {
      await deletePatient(p.patientId);
      setPatients((prev) => prev.filter((x) => x.patientId !== p.patientId));
    } catch (e) {
      alert(e?.message || "Failed to delete patient.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Hospital Patients</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create patient records (UUID), run analyses, and export patient-specific PDFs.
              </p>
              <div className="mt-2 text-xs text-gray-400">
                Signed in as <span className="font-semibold text-gray-600">{auth?.email}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                {showForm ? "Close" : "Add Patient"}
              </button>
              <Link
                to="/medical/patient"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Patient Risk Tool
              </Link>
            </div>
          </div>

          {showForm ? (
            <form onSubmit={onCreate} className="mt-6 space-y-4">
              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Full Name *</label>
                  <input name="name" value={form.name} onChange={onChange} className={INPUT} placeholder="Patient name" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Contact Number *</label>
                  <input name="contact" value={form.contact} onChange={onChange} className={INPUT} placeholder="Phone number" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Age *</label>
                  <input name="age" type="number" min={0} max={150} value={form.age} onChange={onChange} className={INPUT} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender *</label>
                  <select name="gender" value={form.gender} onChange={onChange} className={INPUT}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                  <input name="email" type="email" value={form.email} onChange={onChange} className={INPUT} placeholder="optional" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Address</label>
                  <input name="address" value={form.address} onChange={onChange} className={INPUT} placeholder="optional" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Medical History</label>
                  <textarea
                    name="medicalHistory"
                    value={form.medicalHistory}
                    onChange={onChange}
                    rows={3}
                    className={`${INPUT} resize-y`}
                    placeholder="Previous conditions, surgeries, etc."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={onChange}
                    rows={3}
                    className={`${INPUT} resize-y`}
                    placeholder="Any additional notes"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Allergies</label>
                  <textarea
                    name="allergies"
                    value={form.allergies}
                    onChange={onChange}
                    rows={2}
                    className={`${INPUT} resize-y`}
                    placeholder="Known allergies"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Current Medications</label>
                  <textarea
                    name="currentMedications"
                    value={form.currentMedications}
                    onChange={onChange}
                    rows={2}
                    className={`${INPUT} resize-y`}
                    placeholder="Medications and dosages"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Patient"}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="text-sm font-semibold text-gray-900">Clinical workspace</div>
          <div className="mt-1 text-xs text-gray-500">Patient UUIDs, history, and printable reports.</div>
          <img
            className="mt-4 w-full rounded-xl border border-gray-100 bg-gray-50"
            src={medicalIllustration}
            alt="Hospital illustration"
          />
          <div className="mt-3 text-xs text-gray-400">
            Tip: Open a patient to run a new analysis and generate a patient-specific PDF.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-lg">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={INPUT}
            placeholder="Search by name, contact, or patient UUID..."
          />
        </div>
        <div className="text-sm text-gray-500">
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="text-sm text-gray-400">No patients found.</div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Add your first patient
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.patientId} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-gray-900">{p.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    UUID: <span className="font-mono text-gray-700">{p.patientId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Age {p.age}</span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold capitalize text-gray-700">{p.gender}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{p.contact}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Predictions</div>
                  <div className="mt-0.5 text-sm font-bold text-gray-900">{p.predictionCount || 0}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Last activity</div>
                  <div className="mt-0.5 text-xs font-semibold text-gray-700">{safeDate(p.lastPrediction)}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Link
                  to={`/medical/patients/${p.patientId}`}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

