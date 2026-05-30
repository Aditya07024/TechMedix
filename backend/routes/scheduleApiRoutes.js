import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getAvailableDateRange,
  getAvailableTimeSlots,
  getDoctorSchedule,
  setDoctorSchedule,
} from "../services/scheduleService.js";

const router = express.Router();

/**
 * GET /api/v2/schedule/doctor/:doctorId/available-dates
 * Get available dates for next N days
 */
router.get(
  "/doctor/:doctorId/available-dates",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { days = 30 } = req.query;

      const result = await getAvailableDateRange(doctorId, parseInt(days));
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/v2/schedule/doctor/:doctorId/available-slots
 * Get available time slots for a specific date
 */
router.get(
  "/doctor/:doctorId/available-slots",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { date, duration = 30 } = req.query;

      console.log("🎯 Available slots request:", { doctorId, date, duration });

      if (!date) {
        console.error("❌ Date is missing from query params");
        return res
          .status(400)
          .json({ success: false, error: "Date is required" });
      }

      const result = await getAvailableTimeSlots(
        doctorId,
        date,
        parseInt(duration),
      );

      console.log("✅ Slots result:", result);
      res.json(result);
    } catch (error) {
      console.error("❌ Error in available-slots route:", error.message);
      res.status(400).json({
        success: false,
        error: error.message,
        debug: {
          doctorId,
          date,
          duration,
        },
      });
    }
  },
);

/**
 * GET /api/v2/schedule/doctor/:doctorId
 * Get doctor's full schedule
 */
router.get("/doctor/:doctorId", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const result = await getDoctorSchedule(doctorId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2/schedule/doctor/:doctorId
 * Set doctor's schedule
 */
router.post("/doctor/:doctorId", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;

    console.log(
      "Schedule update request - Doctor ID:",
      doctorId,
      "User ID:",
      req.user?.id,
    );

    // Verify user is updating their own schedule
    if (String(req.user?.id) !== String(doctorId)) {
      console.warn(
        "Unauthorized attempt: user",
        req.user?.id,
        "trying to update doctor",
        doctorId,
      );
      return res
        .status(403)
        .json({
          success: false,
          error: "Unauthorized: You can only update your own schedule",
        });
    }

    const scheduleData = {
      doctor_id: doctorId,
      ...req.body,
    };

    console.log("Setting schedule with data:", scheduleData);

    const result = await setDoctorSchedule(scheduleData);

    if (!result || result.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Failed to save schedule - no data returned",
        });
    }

    console.log("Schedule saved successfully:", result[0]);
    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("Schedule update error:", error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
