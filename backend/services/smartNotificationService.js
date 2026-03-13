import sql from "../config/database.js";

/**
 * Create notification for user
 */
export async function createNotification(
  userId,
  type,
  title,
  message,
  relatedEntityId = null,
  relatedEntityType = null,
  actionUrl = null,
  expiresAt = null,
) {
  const notification = await sql`
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_entity_id,
      related_entity_type,
      action_url,
      expires_at,
      is_read
    ) VALUES (
      ${userId},
      ${type},
      ${title},
      ${message},
      ${relatedEntityId},
      ${relatedEntityType},
      ${actionUrl},
      ${expiresAt},
      false
    )
    RETURNING *
  `;

  return notification[0];
}

/**
 * Send appointment reminders
 * Called 1 hour before appointment (via cron)
 */
export async function sendAppointmentReminders() {
  const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Get appointments in next 1 hour
  const appointments = await sql`
    SELECT 
      a.id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date,
      a.appointment_time,
      d.name as doctor_name,
      p.name as patient_name,
      p.email as patient_email
    FROM appointments a
    JOIN users d ON a.doctor_id = d.id
    JOIN users p ON a.patient_id = p.id
    WHERE a.appointment_date = CURRENT_DATE
      AND a.appointment_time BETWEEN DATE_TRUNC('minute', CURRENT_TIMESTAMP + INTERVAL '1 hour')::time 
                                 AND DATE_TRUNC('minute', CURRENT_TIMESTAMP + INTERVAL '2 hours')::time
      AND a.status = 'booked'
  `;

  const notifications = [];

  for (const apt of appointments) {
    // Notify patient
    const patientNotif = await createNotification(
      apt.patient_id,
      "appointment_reminder",
      "Appointment Reminder",
      `Your appointment with ${apt.doctor_name} is in 1 hour at ${apt.appointment_time}`,
      apt.id,
      "appointment",
      `/patient/appointment/${apt.id}`,
    );

    notifications.push(patientNotif);

    // Notify doctor
    const doctorNotif = await createNotification(
      apt.doctor_id,
      "appointment_reminder",
      "Upcoming Appointment",
      `${apt.patient_name} appointment in 1 hour at ${apt.appointment_time}`,
      apt.id,
      "appointment",
      `/doctor/queue`,
    );

    notifications.push(doctorNotif);
  }

  return {
    total_reminders_sent: notifications.length,
    appointments: appointments.length,
  };
}

/**
 * Send prescription refill reminders
 * Called for patients with expiring prescriptions
 */
export async function sendPrescriptionRefillReminders() {
  // Get prescriptions expiring in 3 days
  const expiringPrescriptions = await sql`
    SELECT 
      p.id,
      p.patient_id,
      p.medicine_name,
      p.expires_at,
      u.name as patient_name,
      u.email as patient_email
    FROM prescriptions p
    JOIN users u ON p.patient_id = u.id
    WHERE p.expires_at < NOW() + INTERVAL '3 days'
      AND p.expires_at > NOW()
      AND p.is_completed = false
      AND p.refill_count < p.max_refills
  `;

  const notifications = [];

  for (const prescription of expiringPrescriptions) {
    const notif = await createNotification(
      prescription.patient_id,
      "refill_reminder",
      "Prescription Expiring Soon",
      `Your prescription for ${prescription.medicine_name} expires on ${prescription.expires_at.toDateString()}. Request a refill now.`,
      prescription.id,
      "prescription",
      `/patient/prescription/${prescription.id}`,
    );

    notifications.push(notif);
  }

  return {
    total_refill_reminders_sent: notifications.length,
    prescriptions: expiringPrescriptions.length,
  };
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId,
  limit = 20,
  unreadOnly = false,
) {
  let query = `
    SELECT *
    FROM notifications
    WHERE user_id = $1
  `;

  const params = [userId];

  if (unreadOnly) {
    query += ` AND is_read = false`;
  }

  query += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const notifications = await sql(query, params);

  const unreadCount = await sql`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ${userId}
      AND is_read = false
  `;

  return {
    user_id: userId,
    total: notifications.length,
    unread_count: unreadCount[0]?.count || 0,
    notifications,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId, userId) {
  const updated = await sql`
    UPDATE notifications
    SET is_read = true,
        read_at = CURRENT_TIMESTAMP
    WHERE id = ${notificationId}
      AND user_id = ${userId}
    RETURNING *
  `;

  if (!updated || updated.length === 0) {
    throw new Error("Notification not found");
  }

  return updated[0];
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId) {
  const updated = await sql`
    UPDATE notifications
    SET is_read = true,
        read_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND is_read = false
    RETURNING *
  `;

  return {
    user_id: userId,
    marked_as_read: updated.length,
  };
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId, userId) {
  const deleted = await sql`
    DELETE FROM notifications
    WHERE id = ${notificationId}
      AND user_id = ${userId}
    RETURNING id
  `;

  if (!deleted || deleted.length === 0) {
    throw new Error("Notification not found");
  }

  return { deleted: true };
}

/**
 * Clean up expired notifications
 * Called periodically via cron
 */
export async function cleanupExpiredNotifications() {
  const deleted = await sql`
    DELETE FROM notifications
    WHERE expires_at < CURRENT_TIMESTAMP
      AND expires_at IS NOT NULL
    RETURNING id
  `;

  return {
    total_deleted: deleted.length,
  };
}

/**
 * Send queue update notifications
 */
export async function sendQueueUpdateNotifications(
  appointmentId,
  position,
  waitMinutes,
) {
  const apt = await sql`
    SELECT patient_id
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  if (!apt || apt.length === 0) {
    throw new Error("Appointment not found");
  }

  return await createNotification(
    apt[0].patient_id,
    "queue_update",
    "Queue Position Updated",
    `You are #${position} in queue. Estimated wait: ${waitMinutes} minutes`,
    appointmentId,
    "queue",
    `/patient/queue/${appointmentId}`,
  );
}

/**
 * Send doctor delay notification
 */
export async function sendDoctorDelayNotifications(
  doctorId,
  delayMinutes,
  reason,
) {
  // Get all patients in queue for this doctor
  const patients = await sql`
    SELECT DISTINCT a.patient_id
    FROM queue_tracking qt
    JOIN appointments a ON qt.appointment_id = a.id
    WHERE qt.doctor_id = ${doctorId}
      AND qt.status IN ('waiting', 'in_progress')
  `;

  const notifications = [];

  for (const patient of patients) {
    const notif = await createNotification(
      patient.patient_id,
      "doctor_delay",
      "Doctor Running Late",
      `Doctor is running ${delayMinutes} minutes late. Reason: ${reason}`,
      null,
      null,
      `/patient/queue`,
    );

    notifications.push(notif);
  }

  return {
    total_notifications_sent: notifications.length,
    patients_notified: patients.length,
  };
}

/**
 * Send prescription uploaded notification
 */
export async function sendPrescriptionNotifications(
  prescriptionId,
  patientId,
  doctorId,
  doctorName,
) {
  // Notify patient
  const patientNotif = await createNotification(
    patientId,
    "prescription_uploaded",
    "New Prescription",
    `${doctorName} has uploaded a new prescription for you`,
    prescriptionId,
    "prescription",
    `/patient/prescription/${prescriptionId}`,
  );

  // Notify doctor (optional - for confirmation)
  const doctorNotif = await createNotification(
    doctorId,
    "prescription_uploaded",
    "Prescription Created",
    `You have created a new prescription`,
    prescriptionId,
    "prescription",
    `/doctor/prescription/${prescriptionId}`,
  );

  return {
    patient_notification: patientNotif,
    doctor_notification: doctorNotif,
  };
}

/**
 * Get notification statistics for user
 */
export async function getUserNotificationStats(userId) {
  const stats = await sql`
    SELECT 
      COUNT(*) as total_notifications,
      COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
      COUNT(DISTINCT type) as notification_types,
      MAX(created_at) as last_notification
    FROM notifications
    WHERE user_id = ${userId}
  `;

  const byType = await sql`
    SELECT type, COUNT(*) as count
    FROM notifications
    WHERE user_id = ${userId}
    GROUP BY type
  `;

  return {
    user_id: userId,
    total_notifications: stats[0]?.total_notifications || 0,
    unread_count: stats[0]?.unread_count || 0,
    last_notification: stats[0]?.last_notification,
    by_type: byType,
  };
}
