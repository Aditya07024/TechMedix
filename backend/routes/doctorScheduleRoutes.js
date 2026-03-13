import express from "express";
import { setDoctorSchedule, getDoctorSchedule } from "../services/scheduleService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/set",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.body;

      if (!doctorId) {
        return res.status(400).json({ error: "doctorId is required" });
      }

      if (String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({
          error: "You can only update your own schedule"
        });
      }

      const result = await setDoctorSchedule(req.body);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.get(
  "/:doctorId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      if (String(req.user.id) !== String(req.params.doctorId)) {
        return res.status(403).json({
          error: "You can only view your own schedule"
        });
      }
      const result = await getDoctorSchedule(req.params.doctorId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;