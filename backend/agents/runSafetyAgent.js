export async function runSafetyAgent({ prescriptionId, userId }) {
  if (!prescriptionId) {
    throw new Error("prescriptionId required");
  }

  console.log("🛡️ Safety Agent started");

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

    /* ───── LOAD MEDICINES ───── */
    const medicines = await tx`
      SELECT medicine_name, dosage, frequency, duration
      FROM prescription_medicines
      WHERE prescription_id = ${prescriptionId}
    `;

    if (!medicines.length) {
      throw new Error("No medicines found for safety analysis");
    }

    /* ───── PREVENT DUPLICATE REPORT ───── */
    const existingReport = await tx`
      SELECT id FROM safety_reports
      WHERE prescription_id = ${prescriptionId}
      LIMIT 1
    `;

    if (existingReport.length) {
      console.log("⚠ Safety report already exists — skipping regeneration");
      return {
        success: true,
        message: "Safety report already exists"
      };
    }

    /* ───── GENERATE MEDICINE PAIRS ───── */
    const pairs = [];
    for (let i = 0; i < medicines.length; i++) {
      for (let j = i + 1; j < medicines.length; j++) {
        pairs.push([medicines[i], medicines[j]]);
      }
    }

    const warnings = [];

    /* ───── DATABASE INTERACTION CHECK ───── */
    for (const [a, b] of pairs) {
      const rows = await tx`
        SELECT *
        FROM drug_interactions
        WHERE
          (medicine_a = ${a.medicine_name} AND medicine_b = ${b.medicine_name})
          OR
          (medicine_a = ${b.medicine_name} AND medicine_b = ${a.medicine_name})
        LIMIT 1
      `;

      if (rows.length) {
        const i = rows[0];

        warnings.push({
          type: "interaction",
          severity: i.severity,
          medicine_1: i.medicine_a,
          medicine_2: i.medicine_b,
          description: i.description,
          mechanism: i.mechanism,
          recommendation: i.recommendation,
          source: "database",
          confidence: 1.0
        });
      }
    }

    /* ───── RISK LEVEL CALCULATION ───── */
    let riskLevel = "safe";
    if (warnings.some(w => w.severity === "critical")) riskLevel = "critical";
    else if (warnings.some(w => w.severity === "high")) riskLevel = "high";
    else if (warnings.length > 0) riskLevel = "medium";

    /* ───── SAVE REPORT ───── */
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
    if (userId) {
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
    }

    return {
      success: true,
      prescription_id: prescriptionId,
      overall_risk: riskLevel,
      total_warnings: warnings.length,
      warnings,
      safe_to_proceed: riskLevel === "safe",
      requires_doctor_consultation: ["high", "critical"].includes(riskLevel)
    };
  });
}