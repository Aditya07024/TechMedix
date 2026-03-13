import express from "express";
import { getPatientTimeline } from "../services/timelineService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/:patientId/timeline",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      if (req.user.role === "patient" && String(req.user.id) !== String(patientId)) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own timeline"
        });
      }

      const timeline = await getPatientTimeline(patientId);

      res.json(timeline);

    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

export default router;