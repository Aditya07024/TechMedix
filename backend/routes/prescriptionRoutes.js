import express from "express";
import multer from "multer";
import sql from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import prescriptionAgent from "../agents/prescriptionAgent.js";
import adherenceAgent from "../agents/adherenceAgent.js";
const router = express.Router();
const upload = multer({ dest: "uploads/" });
import { runSafetyAgent } from "../agents/safetyAgent.js";
import workflowOrchestrator from "../orchestrator/workflowOrchestrator.js";
/* ===================== UPLOAD ===================== */
router.post(
  "/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      const { userId, patientId } = req.body;

      if (!userId || !patientId || !req.file) {
        return res.status(400).json({ error: "Invalid input" });
      }

      const result = await sql`
        INSERT INTO prescriptions (
          user_id,
          patient_id,
          image_url,
          status
        )
        VALUES (
          ${userId},
          ${patientId},
          ${req.file.path},
          'uploaded'
        )
        RETURNING id
      `;

      const prescriptionId = result[0].id;
      const workflowId = uuidv4();

      // 🔥 AUTO-TRIGGER AGENT-1 (non-blocking)
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
      SELECT user_id FROM prescriptions WHERE id = ${prescriptionId}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const workflowId = uuidv4();

    await prescriptionAgent.execute({
      prescriptionId,
      userId: rows[0].user_id,
      workflowId,
    });

    res.json({
      success: true,
      workflow_id: workflowId,
      message: "Prescription analysis completed",
    });
  } catch (err) {
    console.error("Analysis failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/api/prescriptions/:prescriptionId/price-check",
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
      SELECT user_id FROM prescriptions WHERE id = ${prescriptionId}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const userId = rows[0].user_id;

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
      workflow: err,
    });
  }
});
export default router;