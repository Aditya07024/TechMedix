import sql from "../config/database.js";
import { logAudit } from "./auditService.js";

/**
 * Add appointment to queue when patient arrives
 * Creates queue tracking entry with token number
 */
export async function addToQueue(appointmentId, io) {
  // Get appointment details
  const appointment = await sql`
    SELECT 
      id, doctor_id, patient_id, appointment_date, status
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  if (!appointment || appointment.length === 0) {
    throw new Error("Appointment not found");
  }

  const { doctor_id, patient_id, appointment_date, status } = appointment[0];

  if (status === "cancelled") {
    throw new Error("Cannot add cancelled appointment to queue");
  }

  // Check if already in queue
  const existingQueue = await sql`
    SELECT id FROM queue_tracking
    WHERE appointment_id = ${appointmentId}
      AND status IN ('waiting', 'in_progress')
  `;

  if (existingQueue.length > 0) {
    throw new Error("Appointment already in queue");
  }

  // Get today's highest token number for this doctor
  const today = new Date().toISOString().split("T")[0];
  const lastToken = await sql`
    SELECT MAX(token_number) as max_token
    FROM queue_tracking
    WHERE doctor_id = ${doctor_id}
      AND DATE(created_at) = ${today}
  `;

  const tokenNumber = (lastToken[0]?.max_token || 0) + 1;

  // Get current queue position
  const queueLength = await sql`
    SELECT COUNT(*) as count
    FROM queue_tracking
    WHERE doctor_id = ${doctor_id}
      AND status IN ('waiting', 'in_progress')
  `;

  const position = queueLength[0]?.count || 0;

  // Calculate estimated wait time
  const schedule = await sql`
    SELECT consultation_duration_minutes
    FROM doctor_schedule
    WHERE doctor_id = ${doctor_id}
      AND day_of_week = ${new Date(appointment_date).getDay()}
    LIMIT 1
  `;

  const consultationDuration = schedule[0]?.consultation_duration_minutes || 30;
  const estimatedWait = position * consultationDuration;

  // Create queue tracking entry
  const queueEntry = await sql`
    INSERT INTO queue_tracking (
      doctor_id,
      appointment_id,
      token_number,
      status,
      position_in_queue,
      estimated_wait_minutes
    ) VALUES (
      ${doctor_id},
      ${appointmentId},
      ${tokenNumber},
      'waiting',
      ${position + 1},
      ${estimatedWait}
    )
    RETURNING *
  `;

  // Update appointment status
  await sql`
    UPDATE appointments
    SET status = 'arrived'
    WHERE id = ${appointmentId}
  `;

  // Log audit
  await logAudit({
    action: "patient_arrived",
    entity_type: "queue_tracking",
    entity_id: queueEntry[0].id,
  });

  // Emit real-time updates
  if (io) {
    // Notify doctor
    io.to(`doctor-${doctor_id}`).emit("queue-update", {
      token_number: tokenNumber,
      position: position + 1,
      total_waiting: queueLength[0]?.count + 1,
    });

    // Notify patient
    io.to(`patient-${patient_id}`).emit("queue-joined", {
      token_number: tokenNumber,
      position: position + 1,
      estimated_wait_minutes: estimatedWait,
    });
  }

  return {
    token_number: tokenNumber,
    position: position + 1,
    estimated_wait_minutes: estimatedWait,
    queue_id: queueEntry[0].id,
  };
}

/**
 * Get live queue for a doctor
 */
export async function getDoctorQueue(doctorId) {
  const queue = await sql`
    SELECT 
      qt.id,
      qt.token_number,
      qt.status,
      qt.position_in_queue,
      qt.estimated_wait_minutes,
      qt.created_at,
      a.patient_id,
      u.name as patient_name,
      u.phone as patient_phone
    FROM queue_tracking qt
    JOIN appointments a ON qt.appointment_id = a.id
    JOIN users u ON a.patient_id = u.id
    WHERE qt.doctor_id = ${doctorId}
      AND qt.status IN ('waiting', 'in_progress')
    ORDER BY qt.position_in_queue ASC
  `;

  return {
    doctor_id: doctorId,
    queue_size: queue.length,
    queue: queue,
  };
}

/**
 * Get patient's queue position
 */
export async function getPatientQueuePosition(appointmentId, patientId) {
  const queueEntry = await sql`
    SELECT 
      qt.id,
      qt.token_number,
      qt.position_in_queue,
      qt.estimated_wait_minutes,
      qt.status,
      qt.doctor_id,
      u.name as doctor_name
    FROM queue_tracking qt
    JOIN appointments a ON qt.appointment_id = a.id
    JOIN users u ON a.doctor_id = u.id
    WHERE qt.appointment_id = ${appointmentId}
      AND a.patient_id = ${patientId}
  `;

  if (!queueEntry || queueEntry.length === 0) {
    throw new Error("Patient not in queue");
  }

  const entry = queueEntry[0];

  // Calculate wait time from current position
  const ahead = await sql`
    SELECT COUNT(*) as count
    FROM queue_tracking
    WHERE doctor_id = ${entry.doctor_id}
      AND status = 'in_progress'
  `;

  const isBeingServed = ahead[0]?.count > 0;

  return {
    token_number: entry.token_number,
    position: entry.position_in_queue,
    estimated_wait_minutes: entry.estimated_wait_minutes,
    doctor_name: entry.doctor_name,
    is_being_served: isBeingServed,
    status: entry.status,
  };
}

/**
 * Mark patient as being served (in_progress)
 */
export async function markPatientInProgress(queueId, doctorId, io) {
  const queueEntry = await sql`
    UPDATE queue_tracking
    SET status = 'in_progress',
        actual_started_at = CURRENT_TIMESTAMP
    WHERE id = ${queueId}
      AND doctor_id = ${doctorId}
      AND status = 'waiting'
    RETURNING *
  `;

  if (!queueEntry || queueEntry.length === 0) {
    throw new Error("Invalid queue entry");
  }

  const entry = queueEntry[0];

  // Get appointment with patient info
  const apt = await sql`
    SELECT a.patient_id, u.name as patient_name
    FROM appointments a
    JOIN users u ON a.patient_id = u.id
    WHERE a.id = ${entry.appointment_id}
  `;

  if (apt && apt.length > 0) {
    if (io) {
      // Notify doctor
      io.to(`doctor-${doctorId}`).emit("patient-called", {
        token_number: entry.token_number,
        patient_name: apt[0].patient_name,
      });

      // Notify patient
      io.to(`patient-${apt[0].patient_id}`).emit("your-turn", {
        message: "Your turn to see the doctor",
      });
    }
  }

  await logAudit({
    action: "patient_in_progress",
    entity_type: "queue_tracking",
    entity_id: queueId,
  });

  return entry;
}

/**
 * Mark consultation as complete and advance queue
 */
export async function completeConsultation(queueId, doctorId, io) {
  const queueEntry = await sql`
    UPDATE queue_tracking
    SET status = 'completed',
        actual_completed_at = CURRENT_TIMESTAMP
    WHERE id = ${queueId}
      AND doctor_id = ${doctorId}
    RETURNING *
  `;

  if (!queueEntry || queueEntry.length === 0) {
    throw new Error("Invalid queue entry");
  }

  // Get next patient in queue
  const nextPatient = await sql`
    SELECT qt.id, qt.token_number, a.patient_id, u.name as patient_name
    FROM queue_tracking qt
    JOIN appointments a ON qt.appointment_id = a.id
    JOIN users u ON a.patient_id = u.id
    WHERE qt.doctor_id = ${doctorId}
      AND qt.status = 'waiting'
    ORDER BY qt.position_in_queue ASC
    LIMIT 1
  `;

  if (nextPatient && nextPatient.length > 0) {
    const next = nextPatient[0];

    if (io) {
      // Notify next patient
      io.to(`patient-${next.patient_id}`).emit("queue-position-updated", {
        new_position: 1,
        token_number: next.token_number,
      });

      // Notify doctor to call next
      io.to(`doctor-${doctorId}`).emit("next-patient", {
        token_number: next.token_number,
        patient_name: next.patient_name,
      });
    }
  }

  // Recalculate positions for remaining patients
  await recalculateQueuePositions(doctorId);

  await logAudit({
    action: "consultation_completed",
    entity_type: "queue_tracking",
    entity_id: queueId,
  });

  return queueEntry[0];
}

/**
 * Recalculate positions after patient completion
 */
export async function recalculateQueuePositions(doctorId) {
  const queue = await sql`
    SELECT id, position_in_queue
    FROM queue_tracking
    WHERE doctor_id = ${doctorId}
      AND status = 'waiting'
    ORDER BY created_at ASC
  `;

  for (let i = 0; i < queue.length; i++) {
    await sql`
      UPDATE queue_tracking
      SET position_in_queue = ${i + 1}
      WHERE id = ${queue[i].id}
    `;
  }
}

/**
 * Get queue statistics for a doctor
 */
export async function getQueueStats(doctorId) {
  const stats = await sql`
    SELECT 
      COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_count,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      AVG(
        CASE WHEN status = 'completed' AND actual_completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (actual_completed_at - actual_started_at)) / 60
        END
      ) as avg_consultation_minutes,
      MAX(estimated_wait_minutes) as max_wait_time
    FROM queue_tracking
    WHERE doctor_id = ${doctorId}
      AND DATE(created_at) = CURRENT_DATE
  `;

  return stats[0] || {};
}

/**
 * Get doctor delays
 */
export async function getDoctorDelay(doctorId) {
  const delay = await sql`
    SELECT *
    FROM doctor_delays
    WHERE doctor_id = ${doctorId}
      AND active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return delay.length > 0 ? delay[0] : null;
}

/**
 * Create doctor delay notification
 */
export async function setDoctorDelay(doctorId, delayMinutes, reason, io) {
  // Close any existing delays
  await sql`
    UPDATE doctor_delays
    SET active = false
    WHERE doctor_id = ${doctorId}
      AND active = true
  `;

  // Create new delay
  const delay = await sql`
    INSERT INTO doctor_delays (
      doctor_id,
      delay_minutes,
      reason,
      active
    ) VALUES (
      ${doctorId},
      ${delayMinutes},
      ${reason},
      true
    )
    RETURNING *
  `;

  // Get all patients in queue for this doctor
  const queuedPatients = await sql`
    SELECT DISTINCT a.patient_id
    FROM queue_tracking qt
    JOIN appointments a ON qt.appointment_id = a.id
    WHERE qt.doctor_id = ${doctorId}
      AND qt.status IN ('waiting', 'in_progress')
  `;

  // Notify all patients
  if (io) {
    queuedPatients.forEach((patient) => {
      io.to(`patient-${patient.patient_id}`).emit("doctor-delay", {
        delay_minutes: delayMinutes,
        reason: reason,
        message: `Doctor is running ${delayMinutes} minutes late. Reason: ${reason}`,
      });
    });
  }

  await logAudit({
    action: "doctor_delay_created",
    entity_type: "doctor_delays",
    entity_id: delay[0].id,
  });

  return delay[0];
}
