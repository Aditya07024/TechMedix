import express from "express";
import {
  createAppointment,
  cancelAppointmentHandler,
  rescheduleAppointmentHandler,
  getAppointment,
  getDoctorAppts,
  getPatientAppts,
  updateApptStatus,
} from "../controllers/appointmentController.js";
import { authenticate } from "../middleware/auth.js";
import {
  validateAppointmentBooking,
  validateReschedule,
} from "../validators/appointmentValidator.js";

const router = express.Router();

// Book appointment
router.post(
  "/",
  authenticate,
  (req, res, next) => {
    const validation = validateAppointmentBooking(req.body);
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ success: false, errors: validation.errors });
    }
    next();
  },
  createAppointment,
);

// Get appointment
router.get("/:appointment_id", authenticate, getAppointment);

// Get doctor's appointments
router.get("/doctor/:doctor_id", authenticate, getDoctorAppts);

// Get patient's appointments
router.get("/patient/:patient_id", authenticate, getPatientAppts);

// Cancel appointment
router.post("/:appointment_id/cancel", authenticate, cancelAppointmentHandler);

// Reschedule appointment
router.post(
  "/:appointment_id/reschedule",
  authenticate,
  (req, res, next) => {
    const validation = validateReschedule(req.body);
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ success: false, errors: validation.errors });
    }
    next();
  },
  rescheduleAppointmentHandler,
);

// Update status
router.patch("/:appointment_id/status", authenticate, updateApptStatus);

export default router;
