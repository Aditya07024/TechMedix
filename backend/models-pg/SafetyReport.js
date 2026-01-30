import sql from "../config/database.js";

export const createSafetyReport = async (data) => {
  const [row] = await sql`
    INSERT INTO safety_reports
    (prescription_id, user_id, total_warnings, risk_level)
    VALUES (
      ${data.prescriptionId},
      ${data.userId},
      ${data.totalWarnings},
      ${data.riskLevel}
    )
    RETURNING *
  `;
  return row;
};