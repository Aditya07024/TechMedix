import express from "express";
import sql from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

import prescriptionAgent from "../agents/prescriptionAgent.js";
import adherenceAgent from "../agents/adherenceAgent.js";
import workflowOrchestrator from "../orchestrator/workflowOrchestrator.js";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import { getMedicinesByPrescription } from "../models/PrescriptionMedicine.js";

// ✅ IMPORT YOUR UPLOAD MIDDLEWARE
import { uploadPrescription } from "../middleware/upload.js";

const router = express.Router();

/* ===================== GET PRESCRIPTION DETAILS (for frontend) ===================== */
router.get("/:id/details", async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const rows = await sql`
      SELECT id, image_url, extracted_text, status
      FROM prescriptions
      WHERE id = ${prescriptionId}
    `;
    if (!rows.length) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    const medicines = await getMedicinesByPrescription(prescriptionId);
    res.json({
      prescription: rows[0],
      medicines: medicines.map((m) => ({
        medicine_name: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
        confidence: m.confidence != null ? Number(m.confidence) : null,
      })),
    });
  } catch (err) {
    console.error("❌ Get prescription details failed:", err);
    res.status(500).json({ error: "Failed to load prescription details" });
  }
});

/* ===================== UPLOAD ===================== */
router.post(
  "/upload",
  uploadPrescription, // ✅ USE MIDDLEWARE HERE
  async (req, res) => {
    try {
      const { userId, patientId } = req.body;

      // ✅ VALIDATION
      if (!userId || !patientId || !req.file) {
        return res.status(400).json({ error: "Invalid input" });
      }

      const userIdInt = parseInt(userId, 10);
      const patientIdInt = parseInt(patientId, 10);
      if (Number.isNaN(userIdInt) || Number.isNaN(patientIdInt)) {
        return res.status(400).json({ error: "Invalid user or patient id" });
      }

      // Use integer columns (run migrations/002_prescriptions_integer_user.sql if you use UUID schema)
      const result = await sql`
        INSERT INTO prescriptions (
          user_id_int,
          patient_id,
          image_url,
          status
        )
        VALUES (
          ${userIdInt},
          ${patientIdInt},
          ${req.file.path},
          'processing'
        )
        RETURNING id
      `;

      const prescriptionId = result[0].id;
      const workflowId = uuidv4();

      // 🔥 AUTO-TRIGGER AGENT-1 (ASYNC)
      setImmediate(() => {
        prescriptionAgent.execute({
          prescriptionId,
          userId,
          workflowId,
        }).catch(err =>
          console.error("❌ Agent-1 async failed:", err)
        );
      });

      res.status(201).json({
        success: true,
        prescription_id: prescriptionId,
        workflow_id: workflowId,
        status: "processing",
        message: "Prescription uploaded. Analysis started.",
      });

    } catch (err) {
      console.error("❌ Upload failed:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ===================== ANALYZE ===================== */
router.post("/:id/analyze", async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    const rows = await sql`
      SELECT user_id_int, user_id FROM prescriptions WHERE id = ${prescriptionId}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const userId = rows[0].user_id_int != null ? rows[0].user_id_int : rows[0].user_id;
    const workflowId = uuidv4();

    await prescriptionAgent.execute({
      prescriptionId,
      userId,
      workflowId,
    });

    res.json({
      success: true,
      workflow_id: workflowId,
      message: "Prescription analysis completed",
    });
  } catch (err) {
    console.error("❌ Analysis failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===================== PRICE CHECK ===================== */
router.post(
  "/:prescriptionId/price-check",
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;
      const data = await runSafetyAgent({ prescriptionId });

      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ Price check failed:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);

/* ===================== ADHERENCE ===================== */
router.post("/:id/adherence", async (req, res) => {
  try {
    await adherenceAgent.execute({
      prescriptionId: req.params.id
    });

    res.json({
      success: true,
      message: "Adherence schedule created"
    });
  } catch (err) {
    console.error("❌ Adherence failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===================== FULL WORKFLOW ===================== */
router.post("/:id/process-complete", async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    const rows = await sql`
      SELECT user_id_int, user_id FROM prescriptions WHERE id = ${prescriptionId}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const userId = rows[0].user_id_int != null ? rows[0].user_id_int : rows[0].user_id;

    const result = await workflowOrchestrator.execute({
      prescriptionId,
      userId,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("❌ Workflow failed:", err);
    res.status(500).json({
      success: false,
      error: err.error || err.message,
    });
  }
});

export default router;
