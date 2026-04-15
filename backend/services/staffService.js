import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sql from "../config/database.js";

const STAFF_MUTABLE_PATIENT_FIELDS = [
  "name",
  "phone",
  "age",
  "gender",
  "blood_group",
  "medical_history",
];

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildStaffToken(staffRow) {
  return jwt.sign(
    {
      id: staffRow.user_id,
      staff_id: staffRow.id,
      email: staffRow.email,
      role: "staff",
      hospital_id: staffRow.hospital_id,
      staff_role: staffRow.role,
      active_doctor_id: staffRow.active_doctor_id || null,
    },
    process.env.TOKEN_SECRET,
    { expiresIn: "1d" },
  );
}

export async function logStaffAction(staffId, action, targetType = null, targetId = null, metadata = {}) {
  if (!staffId || !action) return;

  await sql`
    INSERT INTO staff_logs (staff_id, action, target_type, target_id, metadata)
    VALUES (${staffId}, ${action}, ${targetType}, ${targetId}, ${sql.json(metadata)})
  `;
}

export async function createStaffAccount({
  name,
  email,
  password,
  hospital_id = null,
  role = "staff",
  department = null,
  phone = null,
  created_by = null,
}) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const cleanPassword = String(password || "").trim();

  if (!name || !normalizedEmail || !cleanPassword) {
    throw new Error("Name, email and password are required");
  }

  return sql.begin(async (tx) => {
    const existing = await tx`
      SELECT s.id
      FROM staff s
      WHERE s.email = ${normalizedEmail}
      LIMIT 1
    `;

    if (existing.length) {
      throw new Error("Staff account already exists");
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const userRows = await tx`
      INSERT INTO users (email, password_hash, full_name, phone, role)
      VALUES (${normalizedEmail}, ${passwordHash}, ${name}, ${phone}, 'staff')
      RETURNING id, email, full_name, phone, role
    `;

    const user = userRows[0];

    const staffRows = await tx`
      INSERT INTO staff (
        user_id,
        name,
        email,
        password_hash,
        hospital_id,
        role,
        department,
        phone,
        created_by
      )
      VALUES (
        ${user.id},
        ${name},
        ${normalizedEmail},
        ${passwordHash},
        ${hospital_id},
        ${role},
        ${department},
        ${phone},
        ${created_by}
      )
      RETURNING id, user_id, name, email, hospital_id, role, department, phone, is_active, created_at
    `;

    return staffRows[0];
  });
}

export async function loginStaff({ email, password }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const cleanPassword = String(password || "").trim();

  if (!normalizedEmail || !cleanPassword) {
    throw new Error("Email and password are required");
  }

  const staffRows = await sql`
    SELECT id, user_id, name, email, password_hash, hospital_id, role, department, phone, is_active, active_doctor_id
    FROM staff
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  const staff = staffRows[0];
  if (!staff || !staff.is_active) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(cleanPassword, staff.password_hash);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = buildStaffToken(staff);

  return {
    token,
    user: {
      id: staff.user_id,
      staff_id: staff.id,
      name: staff.name,
      email: staff.email,
      role: "staff",
      hospital_id: staff.hospital_id,
      staff_role: staff.role,
      department: staff.department,
      phone: staff.phone,
      active_doctor_id: staff.active_doctor_id || null,
    },
  };
}

export async function getStaffProfile(userId) {
  const rows = await sql`
    SELECT id, user_id, name, email, username, hospital_id, role, department, phone, is_active, created_at, active_doctor_id, created_by_doctor_id
    FROM staff
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function updateStaffProfile(userId, payload = {}) {
  return sql.begin(async (tx) => {
    const name = payload?.name ?? null;
    const email = payload?.email ?? null;
    const department = payload?.department ?? null;
    const phone = payload?.phone ?? null;

    const rows = await tx`
      UPDATE staff
      SET name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          department = COALESCE(${department}, department),
          phone = COALESCE(${phone}, phone)
      WHERE user_id = ${userId}
        AND is_active = TRUE
      RETURNING id, user_id, name, email, username, hospital_id, role, department, phone, is_active, created_at, active_doctor_id, created_by_doctor_id
    `;

    if (!rows.length) {
      throw new Error("Staff profile not found");
    }

    await tx`
      UPDATE users
      SET email = COALESCE(${email}, email),
          full_name = COALESCE(${name}, full_name),
          phone = COALESCE(${phone}, phone),
          updated_at = NOW()
      WHERE id = ${userId}
        AND COALESCE(is_deleted, FALSE) = FALSE
    `;

    return rows[0];
  });
}

export async function deleteStaffProfile(userId) {
  return sql.begin(async (tx) => {
    const staffRows = await tx`
      UPDATE staff
      SET is_active = FALSE
      WHERE user_id = ${userId}
        AND is_active = TRUE
      RETURNING id, user_id
    `;

    if (!staffRows.length) {
      throw new Error("Staff profile not found");
    }

    await tx`
      UPDATE users
      SET is_deleted = TRUE,
          updated_at = NOW()
      WHERE id = ${userId}
        AND COALESCE(is_deleted, FALSE) = FALSE
    `;

    return staffRows[0];
  });
}

export async function generateQueueToken({ appointmentId, staffId, hospitalId = null, requiredDoctorId = null }) {
  const today = getTodayIsoDate();

  return sql.begin(async (tx) => {
    const appointmentRows = await tx`
      SELECT id, patient_id, doctor_id, appointment_date, status
      FROM appointments
      WHERE id = ${appointmentId}
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    const appointment = appointmentRows[0];
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (requiredDoctorId && String(appointment.doctor_id) !== String(requiredDoctorId)) {
      throw new Error("Appointment does not belong to the active doctor context");
    }

    if (["visited", "completed", "cancelled"].includes(appointment.status)) {
      throw new Error("Token cannot be generated for this appointment");
    }

    const queueDate = appointment.appointment_date || today;

    const existingRows = await tx`
      SELECT id, appointment_id, token_no, patient_id, doctor_id, queue_date, status
      FROM queue
      WHERE appointment_id = ${appointmentId}
      LIMIT 1
    `;

    if (existingRows.length) {
      return existingRows[0];
    }

    await tx`SELECT pg_advisory_xact_lock(hashtext(${`queue:${appointment.doctor_id}:${queueDate}`}))`;

    const nextTokenRows = await tx`
      SELECT COALESCE(MAX(token_no), 0) + 1 AS next_token
      FROM queue
      WHERE doctor_id = ${appointment.doctor_id}
        AND queue_date = ${queueDate}
    `;

    const tokenNo = Number(nextTokenRows[0]?.next_token || 1);

    const insertedRows = await tx`
      INSERT INTO queue (
        appointment_id,
        token_no,
        patient_id,
        doctor_id,
        hospital_id,
        queue_date,
        status,
        assigned_staff_id
      )
      VALUES (
        ${appointmentId},
        ${tokenNo},
        ${appointment.patient_id},
        ${appointment.doctor_id},
        ${hospitalId},
        ${queueDate},
        'waiting',
        ${staffId}
      )
      RETURNING id, appointment_id, token_no, patient_id, doctor_id, queue_date, status
    `;

    await tx`
      UPDATE appointments
      SET status = 'arrived',
          token_number = ${tokenNo},
          checked_in_at = CURRENT_TIMESTAMP,
          handled_by_staff_id = ${staffId},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${appointmentId}
    `;

    return insertedRows[0];
  });
}

export async function getLiveQueue({ doctorId, date = getTodayIsoDate(), hospitalId = null }) {
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
      p.id AS patient_id,
      p.name AS patient_name,
      p.phone AS patient_phone,
      a.slot_time,
      a.status AS appointment_status
    FROM queue q
    JOIN patients p ON p.id = q.patient_id
    JOIN doctors d ON d.id = q.doctor_id
    LEFT JOIN appointments a ON a.id = q.appointment_id
    WHERE q.doctor_id = ${doctorId}
      AND q.queue_date = ${date}
      AND (${hospitalId}::int IS NULL OR d.branch_id = ${hospitalId})
    ORDER BY q.token_no ASC
  `;
}

export async function updateQueueStatus({ queueId, status, staffId }) {
  const allowedStatuses = new Set(["waiting", "in-progress", "completed"]);
  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid queue status");
  }

  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT id, appointment_id, patient_id, doctor_id, status
      FROM queue
      WHERE id = ${queueId}
      LIMIT 1
    `;

    const queue = rows[0];
    if (!queue) {
      throw new Error("Queue entry not found");
    }

    const mappedAppointmentStatus =
      status === "waiting" ? "arrived" : status === "in-progress" ? "in_progress" : "visited";

    const updatedRows = await tx`
      UPDATE queue
      SET status = ${status},
          started_at = CASE
            WHEN ${status} = 'in-progress' AND started_at IS NULL THEN CURRENT_TIMESTAMP
            ELSE started_at
          END,
          completed_at = CASE
            WHEN ${status} = 'completed' THEN CURRENT_TIMESTAMP
            ELSE completed_at
          END,
          assigned_staff_id = COALESCE(${staffId}, assigned_staff_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${queueId}
      RETURNING *
    `;

    await tx`
      UPDATE appointments
      SET status = ${mappedAppointmentStatus},
          handled_by_staff_id = COALESCE(${staffId}, handled_by_staff_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${queue.appointment_id}
    `;

    return updatedRows[0];
  });
}

export async function getTodayAppointments({ hospitalId = null, doctorId = null, status = null }) {
  const today = getTodayIsoDate();

  return sql`
    SELECT
      a.id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date,
      a.slot_time,
      a.status,
      a.token_number,
      a.checked_in_at,
      p.name AS patient_name,
      p.phone AS patient_phone,
      p.gender,
      p.age,
      d.name AS doctor_name,
      d.specialty,
      pay.id AS payment_id,
      pay.status AS payment_status,
      pay.payment_method,
      pay.amount AS payment_amount
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN LATERAL (
      SELECT id, status, payment_method, amount
      FROM payments
      WHERE appointment_id = a.id
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) pay ON true
    WHERE a.appointment_date = ${today}
      AND COALESCE(a.is_deleted, false) = false
      AND (${doctorId}::uuid IS NULL OR a.doctor_id = ${doctorId})
      AND (${status}::text IS NULL OR a.status = ${status})
      AND (${hospitalId}::int IS NULL OR d.branch_id = ${hospitalId})
    ORDER BY a.slot_time ASC, a.created_at ASC
  `;
}

export async function markAppointmentArrived({ appointmentId, staffId }) {
  const rows = await sql`
    UPDATE appointments
    SET status = 'arrived',
        checked_in_at = CURRENT_TIMESTAMP,
        handled_by_staff_id = ${staffId},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
      AND COALESCE(is_deleted, false) = false
      AND status NOT IN ('cancelled', 'visited', 'completed')
    RETURNING *
  `;

  if (!rows.length) {
    throw new Error("Appointment cannot be marked as arrived");
  }

  return rows[0];
}

export async function getLimitedPatientProfile(patientId) {
  const patientRows = await sql`
    SELECT
      p.id,
      p.name,
      p.email,
      p.age,
      p.gender,
      p.phone,
      p.blood_group,
      p.medical_history,
      p.unique_code,
      p.created_at,
      (
        SELECT MAX(a.appointment_date)
        FROM appointments a
        WHERE a.patient_id = p.id
          AND COALESCE(a.is_deleted, false) = false
      ) AS last_appointment_date
    FROM patients p
    WHERE p.id = ${patientId}
      AND COALESCE(p.is_deleted, false) = false
    LIMIT 1
  `;

  return patientRows[0] || null;
}

export async function updateLimitedPatientProfile(patientId, updates = {}) {
  const payload = {};

  for (const field of STAFF_MUTABLE_PATIENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      payload[field] = updates[field];
    }
  }

  const rows = await sql`
    UPDATE patients
    SET
      name = COALESCE(${payload.name}, name),
      phone = COALESCE(${payload.phone}, phone),
      age = COALESCE(${payload.age}, age),
      gender = COALESCE(${payload.gender}, gender),
      blood_group = COALESCE(${payload.blood_group}, blood_group),
      medical_history = COALESCE(${payload.medical_history}, medical_history),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${patientId}
      AND COALESCE(is_deleted, false) = false
    RETURNING id, name, email, age, gender, phone, blood_group, medical_history, unique_code, updated_at
  `;

  if (!rows.length) {
    throw new Error("Patient not found");
  }

  return rows[0];
}

export async function savePatientReport({
  patientId,
  appointmentId = null,
  uploadedBy,
  filePath,
  fileName,
  fileType,
  secureUrl = null,
  publicId = null,
  storageProvider = "local",
}) {
  const rows = await sql`
    INSERT INTO reports (
      user_id,
      patient_id,
      appointment_id,
      uploaded_by,
      file_path,
      file_name,
      file_type,
      secure_url,
      public_id,
      storage_provider,
      created_at,
      updated_at,
      is_deleted
    )
    VALUES (
      ${patientId},
      ${patientId},
      ${appointmentId},
      ${uploadedBy},
      ${filePath},
      ${fileName},
      ${fileType},
      ${secureUrl},
      ${publicId},
      ${storageProvider},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      FALSE
    )
    RETURNING *
  `;

  return rows[0];
}

export async function getPatientReports(patientId) {
  return sql`
    SELECT id, patient_id, appointment_id, file_name, file_type, file_path, secure_url, storage_provider, created_at
    FROM reports
    WHERE patient_id = ${patientId}
      AND COALESCE(is_deleted, false) = false
    ORDER BY created_at DESC
  `;
}

export async function getOverviewStats({ hospitalId = null, staffId = null, doctorId = null }) {
  const today = getTodayIsoDate();

  const [stats] = await sql`
    WITH today_appts AS (
      SELECT a.*, d.branch_id
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.appointment_date = ${today}
        AND COALESCE(a.is_deleted, false) = false
        AND (${doctorId}::uuid IS NULL OR a.doctor_id = ${doctorId})
        AND (${hospitalId}::int IS NULL OR d.branch_id = ${hospitalId})
    ),
    queue_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE q.status = 'waiting')::int AS waiting_count,
        COUNT(*) FILTER (WHERE q.status = 'completed')::int AS completed_count,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (COALESCE(q.started_at, CURRENT_TIMESTAMP) - q.queued_at)) / 60.0
          ) FILTER (WHERE q.status IN ('in-progress', 'completed')),
          0
        )::numeric(10,2) AS avg_wait_minutes
      FROM queue q
      JOIN doctors d ON d.id = q.doctor_id
      WHERE q.queue_date = ${today}
        AND (${doctorId}::uuid IS NULL OR q.doctor_id = ${doctorId})
        AND (${hospitalId}::int IS NULL OR d.branch_id = ${hospitalId})
    ),
    staff_activity AS (
      SELECT COUNT(*)::int AS actions_today
      FROM staff_logs
      WHERE created_at::date = ${today}
        AND (${staffId}::uuid IS NULL OR staff_id = ${staffId})
    )
    SELECT
      (SELECT COUNT(*)::int FROM today_appts) AS total_patients,
      (SELECT waiting_count FROM queue_stats) AS waiting_count,
      (SELECT completed_count FROM queue_stats) AS completed_count,
      (SELECT avg_wait_minutes FROM queue_stats) AS avg_wait_minutes,
      (SELECT actions_today FROM staff_activity) AS staff_actions_today
  `;

  return stats;
}

export async function getStaffActivity({ staffId = null, limit = 25 }) {
  return sql`
    SELECT sl.id, sl.staff_id, s.name AS staff_name, sl.action, sl.target_type, sl.target_id, sl.metadata, sl.created_at
    FROM staff_logs sl
    JOIN staff s ON s.id = sl.staff_id
    WHERE (${staffId}::uuid IS NULL OR sl.staff_id = ${staffId})
    ORDER BY sl.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getStaffPerformance({ hospitalId = null, doctorId = null }) {
  const today = getTodayIsoDate();

  return sql`
    SELECT
      s.id AS staff_id,
      s.name AS staff_name,
      s.department,
      COUNT(sl.id)::int AS actions_today,
      COUNT(sl.id) FILTER (WHERE sl.action = 'queue_token_generated')::int AS tokens_generated,
      COUNT(sl.id) FILTER (WHERE sl.action = 'appointment_marked_arrived')::int AS arrivals_handled,
      COUNT(sl.id) FILTER (WHERE sl.action = 'report_uploaded')::int AS reports_uploaded
    FROM staff s
    LEFT JOIN doctor_staff_map dsm
      ON dsm.staff_id = s.id
      AND dsm.status = 'active'
    LEFT JOIN staff_logs sl
      ON sl.staff_id = s.id
      AND sl.created_at::date = ${today}
    WHERE (${hospitalId}::int IS NULL OR s.hospital_id = ${hospitalId})
      AND (${doctorId}::uuid IS NULL OR dsm.doctor_id = ${doctorId})
    GROUP BY s.id, s.name, s.department
    ORDER BY actions_today DESC, s.name ASC
  `;
}
