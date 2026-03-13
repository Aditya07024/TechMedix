import sql from "../config/database.js";

/*
  CREATE REPORT
*/
export const createReport = async (data) => {
  const result = await sql`
    INSERT INTO reports (
      user_id,
      file_path,
      file_name,
      file_type,
      ai_report,
      created_at,
      is_deleted
    )
    VALUES (
      ${data.userId},
      ${data.filePath},
      ${data.fileName},
      ${data.fileType},
      ${data.aiReport},
      NOW(),
      FALSE
    )
    RETURNING *
  `;
  return result[0];
};


/*
  GET REPORT BY ID
*/
export const getReportById = async (id) => {
  const result = await sql`
    SELECT *
    FROM reports
    WHERE id = ${id}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};


/*
  GET REPORTS BY USER
*/
export const getReportsByUserId = async (userId) => {
  return await sql`
    SELECT *
    FROM reports
    WHERE user_id = ${userId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};


/*
  ADMIN VIEW
*/
export const getAllReports = async () => {
  return await sql`
    SELECT *
    FROM reports
    WHERE is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};


/*
  SAFE UPDATE
*/
export const updateReport = async (id, data) => {
  const result = await sql`
    UPDATE reports
    SET file_path = COALESCE(${data.filePath}, file_path),
        file_name = COALESCE(${data.fileName}, file_name),
        file_type = COALESCE(${data.fileType}, file_type),
        ai_report = COALESCE(${data.aiReport}, ai_report),
        updated_at = NOW()
    WHERE id = ${id}
      AND is_deleted = FALSE
    RETURNING *
  `;

  return result.length ? result[0] : null;
};


/*
  SOFT DELETE
*/
export const deleteReport = async (id) => {
  const result = await sql`
    UPDATE reports
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length ? result[0] : null;
};