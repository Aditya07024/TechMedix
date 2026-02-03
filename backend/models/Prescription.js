import sql from "../config/database.js";

export const createPrescription = async (data) => {
  const res = await sql`
    INSERT INTO prescriptions (user_id, image_url, extracted_text, status)
    VALUES (${data.user_id}, ${data.image_url}, ${data.extracted_text}, 'processing')
    RETURNING *
  `;
  return res[0];
};

export const getPrescriptionsByUser = async (userId) => {
  return await sql`
    SELECT * FROM prescriptions
    WHERE user_id = ${userId}
    ORDER BY uploaded_at DESC
  `;
};