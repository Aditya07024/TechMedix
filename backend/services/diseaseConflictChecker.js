import sql from "../config/database.js";

export async function checkDiseaseConflicts(prescriptionId) {

  // 1️⃣ Get patient ID
  const prescription = await sql`
    SELECT patient_id
    FROM prescriptions
    WHERE id = ${prescriptionId}
      AND COALESCE(is_deleted, false) = false
  `;

  if (!prescription.length) return [];

  const patientId = prescription[0].patient_id;

  // 2️⃣ Get patient diseases
  const diseases = await sql`
    SELECT disease_name
    FROM patient_diseases
    WHERE patient_id = ${patientId}
  `;

  if (!diseases.length) return [];

  // 3️⃣ Get prescribed medicines
  const medicines = await sql`
    SELECT medicine_name
    FROM prescription_medicines
    WHERE prescription_id = ${prescriptionId}
      AND COALESCE(is_deleted, false) = false
  `;

  if (!medicines.length) return [];

  const alerts = [];

  const diseaseNames = diseases.map(d => d.disease_name.toLowerCase());
  const medicineNames = medicines.map(m => m.medicine_name.toLowerCase());

  const conflicts = await sql`
    SELECT *
    FROM medicine_disease_conflicts
    WHERE LOWER(medicine_name) = ANY(${medicineNames})
      AND LOWER(disease_name) = ANY(${diseaseNames})
  `;

  for (const conflict of conflicts) {
    alerts.push({
      type: "disease_conflict",
      severity: conflict.severity,
      message: conflict.description ||
        `${conflict.medicine_name} may be risky for ${conflict.disease_name}`
    });
  }

  return alerts;
}