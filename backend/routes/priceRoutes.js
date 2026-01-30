import express from "express";
import { runPriceAgent } from "../agents/priceAgent.js";

const router = express.Router();

/**
 * POST /api/prescriptions/:prescriptionId/price-check
 * Body: { userId }
 */
router.post(
  "/prescriptions/:prescriptionId/price-check",
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;

      if (!prescriptionId) {
        return res.status(400).json({
          success: false,
          error: "prescriptionId missing",
        });
      }

      const result = await runPriceAgent({
        prescriptionId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("❌ Price check failed:", err.message);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

export default router;