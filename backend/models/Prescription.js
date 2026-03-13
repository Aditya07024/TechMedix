import sql from "../config/database.js";

/*
  CREATE PRESCRIPTION
*/
export const createPrescription = async (data) => {
  try {
    const result = await sql`
      INSERT INTO prescriptions (
        user_id_int,
        patient_id,
        image_url,
        extracted_text,
        status,
        uploaded_at
      )
      VALUES (
        ${data.user_id_int},
        ${data.patient_id},
        ${data.image_url},
        ${data.extracted_text || null},
        'processing',
        NOW()
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Create prescription failed:", error);
    return null;
  }
};


/*
  GET PRESCRIPTIONS BY USER (Soft Delete Safe)
*/
export const getPrescriptionsByUser = async (userId) => {
  try {
    return await sql`
      SELECT *
      FROM prescriptions
      WHERE user_id_int = ${userId}
        AND is_deleted = FALSE
      ORDER BY uploaded_at DESC
    `;
  } catch (error) {
    console.error("Fetch prescriptions failed:", error);
    return [];
  }
};