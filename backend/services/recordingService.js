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
      d.name as doctor_name,
      a.appointment_date,
      a.slot_time
    FROM recordings r
    LEFT JOIN appointments a ON r.appointment_id = a.id
    JOIN doctors d ON r.doctor_id = d.id
    WHERE r.patient_id = ${patientId}
      AND COALESCE(r.is_deleted, FALSE) = FALSE
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
      p.name as patient_name,
      a.appointment_date,
      a.slot_time
    FROM recordings r
    LEFT JOIN appointments a ON r.appointment_id = a.id
    JOIN patients p ON r.patient_id = p.id
    WHERE r.doctor_id = ${doctorId}
      AND COALESCE(r.is_deleted, FALSE) = FALSE
    ORDER BY r.created_at DESC
  `;

  return recordings;
}
