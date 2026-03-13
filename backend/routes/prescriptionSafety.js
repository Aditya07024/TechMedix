import express from "express";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import { runRiskAnalysis } from "../services/riskEngine.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/:id/analyze",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const prescriptionId = req.params.id;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Run existing safety agent
      const report = await runSafetyAgent({
        prescriptionId,
        userId,
      });

      // Run AI Risk Engine
      const io = req.app.get("io");
      const alerts = await runRiskAnalysis(prescriptionId, io);

      res.json({
        message: "Safety + Risk analysis completed",
        report,
        alerts,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: err.message || "Safety analysis failed"
      });
    }
  }
);

export default router;