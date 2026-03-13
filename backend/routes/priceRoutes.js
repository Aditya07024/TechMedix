import express from "express";
import sql from "../config/database.js";
import { runPriceAgent } from "../agents/priceAgent.js";
import {
  analyzeMedicinePrice,
  getPriceHistory,
} from "../services/priceIntelligenceService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/prescriptions/:prescriptionId/price-check
 */
router.post(
  "/prescriptions/:prescriptionId/price-check",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;

      if (!prescriptionId) {
        return res.status(400).json({
          success: false,
          error: "prescriptionId missing",
        });
      }

      // Verify prescription ownership (patients can only check their own)
      const rows = await sql`
        SELECT user_id_int, user_id
        FROM prescriptions
        WHERE id = ${prescriptionId}
      `;

      if (!rows.length) {
        return res.status(404).json({ success: false, error: "Prescription not found" });
      }

      const ownerId = rows[0].user_id_int ?? rows[0].user_id;

      if (req.user.role === "patient" && String(req.user.id) !== String(ownerId)) {
        return res.status(403).json({
          success: false,
          error: "You can only check price for your own prescription"
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

/**
 * GET /api/medicines/:name/price-insights
 * Returns trend, recommendation, avg price, etc.
 */
router.get(
  "/medicines/:name/price-insights",
  authenticate,
  async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const insights = await analyzeMedicinePrice(name);
      res.json({ success: true, data: insights });
    } catch (err) {
      console.error("❌ Price insights failed:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/medicines/:name/price-history
 * Returns price history for charting
 */
router.get(
  "/medicines/:name/price-history",
  authenticate,
  async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const days = parseInt(req.query.days, 10) || 30;
      const points = await getPriceHistory(name, days);
      res.json({ success: true, data: points });
    } catch (err) {
      console.error("❌ Price history failed:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/price-alerts
 * List alerts for logged-in patient (patient_id in query or from auth)
 */
router.get(
  "/price-alerts",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const rows = await sql`
        SELECT * FROM price_alerts
        WHERE patient_id = ${patientId} AND is_active = true
        ORDER BY created_at DESC
      `;
      res.json({ success: true, data: rows });
    } catch (err) {
      if (err.message?.includes("does not exist")) {
        return res.json({ success: true, data: [] });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/price-alerts
 * Create alert: { patientId, medicineName, alertType, targetValue }
 * alertType: price_below | pct_drop | cheapest
 */
router.post(
  "/price-alerts",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { medicineName, alertType, targetValue } = req.body;
      const patientId = req.user.id;
      if (!medicineName || !alertType) {
        return res.status(400).json({
          success: false,
          error: "medicineName, alertType required",
        });
      }
      const [row] = await sql`
        INSERT INTO price_alerts (patient_id, medicine_name, alert_type, target_value)
        VALUES (${patientId}, ${medicineName}, ${alertType}, ${targetValue ?? null})
        RETURNING *
      `;
      res.json({ success: true, data: row });
    } catch (err) {
      if (err.message?.includes("does not exist")) {
        return res.status(400).json({
          success: false,
          error: "price_alerts table not ready. Run migration.",
        });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * DELETE /api/price-alerts/:id
 */
router.delete(
  "/price-alerts/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      await sql`
        UPDATE price_alerts
        SET is_active = false
        WHERE id = ${req.params.id}
        AND patient_id = ${req.user.id}
      `;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;