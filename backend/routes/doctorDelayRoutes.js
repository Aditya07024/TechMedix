import express from "express";
import { broadcastDoctorDelay } from "../services/doctorDelayService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/:doctorId/delay",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { delayMinutes } = req.body;

      // Ensure doctor can only broadcast their own delay
      if (String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({
          error: "You can only broadcast delay for your own schedule"
        });
      }

      // Validate delayMinutes
      const delay = Number(delayMinutes);
      if (Number.isNaN(delay) || delay < 0 || delay > 240) {
        return res.status(400).json({
          error: "delayMinutes must be a number between 0 and 240"
        });
      }

      const io = req.app.get("io");

      await broadcastDoctorDelay(doctorId, delay, io);

      res.status(200).json({
        success: true,
        doctorId,
        delayMinutes: delay
      });

    } catch (error) {
      res.status(500).json({ error: "Delay broadcast failed" });
    }
  }
);

export default router;