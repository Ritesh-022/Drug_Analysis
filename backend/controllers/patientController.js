const Patient = require("../models/Patient");
const Prediction = require("../models/Prediction");
const { logger } = require("../utils/logger");

async function createPatient(req, res, next) {
  try {
    const { name, age, gender, contact, email, address, medicalHistory, allergies, currentMedications, notes } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (age === undefined || age === null || Number(age) < 0 || Number(age) > 150)
      return res.status(400).json({ error: "valid age required (0-150)" });
    if (!gender) return res.status(400).json({ error: "gender is required" });
    if (!contact?.trim()) return res.status(400).json({ error: "contact is required" });

    const patient = await Patient.create({
      createdBy: req.user.email,
      name: name.trim(),
      age: parseInt(age),
      gender,
      contact: contact.trim(),
      email: email?.trim() || "",
      address: address?.trim() || "",
      medicalHistory: medicalHistory?.trim() || "",
      allergies: allergies?.trim() || "",
      currentMedications: currentMedications?.trim() || "",
      notes: notes?.trim() || "",
    });

    logger.info("patient_created", { rid: req.requestId, patientId: patient.patientId, by: req.user.email });
    return res.status(201).json({ patient });
  } catch (err) {
    return next(err);
  }
}

async function getAllPatients(req, res, next) {
  try {
    const search = req.query.search || "";
    const query = { createdBy: req.user.email };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { contact: { $regex: escaped, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query).sort({ createdAt: -1 });

    // Attach prediction count per patient
    const patientIds = patients.map((p) => p.patientId);
    const counts = await Prediction.aggregate([
      { $match: { patientId: { $in: patientIds } } },
      { $group: { _id: "$patientId", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c]));

    const result = patients.map((p) => {
      const c = countMap.get(p.patientId);
      return { ...p.toObject(), predictionCount: c?.count || 0, lastPrediction: c?.lastAt || null };
    });

    return res.json({ patients: result });
  } catch (err) {
    return next(err);
  }
}

async function getPatient(req, res, next) {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId, createdBy: req.user.email });
    if (!patient) return res.status(404).json({ error: "patient not found" });

    const predictions = await Prediction.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 })
      .select("smiles adjusted_toxicity risk_level age weight interpretation causes precautions remedies risks domain_advice mode createdAt");

    return res.json({ patient, predictions });
  } catch (err) {
    return next(err);
  }
}

async function updatePatient(req, res, next) {
  try {
    const { name, age, gender, contact, email, address, medicalHistory, allergies, currentMedications, notes } = req.body || {};
    const patient = await Patient.findOneAndUpdate(
      { patientId: req.params.patientId, createdBy: req.user.email },
      { name, age, gender, contact, email, address, medicalHistory, allergies, currentMedications, notes, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ error: "patient not found" });
    return res.json({ patient });
  } catch (err) {
    return next(err);
  }
}

async function deletePatient(req, res, next) {
  try {
    const patient = await Patient.findOneAndDelete({ patientId: req.params.patientId, createdBy: req.user.email });
    if (!patient) return res.status(404).json({ error: "patient not found" });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createPatient, getAllPatients, getPatient, updatePatient, deletePatient };
