import sql from "../config/database.js";

let doctorScheduleDurationColumnPromise;

async function getDoctorScheduleDurationColumn() {
  if (!doctorScheduleDurationColumnPromise) {
    doctorScheduleDurationColumnPromise = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'doctor_schedule'
        AND column_name IN ('consultation_duration_minutes', 'consultation_duration')
    `
      .then((rows) => {
        const names = rows.map((row) => row.column_name);
        if (names.includes("consultation_duration_minutes")) {
          return "consultation_duration_minutes";
        }
        if (names.includes("consultation_duration")) {
          return "consultation_duration";
        }
        return "consultation_duration_minutes";
      })
      .catch(() => "consultation_duration_minutes");
  }

  return doctorScheduleDurationColumnPromise;
}

function getIsoDate(value = new Date()) {
  return new Date(value).toISOString().split("T")[0];
}

async function getConsultationDurationMinutes(doctorId, queueDate) {
  const dayOfWeek = new Date(queueDate).getDay();
  const durationColumn = await getDoctorScheduleDurationColumn();

  const rows =
    durationColumn === "consultation_duration"
      ? await sql`
          SELECT consultation_duration
          FROM doctor_schedule
          WHERE doctor_id = ${doctorId}
            AND day_of_week = ${dayOfWeek}
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `
      : await sql`
          SELECT consultation_duration_minutes
          FROM doctor_schedule
          WHERE doctor_id = ${doctorId}
            AND day_of_week = ${dayOfWeek}
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `;

  return Number(rows[0]?.[durationColumn]) || 30;
}

async function getQueueSnapshot(doctorId, queueDate) {
  return sql`
    SELECT
      q.id,
      q.appointment_id,
      q.token_no,
      q.status,
      q.queue_date,
      q.queued_at,
      q.started_at,
      q.completed_at,
      a.patient_id,
      a.doctor_id,
      a.slot_time,
      a.status AS appointment_status,
      p.name AS patient_name,
      p.phone AS patient_phone,
      d.name AS doctor_name
    FROM queue q
    JOIN appointments a ON a.id = q.appointment_id
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE q.doctor_id = ${doctorId}
      AND q.queue_date = ${queueDate}
      AND COALESCE(a.is_deleted, false) = false
    ORDER BY q.token_no ASC
  `;
}

function mapQueueRow(row, index, consultationMinutes) {
  const isCompleted = row.status === "completed";
  const position = isCompleted ? null : index + 1;
  const estimatedWaitMinutes = isCompleted
    ? 0
    : Math.max(0, index) * consultationMinutes;

  return {
    id: row.id,
    queue_id: row.id,
    appointment_id: row.appointment_id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    patient_name: row.patient_name,
    patient_phone: row.patient_phone,
    slot_time: row.slot_time,
    token_number: row.token_no,
    token_no: row.token_no,
    status:
      row.status === "in-progress"
        ? "in_progress"
        : row.status === "waiting"
          ? "arrived"
          : row.status,
    raw_status: row.status,
    position_in_queue: position,
    position,
    estimated_wait_minutes: estimatedWaitMinutes,
    appointment_status: row.appointment_status,
    queue_date: row.queue_date,
    queued_at: row.queued_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

async function emitQueueState(io, doctorId, queueDate, changedAppointmentId = null) {
  if (!io || !doctorId || !queueDate) return;

  const consultationMinutes = await getConsultationDurationMinutes(
    doctorId,
    queueDate,
  );
  const rows = await getQueueSnapshot(doctorId, queueDate);
  const queue = rows.map((row, index) =>
    mapQueueRow(row, index, consultationMinutes),
  );

  io.to(`doctor-${doctorId}`).emit("queue-update", {
    doctor_id: doctorId,
    queue_date: queueDate,
    queue_size: queue.filter((entry) => entry.raw_status !== "completed").length,
    queue,
    changed_appointment_id: changedAppointmentId,
  });

  queue.forEach((entry) => {
    io.to(`patient-${entry.patient_id}`).emit("queue-position-updated", {
      appointment_id: entry.appointment_id,
      token_number: entry.token_number,
      new_position: entry.position,
      estimated_wait_minutes: entry.estimated_wait_minutes,
      status: entry.status,
      doctor_id: entry.doctor_id,
      doctor_name: entry.doctor_name,
    });

    if (entry.raw_status === "in-progress") {
      io.to(`patient-${entry.patient_id}`).emit("your-turn", {
        appointment_id: entry.appointment_id,
        status: "in_progress",
        message: "Your turn to see the doctor",
      });
    }
  });
}

async function ensureAppointmentBelongsToDoctor(appointmentId, doctorId) {
  const rows = await sql`
    SELECT id, doctor_id, patient_id, appointment_date, status, token_number
    FROM appointments
    WHERE id = ${appointmentId}
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
  `;

  const appointment = rows[0];
  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (doctorId && String(appointment.doctor_id) !== String(doctorId)) {
    throw new Error("Unauthorized for this appointment");
  }

  return appointment;
}

async function ensureQueueEntryForAppointment(appointmentId) {
  const appointment = await ensureAppointmentBelongsToDoctor(appointmentId, null);
  const queueDate = appointment.appointment_date || getIsoDate();

  return sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id, token_no, status, queue_date
      FROM queue
      WHERE appointment_id = ${appointmentId}
      LIMIT 1
    `;

    if (existing.length) {
      return { appointment, queue: existing[0] };
    }

    await tx`SELECT pg_advisory_xact_lock(hashtext(${`queue:${appointment.doctor_id}:${queueDate}`}))`;

    const nextTokenRows = await tx`
      SELECT COALESCE(MAX(token_no), 0) + 1 AS next_token
      FROM queue
      WHERE doctor_id = ${appointment.doctor_id}
        AND queue_date = ${queueDate}
    `;

    const tokenNo = Number(nextTokenRows[0]?.next_token || 1);

    const inserted = await tx`
      INSERT INTO queue (
        appointment_id,
        token_no,
        patient_id,
        doctor_id,
        queue_date,
        status
      )
      VALUES (
        ${appointmentId},
        ${tokenNo},
        ${appointment.patient_id},
        ${appointment.doctor_id},
        ${queueDate},
        'waiting'
      )
      RETURNING id, token_no, status, queue_date
    `;

    await tx`
      UPDATE appointments
      SET status = 'arrived',
          token_number = ${tokenNo},
          checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${appointmentId}
    `;

    return { appointment, queue: inserted[0] };
  });
}

export async function getQueueForDoctor(doctorId, date = getIsoDate()) {
  const queueDate = date || getIsoDate();
  const consultationMinutes = await getConsultationDurationMinutes(
    doctorId,
    queueDate,
  );
  const rows = await getQueueSnapshot(doctorId, queueDate);

  return rows.map((row, index) => mapQueueRow(row, index, consultationMinutes));
}

export async function getQueuePosition(appointmentId, patientId = null) {
  const rows = await sql`
    SELECT
      q.id,
      q.appointment_id,
      q.token_no,
      q.status,
      q.queue_date,
      a.patient_id,
      a.doctor_id,
      d.name AS doctor_name
    FROM queue q
    JOIN appointments a ON a.id = q.appointment_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE q.appointment_id = ${appointmentId}
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Queue entry not found");
  }

  if (patientId && String(row.patient_id) !== String(patientId)) {
    throw new Error("Unauthorized");
  }

  const queue = await getQueueForDoctor(row.doctor_id, row.queue_date);
  const current = queue.find(
    (entry) => String(entry.appointment_id) === String(appointmentId),
  );

  if (!current) {
    throw new Error("Queue entry not found");
  }

  return {
    appointment_id: current.appointment_id,
    queue_id: current.queue_id,
    token_number: current.token_number,
    position: current.position,
    estimated_wait_minutes: current.estimated_wait_minutes,
    doctor_id: current.doctor_id,
    doctor_name: current.doctor_name,
    patient_id: current.patient_id,
    status: current.status,
  };
}

export async function markArrived(appointmentId, io) {
  const { appointment, queue } = await ensureQueueEntryForAppointment(appointmentId);
  await emitQueueState(io, appointment.doctor_id, queue.queue_date, appointmentId);

  return {
    success: true,
    appointment_id: appointmentId,
    queue_id: queue.id,
    token_number: queue.token_no,
    status: "arrived",
    message: "Patient marked as arrived",
  };
}

export async function markInProgress(appointmentId, io, doctorId = null) {
  const appointment = await ensureAppointmentBelongsToDoctor(appointmentId, doctorId);

  const rows = await sql`
    UPDATE queue
    SET status = 'in-progress',
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = ${appointmentId}
      AND status IN ('waiting', 'in-progress')
    RETURNING id, queue_date
  `;

  if (!rows.length) {
    throw new Error("Queue entry not found");
  }

  await sql`
    UPDATE appointments
    SET status = 'in_progress',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
  `;

  await emitQueueState(io, appointment.doctor_id, rows[0].queue_date, appointmentId);

  return {
    success: true,
    appointment_id: appointmentId,
    queue_id: rows[0].id,
    status: "in_progress",
    message: "Consultation started",
  };
}

export async function markCompleted(appointmentId, io, doctorId = null, followUpDate = null) {
  const appointment = await ensureAppointmentBelongsToDoctor(appointmentId, doctorId);

  const rows = await sql`
    UPDATE queue
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = ${appointmentId}
      AND status IN ('waiting', 'in-progress', 'completed')
    RETURNING id, queue_date
  `;

  if (!rows.length) {
    throw new Error("Queue entry not found");
  }

  await sql`
    UPDATE appointments
    SET status = 'visited',
        follow_up_date = COALESCE(${followUpDate}, follow_up_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
  `;

  await emitQueueState(io, appointment.doctor_id, rows[0].queue_date, appointmentId);

  return {
    success: true,
    appointment_id: appointmentId,
    queue_id: rows[0].id,
    status: "visited",
    message: "Consultation completed",
  };
}

export async function finishConsultation(appointmentId, followUpDate, io) {
  return markCompleted(appointmentId, io, null, followUpDate);
}

export async function skipPatient(appointmentId, io, doctorId = null) {
  const appointment = await ensureAppointmentBelongsToDoctor(appointmentId, doctorId);

  const rows = await sql`
    UPDATE queue
    SET status = 'waiting',
        updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = ${appointmentId}
      AND status IN ('waiting', 'in-progress')
    RETURNING id, queue_date
  `;

  if (!rows.length) {
    throw new Error("Queue entry not found");
  }

  await sql`
    UPDATE appointments
    SET status = 'arrived',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
  `;

  await emitQueueState(io, appointment.doctor_id, rows[0].queue_date, appointmentId);

  return {
    success: true,
    appointment_id: appointmentId,
    queue_id: rows[0].id,
    status: "arrived",
    message: "Patient returned to waiting queue",
  };
}

export async function resetQueue(doctorId, date = getIsoDate(), io = null) {
  await sql`
    DELETE FROM queue
    WHERE doctor_id = ${doctorId}
      AND queue_date = ${date}
  `;

  await sql`
    UPDATE appointments
    SET status = 'booked',
        token_number = NULL,
        checked_in_at = NULL,
        handled_by_staff_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE doctor_id = ${doctorId}
      AND appointment_date = ${date}
      AND status IN ('arrived', 'in_progress', 'visited', 'completed')
      AND COALESCE(is_deleted, false) = false
  `;

  await emitQueueState(io, doctorId, date, null);

  return {
    success: true,
    message: "Queue reset successfully",
  };
}

export async function scanQrAndMarkArrived(uniqueCode, io) {
  const patients = await sql`
    SELECT id
    FROM patients
    WHERE unique_code = ${uniqueCode}
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
  `;

  if (!patients.length) {
    throw new Error("Patient not found");
  }

  const appointments = await sql`
    SELECT id
    FROM appointments
    WHERE patient_id = ${patients[0].id}
      AND appointment_date = CURRENT_DATE
      AND status IN ('booked', 'arrived')
      AND COALESCE(is_deleted, false) = false
    ORDER BY slot_time ASC NULLS LAST, created_at ASC
    LIMIT 1
  `;

  if (!appointments.length) {
    throw new Error("No active appointment found");
  }

  return markArrived(appointments[0].id, io);
}
