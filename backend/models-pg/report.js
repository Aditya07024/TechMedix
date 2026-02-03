import sql from "../config/database.js";

export const createReport = async (reportData) => {
  const { userId, filePath, fileName, fileType, aiReport } = reportData;

  const result = await sql`
    INSERT INTO reports (user_id, file_path, file_name, file_type, ai_report)
    VALUES (${userId}, ${filePath}, ${fileName}, ${fileType}, ${aiReport})
    RETURNING *
  `;
  return result[0];
};

export const getReportById = async (id) => {
  const result = await sql`
    SELECT * FROM reports WHERE id = ${id}
  `;
  return result[0];
};

export const getReportsByUserId = async (userId) => {
  const result = await sql`
    SELECT * FROM reports WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return result;
};

export const getAllReports = async () => {
  const result = await sql`
    SELECT * FROM reports ORDER BY created_at DESC
  `;
  return result;
};

export const updateReport = async (id, reportData) => {
  const fields = [];
  const values = [];
  let index = 0;

  Object.entries(reportData).forEach(([key, value]) => {
    if (value !== undefined && key !== "id") {
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      fields.push(`${dbKey} = $${++index}`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    return getReportById(id);
  }

  values.push(id);
  const query = `UPDATE reports SET ${fields.join(", ")} WHERE id = $${++index} RETURNING *`;

  const result = await sql(query, values);
  return result[0];
};

export const deleteReport = async (id) => {
  const result = await sql`
    DELETE FROM reports WHERE id = ${id} RETURNING id
  `;
  return result[0];
};
