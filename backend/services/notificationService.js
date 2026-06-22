import sql from "../config/database.js";
import { emitUserNotification } from "../socket/socketServer.js";

export async function sendAppointmentReminders(io) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateString = tomorrow.toISOString().split("T")[0];

  const appointments = await sql`
    SELECT a.id, a.patient_id, a.doctor_id,
           p.name as patient_name,
           d.name as doctor_name,
           a.slot_time
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.appointment_date = ${dateString}
      AND a.status = 'booked'
  `;

  for (const appointment of appointments) {
    const patientMessage = `Reminder: You have appointment with Dr. ${appointment.doctor_name} tomorrow at ${appointment.slot_time}`;

    // Store UUID-safe patient reminder in patient_notifications.
    const patientNotification = await sql`
      INSERT INTO patient_notifications (
        patient_id,
        prescription_id,
        title,
        message,
        severity
      )
      SELECT
        ${appointment.patient_id},
        NULL,
        'Appointment Reminder',
        ${patientMessage},
        'low'
      WHERE NOT EXISTS (
        SELECT 1
        FROM patient_notifications
        WHERE patient_id = ${appointment.patient_id}
          AND title = 'Appointment Reminder'
          AND message = ${patientMessage}
          AND created_at >= CURRENT_DATE
      )
      RETURNING
        id,
        title,
        message,
        is_read,
        created_at
    `;
    if (patientNotification[0]) {
      emitUserNotification(appointment.patient_id, patientNotification[0]);
    }

    // 🔔 Emit to Patient Room
    if (io) {
      io.to(`patient-${appointment.patient_id}`).emit("appointmentReminder", {
        type: "patient",
        message: patientMessage,
      });
    }

    console.log(
      `🔔 Reminder stored and sent for appointment ${appointment.id}`,
    );
  }
}

// Fetch notifications for a user
export async function getUserNotifications(userType, userId) {
  if (userType === "patient") {
    const notifications = await sql`
      SELECT id, title, message, is_read, created_at
      FROM patient_notifications
      WHERE patient_id = ${userId}
      ORDER BY created_at DESC
    `;

    return notifications;
  }

  const notifications = await sql`
    SELECT id, message, is_read, created_at
    FROM notifications
    WHERE user_type = ${userType}
      AND user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return notifications;
}

// Mark notification as read
export async function markNotificationAsRead(notificationId) {
  // Try patient_notifications first (UUID ids from patients)
  const patientUpdated = await sql`
    UPDATE patient_notifications
    SET is_read = true
    WHERE id = ${notificationId}
    RETURNING *
  `.catch(() => []);

  if (patientUpdated.length > 0) return patientUpdated[0];

  // Fall back to legacy notifications table (integer ids)
  const updated = await sql`
    UPDATE notifications
    SET is_read = true
    WHERE id = ${notificationId}
    RETURNING *
  `.catch(() => []);

  if (updated.length === 0) {
    throw new Error("Notification not found");
  }

  return updated[0];
}

// Get unread count
export async function getUnreadCount(userType, userId) {
  if (userType === "patient") {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM patient_notifications
      WHERE patient_id = ${userId}
        AND is_read = false
    `;

    return Number(result[0].count);
  }

  const result = await sql`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_type = ${userType}
      AND user_id = ${userId}
      AND is_read = false
  `;

  return Number(result[0].count);
}

// Get notifications by user (alias for getUserNotifications)
export async function getNotificationsByUser(
  userId,
  is_read = null,
  limit = 50,
) {
  // patient_notifications uses a UUID patient_id; the legacy notifications
  // table uses an integer user_id. Query both and merge.
  const patientRows = await sql`
    SELECT
      id::text,
      COALESCE(title, 'Notification') AS message,
      is_read,
      created_at,
      'patient' AS type
    FROM patient_notifications
    WHERE patient_id = ${userId}
    ${is_read !== null ? sql`AND is_read = ${is_read === "true" || is_read === true}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `.catch(() => []);

  // Only query legacy table when userId looks like an integer
  const isNumericId = /^\d+$/.test(String(userId));
  const legacyRows = isNumericId
    ? await sql`
        SELECT
          id::text,
          message,
          is_read,
          created_at,
          NULL::text AS type
        FROM notifications
        WHERE user_id = ${userId}
        ${is_read !== null ? sql`AND is_read = ${is_read === "true" || is_read === true}` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `.catch(() => [])
    : [];

  const merged = [...patientRows, ...legacyRows].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  return merged.slice(0, Number(limit));
}


// Mark notification as read (alias)
export async function markAsRead(notificationId) {
  return await markNotificationAsRead(notificationId);
}

// Mark all notifications as read
export async function markAllAsRead(userId) {
  const isNumericId = /^\d+$/.test(String(userId));

  // Always update patient_notifications (UUID patient_id)
  const patientUpdated = await sql`
    UPDATE patient_notifications
    SET is_read = true
    WHERE patient_id = ${userId}
      AND is_read = false
    RETURNING *
  `.catch(() => []);

  // Also update legacy table for numeric user ids
  const legacyUpdated = isNumericId
    ? await sql`
        UPDATE notifications
        SET is_read = true
        WHERE user_id = ${userId}
          AND is_read = false
        RETURNING *
      `.catch(() => [])
    : [];

  const allUpdated = [...patientUpdated, ...legacyUpdated];

  return {
    success: true,
    count: allUpdated.length,
    notifications: allUpdated,
  };
}

// Delete notification
export async function deleteNotification(notificationId) {
  const deleted = await sql`
    DELETE FROM notifications
    WHERE id = ${notificationId}
    RETURNING *
  `;

  if (deleted.length === 0) {
    throw new Error("Notification not found");
  }

  return {
    success: true,
    message: "Notification deleted",
    notification: deleted[0],
  };
}
