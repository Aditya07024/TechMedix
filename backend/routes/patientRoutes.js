

import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

/*
  GET PATIENT PRESCRIPTIONS (Soft Delete Safe)
  GET /api/patient/:id/prescriptions
*/
router.get(
  "/:id/prescriptions",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (String(req.user.id) !== String(id)) {
        return res.status(403).json({
          error: "You can only access your own prescriptions"
        });
      }

      const prescriptions = await sql`
        SELECT id,
               uploaded_at,
               processed_at,
               status,
               risk_score
        FROM prescriptions
        WHERE patient_id = ${id}
          AND is_deleted = FALSE
        ORDER BY uploaded_at DESC
      `;

      res.json(prescriptions);

    } catch (error) {
      console.error("Patient prescriptions error:", error);
      res.status(500).json({ error: "Failed to fetch prescriptions" });
    }
  }
);

/*
  GET PATIENT TIMELINE (Appointments + Prescriptions)
  GET /api/patient/:id/timeline
*/
router.get(
  "/:id/timeline",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (String(req.user.id) !== String(id)) {
        return res.status(403).json({
          error: "You can only access your own timeline"
        });
      }

      const appointments = await sql`
        SELECT id,
               doctor_id,
               appointment_date,
               slot_time,
               status
        FROM appointments
        WHERE patient_id = ${id}
          AND is_deleted = FALSE
        ORDER BY appointment_date DESC
      `;

      const prescriptions = await sql`
        SELECT id,
               uploaded_at,
               processed_at,
               status
        FROM prescriptions
        WHERE patient_id = ${id}
          AND is_deleted = FALSE
        ORDER BY uploaded_at DESC
      `;

      res.json({
        appointments,
        prescriptions
      });

    } catch (error) {
      console.error("Patient timeline error:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  }
);

/*
  SOFT DELETE PRESCRIPTION
  DELETE /api/patient/prescription/:id
*/
router.delete(
  "/prescription/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;
      // Ensure prescription belongs to the logged-in patient
      const prescription = await sql`
        SELECT patient_id FROM prescriptions WHERE id = ${id}
      `;
      if (!prescription.length) {
        return res.status(404).json({ error: "Prescription not found" });
      }
      if (String(prescription[0].patient_id) !== String(req.user.id)) {
        return res.status(403).json({
          error: "You can only delete your own prescriptions"
        });
      }

      await sql`
        UPDATE prescriptions
        SET is_deleted = TRUE
        WHERE id = ${id}
      `;

      res.json({ success: true });

    } catch (error) {
      console.error("Soft delete prescription error:", error);
      res.status(500).json({ error: "Delete failed" });
    }
  }
);

export default router;