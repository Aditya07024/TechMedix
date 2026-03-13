import sql from "../config/database.js";

/*
  CREATE OR UPDATE SAFETY REPORT
*/
export const createSafetyReport = async (data) => {
  try {
    const result = await sql`
      INSERT INTO safety_reports (
        prescription_id,
        user_id,
        total_warnings,
        risk_level,
        created_at
      )
      VALUES (
        ${data.prescription_id},
        ${data.user_id || null},
        ${data.total_warnings || 0},
        ${data.risk_level},
        NOW()
      )
      ON CONFLICT (prescription_id)
      DO UPDATE SET
        total_warnings = EXCLUDED.total_warnings,
        risk_level = EXCLUDED.risk_level,
        updated_at = NOW()
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Create safety report failed:", error);
    return null;
  }
};


/*
  GET SAFETY REPORT (Soft Delete Safe)
*/
export const getSafetyReportByPrescription = async (prescriptionId) => {
  try {
    const result = await sql`
      SELECT sr.*
      FROM safety_reports sr
      JOIN prescriptions p ON sr.prescription_id = p.id
      WHERE sr.prescription_id = ${prescriptionId}
        AND p.is_deleted = FALSE
      LIMIT 1
    `;

    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Fetch safety report failed:", error);
    return null;
  }
};