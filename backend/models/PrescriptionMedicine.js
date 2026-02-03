import sql from "../config/database.js";

export const addPrescriptionMedicine = async (data) => {
  const res = await sql`
    INSERT INTO prescription_medicines (
      prescription_id, medicine_name, dosage,
      frequency, duration, instructions
    )
    VALUES (
      ${data.prescription_id},
      ${data.medicine_name},
      ${data.dosage},
      ${data.frequency},
      ${data.duration},
      ${data.instructions}
    )
    RETURNING *
  `;
  return res[0];
};

export const getMedicinesByPrescription = async (prescriptionId) => {
  return await sql`
    SELECT * FROM prescription_medicines
    WHERE prescription_id = ${prescriptionId}
  `;
};