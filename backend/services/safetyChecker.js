import sql from "../config/database.js";

/**
 * Check disease-medicine conflict
 */
export async function checkDiseaseConflict(patientId, medicines) {
  const diseases = await sql`
    SELECT disease_name FROM patient_diseases
    WHERE patient_id = ${patientId} AND is_active = true
  `;

  if (diseases.length === 0) return [];

  const conflicts = [];
  for (const medicine of medicines) {
    const result = await sql`
      SELECT * FROM disease_medicine_conflicts
      WHERE disease_name = ANY(${diseases.map((d) => d.disease_name)})
        AND LOWER(medicine_name) = LOWER(${medicine.name})
      ORDER BY severity DESC
    `;
    conflicts.push(...result);
  }

  return conflicts;
}

/**
 * Check drug-drug interaction
 */
export async function checkDrugDrugInteraction(medicines) {
  if (!medicines || medicines.length < 2) return [];

  const interactions = [];

  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const result = await sql`
        SELECT * FROM medicine_conflicts
        WHERE (
          (LOWER(medicine_a) = LOWER(${medicines[i].name}) AND LOWER(medicine_b) = LOWER(${medicines[j].name}))
          OR
          (LOWER(medicine_a) = LOWER(${medicines[j].name}) AND LOWER(medicine_b) = LOWER(${medicines[i].name}))
        )
        LIMIT 1
      `;
      if (result.length > 0) {
        interactions.push(result[0]);
      }
    }
  }

  return interactions;
}
