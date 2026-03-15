import express from "express";
import sql from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

import prescriptionAgent from "../agents/prescriptionAgent.js";
import adherenceAgent from "../agents/adherenceAgent.js";
import workflowOrchestrator from "../orchestrator/workflowOrchestrator.js";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import { runPriceAgent } from "../agents/priceAgent.js";
import { getMedicinesByPrescription } from "../models/PrescriptionMedicine.js";
import { runRiskAnalysis } from "../services/riskEngine.js";

// ✅ IMPORT YOUR UPLOAD MIDDLEWARE
import { uploadPrescription } from "../middleware/upload.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";
import { createHealthWalletDocument } from "../models-pg/healthWalletDocument.js";


const router = express.Router();

/* ===================== GET PATIENT ACTIVE PRESCRIPTIONS ===================== */
router.get(
  "/patient/:patientId",
  authenticate,
  authorizeRoles("doctor", "patient"),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const medicines = await sql`
  SELECT
    pm.id AS medicine_id,
    pm.medicine_name,
    pm.dosage,
    pm.frequency,
    pm.duration,
    pm.instructions
  FROM prescription_medicines pm
  JOIN prescriptions p
  ON pm.prescription_id = p.id
  WHERE p.user_id = ${patientId}
  ORDER BY p.created_at DESC
`;

      res.json({
        success: true,
        data: medicines
      });
    } catch (err) {
      console.error("❌ Failed to load patient prescriptions:", err);
      res.status(500).json({
        success: false,
        error: "Failed to load prescriptions"
      });
    }
  }
);

/* ===================== GET PRESCRIPTION DETAILS (for frontend) ===================== */
router.get(
  "/:id/details",
  authenticate,
  async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const rows = await sql`
      SELECT id, image, extracted_text, status
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
        id: m.id,
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
  authenticate,
  authorizeRoles("patient"),
  uploadPrescription,
  async (req, res) => {
    try {
      const { userId, patientId } = req.body;
      let walletUploadResult = null;

      // ✅ VALIDATION
      if (!patientId || !req.file) {
        return res.status(400).json({ error: "patientId and file are required" });
      }

      // UUID validation
if (!userId || !patientId) {
  return res.status(400).json({ error: "Invalid user or patient id" });
}

// Ensure logged-in user matches request
if (String(req.user.id) !== String(userId)) {
  return res.status(403).json({
    error: "You can only upload prescriptions for yourself"
  });
}

      // Use integer columns (run migrations/002_prescriptions_integer_user.sql if you use UUID schema)
      const result = await sql`
        INSERT INTO prescriptions (
  user_id,
  patient_id,
  image,
  status
)
        VALUES (
          ${req.user.id},
          ${patientId},
          ${req.file.path},
          'processing'
        )
        RETURNING id
      `;

      const prescriptionId = result[0].id;
      const workflowId = uuidv4();

      const folder =
        process.env.CLOUDINARY_HEALTH_WALLET_FOLDER || "techmedix/health-wallet";

      walletUploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "auto",
        folder,
        use_filename: true,
        unique_filename: true,
      });

      await createHealthWalletDocument({
        patient_id: req.user.id,
        public_id: walletUploadResult.public_id,
        file_url: walletUploadResult.secure_url,
        file_name: req.file.originalname,
        resource_type: walletUploadResult.resource_type || "raw",
        format:
          walletUploadResult.format ||
          req.file.originalname.split(".").pop()?.toLowerCase() ||
          null,
        bytes: walletUploadResult.bytes || req.file.size,
        mime_type: req.file.mimetype,
      });

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
      if (walletUploadResult?.public_id) {
        try {
          await cloudinary.uploader.destroy(walletUploadResult.public_id, {
            resource_type: walletUploadResult.resource_type || "raw",
            invalidate: true,
          });
        } catch (cleanupErr) {
          console.warn("⚠ Failed to cleanup uploaded wallet document:", cleanupErr.message);
        }
      }
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ===================== ANALYZE ===================== */
router.post(
  "/:id/analyze",
  authenticate,
  async (req, res) => {
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
  }
);

/* ===================== PRICE CHECK ===================== */
router.post(
  "/:prescriptionId/price-check",
  authenticate,
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;
      const data = await runPriceAgent({ prescriptionId });

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
router.post(
  "/:id/adherence",
  authenticate,
  async (req, res) => {
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
  }
);

/* ===================== FULL WORKFLOW ===================== */
router.post(
  "/:id/process-complete",
  authenticate,
  async (req, res) => {
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

      // 🔥 Run AI Risk Analysis after workflow completes
      const io = req.app.get("io");
      const alerts = await runRiskAnalysis(prescriptionId, io);

      // 🚨 If any severe alert exists → block prescription
      const severeAlert = alerts.find(a => a.severity === "high" || a.severity === "critical");

      if (severeAlert) {
        await sql`
          UPDATE prescriptions
          SET status = 'blocked'
          WHERE id = ${prescriptionId}
        `;

        return res.status(400).json({
          success: false,
          blocked: true,
          message: "Prescription blocked due to high-risk alert",
          alert: severeAlert,
        });
      }

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
  }
);

router.post("/manual", authenticate, async (req, res) => {
  try {
    const { patient_id, medicine_name, dosage, frequency, duration } = req.body;

    const prescription = await sql`
      INSERT INTO prescriptions (user_id, created_at)
      VALUES (${patient_id}, NOW())
      RETURNING id
    `;

    const medicine = await sql`
      INSERT INTO prescription_medicines
      (prescription_id, medicine_name, dosage, frequency, duration)
      VALUES
      (${prescription[0].id}, ${medicine_name}, ${dosage}, ${frequency}, ${duration})
      RETURNING id, medicine_name, dosage, frequency, duration
    `;

    res.json({
      success: true,
      data: medicine[0]
    });

  } catch (err) {
    console.error("Manual prescription failed:", err);
    res.status(500).json({ success: false });
  }
});

/* ===================== EDIT MEDICINE DOSAGE/FREQUENCY/DURATION ===================== */
router.patch(
  "/medicine/:id",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { dosage, frequency, duration } = req.body;

      const result = await sql`
        UPDATE prescription_medicines
        SET
          dosage = COALESCE(${dosage}, dosage),
          frequency = COALESCE(${frequency}, frequency),
          duration = COALESCE(${duration}, duration)
        WHERE id = ${id}
        RETURNING *
      `;

      if (!result.length) {
        return res.status(404).json({
          success: false,
          error: "Medicine not found"
        });
      }

      res.json({
        success: true,
        data: result[0]
      });
    } catch (err) {
      console.error("❌ Update medicine failed:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update medicine"
      });
    }
  }
);

/* ===================== STOP MEDICINE ===================== */
router.delete(
  "/medicine/:id",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await sql`
        DELETE FROM prescription_medicines
        WHERE id = ${id}
        RETURNING id
      `;

      if (!result.length) {
        return res.status(404).json({
          success: false,
          error: "Medicine not found"
        });
      }

      res.json({
        success: true,
        message: "Medicine stopped successfully"
      });
    } catch (err) {
      console.error("❌ Stop medicine failed:", err);
      res.status(500).json({
        success: false,
        error: "Failed to stop medicine"
      });
    }
  }
);
export default router;
