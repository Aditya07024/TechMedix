import sql from "../config/database.js";

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
    const doctorMessage = `Reminder: ${appointment.patient_name} has appointment tomorrow at ${appointment.slot_time}`;
    const patientMessage = `Reminder: You have appointment with Dr. ${appointment.doctor_name} tomorrow at ${appointment.slot_time}`;

    // ✅ Save Doctor Notification (safe insert)
    await sql`
      INSERT INTO notifications (user_type, user_id, message, is_read, created_at)
      SELECT 'doctor', ${appointment.doctor_id}, ${doctorMessage}, false, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_type = 'doctor'
          AND user_id = ${appointment.doctor_id}
          AND message = ${doctorMessage}
          AND created_at >= CURRENT_DATE
      )
    `;

    // ✅ Save Patient Notification (safe insert)
    await sql`
      INSERT INTO notifications (user_type, user_id, message, is_read, created_at)
      SELECT 'patient', ${appointment.patient_id}, ${patientMessage}, false, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_type = 'patient'
          AND user_id = ${appointment.patient_id}
          AND message = ${patientMessage}
          AND created_at >= CURRENT_DATE
      )
    `;

    // 🔔 Emit to Doctor Room
    if (io) {
      io.to(`doctor-${appointment.doctor_id}`).emit("appointmentReminder", {
        type: "doctor",
        message: doctorMessage,
      });
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
  const updated = await sql`
    UPDATE notifications
    SET is_read = true
    WHERE id = ${notificationId}
    RETURNING *
  `;

  if (updated.length === 0) {
    throw new Error("Notification not found");
  }

  return updated[0];
}

// Get unread count
export async function getUnreadCount(userType, userId) {
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
  let query = sql`
    SELECT id, message, is_read, created_at, type
    FROM notifications
    WHERE user_id = ${userId}
  `;

  if (is_read !== null) {
    query += sql` AND is_read = ${is_read === "true" || is_read === true}`;
  }

  query += sql` ORDER BY created_at DESC LIMIT ${limit}`;

  const notifications = await sql`
    SELECT id, message, is_read, created_at, type
    FROM notifications
    WHERE user_id = ${userId}
    ${is_read !== null ? sql`AND is_read = ${is_read === "true" || is_read === true}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return notifications;
}

// Mark notification as read (alias)
export async function markAsRead(notificationId) {
  return await markNotificationAsRead(notificationId);
}

// Mark all notifications as read
export async function markAllAsRead(userId) {
  const updated = await sql`
    UPDATE notifications
    SET is_read = true
    WHERE user_id = ${userId}
      AND is_read = false
    RETURNING *
  `;

  return {
    success: true,
    count: updated.length,
    notifications: updated,
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
