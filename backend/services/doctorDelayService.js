import sql from "../config/database.js";
import { logAudit } from "./auditService.js";

export async function broadcastDoctorDelay(doctorId, delayMinutes, io) {
  try {
    const appointments = await sql`
      SELECT id, patient_id, estimated_time
      FROM appointments
      WHERE doctor_id = ${doctorId}
        AND appointment_date = CURRENT_DATE
        AND status IN ('booked','arrived')
        AND estimated_time IS NOT NULL
        AND COALESCE(is_deleted, false) = false
    `;

    for (const appt of appointments) {

      await sql`
        UPDATE appointments
        SET estimated_time = estimated_time + (${delayMinutes} || ' minutes')::interval,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${appt.id}
          AND COALESCE(is_deleted, false) = false
      `;

      if (io) {
        io.to(`patient-${appt.patient_id}`).emit("queueDelayUpdate", {
          appointment_id: appt.id,
          delay_minutes: delayMinutes
        });
      }
    }

    await logAudit({
      actorId: doctorId,
      actorRole: 'doctor',
      action: 'doctor_delay_broadcast',
      table_name: 'appointments',
      record_id: null,
      metadata: { delayMinutes }
    });

    if (io) {
      io.to(`doctor-${doctorId}`).emit("doctorDelay", {
        doctor_id: doctorId,
        delay_minutes: delayMinutes
      });
    }

    return { success: true };

  } catch (error) {
    console.error("Doctor delay broadcast error:", error);
    throw error;
  }
}