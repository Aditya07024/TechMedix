

import sql from "../config/database.js";

// ===== Admin Dashboard Stats =====
export const getAdminStats = async () => {
  const [patients] = await sql`
    SELECT COUNT(*)::int AS count FROM patients WHERE COALESCE(is_deleted, false) = false
  `;

  const [doctors] = await sql`
    SELECT COUNT(*)::int AS count FROM doctors WHERE COALESCE(is_deleted, false) = false
  `;

  const [appointments] = await sql`
    SELECT COUNT(*)::int AS count FROM appointments WHERE COALESCE(is_deleted, false) = false
  `;

  const [prescriptions] = await sql`
    SELECT COUNT(*)::int AS count FROM prescriptions WHERE COALESCE(is_deleted, false) = false
  `;

  return {
    totalPatients: patients.count,
    totalDoctors: doctors.count,
    totalAppointments: appointments.count,
    totalPrescriptions: prescriptions.count,
  };
};

// ===== Soft Delete Doctor =====
export const softDeleteDoctor = async (doctorId, adminId) => {
  const [updated] = await sql`
    UPDATE doctors
    SET is_deleted = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${doctorId}
    RETURNING id
  `;

  if (updated) {
    await logAdminAction(adminId, "doctor_soft_delete", "doctors", doctorId);
  }

  return updated;
};

// ===== Soft Delete Patient =====
export const softDeletePatient = async (patientId, adminId) => {
  const [updated] = await sql`
    UPDATE patients
    SET is_deleted = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${patientId}
    RETURNING id
  `;

  if (updated) {
    await logAdminAction(adminId, "patient_soft_delete", "patients", patientId);
  }

  return updated;
};

// ===== Admin Audit Log =====
export const logAdminAction = async (adminId, action, tableName, recordId) => {
  await sql`
    INSERT INTO audit_logs (
      actor_id,
      actor_role,
      action,
      table_name,
      record_id,
      created_at
    )
    VALUES (
      ${adminId},
      'admin',
      ${action},
      ${tableName},
      ${recordId},
      CURRENT_TIMESTAMP
    )
  `;
};

// ===== Get Audit Logs =====
export const getAuditLogs = async (limit = 50) => {
  return await sql`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
};