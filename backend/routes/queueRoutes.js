import express from "express";
import sql from "../config/database.js";
import {
  markArrived,
  finishConsultation,
  scanQrAndMarkArrived,
} from "../services/queueService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/start-consultation/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      await sql`
        UPDATE appointments
        SET status = 'in_progress'
        WHERE id = ${appointmentId}
      `;

      res.json({
        success: true,
        message: "Consultation started",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Failed to start consultation",
      });
    }
  },
);

router.get("/mark-arrived", (req, res) => {
  res.json({
    success: true,
    message:
      "Queue route active. Use POST /mark-arrived with appointment_id to mark patient arrived.",
  });
});

router.post(
  "/mark-arrived",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointment_id } = req.body;
      if (!appointment_id) {
        return res.status(400).json({ error: "appointment_id is required" });
      }

      const io = req.app.get("io");

      const result = await markArrived(appointment_id, io);

      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
);

router.post(
  "/mark-arrived/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const io = req.app.get("io");

      const result = await markArrived(req.params.appointmentId, io);

      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
);

router.post(
  "/finish",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointment_id, follow_up_date } = req.body;
      if (!appointment_id) {
        return res.status(400).json({ error: "appointment_id is required" });
      }
      const io = req.app.get("io");

      const result = await finishConsultation(
        appointment_id,
        follow_up_date,
        io,
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/scan",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const io = req.app.get("io");
      const { unique_code } = req.body;
      if (!unique_code) {
        return res.status(400).json({ error: "unique_code is required" });
      }

      const result = await scanQrAndMarkArrived(unique_code, io);

      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
);
router.post(
  "/complete-consultation/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      await sql`
        UPDATE appointments
        SET status = 'visited'
        WHERE id = ${appointmentId}
      `;

      res.json({
        success: true,
        message: "Consultation completed",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to complete consultation" });
    }
  },
);
export default router;
