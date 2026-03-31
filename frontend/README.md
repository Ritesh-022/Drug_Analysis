# Pharma Frontend (Vite + React)

UI for submitting a SMILES string and visualizing drug/toxicity/final scores.

## Dev

1. Start Flask (port 5000) and Express gateway (port 3000).
2. Install and run:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

The Vite dev server proxies `/api/*` to `http://localhost:3000` via `frontend/vite.config.js`.

