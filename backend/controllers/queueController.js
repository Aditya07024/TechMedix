import sql from "../config/database.js";
import {
  markArrived,
  markInProgress,
  markCompleted,
  getQueueForDoctor,
  getQueuePosition,
  skipPatient,
  resetQueue,
} from "../services/queueService.js";
import { logAudit } from "../services/auditService.js";

async function getAppointmentAccessRow(appointmentId) {
  const rows = await sql`
    SELECT id, patient_id, doctor_id
    FROM appointments
    WHERE id = ${appointmentId}
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
  `;

  return rows[0] || null;
}

async function ensureAppointmentAccess(req, appointmentId, allowedRoles = []) {
  const appointment = await getAppointmentAccessRow(appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (req.user?.role === "admin") {
    return appointment;
  }

  if (
    allowedRoles.includes("patient") &&
    req.user?.role === "patient" &&
    String(req.user.id) === String(appointment.patient_id)
  ) {
    return appointment;
  }

  if (
    allowedRoles.includes("doctor") &&
    req.user?.role === "doctor" &&
    String(req.user.id) === String(appointment.doctor_id)
  ) {
    return appointment;
  }

  throw new Error("Unauthorized");
}

export async function markPatientArrived(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");
    await ensureAppointmentAccess(req, appointment_id, ["patient", "doctor"]);

    const result = await markArrived(appointment_id, io);

    await logAudit({
      user_id: req.user?.id,
      action: "patient_marked_arrived",
      entity_id: appointment_id,
      entity_type: "appointment",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function markPatientInProgress(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");
    await ensureAppointmentAccess(req, appointment_id, ["doctor"]);

    const result = await markInProgress(appointment_id, io, req.user?.id);

    await logAudit({
      user_id: req.user?.id,
      action: "consultation_started",
      entity_id: appointment_id,
      entity_type: "appointment",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function markPatientCompleted(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");
    await ensureAppointmentAccess(req, appointment_id, ["doctor"]);

    const result = await markCompleted(appointment_id, io, req.user?.id);

    await logAudit({
      user_id: req.user?.id,
      action: "consultation_completed",
      entity_id: appointment_id,
      entity_type: "appointment",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getQueue(req, res) {
  try {
    const { doctor_id } = req.params;
    const { date } = req.query;

    if (req.user?.id !== doctor_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const queue = await getQueueForDoctor(doctor_id, date);
    res.json({
      success: true,
      data: {
        doctor_id,
        queue_date: date || new Date().toISOString().split("T")[0],
        queue_size: queue.filter((entry) => entry.raw_status !== "completed").length,
        queue,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getQueuePos(req, res) {
  try {
    const { appointment_id } = req.params;

    const position = await getQueuePosition(
      appointment_id,
      req.user?.role === "patient" ? req.user.id : null,
    );
    res.json({ success: true, data: position });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function skipPatientInQueue(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");
    await ensureAppointmentAccess(req, appointment_id, ["doctor"]);

    const result = await skipPatient(appointment_id, io, req.user?.id);

    await logAudit({
      user_id: req.user?.id,
      action: "patient_skipped",
      entity_id: appointment_id,
      entity_type: "appointment",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function resetQueueForDoctor(req, res) {
  try {
    const { doctor_id } = req.params;
    const { date } = req.body;
    const io = req.app.get("io");

    if (req.user?.id !== doctor_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const result = await resetQueue(doctor_id, date, io);

    await logAudit({
      user_id: req.user?.id,
      action: "queue_reset",
      entity_id: doctor_id,
      entity_type: "doctor",
      details: { date },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
