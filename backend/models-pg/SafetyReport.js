import sql from "../config/database.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createSafetyReport = async (data) => {
  // user_id expects UUID (users table); auth uses patients table (integer IDs).
  // Pass null when userId is not a valid UUID (e.g. patient id).
  const userIdOrNull =
    data.userId && UUID_REGEX.test(String(data.userId).trim())
      ? data.userId
      : null;

  const [row] = await sql`
    INSERT INTO safety_reports
    (prescription_id, user_id, total_warnings, risk_level)
    VALUES (
      ${data.prescriptionId},
      ${userIdOrNull},
      ${data.totalWarnings},
      ${data.riskLevel}
    )
    RETURNING *
  `;
  return row;
};