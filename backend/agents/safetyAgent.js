import sql from "../config/database.js";
import { createSafetyReport } from "../models-pg/SafetyReport.js";
import { createSafetyWarning } from "../models-pg/SafetyWarning.js";
import { analyzeInteractionAI } from "../services/aiInteractionAnalyzer.js";

/**
 * Agent-2: Safety Verification Agent
 */
export async function runSafetyAgent({ prescriptionId, userId }) {
  if (!prescriptionId) throw new Error("prescriptionId missing");
  if (!userId) throw new Error("userId missing");

  /* ───── LOAD MEDICINES (FROM AGENT-1 OUTPUT) ───── */
  const medicines = await sql`
    SELECT medicine_name, dosage
    FROM prescription_medicines
    WHERE prescription_id = ${prescriptionId}
  `;

  if (medicines.length === 0) {
    throw new Error("No medicines found for safety check");
  }

  const warnings = [];

  /* ───── GENERATE PAIRS + CHECK ───── */
  for (let i = 0; i < medicines.length; i++) {
    const a = medicines[i].medicine_name;
    for (let j = i + 1; j < medicines.length; j++) {
      const b = medicines[j].medicine_name;

      /* ───── FAST DB CHECK ───── */
      const dbResult = await sql`
        SELECT *
        FROM drug_interactions
        WHERE 
          (medicine_a = ${a} AND medicine_b = ${b})
          OR
          (medicine_a = ${b} AND medicine_b = ${a})
      `;

      if (dbResult.length > 0) {
        const dbRow = dbResult[0];

        warnings.push({
          type: "interaction",
          severity: dbRow.severity,
          medicine_1: dbRow.medicine_a,
          medicine_2: dbRow.medicine_b,
          description: dbRow.description,
          mechanism: dbRow.mechanism,
          recommendation: dbRow.recommendation,
          source: "database",
          confidence: 1.0
        });

        continue;
      }

      /* ───── AI FALLBACK (SMART LAYER) ───── */
      const aiResult = await analyzeInteractionAI(a, b);

      if (aiResult.interaction_found) {
        // save for future learning
        await sql`
          INSERT INTO drug_interactions (
            medicine_a,
            medicine_b,
            severity,
            description,
            mechanism,
            recommendation,
            source
          )
          VALUES (
            ${a},
            ${b},
            ${aiResult.severity},
            ${aiResult.description},
            ${aiResult.mechanism},
            ${aiResult.recommendation},
            'ai'
          )
        `;

        warnings.push({
          type: "interaction",
          severity: aiResult.severity,
          medicine_1: a,
          medicine_2: b,
          description: aiResult.description,
          mechanism: aiResult.mechanism,
          recommendation: aiResult.recommendation,
          source: "ai",
          confidence: aiResult.confidence
        });
      }
    }
  }

  /* ───── CALCULATE OVERALL RISK ───── */
  let riskLevel = "safe";

  if (warnings.some(w => w.severity === "critical")) {
    riskLevel = "critical";
  } else if (warnings.some(w => w.severity === "high")) {
    riskLevel = "high";
  } else if (warnings.length > 0) {
    riskLevel = "medium";
  }

  /* ───── CREATE SAFETY REPORT ───── */
  const report = await createSafetyReport({
    prescriptionId,
    userId,
    totalWarnings: warnings.length,
    riskLevel
  });

  /* ───── SAVE WARNINGS ───── */
  for (const w of warnings) {
    await createSafetyWarning({
      reportId: report.id,
      type: w.type,
      severity: w.severity,
      med1: w.medicine_1,
      med2: w.medicine_2,
      description: w.description,
      mechanism: w.mechanism,
      recommendation: w.recommendation,
      source: w.source,
      confidence: w.confidence
    });
  }

  /* ───── FINAL RESPONSE ───── */
  return {
    success: true,
    prescription_id: prescriptionId,
    total_warnings: warnings.length,
    risk_level: riskLevel,
    safe_to_proceed: riskLevel === "safe",
    requires_doctor_consultation: ["high", "critical"].includes(riskLevel),
    warnings
  };
}