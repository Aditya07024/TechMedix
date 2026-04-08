import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

/* ================= GET QUEUE FOR DOCTOR ================= */
export async function getQueueForDoctor(doctorId, date) {
  const rows = await sql`
    SELECT 
      a.id as appointment_id,
      a.patient_id,
      u.name as patient_name,
      a.status,
      a.token_number,
      a.appointment_date,
      ROW_NUMBER() OVER (ORDER BY a.token_number) as position_in_queue
    FROM appointments a
    LEFT JOIN users u ON a.patient_id = u.id
    WHERE a.doctor_id = ${doctorId}
      AND DATE(a.appointment_date) = ${date}
      AND a.status IN ('booked','arrived','in_progress','completed','visited')
    ORDER BY a.token_number ASC
  `;

  return rows;
}

/* ================= GET QUEUE POSITION ================= */
export async function getQueuePosition(appointmentId) {
  const result = await sql`
    SELECT 
      a.id,
      a.status,
      a.doctor_id,
      a.appointment_date,
      p.name as patient_name,
      d.name as doctor_name,
      (
        SELECT COUNT(*) 
        FROM appointments a2
        WHERE a2.doctor_id = a.doctor_id
        AND a2.appointment_date = a.appointment_date
        AND a2.status IN ('booked','waiting','arrived','in_progress')
        AND a2.created_at <= a.created_at
      ) as position
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.id = ${appointmentId}
  `;

  if (!result.length) {
    throw new Error("Appointment not found");
  }

  const row = result[0];

  return {
    position: row.position,
    token_number: row.position,
    estimated_wait_minutes: row.position * 10,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    status: row.status,
  };
}

/* ================= MARK IN PROGRESS ================= */
export async function markInProgress(appointmentId, io) {
  await sql`
    UPDATE appointments
    SET status = 'in_progress'
    WHERE id = ${appointmentId}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    message: "Consultation started",
  };
}

/* ================= MARK COMPLETED ================= */
export async function markCompleted(appointmentId, io) {
  await sql`
    UPDATE appointments
    SET status = 'visited'
    WHERE id = ${appointmentId}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    message: "Consultation completed",
  };
}

/* ================= SKIP PATIENT ================= */
export async function skipPatient(appointmentId, io) {
  await sql`
    UPDATE appointments
    SET status = 'skipped'
    WHERE id = ${appointmentId}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    message: "Patient skipped",
  };
}

/* ================= RESET QUEUE ================= */
export async function resetQueue(doctorId, date) {
  await sql`
    UPDATE appointments
    SET status = 'booked'
    WHERE doctor_id = ${doctorId}
      AND DATE(appointment_date) = ${date}
  `;

  return {
    success: true,
    message: "Queue reset successfully",
  };
}

// ===== Queue Service Helpers =====
export async function markArrived(appointmentId, io) {
  await sql`
    UPDATE appointments
    SET status = 'arrived'
    WHERE id = ${appointmentId}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    message: "Patient marked as arrived",
  };
}

export async function finishConsultation(appointmentId, followUpDate, io) {
  await sql`
    UPDATE appointments
    SET status = 'visited',
        follow_up_date = ${followUpDate || null}
    WHERE id = ${appointmentId}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    message: "Consultation finished",
  };
}

export async function scanQrAndMarkArrived(uniqueCode, io) {
  const patient = await sql`
    SELECT id FROM users
    WHERE unique_code = ${uniqueCode}
    LIMIT 1
  `;

  if (!patient.length) {
    throw new Error("Patient not found");
  }

  const appointment = await sql`
    SELECT id FROM appointments
    WHERE patient_id = ${patient[0].id}
    AND status = 'booked'
    ORDER BY appointment_date ASC
    LIMIT 1
  `;

  if (!appointment.length) {
    throw new Error("No active appointment found");
  }

  await sql`
    UPDATE appointments
    SET status = 'arrived'
    WHERE id = ${appointment[0].id}
  `;

  io.emit("queue_updated");

  return {
    success: true,
    appointment_id: appointment[0].id,
    message: "Patient scanned and marked arrived",
  };
}

/* ================= START CONSULTATION ================= */
router.post(
  "/start-consultation/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const io = req.app.get("io");

      await sql`
        UPDATE appointments
        SET status = 'in_progress'
        WHERE id = ${appointmentId}
      `;

      // optional socket update
      io.emit("queue_updated");

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

/* ================= MARK ARRIVED ================= */
router.post(
  "/arrived/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const io = req.app.get("io");

      const result = await markArrived(req.params.appointmentId, io);

      res.json(result);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },
);

/* ================= FINISH CONSULTATION ================= */
router.post(
  "/finish",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointment_id, follow_up_date } = req.body;

      if (!appointment_id) {
        return res.status(400).json({
          error: "appointment_id is required",
        });
      }

      const io = req.app.get("io");

      const result = await finishConsultation(
        appointment_id,
        follow_up_date,
        io,
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/* ================= SCAN QR AND MARK ARRIVED ================= */
router.post(
  "/scan",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const io = req.app.get("io");

      const { unique_code } = req.body;

      if (!unique_code) {
        return res.status(400).json({
          error: "unique_code is required",
        });
      }

      const result = await scanQrAndMarkArrived(unique_code, io);

      res.json(result);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },
);

/* ================= COMPLETE CONSULTATION ================= */
router.post(
  "/complete-consultation/:appointmentId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const io = req.app.get("io");

      await sql`
        UPDATE appointments
        SET status = 'completed'
        WHERE id = ${appointmentId}
      `;

      io.emit("queue_updated");

      res.json({
        success: true,
        message: "Consultation completed",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Failed to complete consultation",
      });
    }
  },
);

export default router;
