import {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAppointmentById,
  getDoctorAppointments,
  getPatientAppointments,
  updateAppointmentStatus,
} from "../services/appointmentService.js";
import { logAudit } from "../services/auditService.js";

export async function createAppointment(req, res) {
  try {
    const {
      patient_id,
      doctor_id,
      appointment_date,
      slot_time,
      share_history,
      recording_consent_patient,
    } = req.body;

    const appointment = await bookAppointment({
      patient_id,
      doctor_id,
      appointment_date,
      slot_time,
      share_history,
      recording_consent_patient,
    });

    await logAudit({
      user_id: patient_id,
      action: "appointment_booked",
      entity_id: appointment.id,
      entity_type: "appointment",
      details: { doctor_id, appointment_date, slot_time },
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function cancelAppointmentHandler(req, res) {
  try {
    const { appointment_id } = req.params;
    const { cancel_reason } = req.body;

    const result = await cancelAppointment(appointment_id, req.user?.id, cancel_reason);

    await logAudit({
      user_id: req.user?.id,
      action: "appointment_cancelled",
      entity_id: appointment_id,
      entity_type: "appointment",
      details: { cancel_reason },
    });

    // Wallet credit on paid online cancellation
    try {
      const sql = (await import("../config/database.js")).default;
      const appt = await sql`SELECT patient_id FROM appointments WHERE id = ${appointment_id}`;
      const pay = await sql`
        SELECT id, amount, payment_method, status
        FROM payments
        WHERE appointment_id = ${appointment_id}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (appt.length && pay.length && pay[0].status === 'paid' && pay[0].payment_method === 'online') {
        const dup = await sql`
          SELECT id FROM wallet_transactions
          WHERE patient_id = ${appt[0].patient_id}
            AND type = 'credit'
            AND source = 'appointment_cancel'
            AND reference_id = ${appointment_id}
          LIMIT 1
        `;
        if (!dup.length) {
          const { creditWallet } = await import("../services/walletService.js");
          await creditWallet({
            patientId: appt[0].patient_id,
            amount: pay[0].amount,
            source: 'appointment_cancel',
            referenceId: appointment_id,
            note: 'Refunded as wallet credit for cancelled appointment',
          });
        }
      }
    } catch (e) {
      console.warn('Wallet credit on cancel failed (v2):', e.message);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function rescheduleAppointmentHandler(req, res) {
  try {
    const { appointment_id } = req.params;
    const { new_date, new_slot_time } = req.body;

    const result = await rescheduleAppointment(
      appointment_id,
      new_date,
      new_slot_time,
    );

    await logAudit({
      user_id: req.user?.id,
      action: "appointment_rescheduled",
      entity_id: appointment_id,
      entity_type: "appointment",
      details: { new_date, new_slot_time },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getAppointment(req, res) {
  try {
    const { appointment_id } = req.params;
    const appointment = await getAppointmentById(appointment_id);
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
}

export async function getDoctorAppts(req, res) {
  try {
    const { doctor_id } = req.params;
    const { date } = req.query;

    if (req.user?.id !== doctor_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const appointments = await getDoctorAppointments(doctor_id, date);
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getPatientAppts(req, res) {
  try {
    const { patient_id } = req.params;

    if (req.user?.id !== patient_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const appointments = await getPatientAppointments(patient_id);
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function updateApptStatus(req, res) {
  try {
    const { appointment_id } = req.params;
    const { status } = req.body;

    // only doctors or admins can change status
    if (req.user?.role !== "doctor" && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // ensure doctor owns the appointment when role is doctor
    if (req.user.role === "doctor") {
      const appt = await getAppointmentById(appointment_id);
      if (String(appt.doctor_id) !== String(req.user.id)) {
        return res.status(403).json({ success: false, error: "You can only modify your own appointments" });
      }
    }

    const result = await updateAppointmentStatus(appointment_id, status);

    await logAudit({
      user_id: req.user?.id,
      action: "appointment_status_updated",
      entity_id: appointment_id,
      entity_type: "appointment",
      details: { status },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
