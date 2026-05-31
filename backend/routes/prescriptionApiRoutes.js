import express from "express";
import {
  createPrescriptionHandler,
  overridePrescription,
  getPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  requestRefillHandler,
  completePrescriptionHandler,
} from "../controllers/prescriptionController.js";
import { authenticate } from "../middleware/auth.js";
import { validatePrescription } from "../validators/appointmentValidator.js";
import sql from "../config/database.js";

const router = express.Router();

// Create prescription
router.post(
  "/",
  authenticate,
  (req, res, next) => {
    const validation = validatePrescription(req.body);
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ success: false, errors: validation.errors });
    }
    next();
  },
  createPrescriptionHandler,
);

// Get patient prescriptions
router.get(
  "/patient/:patient_id",

  async (req, res) => {
    try {
      const { patient_id } = req.params;

      const medicines = await sql`
        SELECT
          pm.id,
          pm.medicine_name,
          pm.dosage,
          pm.frequency,
          pm.duration,
          pm.instructions,
          pm.is_deleted,
          p.doctor_id,
          p.created_at,
          COALESCE(d.name, 'User Upload') AS doctor_name,
          COALESCE(d.specialty, 'Prescription Uploads') AS doctor_specialty,
          d.email AS doctor_email,
          d.phone AS doctor_phone,
          d.reg_no AS doctor_reg_no
        FROM prescription_medicines pm
        JOIN prescriptions p ON pm.prescription_id = p.id
        LEFT JOIN doctors d ON p.doctor_id = d.id
        WHERE p.user_id = ${patient_id}
        ORDER BY p.created_at DESC
      `;

      res.json({
        success: true,
        data: medicines,
      });
    } catch (err) {
      console.error("Prescription fetch error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to load prescriptions",
      });
    }
  },
);
// Get doctor prescriptions
router.get("/doctor/:doctor_id", authenticate, getDoctorPrescriptions);

// Get prescription
router.get("/:prescription_id", authenticate, getPrescription);

// Override prescription
router.post("/:prescription_id/override", authenticate, overridePrescription);

// Request refill
router.post("/:prescription_id/refill", authenticate, requestRefillHandler);

// Mark as completed
router.post(
  "/:prescription_id/complete",
  authenticate,
  completePrescriptionHandler,
);

// Update medicine dosage/frequency/duration
router.patch("/medicine/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { dosage, frequency, duration } = req.body;

    const updated = await sql`
        UPDATE prescription_medicines
        SET
          dosage = ${dosage || null},
          frequency = ${frequency || null},
          duration = ${duration || null}
        WHERE id = ${id}
        RETURNING id, medicine_name, dosage, frequency, duration
      `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Medicine not found",
      });
    }

    res.json({
      success: true,
      data: updated[0],
    });
  } catch (err) {
    console.error("Update medicine error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update medicine",
    });
  }
});

// Delete medicine
router.delete("/medicine/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await sql`
        UPDATE prescription_medicines
        SET is_deleted = TRUE
        WHERE id = ${id}
        RETURNING id
      `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Medicine not found",
      });
    }

    res.json({
      success: true,
      message: "Medicine deleted",
    });
  } catch (err) {
    console.error("Delete medicine error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete medicine",
    });
  }
});

export default router;
