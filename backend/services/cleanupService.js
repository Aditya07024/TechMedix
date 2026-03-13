import sql from "../config/database.js";
import { logAudit } from "./auditService.js";

export async function cancelExpiredAppointments() {

  const expired = await sql`
    SELECT id FROM appointments
    WHERE status = 'pending_payment'
    AND created_at < NOW() - INTERVAL '15 minutes'
  `;

  for (const appt of expired) {
    await sql`
      UPDATE appointments
      SET status = 'cancelled',
          cancellation_reason = 'Payment timeout (auto-cancelled)',
          cancelled_by = 'system',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${appt.id}
      AND is_deleted = FALSE
    `;

    await sql`
      UPDATE payments
      SET status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE appointment_id = ${appt.id}
      AND status = 'pending'
    `;

    await logAudit({
      actorId: null,
      actorRole: 'system',
      action: 'appointment_auto_cancelled',
      table_name: 'appointments',
      record_id: appt.id,
      metadata: { reason: 'Payment timeout (15 min rule)' }
    });
  }

  if (expired.length > 0) {
    console.log(`Cancelled ${expired.length} expired appointments`);
  }
}