import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as queueService from "../services/queueManagementService.js";
import * as smartNotifications from "../services/smartNotificationService.js";
import { logAudit } from "../services/auditService.js";

const router = express.Router();

/**
 * DOCTOR ENDPOINTS
 */

// Get live queue for doctor
router.get(
  "/doctor/:doctorId/live-queue",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (req.user.id !== doctorId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Can only view your own queue" });
      }

      const queue = await queueService.getDoctorQueue(doctorId);
      res.json(queue);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get queue statistics
router.get(
  "/doctor/:doctorId/stats",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (req.user.id !== doctorId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const stats = await queueService.getQueueStats(doctorId);
      res.json(stats);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Mark patient as being served
router.post(
  "/:queueId/in-progress",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { queueId } = req.params;
      const io = req.app.get("io");

      const result = await queueService.markPatientInProgress(
        queueId,
        req.user.id,
        io,
      );

      await logAudit({
        action: "patient_in_progress",
        table_name: "queue_tracking",
        record_id: queueId,
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Complete consultation and advance queue
router.post(
  "/:queueId/complete",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { queueId } = req.params;
      const io = req.app.get("io");

      const result = await queueService.completeConsultation(
        queueId,
        req.user.id,
        io,
      );

      await logAudit({
        action: "consultation_completed",
        table_name: "queue_tracking",
        record_id: queueId,
      });

      res.json({ success: true, completed: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Set doctor delay
router.post(
  "/doctor/:doctorId/delay",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { delayMinutes, reason } = req.body;

      if (req.user.id !== doctorId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!delayMinutes || !reason) {
        return res
          .status(400)
          .json({ error: "Delay minutes and reason required" });
      }

      const io = req.app.get("io");
      const delay = await queueService.setDoctorDelay(
        doctorId,
        delayMinutes,
        reason,
        io,
      );

      await logAudit({
        action: "doctor_delay_set",
        table_name: "doctor_delays",
        record_id: delay.id,
        metadata: { delay_minutes: delayMinutes, reason },
      });

      res.json(delay);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get doctor delay status
router.get("/doctor/:doctorId/delay-status", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const delay = await queueService.getDoctorDelay(doctorId);

    if (!delay) {
      return res.json({ has_delay: false });
    }

    res.json({ has_delay: true, delay });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATIENT ENDPOINTS
 */

// Patient joins queue (when arriving)
router.post(
  "/join/:appointmentId",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const io = req.app.get("io");

      // Verify patient
      const apt =
        await sql`SELECT patient_id FROM appointments WHERE id = ${appointmentId}`;
      if (apt.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.id !== apt[0].patient_id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const result = await queueService.addToQueue(appointmentId, io);

      await logAudit({
        action: "patient_joined_queue",
        table_name: "queue_tracking",
        record_id: result.queue_id,
        metadata: {
          appointment_id: appointmentId,
          token_number: result.token_number,
        },
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Get patient's queue position
router.get(
  "/patient/:appointmentId/position",
  authenticate,
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      // Verify access
      const apt =
        await sql`SELECT patient_id FROM appointments WHERE id = ${appointmentId}`;
      if (apt.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.id !== apt[0].patient_id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const position = await queueService.getPatientQueuePosition(
        appointmentId,
        req.user.id,
      );
      res.json(position);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * COMMON ENDPOINTS
 */

// Get queue for a doctor (public view - for digital displays)
router.get("/display/doctor/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const queue = await queueService.getDoctorQueue(doctorId);

    // Only show necessary info for display
    const displayQueue = queue.queue.map((q) => ({
      token_number: q.token_number,
      status: q.status,
      position: q.position_in_queue,
    }));

    res.json({
      doctor_id: doctorId,
      queue_size: queue.queue_size,
      queue: displayQueue,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
