import sql from "../config/database.js";

const LIVE_QUEUE_STATUSES = new Set(["arrived", "in_progress"]);
const ACTIVE_APPOINTMENT_STATUSES = new Set(["booked", "arrived", "in_progress"]);
const COMPLETED_APPOINTMENT_STATUSES = new Set(["visited", "completed"]);
const NO_SHOW_GRACE_MINUTES = 15;
const SNAPSHOT_CACHE_TTL_MS = 5000;

let doctorScheduleDurationColumnPromise;
let doctorDelaysTablePromise;
let doctorAnalyticsTablePromise;
const predictionSnapshotCache = new Map();

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

async function tableExists(tableName) {
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;

  return Boolean(rows[0]?.exists);
}

async function hasDoctorDelaysTable() {
  if (!doctorDelaysTablePromise) {
    doctorDelaysTablePromise = tableExists("doctor_delays").catch(() => false);
  }

  return doctorDelaysTablePromise;
}

async function hasDoctorAnalyticsTable() {
  if (!doctorAnalyticsTablePromise) {
    doctorAnalyticsTablePromise = tableExists("doctor_analytics").catch(() => false);
  }

  return doctorAnalyticsTablePromise;
}

function getIsoDate(value = new Date()) {
  return new Date(value).toISOString().split("T")[0];
}

function isSameDay(value, isoDate) {
  return getIsoDate(value) === isoDate;
}

function parseSlotDateTime(appointmentDate, slotTime) {
  if (!appointmentDate) return null;

  const normalizedTime = String(slotTime || "00:00").slice(0, 5);
  const parsed = new Date(`${appointmentDate}T${normalizedTime}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMinutes(value, minutes) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function diffMinutes(later, earlier) {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / (60 * 1000)));
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toIsoStringOrNull(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : null;
}

function normalizeAppointmentStatus(row) {
  if (row.queue_status === "in-progress") return "in_progress";
  if (row.queue_status === "waiting") return "arrived";
  if (row.status === "completed") return "visited";
  return row.status;
}

function isLikelyNoShow(row, now) {
  if (normalizeAppointmentStatus(row) !== "booked") return false;

  const scheduledAt = parseSlotDateTime(row.appointment_date, row.slot_time);
  if (!scheduledAt) return false;

  return now.getTime() > addMinutes(scheduledAt, NO_SHOW_GRACE_MINUTES).getTime();
}

function weightedAverage(weightedValues, fallback) {
  const valid = weightedValues.filter((entry) => entry.value > 0 && entry.weight > 0);

  if (!valid.length) return fallback;

  const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0);
  const total = valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0);

  return Math.max(5, Math.round((total / totalWeight) * 10) / 10);
}

async function getConsultationDurationMinutes(doctorId, queueDate) {
  const cleanDate = queueDate instanceof Date
    ? `${queueDate.getFullYear()}-${String(queueDate.getMonth() + 1).padStart(2, "0")}-${String(queueDate.getDate()).padStart(2, "0")}`
    : String(queueDate).split("T")[0];
  const [year, month, dateVal] = cleanDate.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, dateVal)).getUTCDay();
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

async function getObservedConsultationAverageMinutes(doctorId, queueDate) {
  const rows = await sql`
    SELECT AVG(EXTRACT(EPOCH FROM (q.completed_at - q.started_at)) / 60.0) AS avg_duration
    FROM queue q
    WHERE q.doctor_id = ${doctorId}
      AND q.queue_date = ${queueDate}
      AND q.started_at IS NOT NULL
      AND q.completed_at IS NOT NULL
  `;

  return safeNumber(rows[0]?.avg_duration);
}

async function getDoctorAnalyticsAverageMinutes(doctorId) {
  if (!(await hasDoctorAnalyticsTable())) {
    return 0;
  }

  const rows = await sql`
    SELECT AVG(avg_consultation_duration_minutes) AS avg_duration
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
  `;

  return safeNumber(rows[0]?.avg_duration);
}

async function getDoctorDelayMinutes(doctorId) {
  if (!(await hasDoctorDelaysTable())) {
    return 0;
  }

  try {
    const rows = await sql`
      SELECT delay_minutes
      FROM doctor_delays
      WHERE doctor_id = ${doctorId}
        AND active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return safeNumber(rows[0]?.delay_minutes);
  } catch {
    return 0;
  }
}

async function getPredictionInputs(doctorId, queueDate) {
  const [scheduleMinutes, observedMinutes, analyticsMinutes, doctorDelayMinutes] =
    await Promise.all([
      getConsultationDurationMinutes(doctorId, queueDate),
      getObservedConsultationAverageMinutes(doctorId, queueDate),
      getDoctorAnalyticsAverageMinutes(doctorId),
      getDoctorDelayMinutes(doctorId),
    ]);

  const avgConsultationMinutes = weightedAverage(
    [
      { value: scheduleMinutes, weight: 0.5 },
      { value: observedMinutes, weight: 0.3 },
      { value: analyticsMinutes, weight: 0.2 },
    ],
    scheduleMinutes || 30,
  );

  return {
    scheduleMinutes,
    observedMinutes,
    analyticsMinutes,
    doctorDelayMinutes,
    avgConsultationMinutes,
  };
}

async function getDoctorAppointmentsSnapshot(doctorId, queueDate) {
  const rows = await sql`
    SELECT
      a.id AS appointment_id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date,
      a.slot_time,
      a.status,
      a.token_number,
      a.checked_in_at,
      a.created_at,
      a.updated_at,
      p.name AS patient_name,
      p.phone AS patient_phone,
      d.name AS doctor_name,
      q.id AS queue_id,
      q.token_no,
      q.status AS queue_status,
      q.queue_date,
      q.queued_at,
      q.started_at,
      q.completed_at
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN queue q ON q.appointment_id = a.id
    WHERE a.doctor_id = ${doctorId}
      AND a.appointment_date = ${queueDate}
      AND COALESCE(a.is_deleted, false) = false
      AND a.status <> 'cancelled'
    ORDER BY a.slot_time ASC NULLS LAST, a.created_at ASC
  `;

  return rows.map((row, index) => ({
    ...row,
    normalized_status: normalizeAppointmentStatus(row),
    virtual_token_number: index + 1,
  }));
}

function buildPredictionRows(rows, inputs, queueDate) {
  const now = new Date();
  const activeRows = rows.filter((row) =>
    ACTIVE_APPOINTMENT_STATUSES.has(row.normalized_status),
  );
  const completedRows = rows.filter((row) =>
    COMPLETED_APPOINTMENT_STATUSES.has(row.normalized_status) || row.queue_status === "completed",
  );
  const currentInProgress = activeRows.find((row) => row.normalized_status === "in_progress");
  const latestCompletedAt = completedRows
    .map((row) => (row.completed_at ? new Date(row.completed_at) : null))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const earliestScheduledAt = activeRows
    .map((row) => parseSlotDateTime(row.appointment_date, row.slot_time))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())[0] || addMinutes(now, inputs.doctorDelayMinutes);

  let cursor;
  if (currentInProgress) {
    cursor = new Date(now);
  } else if (latestCompletedAt) {
    cursor = new Date(Math.max(now.getTime(), latestCompletedAt.getTime()));
  } else if (isSameDay(now, queueDate)) {
    cursor = new Date(Math.max(now.getTime(), earliestScheduledAt.getTime()));
    cursor = addMinutes(cursor, inputs.doctorDelayMinutes);
  } else {
    cursor = addMinutes(earliestScheduledAt, inputs.doctorDelayMinutes);
  }

  const predictedMap = new Map();

  for (const row of activeRows) {
    const scheduledAt = parseSlotDateTime(row.appointment_date, row.slot_time) || new Date(cursor);
    const durationMinutes = inputs.avgConsultationMinutes;
    let predictedStart;
    let predictedEnd;

    if (row.normalized_status === "in_progress") {
      const startedAt = row.started_at ? new Date(row.started_at) : new Date(now);
      const elapsedMinutes = diffMinutes(now, startedAt);
      const remainingMinutes = Math.max(2, Math.ceil(durationMinutes - elapsedMinutes));
      predictedStart = startedAt;
      predictedEnd = addMinutes(now, remainingMinutes);
      cursor = new Date(predictedEnd);
    } else {
      predictedStart = new Date(Math.max(cursor.getTime(), scheduledAt.getTime()));
      predictedEnd = addMinutes(predictedStart, durationMinutes);
      cursor = new Date(predictedEnd);
    }

    predictedMap.set(String(row.appointment_id), {
      predicted_start_at: predictedStart,
      predicted_end_at: predictedEnd,
      duration_minutes: durationMinutes,
    });
  }

  return {
    now,
    activeRows,
    predictedMap,
  };
}

function buildQueueStatus(row, predictedMap, activeRows, inputs, now) {
  const normalizedStatus = row.normalized_status;
  const prediction = predictedMap.get(String(row.appointment_id));
  const scheduledAt = parseSlotDateTime(row.appointment_date, row.slot_time);
  const checkedIn = LIVE_QUEUE_STATUSES.has(normalizedStatus);
  const queueMode = checkedIn ? "live_queue" : "pre_checkin";

  const targetIndex = activeRows.findIndex(
    (entry) => String(entry.appointment_id) === String(row.appointment_id),
  );

  const peopleAhead = activeRows.reduce((count, candidate, index) => {
    if (index >= targetIndex) return count;
    if (checkedIn) {
      return count + (LIVE_QUEUE_STATUSES.has(candidate.normalized_status) ? 1 : 0);
    }

    return count + (isLikelyNoShow(candidate, now) ? 0 : 1);
  }, 0);

  const tokenNumber = safeNumber(row.token_no) || safeNumber(row.token_number) || row.virtual_token_number;
  const expectedConsultationTime = prediction?.predicted_start_at || scheduledAt;
  const estimatedWaitMinutes = expectedConsultationTime
    ? diffMinutes(expectedConsultationTime, now)
    : 0;
  const leaveForClinicAt = expectedConsultationTime
    ? addMinutes(expectedConsultationTime, -15)
    : null;

  return {
    queue_id: row.queue_id || null,
    appointment_id: row.appointment_id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    patient_name: row.patient_name,
    patient_phone: row.patient_phone,
    queue_date: row.queue_date || row.appointment_date,
    scheduled_time: row.slot_time,
    scheduled_at: toIsoStringOrNull(scheduledAt),
    token_number: tokenNumber,
    position: checkedIn ? peopleAhead + 1 : null,
    position_in_queue: checkedIn ? peopleAhead + 1 : null,
    people_ahead: peopleAhead,
    estimated_wait_minutes: estimatedWaitMinutes,
    expected_consultation_time: toIsoStringOrNull(expectedConsultationTime),
    expected_completion_time: toIsoStringOrNull(prediction?.predicted_end_at || null),
    leave_for_clinic_at: toIsoStringOrNull(leaveForClinicAt),
    avg_consultation_minutes: inputs.avgConsultationMinutes,
    observed_consultation_minutes: inputs.observedMinutes,
    doctor_delay_minutes: inputs.doctorDelayMinutes,
    checked_in: checkedIn,
    queue_mode: queueMode,
    status: normalizedStatus,
    raw_status: row.queue_status || row.status,
    queued_at: row.queued_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

async function getDoctorPredictionSnapshot(doctorId, queueDate = getIsoDate()) {
  const [rows, inputs] = await Promise.all([
    getDoctorAppointmentsSnapshot(doctorId, queueDate),
    getPredictionInputs(doctorId, queueDate),
  ]);

  const simulation = buildPredictionRows(rows, inputs, queueDate);
  const statusRows = rows.map((row) =>
    buildQueueStatus(row, simulation.predictedMap, simulation.activeRows, inputs, simulation.now),
  );

  return {
    queueDate,
    inputs,
    rows,
    statusRows,
    activeStatusRows: statusRows.filter((row) =>
      ACTIVE_APPOINTMENT_STATUSES.has(row.status),
    ),
  };
}

function getSnapshotCacheKey(doctorId, queueDate) {
  return `${doctorId}:${queueDate}`;
}

function setCachedDoctorPredictionSnapshot(doctorId, queueDate, snapshot) {
  predictionSnapshotCache.set(getSnapshotCacheKey(doctorId, queueDate), {
    snapshot,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  });
}

function getCachedDoctorPredictionSnapshotEntry(doctorId, queueDate) {
  const cacheKey = getSnapshotCacheKey(doctorId, queueDate);
  const entry = predictionSnapshotCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    predictionSnapshotCache.delete(cacheKey);
    return null;
  }

  return entry.snapshot;
}

async function getDoctorPredictionSnapshotCached(
  doctorId,
  queueDate = getIsoDate(),
  { forceRefresh = false } = {},
) {
  if (!forceRefresh) {
    const cached = getCachedDoctorPredictionSnapshotEntry(doctorId, queueDate);
    if (cached) {
      return cached;
    }
  }

  const snapshot = await getDoctorPredictionSnapshot(doctorId, queueDate);
  setCachedDoctorPredictionSnapshot(doctorId, queueDate, snapshot);
  return snapshot;
}

async function emitQueueState(io, doctorId, queueDate, changedAppointmentId = null) {
  if (!io || !doctorId || !queueDate) return;

  const snapshot = await getDoctorPredictionSnapshotCached(doctorId, queueDate, {
    forceRefresh: true,
  });
  const liveQueue = snapshot.statusRows.filter((entry) => entry.queue_id);

  io.to(`doctor-${doctorId}`).emit("queue-update", {
    doctor_id: doctorId,
    queue_date: queueDate,
    queue_size: liveQueue.filter((entry) => entry.status !== "visited").length,
    queue: liveQueue,
    changed_appointment_id: changedAppointmentId,
    avg_consultation_minutes: snapshot.inputs.avgConsultationMinutes,
    doctor_delay_minutes: snapshot.inputs.doctorDelayMinutes,
  });

  snapshot.activeStatusRows.forEach((entry) => {
    io.to(`patient-${entry.patient_id}`).emit("queue-position-updated", {
      appointment_id: entry.appointment_id,
      token_number: entry.token_number,
      new_position: entry.position,
      people_ahead: entry.people_ahead,
      estimated_wait_minutes: entry.estimated_wait_minutes,
      expected_consultation_time: entry.expected_consultation_time,
      leave_for_clinic_at: entry.leave_for_clinic_at,
      doctor_delay_minutes: entry.doctor_delay_minutes,
      avg_consultation_minutes: entry.avg_consultation_minutes,
      queue_mode: entry.queue_mode,
      checked_in: entry.checked_in,
      status: entry.status,
      doctor_id: entry.doctor_id,
      doctor_name: entry.doctor_name,
    });

    if (entry.status === "in_progress") {
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

    const slotOrder = await tx`
      SELECT COUNT(*)::int AS next_token
      FROM appointments a
      WHERE a.doctor_id = ${appointment.doctor_id}
        AND a.appointment_date = ${queueDate}
        AND COALESCE(a.is_deleted, false) = false
        AND a.status <> 'cancelled'
        AND (
          a.slot_time < (
            SELECT slot_time
            FROM appointments
            WHERE id = ${appointmentId}
          )
          OR (
            a.slot_time = (
              SELECT slot_time
              FROM appointments
              WHERE id = ${appointmentId}
            )
            AND (
              a.created_at < (
                SELECT created_at
                FROM appointments
                WHERE id = ${appointmentId}
              )
              OR (
                a.created_at = (
                  SELECT created_at
                  FROM appointments
                  WHERE id = ${appointmentId}
                )
                AND a.id <= ${appointmentId}
              )
            )
          )
        )
    `;

    const preferredToken = safeNumber(slotOrder[0]?.next_token) || 1;
    const tokenNo = preferredToken;

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
  const snapshot = await getDoctorPredictionSnapshotCached(doctorId, date || getIsoDate());
  return snapshot.statusRows.filter((entry) => entry.queue_id);
}

export async function getQueuePosition(appointmentId, patientId = null) {
  const rows = await sql`
    SELECT
      a.id AS appointment_id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date
    FROM appointments a
    WHERE a.id = ${appointmentId}
      AND COALESCE(a.is_deleted, false) = false
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Appointment not found");
  }

  if (patientId && String(row.patient_id) !== String(patientId)) {
    throw new Error("Unauthorized");
  }

  const snapshot = await getDoctorPredictionSnapshotCached(
    row.doctor_id,
    row.appointment_date || getIsoDate(),
  );
  const current = snapshot.statusRows.find(
    (entry) => String(entry.appointment_id) === String(appointmentId),
  );

  if (!current) {
    throw new Error("Queue entry not found");
  }

  return current;
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
    message: "Patient checked in successfully",
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
        started_at = NULL,
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
