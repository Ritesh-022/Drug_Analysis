import os
import uuid
import logging
import pickle

from flask import Flask, request, jsonify, g

try:
    import numpy as np
except ImportError:
    np = None

try:
    import joblib
except ImportError:
    joblib = None

try:
    import torch
except ImportError:
    torch = None

try:
    from rdkit import Chem, DataStructs
    from rdkit.Chem import AllChem, rdFingerprintGenerator
except ImportError:
    Chem = None
    DataStructs = None
    AllChem = None
    rdFingerprintGenerator = None

try:
    from torch_geometric.data import Data
except ImportError:
    Data = None

try:
    from gnn_models import ToxGNN, ZincGNN
except ImportError:
    ToxGNN = None
    ZincGNN = None


# =========================
# CONFIG
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "ml_train")

TOX_DIR = os.path.join(MODEL_DIR, "tox21")
ZINC_DIR = os.path.join(MODEL_DIR, "zinc")

MORGAN_BITS = 2048
XGB_WEIGHT = 0.6
GNN_WEIGHT = 0.4

TOX_LABELS = [
    "NR-AR",
    "NR-AR-LBD",
    "NR-AhR",
    "NR-Aromatase",
    "NR-ER",
    "NR-ER-LBD",
    "NR-PPAR-gamma",
    "SR-ARE",
    "SR-ATAD5",
]

ZINC_LABELS = ["logP", "qed", "SAS"]


def load_torch_checkpoint(path):
    if torch is None:
        return None

    try:
        return torch.load(path, map_location="cpu")
    except Exception as e:
        # PyTorch 2.6 defaults to weights_only=True; older checkpoints may need False.
        if "Weights only load failed" in str(e) or "weights_only" in str(e):
            return torch.load(path, map_location="cpu", weights_only=False)
        raise


def label_map(labels, values, as_int=False):
    if as_int:
        return {label: int(value) for label, value in zip(labels, values)}
    return {label: float(value) for label, value in zip(labels, values)}


def atom_features(atom):
    return [
        atom.GetAtomicNum(),
        atom.GetDegree(),
        atom.GetFormalCharge(),
        atom.GetNumImplicitHs(),
        int(atom.GetIsAromatic()),
        atom.GetTotalValence(),
        atom.GetMass(),
    ]


def smiles_to_graph(smiles):
    if torch is None or Chem is None or Data is None:
        raise RuntimeError("GNN dependencies missing (torch, rdkit, torch_geometric).")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None or mol.GetNumAtoms() == 0:
        return None

    x = torch.tensor(
        [atom_features(atom) for atom in mol.GetAtoms()],
        dtype=torch.float,
    )

    edge_index_data = []
    for bond in mol.GetBonds():
        i = bond.GetBeginAtomIdx()
        j = bond.GetEndAtomIdx()
        edge_index_data.append([i, j])
        edge_index_data.append([j, i])

    if edge_index_data:
        edge_index = torch.tensor(edge_index_data, dtype=torch.long).t().contiguous()
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)

    graph = Data(x=x, edge_index=edge_index)
    graph.batch = torch.zeros(graph.num_nodes, dtype=torch.long)
    return graph


def smiles_to_morgan_bits(smiles, n_bits=MORGAN_BITS):
    if np is None or Chem is None or DataStructs is None or AllChem is None:
        raise RuntimeError("XGB dependencies missing (numpy, rdkit).")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    if rdFingerprintGenerator is not None:
        generator = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=n_bits)
        fingerprint = generator.GetFingerprint(mol)
    else:
        fingerprint = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=n_bits)
    features = np.zeros((n_bits,), dtype=np.float32)
    DataStructs.ConvertToNumpyArray(fingerprint, features)
    return features


def extract_xgb_positive_probabilities(raw_output):
    if np is None:
        raise RuntimeError("numpy is required for probability extraction.")

    if isinstance(raw_output, list):
        probs = []
        for output in raw_output:
            arr = np.asarray(output)
            if arr.ndim == 2 and arr.shape[0] >= 1:
                if arr.shape[1] >= 2:
                    probs.append(float(arr[0, 1]))
                elif arr.shape[1] == 1:
                    probs.append(float(arr[0, 0]))
                else:
                    raise ValueError("Unexpected predict_proba output shape.")
            elif arr.ndim == 1 and arr.size >= 1:
                probs.append(float(arr[0]))
            else:
                raise ValueError("Unexpected predict_proba output format.")
        return np.asarray(probs, dtype=np.float32)

    arr = np.asarray(raw_output, dtype=np.float32)
    if arr.ndim == 2 and arr.shape[0] == 1:
        return arr[0]
    if arr.ndim == 1:
        return arr
    raise ValueError("Unsupported predict_proba output shape.")


def predict_tox_xgb(smiles, model):
    if np is None:
        raise RuntimeError("numpy is required for XGB inference.")

    features = smiles_to_morgan_bits(smiles)
    if features is None:
        raise ValueError("Invalid SMILES string.")

    pred_values = np.asarray(model.predict([features])[0], dtype=np.float32)
    if pred_values.shape[0] != len(TOX_LABELS):
        raise ValueError("Unexpected XGB output size.")

    xgb_class_map = label_map(TOX_LABELS, pred_values, as_int=True)

    proba_values = pred_values
    if hasattr(model, "predict_proba"):
        try:
            proba_values = extract_xgb_positive_probabilities(model.predict_proba([features]))
        except Exception:
            proba_values = pred_values

    if proba_values.shape[0] != len(TOX_LABELS):
        proba_values = pred_values

    xgb_proba_map = label_map(TOX_LABELS, proba_values)
    return xgb_class_map, xgb_proba_map, proba_values


def predict_tox_gnn(smiles, model):
    if torch is None or np is None:
        raise RuntimeError("torch and numpy are required for GNN inference.")

    graph = smiles_to_graph(smiles)
    if graph is None:
        raise ValueError("Invalid SMILES string.")

    with torch.no_grad():
        logits = model(graph)
        probs = torch.sigmoid(logits).detach().cpu().numpy()[0]

    if probs.shape[0] != len(TOX_LABELS):
        raise ValueError("Unexpected GNN output size.")

    return label_map(TOX_LABELS, probs), probs


def predict_zinc_gnn(smiles, model_info):
    if torch is None or np is None:
        raise RuntimeError("torch and numpy are required for GNN inference.")

    graph = smiles_to_graph(smiles)
    if graph is None:
        raise ValueError("Invalid SMILES string.")

    with torch.no_grad():
        pred = model_info["model"](graph).detach().cpu().numpy()[0]

    y_mean = np.asarray(model_info["y_mean"], dtype=np.float32)
    y_std = np.asarray(model_info["y_std"], dtype=np.float32)
    denorm = pred * y_std + y_mean

    return {label: float(value) for label, value in zip(ZINC_LABELS, denorm)}


# =========================
# LOAD MODELS
# =========================
def load_models():
    models = {
        "gnn_tox": None,
        "xgb_tox": None,
        "gnn_zinc": None,
    }

    # ---- Load TOX GNN ----
    try:
        path = os.path.join(TOX_DIR, "gnn_best_model.pth")
        if torch and ToxGNN and os.path.exists(path):
            checkpoint = load_torch_checkpoint(path)
            state_dict = checkpoint
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]

            model = ToxGNN(out_dim=len(TOX_LABELS))
            model.load_state_dict(state_dict)
            model.eval()
            models["gnn_tox"] = model
            print("Loaded gnn_tox")
    except Exception as e:
        print("Failed gnn_tox:", e)

    # ---- Load TOX XGB ----
    try:
        path = os.path.join(TOX_DIR, "xgb_best_model.pkl")
        if os.path.exists(path):
            load_errors = []

            if joblib is not None:
                try:
                    models["xgb_tox"] = joblib.load(path)
                    print("Loaded xgb_tox with joblib")
                except Exception as e:
                    load_errors.append(f"joblib failed: {e}")

            if models["xgb_tox"] is None:
                try:
                    with open(path, "rb") as f:
                        models["xgb_tox"] = pickle.load(f)
                    print("Loaded xgb_tox with pickle")
                except Exception as e:
                    load_errors.append(f"pickle failed: {e}")

            if models["xgb_tox"] is None:
                raise RuntimeError("; ".join(load_errors))
    except Exception as e:
        print("Failed xgb_tox:", e)

    # ---- Load ZINC GNN ----
    try:
        zinc_candidates = [
            os.path.join(ZINC_DIR, "zinc_model.pth"),
            os.path.join(ZINC_DIR, "GNN_zinc_model.pth"),
        ]
        zinc_path = next((p for p in zinc_candidates if os.path.exists(p)), None)
        if torch and ZincGNN and zinc_path:
            checkpoint = load_torch_checkpoint(zinc_path)
            state_dict = checkpoint
            y_mean = [0.0, 0.0, 0.0]
            y_std = [1.0, 1.0, 1.0]

            if isinstance(checkpoint, dict):
                state_dict = checkpoint.get("model_state_dict", checkpoint)
                y_mean = checkpoint.get("y_mean", y_mean)
                y_std = checkpoint.get("y_std", y_std)

            model = ZincGNN()
            model.load_state_dict(state_dict)
            model.eval()

            models["gnn_zinc"] = {
                "model": model,
                "y_mean": y_mean,
                "y_std": y_std,
            }
            print(f"Loaded gnn_zinc from {os.path.basename(zinc_path)}")
    except Exception as e:
        print("Failed gnn_zinc:", e)

    return models


# =========================
# APP INIT
# =========================
app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

MODELS = load_models()


# =========================
# REQUEST TRACKING
# =========================
@app.before_request
def add_request_id():
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))


# =========================
# HEALTH CHECK
# =========================
@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "models_loaded": {
                "gnn_tox": MODELS["gnn_tox"] is not None,
                "xgb_tox": MODELS["xgb_tox"] is not None,
                "gnn_zinc": MODELS["gnn_zinc"] is not None,
            },
        }
    )


# =========================
# HELPERS
# =========================
def _run_tox(smiles):
    """Run tox ensemble and return (gnn_tox, xgb_tox, ensemble_probs) or raise."""
    xgb_proba_values = None
    gnn_proba_values = None

    if MODELS["xgb_tox"] is not None:
        _, _, xgb_proba_values = predict_tox_xgb(smiles, MODELS["xgb_tox"])

    if MODELS["gnn_tox"] is not None:
        _, gnn_proba_values = predict_tox_gnn(smiles, MODELS["gnn_tox"])

    if xgb_proba_values is not None and gnn_proba_values is not None:
        ensemble_probs = (XGB_WEIGHT * xgb_proba_values) + (GNN_WEIGHT * gnn_proba_values)
    elif xgb_proba_values is not None:
        ensemble_probs = xgb_proba_values
    elif gnn_proba_values is not None:
        ensemble_probs = gnn_proba_values
    else:
        raise RuntimeError("No tox models loaded")

    gnn_tox = float(np.mean(gnn_proba_values)) if gnn_proba_values is not None else None
    xgb_tox = float(np.mean(xgb_proba_values)) if xgb_proba_values is not None else None
    return gnn_tox, xgb_tox, ensemble_probs


def _zinc_scores(smiles):
    """Return zinc property dict or None."""
    if MODELS["gnn_zinc"] is None:
        return None
    return predict_zinc_gnn(smiles, MODELS["gnn_zinc"])


def _compute_final_score(toxicity_score, drug_score):
    """Weighted combination: lower tox + higher drug = better."""
    return round(float((1.0 - toxicity_score) * 0.6 + drug_score * 0.4), 4)


# =========================
# LEGACY /predict (kept for api_request_examples.py)
# =========================
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    smiles = data.get("smiles")
    model_type = data.get("model_type")

    if not smiles:
        return jsonify({"error": "SMILES required"}), 400
    if model_type not in ["tox", "zinc"]:
        return jsonify({"error": "model_type must be 'tox' or 'zinc'"}), 400

    if model_type == "tox":
        try:
            gnn_tox, xgb_tox, ensemble_probs = _run_tox(smiles)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        ensemble_binary = (ensemble_probs >= 0.5).astype(int)
        return jsonify({
            "type": "tox",
            "smiles": smiles,
            "result": {
                "ensemble": label_map(TOX_LABELS, ensemble_probs),
                "ensemble_binary": label_map(TOX_LABELS, ensemble_binary, as_int=True),
            },
        })

    try:
        zinc_result = _zinc_scores(smiles)
        if zinc_result is None:
            return jsonify({"error": "ZINC model not loaded"}), 500
        return jsonify({"type": "zinc", "smiles": smiles, "result": zinc_result})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"zinc inference failed: {e}"}), 500


# =========================
# /predict/final  (pharma mode)
# =========================
@app.route("/predict/final", methods=["POST"])
def predict_final():
    data = request.get_json(silent=True) or {}
    smiles = data.get("smiles")
    if not smiles:
        return jsonify({"error": "smiles required"}), 400

    try:
        gnn_tox, xgb_tox, ensemble_probs = _run_tox(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    toxicity_score = round(float(np.mean(ensemble_probs)), 4)
    zinc = _zinc_scores(smiles) or {}
    # QED from zinc is our drug-likeness proxy (0-1); fallback to 0.5
    drug_score = round(float(zinc.get("qed", 0.5)), 4)
    final_score = _compute_final_score(toxicity_score, drug_score)
    confidence = round(float(1.0 - np.std(ensemble_probs)), 4)

    return jsonify({
        "toxicity_score": toxicity_score,
        "drug_score": drug_score,
        "final_score": final_score,
        "confidence": max(0.0, min(1.0, confidence)),
        "gnn_tox": gnn_tox,
        "xgb_tox": xgb_tox,
        "llm_analysis": {},
        # Per-label ensemble probabilities (9 TOX21 endpoints)
        "tox_labels": label_map(TOX_LABELS, ensemble_probs),
        "tox_binary": label_map(TOX_LABELS, (ensemble_probs >= 0.5).astype(int), as_int=True),
        # ZINC drug-property scores
        "zinc": zinc,
    })


# =========================
# /predict/batch
# =========================
@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    data = request.get_json(silent=True) or {}
    smiles_list = data.get("smiles_list")
    if not isinstance(smiles_list, list) or len(smiles_list) == 0:
        return jsonify({"error": "smiles_list must be a non-empty array"}), 400

    results = []
    for smiles in smiles_list:
        try:
            gnn_tox, xgb_tox, ensemble_probs = _run_tox(smiles)
            toxicity_score = round(float(np.mean(ensemble_probs)), 4)
            zinc = _zinc_scores(smiles) or {}
            drug_score = round(float(zinc.get("qed", 0.5)), 4)
            final_score = _compute_final_score(toxicity_score, drug_score)
            confidence = round(float(1.0 - np.std(ensemble_probs)), 4)

            results.append({
                "smiles": smiles,
                "toxicity_score": toxicity_score,
                "drug_score": drug_score,
                "final_score": final_score,
                "confidence": max(0.0, min(1.0, confidence)),
                "gnn_tox": gnn_tox,
                "xgb_tox": xgb_tox,
                "llm_analysis": {},
                "tox_labels": label_map(TOX_LABELS, ensemble_probs),
                "tox_binary": label_map(TOX_LABELS, (ensemble_probs >= 0.5).astype(int), as_int=True),
                "zinc": zinc,
            })
        except Exception as e:
            results.append({"smiles": smiles, "final_score": None, "error": str(e)})

    return jsonify({"results": results})


# =========================
# /predict/patient  (medical mode)
# =========================
@app.route("/predict/patient", methods=["POST"])
def predict_patient():
    data = request.get_json(silent=True) or {}
    smiles = data.get("smiles")
    age = data.get("age")
    weight = data.get("weight")

    if not smiles:
        return jsonify({"error": "smiles required"}), 400
    try:
        age = float(age)
        weight = float(weight)
    except (TypeError, ValueError):
        return jsonify({"error": "age and weight must be numbers"}), 400

    try:
        _, _, ensemble_probs = _run_tox(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    base_tox = float(np.mean(ensemble_probs))

    # Age/weight adjustment: elderly (>65) or low weight (<50kg) increases risk
    age_factor = 1.2 if age > 65 else (1.1 if age < 18 else 1.0)
    weight_factor = 1.1 if weight < 50 else 1.0
    adjusted_toxicity = round(min(1.0, base_tox * age_factor * weight_factor), 4)

    if adjusted_toxicity >= 0.7:
        risk_level = "high"
    elif adjusted_toxicity >= 0.4:
        risk_level = "moderate"
    else:
        risk_level = "low"

    return jsonify({
        "adjusted_toxicity": adjusted_toxicity,
        "risk_level": risk_level,
        "llm_analysis": {},
    })


# =========================
# /predict/forensic
# =========================
@app.route("/predict/forensic", methods=["POST"])
def predict_forensic():
    data = request.get_json(silent=True) or {}
    smiles = data.get("smiles")
    if not smiles:
        return jsonify({"error": "smiles required"}), 400

    try:
        _, _, ensemble_probs = _run_tox(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    tox_score = float(np.mean(ensemble_probs))
    positive_count = int(np.sum(ensemble_probs >= 0.5))

    if tox_score >= 0.7 or positive_count >= 5:
        classification = "highly_toxic"
        severity = round(tox_score, 4)
    elif tox_score >= 0.4 or positive_count >= 3:
        classification = "moderately_toxic"
        severity = round(tox_score, 4)
    else:
        classification = "low_toxicity"
        severity = round(tox_score, 4)

    return jsonify({
        "classification": classification,
        "severity": severity,
        "llm_analysis": {},
    })


# =========================
# /visualize
# =========================
@app.route("/visualize", methods=["POST"])
def visualize():
    if Chem is None:
        return jsonify({"error": "rdkit not available"}), 500

    data = request.get_json(silent=True) or {}
    smiles = data.get("smiles")
    if not smiles:
        return jsonify({"error": "smiles required"}), 400

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return jsonify({"error": "invalid SMILES"}), 400

    try:
        from rdkit.Chem import Draw
        from io import BytesIO
        import base64

        img = Draw.MolToImage(mol, size=(300, 300))
        buf = BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        return jsonify({"image": encoded, "format": "png"})
    except Exception:
        # Fallback to SVG if PIL not available
        try:
            from rdkit.Chem.Draw import rdMolDraw2D
            drawer = rdMolDraw2D.MolDraw2DSVG(300, 300)
            drawer.DrawMolecule(mol)
            drawer.FinishDrawing()
            svg = drawer.GetDrawingText()
            import base64
            encoded = base64.b64encode(svg.encode()).decode("utf-8")
            return jsonify({"image": encoded, "format": "svg"})
        except Exception as e:
            return jsonify({"error": f"visualization failed: {e}"}), 500


# =========================
# ERROR HANDLING
# =========================
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "not found"}), 404


@app.errorhandler(500)
def server_error(e):
    logging.exception("Server Error")
    return jsonify({"error": "internal server error"}), 500


# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
