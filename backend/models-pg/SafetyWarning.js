import sql from "../config/database.js";

/*
  CREATE SAFETY WARNING
*/
export const createSafetyWarning = async (w) => {
  try {
    const normalizedSeverity = (w.severity || "").toLowerCase();

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
        created_at,
        is_deleted
      )
      VALUES (
        ${w.reportId},
        ${w.type},
        ${normalizedSeverity},
        ${w.med1},
        ${w.med2},
        ${w.description},
        ${w.recommendation},
        ${w.source},
        NOW(),
        FALSE
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Create safety warning failed:", error);
    return null;
  }
};


/*
  GET WARNINGS BY REPORT
*/
export const getWarningsByReport = async (reportId) => {
  return await sql`
    SELECT *
    FROM safety_warnings
    WHERE safety_report_id = ${reportId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};


/*
  SOFT DELETE WARNING
*/
export const deleteSafetyWarning = async (id) => {
  const result = await sql`
    UPDATE safety_warnings
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length ? result[0] : null;
};