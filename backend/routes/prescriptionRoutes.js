import express from "express";
import multer from "multer";
import sql from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import prescriptionAgent from "../agents/prescriptionAgent.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* ===================== UPLOAD ===================== */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const userId = req.body.userId;
    const patientId = Number(req.body.patientId);

    if (!userId || !patientId || !req.file) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const result = await sql`
      INSERT INTO prescriptions (user_id, patient_id, image_url, status)
      VALUES (${userId}, ${patientId}, ${req.file.path}, 'processing')
      RETURNING id
    `;

    res.json({ success: true, prescription_id: result[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

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

export default router;