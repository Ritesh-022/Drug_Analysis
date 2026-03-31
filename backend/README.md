# Pharma Express API

Express gateway that authenticates via JWT, enforces role-based access, and proxies prediction requests to the local Flask service.

## Setup

1. Install deps:
   - `cd node_api`
   - `npm install`

2. Configure env:
   - copy `.env.example` to `.env`
   - set `JWT_SECRET`

3. Run:
   - `npm start`

## Endpoint

`POST /api/predict`

Headers:
- `Authorization: Bearer <jwt>`

Body:
```json
{ "smiles": "CCO" }
```

Proxies to:
- `POST ${FLASK_URL}/predict/final`

Response:
```json
{ "toxicity_score": 0.3, "drug_score": 0.8, "final_score": 0.75 }
```

## JWT payload

Your JWT should include a role:
```json
{ "sub": "user123", "role": "pharma" }
```

