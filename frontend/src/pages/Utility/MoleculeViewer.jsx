import { useMemo, useState } from "react";
import { visualize } from "../../services/api.js";

export default function MoleculeViewer() {
  const [smiles, setSmiles] = useState("CCO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [molecule, setMolecule] = useState(null);

  const canSubmit = useMemo(() => smiles.trim() && !loading, [smiles, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setMolecule(null);
    const s = smiles.trim();
    if (!s) return;
    setLoading(true);
    try {
      const data = await visualize(s);
      if (!data?.image) throw new Error("No image returned.");
      setMolecule({ image: data.image, format: data.format || "svg" });
    } catch (err) {
      setError(err?.message || "Visualization failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Molecule Viewer</h1>
        <p className="mt-1 text-sm text-gray-500">Generate a 2D depiction from a SMILES string.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">SMILES string</label>
          <input
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            maxLength={512}
          />
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <button type="button" onClick={onSubmit} disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Rendering..." : "Render Molecule"}
        </button>
      </div>

      {molecule ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <img
            alt="Molecule"
            className="w-full rounded-lg border border-gray-100 bg-gray-50"
            src={`data:image/${molecule.format === "svg" ? "svg+xml" : molecule.format};base64,${molecule.image}`}
          />
        </div>
      ) : null}
    </div>
  );
}
