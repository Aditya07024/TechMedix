import cron from "node-cron";
import sql from "../config/database.js";

export function startNotificationScheduler(io) {

  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("Running smart notification scheduler...");

      // ================= 1 DAY REMINDER =================
      const oneDayAppointments = await sql`
        SELECT id, patient_id
        FROM appointments
        WHERE appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND reminder_1day_sent IS NOT TRUE
          AND status = 'booked'
          AND is_deleted = FALSE
      `;

      for (const appt of oneDayAppointments) {

        await sql`
          INSERT INTO patient_notifications (
            patient_id,
            prescription_id,
            title,
            message,
            severity
          )
          SELECT ${appt.patient_id}, NULL, 'Appointment Reminder',
                 'You have an appointment scheduled for tomorrow.',
                 'low'
          WHERE NOT EXISTS (
            SELECT 1 FROM patient_notifications
            WHERE patient_id = ${appt.patient_id}
              AND title = 'Appointment Reminder'
              AND message = 'You have an appointment scheduled for tomorrow.'
              AND created_at >= CURRENT_DATE
          )
        `;

        await sql`
          UPDATE appointments
          SET reminder_1day_sent = TRUE
          WHERE id = ${appt.id}
            AND is_deleted = FALSE
        `;

        if (io) {
          io.to(`patient-${appt.patient_id}`).emit("appointmentReminder", {
            appointment_id: appt.id,
            type: "1day"
          });
        }
      }

      // ================= 1 HOUR REMINDER =================
      const oneHourAppointments = await sql`
        SELECT id, patient_id
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
          AND reminder_1hour_sent IS NOT TRUE
          AND status = 'booked'
          AND is_deleted = FALSE
          AND (appointment_date + slot_time) <= NOW() + INTERVAL '1 hour'
          AND (appointment_date + slot_time) > NOW()
      `;

      for (const appt of oneHourAppointments) {

        await sql`
          INSERT INTO patient_notifications (
            patient_id,
            prescription_id,
            title,
            message,
            severity
          )
          SELECT ${appt.patient_id}, NULL, 'Appointment Reminder',
                 'Your appointment is within the next hour.',
                 'medium'
          WHERE NOT EXISTS (
            SELECT 1 FROM patient_notifications
            WHERE patient_id = ${appt.patient_id}
              AND title = 'Appointment Reminder'
              AND message = 'Your appointment is within the next hour.'
              AND created_at >= CURRENT_DATE
          )
        `;

        await sql`
          UPDATE appointments
          SET reminder_1hour_sent = TRUE
          WHERE id = ${appt.id}
            AND is_deleted = FALSE
        `;

        if (io) {
          io.to(`patient-${appt.patient_id}`).emit("appointmentReminder", {
            appointment_id: appt.id,
            type: "1hour"
          });
        }
      }
// Follow-up reminders (1 day before)
const followUps = await sql`
  SELECT id, patient_id, follow_up_date
  FROM appointments
  WHERE follow_up_date = CURRENT_DATE + INTERVAL '1 day'
    AND follow_up_reminder_sent IS NOT TRUE
    AND is_deleted = FALSE
`;

for (const appt of followUps) {

  await sql`
    INSERT INTO patient_notifications (
      patient_id,
      title,
      message,
      severity
    )
    SELECT ${appt.patient_id},
           'Follow-up Reminder',
           'You have a follow-up appointment tomorrow.',
           'info'
    WHERE NOT EXISTS (
      SELECT 1 FROM patient_notifications
      WHERE patient_id = ${appt.patient_id}
        AND title = 'Follow-up Reminder'
        AND created_at >= CURRENT_DATE
    )
  `;

  if (io) {
    io.to(`patient-${appt.patient_id}`).emit("followUpReminder", {
      appointment_id: appt.id
    });
  }

  await sql`
    UPDATE appointments
    SET follow_up_reminder_sent = TRUE
    WHERE id = ${appt.id}
      AND is_deleted = FALSE
  `;
}
      // ================= REFILL REMINDER =================
      const refillPrescriptions = await sql`
  SELECT id, patient_id
FROM prescriptions
WHERE patient_id IS NOT NULL
AND COALESCE(is_deleted, false) = false
AND created_at <= NOW() - INTERVAL '28 days'
    AND processed_at IS NOT NULL
    AND patient_id IS NOT NULL
    AND COALESCE(is_deleted, false) = false
`;

      for (const pres of refillPrescriptions) {

        await sql`
          INSERT INTO patient_notifications (
            patient_id,
            prescription_id,
            title,
            message,
            severity
          )
          SELECT ${pres.patient_id},
                 ${pres.id},
                 'Refill Reminder',
                 'It may be time to refill your prescription.',
                 'medium'
          WHERE NOT EXISTS (
            SELECT 1 FROM patient_notifications
            WHERE prescription_id = ${pres.id}
              AND title = 'Refill Reminder'
          )
        `;

        

        if (io) {
          io.to(`patient-${pres.patient_id}`).emit("refillReminder", {
            prescription_id: pres.id
          });
        }
      }

    } catch (error) {
      console.error("Notification scheduler error:", error);
    }
  });
}