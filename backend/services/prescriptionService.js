import sql from "../config/database.js";
import { emitUserNotification } from "../socket/socketServer.js";
import { logAudit } from "./auditService.js";

/**
 * Create a new prescription with medicines
 */
export async function createPrescription(data) {
  const {
    visit_id,
    appointment_id,
    doctor_id,
    patient_id,
    medicines,
    special_instructions,
    audio_url,
  } = data;

  // Create main prescription
  const prescription = await sql`
    INSERT INTO prescriptions (
      visit_id,
      appointment_id,
      doctor_id,
      patient_id,
      medicine_name,
      dosage,
      frequency,
      duration_days,
      special_instructions,
      audio_url,
      created_at
    ) VALUES (
      ${visit_id},
      ${appointment_id},
      ${doctor_id},
      ${patient_id},
      ${medicines[0]?.name || "Multiple medicines"},
      ${medicines[0]?.dosage || ""},
      ${medicines[0]?.frequency || ""},
      ${medicines[0]?.duration_days || 30},
      ${special_instructions || ""},
      ${audio_url || ""},
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  // Add medicines if multiple
  if (medicines.length > 1) {
    for (const medicine of medicines) {
      await sql`
        INSERT INTO prescription_medicines (
          prescription_id,
          medicine_name,
          dosage,
          frequency,
          duration_days,
          generic_name,
          created_at
        ) VALUES (
          ${prescription[0].id},
          ${medicine.name},
          ${medicine.dosage},
          ${medicine.frequency},
          ${medicine.duration_days},
          ${medicine.generic_name || ""},
          CURRENT_TIMESTAMP
        )
      `;
    }
  }

  return prescription[0];
}

/**
 * Get prescription by ID with security check
 */
export async function getPrescriptionById(prescriptionId) {
  const prescription = await sql`
    SELECT 
      p.*,
      u_doctor.name as doctor_name,
      u_patient.name as patient_name,
      json_agg(json_build_object(
        'id', pm.id,
        'name', pm.medicine_name,
        'dosage', pm.dosage,
        'frequency', pm.frequency,
        'duration_days', pm.duration_days,
        'generic_name', pm.generic_name
      )) as medicines
    FROM prescriptions p
    LEFT JOIN users u_doctor ON p.doctor_id = u_doctor.id
    LEFT JOIN users u_patient ON p.patient_id = u_patient.id
    LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
    WHERE p.id = ${prescriptionId}
    GROUP BY p.id, u_doctor.name, u_patient.name
  `;

  if (prescription.length === 0) {
    throw new Error("Prescription not found");
  }

  return prescription[0];
}

/**
 * Get prescriptions by patient
 */
export async function getPrescriptionsByPatient(patientId) {
  const prescriptions = await sql`
    SELECT 
      p.id,
      p.medicine_name,
      p.dosage,
      p.frequency,
      p.duration_days,
      p.created_at,
      p.expires_at,
      p.is_completed,
      p.refill_count,
      p.max_refills,
      u.name as doctor_name,
      CASE 
        WHEN p.expires_at < CURRENT_TIMESTAMP THEN 'expired'
        WHEN p.is_completed THEN 'completed'
        ELSE 'active'
      END as status
    FROM prescriptions p
    LEFT JOIN users u ON p.doctor_id = u.id
    WHERE p.patient_id = ${patientId}
    ORDER BY p.created_at DESC
  `;

  return prescriptions;
}

/**
 * Get prescriptions by doctor
 */
export async function getPrescriptionsByDoctor(doctorId) {
  const prescriptions = await sql`
    SELECT 
      p.id,
      p.patient_id,
      p.medicine_name,
      p.created_at,
      p.expires_at,
      u.name as patient_name,
      CASE 
        WHEN p.expires_at < CURRENT_TIMESTAMP THEN 'expired'
        WHEN p.is_completed THEN 'completed'
        ELSE 'active'
      END as status
    FROM prescriptions p
    LEFT JOIN users u ON p.patient_id = u.id
    WHERE p.doctor_id = ${doctorId}
    ORDER BY p.created_at DESC
  `;

  return prescriptions;
}

/**
 * Update prescription with override
 */
export async function updatePrescriptionOverride(
  prescriptionId,
  doctorId,
  overrideReason,
) {
  if (!overrideReason || typeof overrideReason !== "string") {
    throw new Error("Override reason required");
  }

  const prescription = await sql`
    UPDATE prescriptions
    SET 
      override_flag = true,
      override_reason = ${overrideReason},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${prescriptionId}
      AND doctor_id = ${doctorId}
    RETURNING *
  `;

  if (prescription.length === 0) {
    throw new Error("Prescription not found or unauthorized");
  }

  return prescription[0];
}

/**
 * Request refill for prescription
 */
export async function requestRefill(prescriptionId, patientId) {
  const prescription = await sql`
    SELECT * FROM prescriptions
    WHERE id = ${prescriptionId}
      AND patient_id = ${patientId}
  `;

  if (prescription.length === 0) {
    throw new Error("Prescription not found");
  }

  if (prescription[0].refill_count >= prescription[0].max_refills) {
    throw new Error("Maximum refills exceeded");
  }

  if (prescription[0].is_completed) {
    throw new Error("Cannot refill completed prescription");
  }

  const refilled = await sql`
    UPDATE prescriptions
    SET 
      refill_count = refill_count + 1,
      expires_at = CURRENT_TIMESTAMP + (duration_days || 30 || ' days')::INTERVAL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${prescriptionId}
    RETURNING *
  `;

  // Create notification for doctor
  const notification = await sql`
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_entity_id,
      related_entity_type,
      created_at
    ) VALUES (
      ${prescription[0].doctor_id},
      'refill_request',
      'Prescription Refill Requested',
      'Patient requested refill for ' || (SELECT medicine_name FROM prescriptions WHERE id = ${prescriptionId}),
      ${prescriptionId},
      'prescription',
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  if (notification[0]) {
    emitUserNotification(prescription[0].doctor_id, notification[0]);
  }

  return refilled[0];
}

/**
 * Mark prescription as completed
 */
export async function completePrescription(prescriptionId) {
  const prescription = await sql`
    UPDATE prescriptions
    SET 
      is_completed = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${prescriptionId}
    RETURNING *
  `;

  if (prescription.length === 0) {
    throw new Error("Prescription not found");
  }

  return prescription[0];
}

/**
 * Get expired prescriptions for a patient
 */
export async function getExpiredPrescriptions(patientId) {
  const prescriptions = await sql`
    SELECT 
      id,
      medicine_name,
      dosage,
      refill_count,
      max_refills,
      expires_at
    FROM prescriptions
    WHERE patient_id = ${patientId}
      AND expires_at < CURRENT_TIMESTAMP
      AND is_completed = false
      AND refill_count < max_refills
    ORDER BY expires_at DESC
  `;

  return prescriptions;
}

/**
 * Search prescriptions
 */
export async function searchPrescriptions(patientId, query) {
  const prescriptions = await sql`
    SELECT 
      p.id,
      p.medicine_name,
      p.dosage,
      p.created_at,
      u.name as doctor_name
    FROM prescriptions p
    LEFT JOIN users u ON p.doctor_id = u.id
    WHERE p.patient_id = ${patientId}
      AND (
        p.medicine_name ILIKE ${"%" + query + "%"}
        OR p.dosage ILIKE ${"%" + query + "%"}
        OR u.name ILIKE ${"%" + query + "%"}
      )
    ORDER BY p.created_at DESC
  `;

  return prescriptions;
}
