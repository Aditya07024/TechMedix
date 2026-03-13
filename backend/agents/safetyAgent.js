export async function runSafetyAgent({ prescriptionId, userId }) {
  if (!prescriptionId) throw new Error("prescriptionId missing");
  if (!userId) throw new Error("userId missing");

  return await sql.begin(async (tx) => {

    /* ───── VALIDATE PRESCRIPTION ───── */
    const exists = await tx`
      SELECT id
      FROM prescriptions
      WHERE id = ${prescriptionId}
        AND is_deleted IS NOT TRUE
    `;

    if (!exists.length) {
      throw new Error("Prescription not found");
    }

    /* ───── PREVENT DUPLICATE REPORT ───── */
    const existingReport = await tx`
      SELECT id FROM safety_reports
      WHERE prescription_id = ${prescriptionId}
      LIMIT 1
    `;

    if (existingReport.length) {
      return {
        success: true,
        message: "Safety report already exists"
      };
    }

    /* ───── LOAD MEDICINES ───── */
    const medicines = await tx`
      SELECT medicine_name, dosage
      FROM prescription_medicines
      WHERE prescription_id = ${prescriptionId}
    `;

    if (!medicines.length) {
      throw new Error("No medicines found for safety check");
    }

    const warnings = [];

    /* ───── GENERATE PAIRS + CHECK ───── */
    for (let i = 0; i < medicines.length; i++) {
      const a = medicines[i].medicine_name;

      for (let j = i + 1; j < medicines.length; j++) {
        const b = medicines[j].medicine_name;

        /* ───── FAST DB CHECK ───── */
        const dbResult = await tx`
          SELECT *
          FROM drug_interactions
          WHERE 
            (medicine_a = ${a} AND medicine_b = ${b})
            OR
            (medicine_a = ${b} AND medicine_b = ${a})
          LIMIT 1
        `;

        if (dbResult.length) {
          const dbRow = dbResult[0];

          warnings.push({
            type: "interaction",
            severity: dbRow.severity,
            medicine_1: dbRow.medicine_a,
            medicine_2: dbRow.medicine_b,
            description: dbRow.description,
            mechanism: dbRow.mechanism,
            recommendation: dbRow.recommendation,
            source: dbRow.source || "database",
            confidence: 1.0
          });

          continue;
        }

        /* ───── AI FALLBACK ───── */
        let aiResult = null;

        try {
          aiResult = await analyzeInteractionAI(a, b);
        } catch (err) {
          console.error("AI interaction check failed:", err.message);
          continue; // fail-safe, do not crash
        }

        if (aiResult?.interaction_found) {

          /* Prevent duplicate AI learning */
          const alreadyStored = await tx`
            SELECT id FROM drug_interactions
            WHERE 
              (medicine_a = ${a} AND medicine_b = ${b})
              OR
              (medicine_a = ${b} AND medicine_b = ${a})
            LIMIT 1
          `;

          if (!alreadyStored.length) {
            await tx`
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
          }

          warnings.push({
            type: "interaction",
            severity: aiResult.severity,
            medicine_1: a,
            medicine_2: b,
            description: aiResult.description,
            mechanism: aiResult.mechanism,
            recommendation: aiResult.recommendation,
            source: "ai",
            confidence: aiResult.confidence ?? 0.85
          });
        }
      }
    }

    /* ───── RISK CALCULATION ───── */
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

    /* ───── AUDIT LOG ───── */
    await tx`
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        created_at
      )
      VALUES (
        ${userId},
        'RUN_SAFETY_ANALYSIS',
        'prescription',
        ${prescriptionId},
        NOW()
      )
    `;

    return {
      success: true,
      prescription_id: prescriptionId,
      total_warnings: warnings.length,
      risk_level: riskLevel,
      safe_to_proceed: riskLevel === "safe",
      requires_doctor_consultation: ["high", "critical"].includes(riskLevel),
      warnings
    };
  });
}