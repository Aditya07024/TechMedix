import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as safetyEngine from "../services/safetyEngine.js";
import { analyzeInteractionAI } from "../services/aiInteractionAnalyzer.js";
import { logAudit } from "../services/auditService.js";

const router = express.Router();

/**
 * Check disease-medicine conflicts
 */
router.post(
  "/check-disease-conflicts",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { patientId, medicineName } = req.body;

      if (!patientId || !medicineName) {
        return res
          .status(400)
          .json({ error: "Patient ID and medicine name required" });
      }

      const conflicts = await safetyEngine.checkDiseaseConflicts(
        patientId,
        medicineName,
      );

      res.json(conflicts);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Check drug-drug interactions
 */
router.post(
  "/check-drug-interactions",
  authenticate,
  authorizeRoles("doctor", "patient"),
  async (req, res) => {
    try {
      const { medicines } = req.body;

      if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ error: "Medicines array required" });
      }

      const cleanedMedicines = medicines
        .map((medicine) => String(medicine || "").trim())
        .filter(Boolean);

      if (cleanedMedicines.length < 2) {
        return res.json({
          has_interactions: false,
          interactions: [],
          critical: false,
          source: "ai",
        });
      }

      const interactions = [];

      for (let i = 0; i < cleanedMedicines.length; i += 1) {
        for (let j = i + 1; j < cleanedMedicines.length; j += 1) {
          const medicineA = cleanedMedicines[i];
          const medicineB = cleanedMedicines[j];
          const result = await analyzeInteractionAI(medicineA, medicineB);

          if (result?.interaction_found) {
            interactions.push({
              medicine_a: medicineA,
              medicine_b: medicineB,
              severity: result.severity || "medium",
              description:
                result.description ||
                `Potential interaction between ${medicineA} and ${medicineB}.`,
              mechanism: result.mechanism || "",
              recommendation: result.recommendation || "",
              confidence: result.confidence ?? 0,
              source: "ai",
            });
          }
        }
      }

      res.json({
        has_interactions: interactions.length > 0,
        interactions,
        critical: interactions.some((item) =>
          ["high", "critical"].includes(String(item.severity).toLowerCase()),
        ),
        source: "ai",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Validate prescription for safety
 * Comprehensive check for all risk factors
 */
router.post(
  "/validate-prescription",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { patientId, medicines } = req.body;

      if (!patientId || !medicines || medicines.length === 0) {
        return res
          .status(400)
          .json({ error: "Patient ID and medicines required" });
      }

      const validation = await safetyEngine.validatePrescriptionSafety({
        patient_id: patientId,
        doctor_id: req.user.id,
        medicines,
      });

      res.json(validation);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get prescription risk alerts
 */
router.get(
  "/prescription/:prescriptionId/alerts",
  authenticate,
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;

      const alerts = await safetyEngine.getPrescriptionAlerts(prescriptionId);

      res.json({
        prescription_id: prescriptionId,
        pending_alerts: alerts.length,
        alerts,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Override prescription risk alert
 * Doctor must provide override reason
 */
router.post(
  "/alert/:alertId/override",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { alertId } = req.params;
      const { overrideReason } = req.body;

      if (!overrideReason) {
        return res.status(400).json({ error: "Override reason required" });
      }

      const result = await safetyEngine.overridePrescriptionRisk(
        alertId,
        req.user.id,
        overrideReason,
      );

      await logAudit({
        action: "prescription_override",
        table_name: "prescription_risk_alerts",
        record_id: alertId,
        metadata: { override_reason: overrideReason, doctor_id: req.user.id },
      });

      res.json({
        success: true,
        message: "Risk alert overridden by doctor",
        alert: result,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get active risks for patient
 */
router.get(
  "/patient/:patientId/active-risks",
  authenticate,
  authorizeRoles("doctor", "admin"),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const risks = await safetyEngine.getPatientActiveRisks(patientId);

      res.json(risks);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get doctor's safety report
 */
router.get(
  "/doctor/:doctorId/safety-report",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { days = 30 } = req.query;

      if (req.user.id !== doctorId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const report = await safetyEngine.getDoctorSafetyReport(
        doctorId,
        parseInt(days),
      );

      res.json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
