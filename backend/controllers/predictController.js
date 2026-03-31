const axios = require("axios");
const Prediction = require("../models/Prediction");
const { logger } = require("../utils/logger");
const { analyzePrediction } = require("../services/ollamaService");

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";
const REQUEST_TIMEOUT_MS = parseInt(process.env.FLASK_TIMEOUT_MS || "15000", 10);

function isValidSmiles(smiles) {
  if (typeof smiles !== "string") return { ok: false, error: "smiles must be a string" };
  const trimmed = smiles.trim();
  if (!trimmed) return { ok: false, error: "smiles must be a non-empty string" };
  if (trimmed.length > 512) return { ok: false, error: "smiles is too long" };
  if (/\s/.test(trimmed)) return { ok: false, error: "smiles must not contain whitespace" };
  if (/[<>`${}|&]/.test(trimmed)) return { ok: false, error: "smiles contains invalid characters" };
  // Common user mistake: pasting an ID instead of a SMILES string.
  if (/^[0-9a-f]{24}$/i.test(trimmed)) return { ok: false, error: "smiles looks like an ID (24-hex), not a SMILES string" };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed))
    return { ok: false, error: "smiles looks like an ID (UUID), not a SMILES string" };
  return { ok: true, value: trimmed };
}

async function callFlask(req, path, body) {
  const started = Date.now();
  const url = `${FLASK_URL.replace(/\/$/, "")}${path}`;
  const resp = await axios.post(url, body, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "x-request-id": req.requestId },
  });
  logger.info("flask_call_ok", { rid: req.requestId, path, elapsed_ms: Date.now() - started });
  return resp.data || {};
}

async function callOllama(req, context, handler) {
  try {
    const result = await analyzePrediction(context);
    return result;
  } catch (e) {
    logger.warn("ollama_failed", { rid: req.requestId, handler, message: e?.message });
    console.error(`[ollama] ${handler} failed:`, e?.message);
    return {};
  }
}

async function predictFinal(req, res, next) {
  try {
    const { smiles } = req.body || {};
    const valid = isValidSmiles(smiles);
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const data = await callFlask(req, "/predict/final", { smiles: valid.value });

    const llm = await callOllama(req, {
      smiles: valid.value,
      toxicity_score: data.toxicity_score,
      drug_score: data.drug_score,
      final_score: data.final_score,
      gnn_tox: data.gnn_tox,
      xgb_tox: data.xgb_tox,
      tox_labels: data.tox_labels || {},
      tox_binary: data.tox_binary || {},
      zinc: data.zinc || {},
    }, "predictFinal");

    Prediction.create({
      userId: req.user.email,
      smiles: valid.value,
      toxicity_score: data.toxicity_score,
      drug_score: data.drug_score,
      final_score: data.final_score,
      confidence: data.confidence,
      gnn_tox: data.gnn_tox,
      xgb_tox: data.xgb_tox,
      mode: "pharma",
      tox_labels: data.tox_labels || {},
      tox_binary: data.tox_binary || {},
      zinc: data.zinc || {},
      interpretation: llm.interpretation || "",
      causes: Array.isArray(llm.causes) ? llm.causes : [],
      precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
      remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
      risks: Array.isArray(llm.risks) ? llm.risks : [],
      domain_advice: llm.domain_advice || "",
      model_disagreement_note: llm.model_disagreement_note || "",
    }).catch((e) => logger.error("db_write_failed", { rid: req.requestId, handler: "predictFinal", message: e?.message }));

    return res.json({
      toxicity_score: data.toxicity_score,
      drug_score: data.drug_score,
      final_score: data.final_score,
      confidence: data.confidence,
      gnn_tox: data.gnn_tox,
      xgb_tox: data.xgb_tox,
      llm_analysis: llm,
      tox_labels: data.tox_labels || {},
      tox_binary: data.tox_binary || {},
      zinc: data.zinc || {},
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

async function predictBatch(req, res, next) {
  try {
    const { smiles_list, include_llm } = req.body || {};
    if (!Array.isArray(smiles_list) || smiles_list.length === 0)
      return res.status(400).json({ error: "smiles_list must be a non-empty array" });
    if (smiles_list.length > 200)
      return res.status(400).json({ error: "smiles_list is too large (max 200)" });

    const validated = [];
    for (let i = 0; i < smiles_list.length; i++) {
      const v = isValidSmiles(smiles_list[i]);
      if (!v.ok) return res.status(400).json({ error: `smiles_list[${i}]: ${v.error}` });
      validated.push(v.value);
    }

    const unique = [...new Set(validated)];
    const data = await callFlask(req, "/predict/batch", { smiles_list: unique });

    const map = new Map((data.results || []).map((r) => [r.smiles?.trim(), r]));

    // Optional: attach LLM narrative for parity with single-prediction Results page.
    if (include_llm) {
      const concurrency = 6;
      let nextIndex = 0;
      const uniqueResults = unique.map((s) => ({ smiles: s, data: map.get(s) }));

      async function worker() {
        while (true) {
          const idx = nextIndex++;
          if (idx >= uniqueResults.length) return;
          const item = uniqueResults[idx];
          if (!item?.data || item.data?.final_score == null) continue;
          const llm = await callOllama(req, {
            smiles: item.smiles,
            toxicity_score: item.data.toxicity_score,
            drug_score: item.data.drug_score,
            final_score: item.data.final_score,
            gnn_tox: item.data.gnn_tox,
            xgb_tox: item.data.xgb_tox,
            tox_labels: item.data.tox_labels || {},
            tox_binary: item.data.tox_binary || {},
            zinc: item.data.zinc || {},
          }, "predictBatch");
          item.data.llm_analysis = llm || {};
        }
      }

      const workers = [];
      for (let i = 0; i < Math.min(concurrency, uniqueResults.length); i++) workers.push(worker());
      await Promise.all(workers);
    }

    const results = validated.map((s) => {
      const r = map.get(s);
      if (!r) return { smiles: s, final_score: null };
      return r;
    });

    Prediction.insertMany(
      unique.map((s) => {
        const r = map.get(s) || {};
        const llm = r.llm_analysis || {};
        return {
          userId: req.user.email,
          smiles: s,
          toxicity_score: r.toxicity_score,
          drug_score: r.drug_score,
          final_score: r.final_score,
          confidence: r.confidence,
          gnn_tox: r.gnn_tox,
          xgb_tox: r.xgb_tox,
          tox_labels: r.tox_labels || {},
          tox_binary: r.tox_binary || {},
          zinc: r.zinc || {},
          interpretation: llm.interpretation || "",
          causes: Array.isArray(llm.causes) ? llm.causes : [],
          precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
          remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
          risks: Array.isArray(llm.risks) ? llm.risks : [],
          domain_advice: llm.domain_advice || "",
          model_disagreement_note: llm.model_disagreement_note || "",
          mode: "batch",
        };
      }),
      { ordered: false }
    ).catch((e) => logger.error("db_write_failed", { rid: req.requestId, handler: "predictBatch", message: e?.message }));

    return res.json({ results });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

async function predictPatient(req, res, next) {
  try {
    const { smiles, age, weight, patientId } = req.body || {};
    const valid = isValidSmiles(smiles);
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const ageNum = parseFloat(age);
    const weightNum = parseFloat(weight);
    if (!Number.isFinite(ageNum) || ageNum < 0)
      return res.status(400).json({ error: "age must be a non-negative number" });
    if (!Number.isFinite(weightNum) || weightNum <= 0)
      return res.status(400).json({ error: "weight must be a positive number" });

    const data = await callFlask(req, "/predict/patient", { smiles: valid.value, age: ageNum, weight: weightNum });

    const llm = await callOllama(req, {
      smiles: valid.value,
      age: ageNum,
      weight: weightNum,
      adjusted_toxicity: data.adjusted_toxicity,
      risk_level: data.risk_level,
    }, "predictPatient");

    Prediction.create({
      userId: req.user.email,
      patientId: patientId || null,
      smiles: valid.value,
      adjusted_toxicity: data.adjusted_toxicity,
      risk_level: data.risk_level,
      age: ageNum,
      weight: weightNum,
      mode: "medical",
      interpretation: llm.interpretation || "",
      causes: Array.isArray(llm.causes) ? llm.causes : [],
      precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
      remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
      risks: Array.isArray(llm.risks) ? llm.risks : [],
      domain_advice: llm.domain_advice || "",
      model_disagreement_note: llm.model_disagreement_note || "",
    }).catch((e) => logger.error("db_write_failed", { rid: req.requestId, handler: "predictPatient", message: e?.message }));

    return res.json({ ...data, llm_analysis: llm });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

async function predictForensic(req, res, next) {
  try {
    const { smiles, caseId, caseTitle, caseDetails, incidentType, evidenceRef, collectionDate, officerName, labName, chainOfCustody } = req.body || {};
    const valid = isValidSmiles(smiles);
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const data = await callFlask(req, "/predict/forensic", { smiles: valid.value });

    const llm = await callOllama(req, {
      mode: "forensic",
      smiles: valid.value,
      classification: data.classification,
      severity: data.severity,
      tox_labels: data.tox_labels || {},
      case_title: caseTitle || "",
      case_details: caseDetails || "",
      incident_type: incidentType || "",
      evidence_ref: evidenceRef || "",
      officer_name: officerName || "",
      lab_name: labName || "",
    }, "predictForensic");

    Prediction.create({
      userId: req.user.email,
      smiles: valid.value,
      caseId: caseId || null,
      caseTitle: caseTitle || "",
      caseDetails: caseDetails || "",
      classification: data.classification,
      severity: data.severity,
      mode: "forensic",
      interpretation: llm.interpretation || "",
      causes: Array.isArray(llm.causes) ? llm.causes : [],
      precautions: Array.isArray(llm.precautions) ? llm.precautions : [],
      remedies: Array.isArray(llm.remedies) ? llm.remedies : [],
      risks: Array.isArray(llm.risks) ? llm.risks : [],
      domain_advice: llm.domain_advice || "",
      model_disagreement_note: llm.model_disagreement_note || "",
    }).catch((e) => logger.error("db_write_failed", { rid: req.requestId, handler: "predictForensic", message: e?.message }));

    return res.json({ ...data, llm_analysis: llm });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

async function predictForensicBatch(req, res, next) {
  try {
    const {
      smiles_list,
      caseId,
      caseTitle,
      caseDetails,
      incidentType,
      evidenceRef,
      collectionDate,
      officerName,
      labName,
      chainOfCustody,
      include_llm,
    } = req.body || {};

    if (!Array.isArray(smiles_list) || smiles_list.length === 0)
      return res.status(400).json({ error: "smiles_list must be a non-empty array" });
    if (smiles_list.length > 200)
      return res.status(400).json({ error: "smiles_list is too large (max 200)" });

    const validated = [];
    for (let i = 0; i < smiles_list.length; i++) {
      const v = isValidSmiles(smiles_list[i]);
      if (!v.ok) return res.status(400).json({ error: `smiles_list[${i}]: ${v.error}` });
      validated.push(v.value);
    }

    const concurrency = 6;
    let nextIndex = 0;
    const results = new Array(validated.length);

    async function worker() {
      while (true) {
        const idx = nextIndex++;
        if (idx >= validated.length) return;
        const smiles = validated[idx];

        const data = await callFlask(req, "/predict/forensic", { smiles });

        let llm = {};
        if (include_llm) {
          llm = await callOllama(req, {
            mode: "forensic",
            smiles,
            classification: data.classification,
            severity: data.severity,
            tox_labels: data.tox_labels || {},
            case_title: caseTitle || "",
            case_details: caseDetails || "",
            incident_type: incidentType || "",
            evidence_ref: evidenceRef || "",
            officer_name: officerName || "",
            lab_name: labName || "",
            collection_date: collectionDate || "",
            chain_of_custody: chainOfCustody || "",
          }, "predictForensicBatch");
        }

        results[idx] = {
          smiles,
          classification: data.classification,
          severity: data.severity,
          llm_analysis: llm,
        };
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, validated.length); i++) workers.push(worker());
    await Promise.all(workers);

    Prediction.insertMany(
      results.map((r) => ({
        userId: req.user.email,
        smiles: r.smiles,
        caseId: caseId || null,
        caseTitle: caseTitle || "",
        caseDetails: caseDetails || "",
        classification: r.classification,
        severity: r.severity,
        mode: "forensic",
        interpretation: r.llm_analysis?.interpretation || "",
        causes: Array.isArray(r.llm_analysis?.causes) ? r.llm_analysis.causes : [],
        precautions: Array.isArray(r.llm_analysis?.precautions) ? r.llm_analysis.precautions : [],
        remedies: Array.isArray(r.llm_analysis?.remedies) ? r.llm_analysis.remedies : [],
        risks: Array.isArray(r.llm_analysis?.risks) ? r.llm_analysis.risks : [],
        domain_advice: r.llm_analysis?.domain_advice || "",
        model_disagreement_note: r.llm_analysis?.model_disagreement_note || "",
      })),
      { ordered: false }
    ).catch((e) => logger.error("db_write_failed", { rid: req.requestId, handler: "predictForensicBatch", message: e?.message }));

    return res.json({ results });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

async function visualize(req, res, next) {
  try {
    const { smiles } = req.body || {};
    const valid = isValidSmiles(smiles);
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const data = await callFlask(req, "/visualize", { smiles: valid.value });
    return res.json({ image: data.image, format: data.format || "png" });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status || 502).json({ error: "upstream flask error", upstream: err.response?.data });
    }
    return next(err);
  }
}

const VALID_MODES = new Set(["pharma", "medical", "forensic", "batch"]);

async function history(req, res, next) {
  try {
    const { mode, limit: limitRaw, page: pageRaw } = req.query;

    if (mode !== undefined && !VALID_MODES.has(mode))
      return res.status(400).json({ error: "invalid mode" });

    const limit = Math.min(parseInt(limitRaw) || 50, 200);
    const page  = Math.max(parseInt(pageRaw)  || 1, 1);
    const skip  = (page - 1) * limit;

    const query = { userId: req.user.email };
    if (mode) query.mode = mode;

    const records = await Prediction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("smiles final_score toxicity_score drug_score confidence gnn_tox xgb_tox patientId adjusted_toxicity risk_level age weight caseId caseTitle caseDetails classification severity mode interpretation causes precautions remedies risks domain_advice model_disagreement_note createdAt");

    logger.info("history_get", { rid: req.requestId, userId: req.user.email, count: records.length, page, limit });
    return res.json({ history: records, page, limit });
  } catch (err) {
    return next(err);
  }
}

module.exports = { predictFinal, predictBatch, predictPatient, predictForensic, predictForensicBatch, visualize, history };
