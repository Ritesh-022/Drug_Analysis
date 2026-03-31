const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },

  smiles: { type: String, required: true },

  // Core scores
  toxicity_score: { type: Number },
  drug_score:     { type: Number },
  final_score:    { type: Number },
  confidence:     { type: Number },
  gnn_tox:        { type: Number },
  xgb_tox:        { type: Number },

  // Patient-specific
  patientId:         { type: String, index: true }, // links to Patient.patientId
  adjusted_toxicity: { type: Number },
  risk_level:        { type: String },
  age:               { type: Number },
  weight:            { type: Number },

  // Forensic-specific
  caseId:         { type: String, index: true },
  caseTitle:      { type: String },
  caseDetails:    { type: String },
  classification: { type: String, enum: ["highly_toxic", "moderately_toxic", "low_toxicity"] },
  severity:       { type: Number },

  // Per-label tox scores (pharma mode)
  tox_labels: { type: Map, of: Number },
  tox_binary: { type: Map, of: Number },

  // ZINC drug-property scores (pharma mode)
  zinc: {
    logP: { type: Number },
    qed:  { type: Number },
    SAS:  { type: Number },
  },

  // LLM analysis fields (from Ollama via Flask)
  interpretation:          { type: String },
  causes:                  [{ type: String }],
  precautions:             [{ type: String }],
  remedies:                [{ type: String }],
  risks:                   [{ type: String }],
  domain_advice:           { type: String },
  model_disagreement_note: { type: String },

  // Metadata
  mode: {
    type: String,
    enum: ["pharma", "medical", "forensic", "batch"],
    required: true,
  },

  createdAt: { type: Date, default: Date.now },
});

// Compound index: per-user history sorted by newest first
predictionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Prediction", predictionSchema);
