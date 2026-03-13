import sql from "../config/database.js";

/**
 * Create a visit record
 */
export async function createVisit(
  appointmentId,
  doctorId,
  patientId,
  visitData,
) {
  const {
    visit_type = "consultation",
    chief_complaint,
    visit_notes,
    vitals,
    diagnosis,
    treatment_plan,
    duration_minutes = 30,
  } = visitData;

  const visit = await sql`
    INSERT INTO visits (
      appointment_id,
      doctor_id,
      patient_id,
      visit_type,
      chief_complaint,
      visit_notes,
      vitals,
      diagnosis,
      treatment_plan,
      duration_minutes,
      created_at
    ) VALUES (
      ${appointmentId},
      ${doctorId},
      ${patientId},
      ${visit_type},
      ${chief_complaint || ""},
      ${visit_notes || ""},
      ${vitals ? JSON.stringify(vitals) : null},
      ${diagnosis || ""},
      ${treatment_plan || ""},
      ${duration_minutes},
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  return visit[0];
}

/**
 * Get visit by ID
 */
export async function getVisitById(visitId) {
  const visit = await sql`
    SELECT * FROM visits
    WHERE id = ${visitId}
  `;

  if (visit.length === 0) {
    throw new Error("Visit not found");
  }

  return visit[0];
}

/**
 * Get patient visits
 */
export async function getPatientVisits(patientId) {
  const visits = await sql`
    SELECT 
      v.*,
      u.name as doctor_name
    FROM visits v
    LEFT JOIN users u ON v.doctor_id = u.id
    WHERE v.patient_id = ${patientId}
    ORDER BY v.created_at DESC
  `;

  return visits;
}

/**
 * Get doctor visits
 */
export async function getDoctorVisits(doctorId, date = null) {
  let query = sql`
    SELECT 
      v.*,
      u.name as patient_name
    FROM visits v
    LEFT JOIN users u ON v.patient_id = u.id
    WHERE v.doctor_id = ${doctorId}
  `;

  if (date) {
    query += ` AND DATE(v.created_at) = ${date}`;
  }

  query += ` ORDER BY v.created_at DESC`;

  const visits = await sql`
    SELECT 
      v.*,
      u.name as patient_name
    FROM visits v
    LEFT JOIN users u ON v.patient_id = u.id
    WHERE v.doctor_id = ${doctorId}
    ${date ? sql`AND DATE(v.created_at) = ${date}` : sql``}
    ORDER BY v.created_at DESC
  `;

  return visits;
}

/**
 * Update visit
 */
export async function updateVisit(visitId, doctorId, updates) {
  const visit = await sql`
    UPDATE visits
    SET 
      visit_type = COALESCE(${updates.visit_type}, visit_type),
      chief_complaint = COALESCE(${updates.chief_complaint}, chief_complaint),
      visit_notes = COALESCE(${updates.visit_notes}, visit_notes),
      diagnosis = COALESCE(${updates.diagnosis}, diagnosis),
      treatment_plan = COALESCE(${updates.treatment_plan}, treatment_plan),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${visitId} AND doctor_id = ${doctorId}
    RETURNING *
  `;

  if (visit.length === 0) {
    throw new Error("Visit not found or unauthorized");
  }

  return visit[0];
}
