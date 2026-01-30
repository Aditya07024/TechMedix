import sql from "../config/database.js";

export const addSafetyWarning = async (data) => {
  const res = await sql`
    INSERT INTO safety_warnings (
      safety_report_id, warning_type, severity,
      medicine_1, medicine_2, description,
      recommendation, source
    )
    VALUES (
      ${data.safety_report_id},
      ${data.warning_type},
      ${data.severity},
      ${data.medicine_1},
      ${data.medicine_2},
      ${data.description},
      ${data.recommendation},
      ${data.source}
    )
    RETURNING *
  `;
  return res[0];
};

export const getWarningsByReport = async (reportId) => {
  return await sql`
    SELECT * FROM safety_warnings
    WHERE safety_report_id = ${reportId}
  `;
};