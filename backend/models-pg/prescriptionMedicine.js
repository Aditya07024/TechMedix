import sql from "../config/database.js";

export async function saveMedicines(prescriptionId, medicines) {
  const saved = [];

  for (const m of medicines) {
    const result = await sql`
      INSERT INTO prescription_medicines (
        prescription_id,
        medicine_name,
        dosage,
        frequency,
        duration,
        instructions,
        confidence,
        created_at
      )
      VALUES (
        ${prescriptionId},
        ${m.medicine_name},
        ${m.dosage},
        ${m.frequency},
        ${m.duration},
        ${m.instructions},
        ${m.confidence || null},
        NOW()
      )
      RETURNING *
    `;

    saved.push(result[0]);
  }

  return saved;
}