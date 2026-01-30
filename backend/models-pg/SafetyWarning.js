import sql from "../config/database.js";

export const createSafetyWarning = async (w) => {
  const [row] = await sql`
    INSERT INTO safety_warnings
    (safety_report_id, warning_type, severity,
     medicine_1, medicine_2, description,
     recommendation, source)
    VALUES (
      ${w.reportId},
      ${w.type},
      ${w.severity},
      ${w.med1},
      ${w.med2},
      ${w.description},
      ${w.recommendation},
      ${w.source}
    )
    RETURNING *
  `;
  return row;
};