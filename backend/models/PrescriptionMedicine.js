import sql from "../config/database.js";

/*
  ADD MEDICINE TO PRESCRIPTION
*/
export const addPrescriptionMedicine = async (data) => {
  try {
    const result = await sql`
      INSERT INTO prescription_medicines (
        prescription_id,
        medicine_name,
        dosage,
        frequency,
        duration,
        instructions
      )
      VALUES (
        ${data.prescription_id},
        ${data.medicine_name},
        ${data.dosage},
        ${data.frequency},
        ${data.duration},
        ${data.instructions || null}
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Add prescription medicine failed:", error);
    return null;
  }
};


/*
  GET MEDICINES BY PRESCRIPTION (Soft Delete Safe)
*/
export const getMedicinesByPrescription = async (prescriptionId) => {
  try {
    return await sql`
      SELECT pm.*
      FROM prescription_medicines pm
      JOIN prescriptions p ON pm.prescription_id = p.id
      WHERE pm.prescription_id = ${prescriptionId}
        AND p.is_deleted = FALSE
    `;
  } catch (error) {
    console.error("Fetch prescription medicines failed:", error);
    return [];
  }
};