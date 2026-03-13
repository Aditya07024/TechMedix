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

export async function markPatientArrived(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");

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

    const result = await markInProgress(appointment_id, io);

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

    const result = await markCompleted(appointment_id, io);

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
    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getQueuePos(req, res) {
  try {
    const { appointment_id } = req.params;

    const position = await getQueuePosition(appointment_id);
    res.json({ success: true, data: position });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function skipPatientInQueue(req, res) {
  try {
    const { appointment_id } = req.params;
    const io = req.app.get("io");

    const result = await skipPatient(appointment_id, io);

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

    if (req.user?.id !== doctor_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const result = await resetQueue(doctor_id, date);

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
