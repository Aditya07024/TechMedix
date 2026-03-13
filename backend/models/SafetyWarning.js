import sql from "../config/database.js";

const allowedSeverity = ["low", "medium", "high", "critical"];

/*
  ADD SAFETY WARNING
*/
export const addSafetyWarning = async (data) => {
  try {
    if (!allowedSeverity.includes(data.severity)) {
      throw new Error("Invalid severity level");
    }

    const result = await sql`
      INSERT INTO safety_warnings (
        safety_report_id,
        warning_type,
        severity,
        medicine_1,
        medicine_2,
        description,
        recommendation,
        source,
        created_at
      )
      VALUES (
        ${data.safety_report_id},
        ${data.warning_type},
        ${data.severity},
        ${data.medicine_1 || null},
        ${data.medicine_2 || null},
        ${data.description},
        ${data.recommendation || null},
        ${data.source || null},
        NOW()
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Add safety warning failed:", error);
    return null;
  }
};


/*
  GET WARNINGS BY REPORT (Soft Delete Safe)
*/
export const getWarningsByReport = async (reportId) => {
  try {
    return await sql`
      SELECT sw.*
      FROM safety_warnings sw
      JOIN safety_reports sr ON sw.safety_report_id = sr.id
      JOIN prescriptions p ON sr.prescription_id = p.id
      WHERE sw.safety_report_id = ${reportId}
        AND p.is_deleted = FALSE
      ORDER BY 
        CASE sw.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `;
  } catch (error) {
    console.error("Fetch safety warnings failed:", error);
    return [];
  }
};