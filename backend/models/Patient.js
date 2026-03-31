const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const patientSchema = new mongoose.Schema({
  patientId: { type: String, default: uuidv4, unique: true, index: true },
  createdBy: { type: String, required: true, index: true }, // doctor's email

  // Basic info
  name:    { type: String, required: true, trim: true },
  age:     { type: Number, required: true, min: 0, max: 150 },
  gender:  { type: String, enum: ["male", "female", "other"], required: true },
  contact: { type: String, required: true, trim: true },
  email:   { type: String, trim: true, default: "" },
  address: { type: String, default: "" },

  // Medical info
  medicalHistory:      { type: String, default: "" },
  allergies:           { type: String, default: "" },
  currentMedications:  { type: String, default: "" },
  notes:               { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

patientSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Patient", patientSchema);
