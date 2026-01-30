import sql from "../config/database.js";

export const createSafetyReport = async (data) => {
  const res = await sql`
    INSERT INTO safety_reports (
      prescription_id, user_id, total_warnings, risk_level
    )
    VALUES (
      ${data.prescription_id},
      ${data.user_id},
      ${data.total_warnings},
      ${data.risk_level}
    )
    RETURNING *
  `;
  return res[0];
};

export const getSafetyReportByPrescription = async (prescriptionId) => {
  const res = await sql`
    SELECT * FROM safety_reports
    WHERE prescription_id = ${prescriptionId}
  `;
  return res[0];
};
