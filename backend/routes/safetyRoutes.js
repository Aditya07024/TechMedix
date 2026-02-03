import express from "express";
import { runSafetyAgent } from "../agents/safetyAgent.js";

const router = express.Router();

// POST /api/prescriptions/:prescriptionId/safety-check
router.post(
  "/prescriptions/:prescriptionId/safety-check",
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;
      const { userId } = req.body;

      if (!prescriptionId || !userId) {
        return res.status(400).json({
          success: false,
          error: "prescriptionId or userId missing",
        });
      }

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