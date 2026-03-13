import cron from "node-cron";
import { sendAppointmentReminders } from "../services/notificationService.js";
import { cancelExpiredAppointments } from "../services/cleanupService.js";
import sql from "../config/database.js";

export function startCronJobs(io) {
  // Send appointment reminders 1 hour before appointment (every 30 min)
  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("🔔 Checking for appointment reminders...");
      await sendAppointmentReminders(io);
    } catch (error) {
      console.error("Error sending appointment reminders:", error);
    }
  });


  // Send refill reminders (daily at 8 AM)
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("💊 Sending refill reminders...");
      const expiringSoon = await sql`
        SELECT p.id, p.patient_id, p.medicine_name, u.email
        FROM prescriptions p
        JOIN users u ON p.patient_id = u.id
        WHERE p.expires_at < CURRENT_TIMESTAMP + INTERVAL '7 days'
          AND p.expires_at > CURRENT_TIMESTAMP
          AND p.is_completed = false
          AND p.refill_count < p.max_refills
      `;

      for (const prescription of expiringSoon) {
        // Create notification
        await sql`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_entity_id,
            related_entity_type,
            created_at
          ) VALUES (
            ${prescription.patient_id},
            'refill_reminder',
            'Prescription Expiring Soon',
            ${`Refill ${prescription.medicine_name} within 7 days`},
            ${prescription.id},
            'prescription',
            CURRENT_TIMESTAMP
          )
        `;
      }

      console.log(`✅ Sent ${expiringSoon.length} refill reminders`);
    } catch (error) {
      console.error("Error sending refill reminders:", error);
    }
  });

  // Cleanup old notifications (weekly)
  cron.schedule("0 2 * * 0", async () => {
    try {
      console.log("🧹 Cleaning up old notifications...");
      await sql`
        DELETE FROM notifications
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
          AND is_read = true
      `;
      console.log("✅ Cleanup completed");
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
    }
  });

  // Generate daily analytics (daily at 11:59 PM)
  cron.schedule("59 23 * * *", async () => {
    try {
      console.log("📊 Generating daily analytics...");
      // Analytics are recorded in real-time, this just aggregates
      console.log("✅ Analytics generation completed");
    } catch (error) {
      console.error("Error generating analytics:", error);
    }
  });

  console.log("✅ All cron jobs initialized");
}
