const express = require("express");

const { authRequired, roleRequired } = require("../middleware/auth");
const predictController = require("../controllers/predictController");
const authController = require("../controllers/authController");
const patientController = require("../controllers/patientController");

const router = express.Router();

// Auth routes (public)
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
router.post("/auth/logout", authController.logout);
router.get("/auth/verify", authRequired, authController.verify);

// JWT + role-based access control
const requireAccess = [authRequired, roleRequired(["pharma", "medical", "forensic", "admin"])];
const requireMedical = [authRequired, roleRequired(["medical", "admin"])];

// Patient management (medical + admin only)
router.post("/patients", ...requireMedical, patientController.createPatient);
router.get("/patients", ...requireMedical, patientController.getAllPatients);
router.get("/patients/:patientId", ...requireMedical, patientController.getPatient);
router.put("/patients/:patientId", ...requireMedical, patientController.updatePatient);
router.delete("/patients/:patientId", ...requireMedical, patientController.deletePatient);

// Predictions
router.post("/predict", ...requireAccess, predictController.predictFinal);
router.post("/predict/batch", ...requireAccess, predictController.predictBatch);
router.post("/predict/patient", ...requireMedical, predictController.predictPatient);
router.post("/predict/forensic", ...requireAccess, predictController.predictForensic);
router.post("/predict/forensic/batch", ...requireAccess, predictController.predictForensicBatch);
router.post("/visualize", ...requireAccess, predictController.visualize);
router.get("/history", ...requireAccess, predictController.history);

module.exports = router;
