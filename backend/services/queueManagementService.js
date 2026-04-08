import sql from "../config/database.js";
import { logAudit } from "./auditService.js";

function getIsoDate(value = new Date()) {
  return new Date(value).toISOString().split("T")[0];
}

function getQueueStatuses() {
  return ["arrived", "in_progress"];
}

async function getScheduleDuration(doctorId, appointmentDate) {
  const dayOfWeek = new Date(appointmentDate).getDay();

  const schedule = await sql`
    SELECT consultation_duration_minutes, consultation_duration
    FROM doctor_schedule
    WHERE doctor_id = ${doctorId}
      AND day_of_week = ${dayOfWeek}
      AND COALESCE(is_active, true) = true
    LIMIT 1
  `;

  return (
    Number(
      schedule[0]?.consultation_duration_minutes ||
        schedule[0]?.consultation_duration,
    ) || 30
  );
}

async function getQueueRowsForDoctor(doctorId, appointmentDate) {
  return await sql`
    SELECT
      a.id,
      a.id AS appointment_id,
      a.patient_id,
      a.status,
      a.appointment_date,
      a.slot_time,
      COALESCE(p.name, u.full_name, 'Patient') AS patient_name,
      COALESCE(p.phone, u.phone) AS patient_phone
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN users u ON a.patient_id = u.id
    WHERE a.doctor_id = ${doctorId}
      AND a.appointment_date = ${appointmentDate}
      AND a.status IN ('arrived', 'in_progress')
      AND COALESCE(a.is_deleted, false) = false
    ORDER BY
      CASE WHEN a.status = 'in_progress' THEN 0 ELSE 1 END,
      a.created_at ASC,
      a.slot_time ASC NULLS LAST
  `;
}

/**
 * Add appointment to queue when patient arrives
 */
export async function addToQueue(appointmentId, io) {
  const appointment = await sql`
    SELECT id, doctor_id, patient_id, appointment_date, status
    FROM appointments
    WHERE id = ${appointmentId}
      AND COALESCE(is_deleted, false) = false
  `;

  if (!appointment.length) {
    throw new Error("Appointment not found");
  }

  const { doctor_id, patient_id, appointment_date, status } = appointment[0];

  if (status === "cancelled") {
    throw new Error("Cannot add cancelled appointment to queue");
  }

  if (getQueueStatuses().includes(status)) {
    throw new Error("Appointment already in queue");
  }

  const existingRows = await getQueueRowsForDoctor(doctor_id, appointment_date);
  const position = existingRows.length + 1;
  const consultationDuration = await getScheduleDuration(
    doctor_id,
    appointment_date,
  );
  const estimatedWait = existingRows.length * consultationDuration;

  await sql`
    UPDATE appointments
    SET status = 'arrived',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
  `;

  await logAudit({
    action: "patient_arrived",
    entity_type: "appointment",
    entity_id: appointmentId,
  });

  if (io) {
    io.to(`doctor-${doctor_id}`).emit("queue-update", {
      appointment_id: appointmentId,
      position,
      total_waiting: position,
    });

    io.to(`patient-${patient_id}`).emit("queue-joined", {
      appointment_id: appointmentId,
      position,
      estimated_wait_minutes: estimatedWait,
    });
  }

  return {
    token_number: position,
    position,
    estimated_wait_minutes: estimatedWait,
    queue_id: appointmentId,
  };
}

/**
 * Get live queue for a doctor
 */
export async function getDoctorQueue(doctorId) {
  const today = getIsoDate();
  const queue = await getQueueRowsForDoctor(doctorId, today);

  return {
    doctor_id: doctorId,
    queue_size: queue.length,
    queue: queue.map((row, index) => ({
      ...row,
      token_number: index + 1,
      position_in_queue: index + 1,
      estimated_wait_minutes: index * 30,
    })),
  };
}

/**
 * Get patient's queue position
 */
export async function getPatientQueuePosition(appointmentId, patientId) {
  const appointment = await sql`
    SELECT
      a.id,
      a.doctor_id,
      a.patient_id,
      a.appointment_date,
      a.status,
      COALESCE(d.name, du.full_name, 'Doctor') AS doctor_name
    FROM appointments a
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN users du ON a.doctor_id = du.id
    WHERE a.id = ${appointmentId}
      AND a.patient_id = ${patientId}
      AND COALESCE(a.is_deleted, false) = false
  `;

  if (!appointment.length) {
    throw new Error("Patient not in queue");
  }

  const entry = appointment[0];

  if (!getQueueStatuses().includes(entry.status)) {
    throw new Error("Patient not in active queue");
  }

  const queue = await getQueueRowsForDoctor(entry.doctor_id, entry.appointment_date);
  const position = queue.findIndex((row) => row.appointment_id === appointmentId) + 1;

  if (position <= 0) {
    throw new Error("Patient not in queue");
  }

  const consultationDuration = await getScheduleDuration(
    entry.doctor_id,
    entry.appointment_date,
  );

  return {
    token_number: position,
    position,
    estimated_wait_minutes: (position - 1) * consultationDuration,
    doctor_name: entry.doctor_name,
    is_being_served: entry.status === "in_progress",
    status: entry.status,
  };
}

/**
 * Mark patient as being served
 */
export async function markPatientInProgress(queueId, doctorId, io) {
  const updated = await sql`
    UPDATE appointments
    SET status = 'in_progress',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${queueId}
      AND doctor_id = ${doctorId}
      AND status = 'arrived'
    RETURNING id, patient_id
  `;

  if (!updated.length) {
    throw new Error("Invalid queue entry");
  }

  const appointment = updated[0];

  if (io) {
    io.to(`doctor-${doctorId}`).emit("patient-called", {
      appointment_id: queueId,
    });

    io.to(`patient-${appointment.patient_id}`).emit("your-turn", {
      message: "Your turn to see the doctor",
    });
  }

  await logAudit({
    action: "patient_in_progress",
    entity_type: "appointment",
    entity_id: queueId,
  });

  return {
    appointment_id: queueId,
    patient_id: appointment.patient_id,
    status: "in_progress",
  };
}

/**
 * Mark consultation as complete and advance queue
 */
export async function completeConsultation(queueId, doctorId, io) {
  const updated = await sql`
    UPDATE appointments
    SET status = 'visited',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${queueId}
      AND doctor_id = ${doctorId}
      AND status IN ('arrived', 'in_progress')
    RETURNING id, appointment_date
  `;

  if (!updated.length) {
    throw new Error("Invalid queue entry");
  }

  const appointmentDate = updated[0].appointment_date;
  const remainingQueue = await getQueueRowsForDoctor(doctorId, appointmentDate);

  if (io && remainingQueue.length > 0) {
    const next = remainingQueue[0];

    io.to(`patient-${next.patient_id}`).emit("queue-position-updated", {
      new_position: 1,
      appointment_id: next.appointment_id,
    });

    io.to(`doctor-${doctorId}`).emit("next-patient", {
      appointment_id: next.appointment_id,
      patient_name: next.patient_name,
    });
  }

  await logAudit({
    action: "consultation_completed",
    entity_type: "appointment",
    entity_id: queueId,
  });

  return {
    appointment_id: queueId,
    status: "visited",
  };
}

/**
 * No-op with appointment-based queue storage
 */
export async function recalculateQueuePositions() {
  return { success: true };
}

/**
 * Get queue statistics for a doctor
 */
export async function getQueueStats(doctorId) {
  const today = getIsoDate();
  const stats = await sql`
    SELECT
      COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS waiting_count,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress_count,
      COUNT(CASE WHEN status IN ('completed', 'visited') THEN 1 END) AS completed_count
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND appointment_date = ${today}
      AND COALESCE(is_deleted, false) = false
  `;

  const avgConsultationMinutes = await getScheduleDuration(doctorId, today);
  const waitingCount = Number(stats[0]?.waiting_count || 0);

  return {
    waiting_count: waitingCount,
    in_progress_count: Number(stats[0]?.in_progress_count || 0),
    completed_count: Number(stats[0]?.completed_count || 0),
    avg_consultation_minutes: avgConsultationMinutes,
    max_wait_time: waitingCount * avgConsultationMinutes,
  };
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
  await sql`
    UPDATE doctor_delays
    SET active = false
    WHERE doctor_id = ${doctorId}
      AND active = true
  `;

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

  const today = getIsoDate();
  const queuedPatients = await sql`
    SELECT DISTINCT patient_id
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND appointment_date = ${today}
      AND status IN ('arrived', 'in_progress')
      AND COALESCE(is_deleted, false) = false
  `;

  if (io) {
    queuedPatients.forEach((patient) => {
      io.to(`patient-${patient.patient_id}`).emit("doctor-delay", {
        delay_minutes: delayMinutes,
        reason,
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
