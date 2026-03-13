import express from "express";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// POST /api/prescriptions/:prescriptionId/safety-check
router.post(
  "/prescriptions/:prescriptionId/safety-check",
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
          error: "You can only run safety check for your own prescription"
        });
      }

      const userId = req.user.id;

      const report = await runSafetyAgent({
        prescriptionId,
        userId,
      });

      res.json({ success: true, data: report });
    } catch (err) {
      console.error("❌ Safety check failed:", err);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// router.post(
//   "/prescriptions/:prescriptionId/safety-check",
//   async (req, res) => {
//     console.log("🧪 DEBUG HEADERS:", req.headers);
//     console.log("🧪 DEBUG BODY:", req.body);

//     try {
//       const { prescriptionId } = req.params;
//       const userId = req.body?.userId;

//       if (!prescriptionId || !userId) {
//         return res.status(400).json({
//           success: false,
//           error: "prescriptionId or userId missing",
//           debugBody: req.body,
//         });
//       }

//       const report = await runSafetyAgent({
//         prescriptionId,
//         userId,
//       });

//       res.json({ success: true, data: report });
//     } catch (err) {
//       console.error("❌ Safety check failed:", err);
//       res.status(500).json({
//         success: false,
//         error: err.message,
//       });
//     }
//   }
// );
export default router;