import express from "express";
import {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
} from "../services/appointmentService.js";

import { authenticate, authorizeRoles } from "../middleware/auth.js";
import sql from "../config/database.js";

const router = express.Router();

router.post("/", authenticate, authorizeRoles("patient"), async (req, res) => {
  try {
    if (String(req.user.id) !== String(req.body.patientId)) {
      return res.status(403).json({
        error: "You can only book appointments for yourself",
      });
    }
    const result = await bookAppointment(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get(
  "/patient/:id",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      if (
        req.user.role === "patient" &&
        String(req.user.id) !== String(req.params.id)
      ) {
        return res.status(403).json({
          error: "You can only view your own appointments",
        });
      }
      const result = await getPatientAppointments(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.get(
  "/doctor/:id",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      if (String(req.user.id) !== String(req.params.id)) {
        return res.status(403).json({
          error: "You can only view your own appointments",
        });
      }
      const result = await getDoctorAppointments(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// UPDATE APPOINTMENT STATUS
router.put(
  "/:id/status",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // only allow the simplified statuses
      const validStatuses = ["booked", "visited", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // verify the appointment belongs to this doctor
      const appointment = await sql`
        SELECT * FROM appointments
        WHERE id = ${id}
          AND doctor_id = ${req.user.id}
          AND is_deleted = FALSE
      `;
      if (!appointment.length) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // delegate to service which handles mapping
      const updated = await updateAppointmentStatus(id, status);

      res.json({
        success: true,
        appointment: updated,
      });
    } catch (err) {
      console.error("Update appointment status failed:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
