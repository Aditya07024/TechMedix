import sql from "../config/database.js";

export const createMedicalScan = async ({
  patientId,
  scanType,
  fileUrl,
  prediction,
  confidence,
  heatmapUrl,
  all_diagnostics,
}) => {
  const rows = await sql`
    INSERT INTO medical_scans (
      patient_id, scan_type, file_url, prediction, confidence, heatmap_url, all_diagnostics
    ) VALUES (
      ${patientId}, ${scanType}, ${fileUrl}, ${prediction}, ${confidence}, ${heatmapUrl}, ${JSON.stringify(all_diagnostics || {})}
    ) RETURNING *
  `;
  return rows[0];
};

export const getMedicalScansByPatient = async (patientId) => {
  return await sql`
    SELECT * FROM medical_scans
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
  `;
};

export const getMedicalScanById = async (id) => {
  const rows = await sql`
    SELECT * FROM medical_scans WHERE id = ${id}
  `;
  return rows[0] || null;
};

