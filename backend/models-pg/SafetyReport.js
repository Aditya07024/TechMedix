import sql from "../config/database.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
  CREATE SAFETY REPORT
*/
export const createSafetyReport = async (data) => {
  try {
    const userIdOrNull =
      data.userId && UUID_REGEX.test(String(data.userId).trim())
        ? data.userId
        : null;

    const result = await sql`
      INSERT INTO safety_reports (
        prescription_id,
        user_id,
        total_warnings,
        risk_level,
        created_at,
        is_deleted
      )
      VALUES (
        ${data.prescriptionId},
        ${userIdOrNull},
        ${data.totalWarnings},
        ${data.riskLevel},
        NOW(),
        FALSE
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Create safety report failed:", error);
    return null;
  }
};


/*
  GET BY PRESCRIPTION
*/
export const getSafetyReportByPrescription = async (prescriptionId) => {
  const result = await sql`
    SELECT *
    FROM safety_reports
    WHERE prescription_id = ${prescriptionId}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};


/*
  SOFT DELETE (Future proof)
*/
export const deleteSafetyReport = async (id) => {
  const result = await sql`
    UPDATE safety_reports
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length ? result[0] : null;
};