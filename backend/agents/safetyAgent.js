import sql from "../config/database.js";
import { createSafetyReport } from "../models-pg/SafetyReport.js";
import { createSafetyWarning } from "../models-pg/SafetyWarning.js";

export async function runSafetyAgent({ prescriptionId, userId }) {
  const medicines = await sql`
    SELECT medicine_name
    FROM prescription_medicines
    WHERE prescription_id = ${prescriptionId}
  `;

  const names = medicines.map(m => m.medicine_name);

  const interactions = await sql`
    SELECT *
    FROM drug_interactions
    WHERE medicine_a = ANY(${names})
       OR medicine_b = ANY(${names})
  `;

  const report = await createSafetyReport({
    prescriptionId,
    userId,
    totalWarnings: interactions.length,
    riskLevel: interactions.some(i => i.severity === 'critical')
      ? 'critical'
      : interactions.length > 0 ? 'medium' : 'low'
  });

  for (const i of interactions) {
    await createSafetyWarning({
      reportId: report.id,
      type: 'interaction',
      severity: i.severity,
      med1: i.medicine_a,
      med2: i.medicine_b,
      description: i.description,
      recommendation: i.recommendation,
      source: i.source
    });
  }

  return report;
}