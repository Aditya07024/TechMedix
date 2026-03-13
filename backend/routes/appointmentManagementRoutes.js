import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as appointmentService from "../services/appointmentService.js";
import * as scheduleService from "../services/scheduleService.js";
import * as safetyEngine from "../services/safetyEngine.js";
import * as smartNotifications from "../services/smartNotificationService.js";
import { logAudit } from "../services/auditService.js";

const router = express.Router();

/**
 * DOCTOR ENDPOINTS
 */

// Get list of appointments for a doctor (used by doctor dashboard)
router.get(
  "/doctor/:doctorId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      // doctor can only access their own schedule
      if (
        req.user.role === "doctor" &&
        String(req.user.id) !== String(doctorId)
      ) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const appointments =
        await appointmentService.getDoctorAppointments(doctorId);
      res.json({ success: true, data: appointments });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get available dates for appointment booking
router.get(
  "/doctor/:doctorId/available-dates",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { days = 30 } = req.query;

      const result = await scheduleService.getAvailableDateRange(
        doctorId,
        parseInt(days),
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get available time slots for a date
router.get(
  "/doctor/:doctorId/available-slots",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { date, duration = 30 } = req.query;

      if (!date) {
        return res.status(400).json({ error: "Date required" });
      }

      const result = await scheduleService.getAvailableTimeSlots(
        doctorId,
        date,
        parseInt(duration),
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * PATIENT ENDPOINTS
 */

// Book appointment
router.post(
  "/book",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const {
        doctorId,
        appointmentDate,
        appointmentTime,
        shareHealthHistory = false,
      } = req.body;

      if (!doctorId || !appointmentDate || !appointmentTime) {
        return res
          .status(400)
          .json({ error: "Doctor ID, date, and time required" });
      }

      // Ensure patient is booking for themselves
      if (req.user.id !== req.body.patientId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Can only book for yourself" });
      }

      const appointmentData = {
        patient_id: req.user.id,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        share_health_history: shareHealthHistory,
        status: "pending_payment", // New status
      };

      const result = await appointmentService.bookAppointment(appointmentData);

      await logAudit({
        action: "appointment_booked",
        table_name: "appointments",
        record_id: result.id,
        metadata: { doctor_id: doctorId, date: appointmentDate },
      });

      // Create notification
      await smartNotifications.createNotification(
        req.user.id,
        "appointment_booked",
        "Appointment Booked",
        `Appointment booked with doctor on ${appointmentDate}`,
        result.id,
        "appointment",
      );

      res.status(201).json({
        success: true,
        appointment: result,
        next_step: "proceed_to_payment",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get patient's appointments
router.get(
  "/patient/my-appointments",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const appointments = await appointmentService.getPatientAppointments(
        req.user.id,
      );
      res.json({ appointments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Cancel appointment
router.post("/:appointmentId/cancel", authenticate, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    // Verify ownership
    const apt =
      await sql`SELECT patient_id, doctor_id FROM appointments WHERE id = ${appointmentId}`;
    if (apt.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const isOwner =
      req.user.id === apt[0].patient_id ||
      req.user.id === apt[0].doctor_id ||
      req.user.role === "admin";
    if (!isOwner) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = await appointmentService.cancelAppointment(
      appointmentId,
      req.user.id,
      reason,
    );

    await logAudit({
      action: "appointment_cancelled",
      table_name: "appointments",
      record_id: appointmentId,
      metadata: { cancelled_by: req.user.id, reason },
    });

    // Notify both parties
    await smartNotifications.createNotification(
      apt[0].patient_id,
      "appointment_cancelled",
      "Appointment Cancelled",
      `Your appointment has been cancelled. Reason: ${reason || "No reason provided"}`,
      appointmentId,
      "appointment",
    );

    if (req.user.id !== apt[0].doctor_id) {
      await smartNotifications.createNotification(
        apt[0].doctor_id,
        "appointment_cancelled",
        "Appointment Cancelled",
        `Patient cancelled appointment`,
        appointmentId,
        "appointment",
      );
    }

    res.json({ success: true, appointment: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reschedule appointment
router.post("/:appointmentId/reschedule", authenticate, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime } = req.body;

    if (!newDate || !newTime) {
      return res.status(400).json({ error: "New date and time required" });
    }

    // Verify ownership
    const apt =
      await sql`SELECT patient_id FROM appointments WHERE id = ${appointmentId}`;
    if (apt.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (req.user.id !== apt[0].patient_id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = await appointmentService.rescheduleAppointment(
      appointmentId,
      newDate,
      newTime,
    );

    await logAudit({
      action: "appointment_rescheduled",
      table_name: "appointments",
      record_id: appointmentId,
      metadata: { new_date: newDate, new_time: newTime },
    });

    // Notify
    await smartNotifications.createNotification(
      apt[0].patient_id,
      "appointment_rescheduled",
      "Appointment Rescheduled",
      `Your appointment has been rescheduled to ${newDate} at ${newTime}`,
      appointmentId,
      "appointment",
    );

    res.json({ success: true, appointment: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Validate appointment for safety
router.post(
  "/:appointmentId/validate-safety",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { medicines = [] } = req.body;

      if (medicines.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one medicine required" });
      }

      // Get appointment
      const apt =
        await sql`SELECT patient_id FROM appointments WHERE id = ${appointmentId}`;
      if (apt.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Validate safety
      const validation = await safetyEngine.validatePrescriptionSafety({
        patient_id: apt[0].patient_id,
        doctor_id: req.user.id,
        medicines,
      });

      res.json(validation);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Mark appointment as arrived
router.post("/:appointmentId/arrived", authenticate, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const io = req.app.get("io");

    const apt =
      await sql`SELECT patient_id, doctor_id FROM appointments WHERE id = ${appointmentId}`;
    if (apt.length === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (req.user.id !== apt[0].patient_id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update status
    const updated = await sql`
      UPDATE appointments
      SET status = 'arrived'
      WHERE id = ${appointmentId}
      RETURNING *
    `;

    // Notify doctor
    if (io) {
      io.to(`doctor-${apt[0].doctor_id}`).emit("patient-arrived", {
        appointment_id: appointmentId,
      });
    }

    res.json({ success: true, appointment: updated[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Complete appointment
router.post(
  "/:appointmentId/complete",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { followUpDate = null } = req.body;

      const result = await appointmentService.completeAppointment(
        appointmentId,
        followUpDate,
      );

      await logAudit({
        action: "appointment_completed",
        table_name: "appointments",
        record_id: appointmentId,
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
