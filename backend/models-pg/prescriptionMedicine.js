import sql from "../config/database.js";

export async function saveMedicines(prescriptionId, medicines) {
  const saved = [];

  for (const m of medicines) {
    const [row] = await sql`
      INSERT INTO medicines
      (prescription_id, medicine_name, dosage, frequency, duration, instructions, confidence)
      VALUES (
        ${prescriptionId},
        ${m.medicine_name},
        ${m.dosage},
        ${m.frequency},
        ${m.duration},
        ${m.instructions},
        ${m.confidence}
      )
      RETURNING *
    `;
    saved.push(row);
  }
  return saved;
}