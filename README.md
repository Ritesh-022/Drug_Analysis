# 🧪 Drug Analysis — AI-Powered Pharmaceutical & Forensic Toxicology Platform

A full-stack, multi-mode drug analysis platform that combines **Graph Neural Networks (GNN)**, **XGBoost**, and a **local LLM (Ollama/LLaMA 3)** to predict molecular toxicity, drug-likeness, and forensic classification from SMILES strings. Designed for pharmaceutical researchers, medical professionals, and forensic analysts.

---

## 📌 Problem Statement

Drug discovery and forensic toxicology require rapid, accurate assessment of chemical compounds. Traditional lab-based methods are time-consuming and expensive. This platform addresses that gap by providing:

- Instant ML-based toxicity prediction across 9 Tox21 endpoints
- Drug-likeness scoring (logP, QED, SAS) via molecular property regression
- Patient-specific risk adjustment based on age and weight
- Forensic compound classification with LLM-generated case narratives
- Batch processing for high-throughput screening

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| AI / ML | Python, PyTorch, PyTorch Geometric, XGBoost, RDKit, scikit-learn |
| ML API | Flask |
| Backend API | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| LLM | Ollama (LLaMA 3) |
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Auth | JWT, bcryptjs |
| Security | Helmet, CORS, express-rate-limit |

---

## 🤖 Models & Algorithms

### Toxicity Prediction (Tox21 — 9 endpoints)
- **ToxGNN** — 3-layer Graph Isomorphism Network (GIN) with global mean pooling; trained on the Tox21 dataset. Outputs per-endpoint sigmoid probabilities.
- **XGBoost (meta-model)** — Trained on 2048-bit Morgan fingerprints (radius=2). Outputs per-endpoint class probabilities.
- **Ensemble** — Weighted combination: `0.6 × XGBoost + 0.4 × GNN` for final toxicity probabilities.

### Drug Property Regression (ZINC)
- **ZincGNN** — 4-layer GIN with dropout; predicts `logP`, `QED`, and `SAS` (Synthetic Accessibility Score) via denormalized regression.

### LLM Narrative Generation
- **Ollama / LLaMA 3** — Locally hosted LLM that generates structured JSON interpretations (causes, precautions, remedies, risks, domain advice) for each prediction mode.

### Scoring Formula
```
final_score = (1 - toxicity_score) × 0.6 + drug_score (QED) × 0.4
```

---

## ✨ Key Features

- **Multi-mode analysis** — Pharma, Medical (patient-specific), and Forensic modes
- **Ensemble ML predictions** — GNN + XGBoost with configurable weights
- **LLM-augmented reports** — Structured natural language analysis via local LLaMA 3
- **Batch processing** — Up to 200 SMILES strings per request with concurrent LLM calls
- **Patient risk adjustment** — Age/weight-aware toxicity scoring for clinical use
- **Forensic classification** — Compound severity classification with chain-of-custody metadata
- **Molecule visualization** — RDKit-rendered PNG/SVG structure images
- **Prediction history** — Paginated, filterable history per user and mode
- **Role-based access control** — `pharma`, `medical`, `forensic`, `admin` roles via JWT
- **PDF report generation** — Frontend report export utility

---

## 🔄 Workflow / Pipeline

```
User Input (SMILES)
        │
        ▼
  React Frontend
        │  REST API (JWT-authenticated)
        ▼
  Express.js Backend  ──────────────────────────────────────┐
        │                                                   │
        │  HTTP (internal)                          Ollama (LLaMA 3)
        ▼                                           LLM Narrative
  Flask ML API                                             │
   ├── SMILES → Graph (RDKit + PyG)                        │
   ├── SMILES → Morgan Fingerprint (RDKit)                 │
   ├── ToxGNN inference (9 Tox21 endpoints)                │
   ├── XGBoost inference (9 Tox21 endpoints)               │
   ├── Ensemble (0.6 XGB + 0.4 GNN)                        │
   ├── ZincGNN inference (logP, QED, SAS)                  │
   └── Final score computation                             │
        │                                                  │
        └──────────────────────────────────────────────────┘
                          │
                          ▼
                  MongoDB (Prediction stored)
                          │
                          ▼
                  Response to Frontend
                  (scores + LLM analysis)
```

---

## 📊 Dataset Information

| Dataset | Purpose | Details |
|---|---|---|
| **Tox21** | Toxicity classification | 9 nuclear receptor & stress response endpoints; binary labels |
| **ZINC** | Drug property regression | logP, QED (drug-likeness, 0–1), SAS (synthetic accessibility) |

> Trained models are pre-saved as `.pth` (PyTorch) and `.pkl` (XGBoost/joblib) files under `AI_Models/ml_train/`.

---

## ⚙️ Preprocessing Steps

1. **SMILES validation** — RDKit `MolFromSmiles` check; invalid molecules are rejected early
2. **Graph construction** — Atoms → node features (atomic number, degree, formal charge, implicit Hs, aromaticity, valence, mass); bonds → bidirectional edge index
3. **Morgan fingerprints** — 2048-bit, radius=2 via `rdFingerprintGenerator` (or `AllChem` fallback); converted to NumPy float32 array
4. **Denormalization** — ZINC GNN outputs are rescaled using stored `y_mean` / `y_std` from the checkpoint
5. **Patient adjustment** — Base toxicity scaled by age factor (×1.2 if >65, ×1.1 if <18) and weight factor (×1.1 if <50 kg), capped at 1.0

---

## 🚀 Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)
- [Ollama](https://ollama.com/) with `llama3` model pulled (`ollama pull llama3`)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/Drug_Analysis.git
cd Drug_Analysis
```

### 2. Set up the Flask ML API

```bash
cd AI_Models
pip install -r requirements.txt
```

### 3. Set up the Express backend

```bash
cd ../backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and service URLs
```

### 4. Set up the React frontend

```bash
cd ../frontend
npm install
```

### 5. Start all services

From the project root, run the provided batch script (Windows):

```bat
start.bat
```

Or start each service manually:

```bash
# Terminal 1 — Flask ML API (port 5000)
cd AI_Models && python app.py

# Terminal 2 — Express backend (port 3000)
cd backend && npm start

# Terminal 3 — React frontend (port 5173)
cd frontend && npm run dev
```

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
PORT=3000
JWT_SECRET=<your_long_random_secret>
MONGO_URI=mongodb://127.0.0.1:27017/pharma_ai
FLASK_URL=http://localhost:5000
FLASK_TIMEOUT_MS=15000
FRONTEND_ORIGIN=http://localhost:5173
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT=60
```

---

## 📡 API Endpoints

### Auth (public)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/verify` | Verify JWT token |

### Predictions (JWT required)

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/api/predict` | all | Single SMILES — pharma mode (toxicity + drug score + LLM) |
| POST | `/api/predict/batch` | all | Batch SMILES list (max 200) |
| POST | `/api/predict/patient` | medical, admin | Patient-specific toxicity with age/weight adjustment |
| POST | `/api/predict/forensic` | all | Forensic compound classification |
| POST | `/api/predict/forensic/batch` | all | Batch forensic classification |
| POST | `/api/visualize` | all | Returns base64 molecule image (PNG/SVG) |
| GET | `/api/history` | all | Paginated prediction history (`?mode=&page=&limit=`) |

### Patient Management (medical, admin only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/patients` | Create patient record |
| GET | `/api/patients` | List all patients |
| GET | `/api/patients/:patientId` | Get patient details |
| PUT | `/api/patients/:patientId` | Update patient |
| DELETE | `/api/patients/:patientId` | Delete patient |

### Flask ML API (internal)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Model load status |
| POST | `/predict/final` | Full pharma prediction |
| POST | `/predict/batch` | Batch prediction |
| POST | `/predict/patient` | Patient-adjusted toxicity |
| POST | `/predict/forensic` | Forensic classification |
| POST | `/visualize` | Molecule image rendering |

**Example request:**

```bash
curl -X POST http://localhost:3000/api/predict \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"smiles": "CC(=O)Oc1ccccc1C(=O)O"}'
```

**Example response:**

```json
{
  "toxicity_score": 0.1823,
  "drug_score": 0.7341,
  "final_score": 0.8027,
  "confidence": 0.9102,
  "gnn_tox": 0.1654,
  "xgb_tox": 0.1921,
  "tox_labels": { "NR-AR": 0.04, "NR-AhR": 0.12, "SR-ARE": 0.31, "..." : "..." },
  "tox_binary": { "NR-AR": 0, "NR-AhR": 0, "SR-ARE": 0, "...": "..." },
  "zinc": { "logP": 1.31, "qed": 0.73, "SAS": 1.87 },
  "llm_analysis": {
    "interpretation": "Low toxicity profile with good drug-likeness...",
    "causes": ["..."],
    "precautions": ["..."],
    "remedies": ["..."],
    "risks": ["..."],
    "domain_advice": "...",
    "model_disagreement_note": ""
  }
}
```

---

## 🗂️ Project Structure

```
Drug_Analysis/
├── AI_Models/                  # Flask ML microservice
│   ├── ml_train/
│   │   ├── tox21/              # ToxGNN + XGBoost model files
│   │   └── zinc/               # ZincGNN model file
│   ├── app.py                  # Flask API (all ML endpoints)
│   ├── gnn_models.py           # ToxGNN & ZincGNN architecture definitions
│   └── requirements.txt
│
├── backend/                    # Express.js REST API
│   ├── config/db.js            # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── patientController.js
│   │   └── predictController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT + role-based access
│   │   └── requestId.js
│   ├── models/                 # Mongoose schemas (User, Patient, Prediction)
│   ├── routes/predict.js       # All API route definitions
│   ├── services/ollamaService.js  # LLM integration
│   ├── utils/logger.js
│   ├── .env.example
│   └── server.js
│
├── frontend/                   # React + Vite SPA
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── pages/
│       │   ├── Auth/           # Login, Register
│       │   ├── Forensic/       # Forensic analysis UI
│       │   ├── Medical/        # Patient management UI
│       │   ├── Prediction/     # Input, Results, Batch
│       │   └── Utility/        # History, MoleculeViewer, Report
│       ├── services/api.js     # Axios API client
│       └── utils/              # PDF export, score helpers
│
└── start.bat                   # One-click startup script (Windows)
```

---

## 🧩 Tox21 Endpoints Predicted

| Endpoint | Description |
|---|---|
| NR-AR | Androgen Receptor |
| NR-AR-LBD | Androgen Receptor Ligand Binding Domain |
| NR-AhR | Aryl Hydrocarbon Receptor |
| NR-Aromatase | Aromatase inhibition |
| NR-ER | Estrogen Receptor Alpha |
| NR-ER-LBD | Estrogen Receptor Ligand Binding Domain |
| NR-PPAR-gamma | Peroxisome Proliferator-Activated Receptor Gamma |
| SR-ARE | Antioxidant Response Element |
| SR-ATAD5 | Genotoxicity (ATAD5) |

---

## ⚠️ Challenges & Solutions

| Challenge | Solution |
|---|---|
| PyTorch 2.6 `weights_only` breaking checkpoint loading | Graceful fallback: retry with `weights_only=False` on failure |
| XGBoost multi-output `predict_proba` shape inconsistency | Robust extraction function handling list-of-arrays and 2D array formats |
| Ollama LLM returning markdown-wrapped JSON | Strip code fences with regex before `JSON.parse` |
| Batch LLM calls causing timeouts | Concurrent worker pool (6 parallel Ollama calls) with per-item error isolation |
| SMILES injection / invalid input | Multi-layer validation: whitespace, length, character allowlist, UUID/hex ID detection |

---

## 🔮 Future Improvements

- [ ] ADMET property prediction (absorption, distribution, metabolism, excretion, toxicity)
- [ ] Molecular generation / optimization using generative GNNs or diffusion models
- [ ] Integration with PubChem / ChEMBL for compound lookup by name or CAS number
- [ ] Docker Compose setup for one-command deployment
- [ ] Model explainability — GNN attention maps and SHAP values for XGBoost
- [ ] Support for cloud-hosted LLMs (AWS Bedrock, OpenAI) as Ollama alternatives
- [ ] CI/CD pipeline with automated model validation tests

---

## 👤 Author

> ⚠️ *Author information not provided — please update this section.*

**[Your Name]**
- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [linkedin.com/in/your-profile](https://linkedin.com/in/your-profile)
- Email: your.email@example.com

---

## 📄 License

> ⚠️ *License not specified — please add a LICENSE file. MIT is recommended for open-source projects.*

This project is licensed under the [MIT License](LICENSE).

---

> **Note:** This platform is intended for research and educational purposes. Predictions should not be used as a substitute for professional pharmaceutical or medical judgment.
