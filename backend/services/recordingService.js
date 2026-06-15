import sql from "../config/database.js";

export async function saveRecording(data) {
  const {
    appointment_id,
    patient_id,
    doctor_id,
    file_url,
    duration = 0,
  } = data;

  // Validate input (appointment_id optional)
  if (!patient_id || !doctor_id) {
    throw new Error("patient_id and doctor_id are required");
  }

  if (!file_url) {
    throw new Error("Recording file URL is required");
  }

  // If appointment_id provided, ensure it exists; otherwise allow null
  if (appointment_id) {
    const appointment = await sql`
      SELECT id, status
      FROM appointments
      WHERE id = ${appointment_id}
        AND is_deleted = FALSE
    `;
    if (appointment.length === 0) {
      throw new Error("Appointment not found");
    }
  }

  // Insert recording
  const recording = await sql`
    INSERT INTO recordings (
      appointment_id,
      patient_id,
      doctor_id,
      audio_url,
      duration,
      created_at
    )
    VALUES (
      ${appointment_id || null},
      ${patient_id},
      ${doctor_id},
      ${file_url},
      ${duration},
      NOW()
    )
    RETURNING *
  `;

  return recording[0];
}

export async function getPatientRecordings(patientId) {
  const recordings = await sql`
    SELECT 
      r.id,
      r.audio_url as file_url,
      r.duration,
      r.created_at,
      r.patient_consent,
      r.doctor_consent,
      d.name as doctor_name,
      a.appointment_date,
      a.slot_time
    FROM recordings r
    LEFT JOIN appointments a ON r.appointment_id = a.id
    JOIN doctors d ON r.doctor_id = d.id
    WHERE r.patient_id = ${patientId}
    ORDER BY r.created_at DESC
  `;

  return recordings;
}

export async function getDoctorRecordings(doctorId) {
  const recordings = await sql`
    SELECT 
      r.id,
      r.audio_url as file_url,
      r.duration,
      r.created_at,
      r.patient_consent,
      r.doctor_consent,
      p.name as patient_name,
      a.appointment_date,
      a.slot_time
    FROM recordings r
    LEFT JOIN appointments a ON r.appointment_id = a.id
    JOIN patients p ON r.patient_id = p.id
    WHERE r.doctor_id = ${doctorId}
    ORDER BY r.created_at DESC
  `;

  return recordings;
}

export async function getRecordingById(id) {
  const rows = await sql`
    SELECT id, doctor_id, patient_id, audio_url, duration, patient_consent, doctor_consent, created_at
    FROM recordings
    WHERE id = ${id}
      AND COALESCE(is_deleted, FALSE) = FALSE
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function updateRecordingConsent(id, role, consent) {
  if (role === "patient") {
    const result = await sql`
      UPDATE recordings
      SET patient_consent = ${consent}
      WHERE id = ${id}
      RETURNING *
    `;
    return result[0] || null;
  } else if (role === "doctor") {
    const result = await sql`
      UPDATE recordings
      SET doctor_consent = ${consent}
      WHERE id = ${id}
      RETURNING *
    `;
    return result[0] || null;
  }
  return null;
}
