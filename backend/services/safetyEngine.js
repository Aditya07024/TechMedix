import sql from "../config/database.js";
import { logAudit } from "./auditService.js";

/**
 * Check disease-medicine conflicts before prescription
 * Returns alert if conflict exists
 */
export async function checkDiseaseConflicts(patientId, medicineName) {
  // Get patient's active diseases
  const diseases = await sql`
    SELECT disease_name
    FROM patient_diseases
    WHERE patient_id = ${patientId}
      AND is_active = true
  `;

  if (diseases.length === 0) {
    return { has_conflict: false, conflicts: [] };
  }

  // Check for conflicts
  const conflicts = await sql`
    SELECT *
    FROM disease_medicine_conflicts
    WHERE disease_name = ANY(${diseases.map((d) => d.disease_name)})
      AND LOWER(medicine_name) = LOWER(${medicineName})
    ORDER BY severity DESC
  `;

  if (conflicts.length === 0) {
    return { has_conflict: false, conflicts: [] };
  }

  const severestConflict = conflicts[0];
  return {
    has_conflict: true,
    severity: severestConflict.severity,
    conflicts: conflicts,
    critical: ["high", "critical"].includes(severestConflict.severity),
  };
}

/**
 * Check drug-drug interactions
 * If multiple medicines in prescription, check each pair
 */
export async function checkDrugInteractions(medicines) {
  if (!medicines || medicines.length < 2) {
    return { has_interactions: false, interactions: [] };
  }

  const interactions = [];

  // Check each pair of medicines
  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const medicine1 = medicines[i];
      const medicine2 = medicines[j];

      const conflict = await sql`
        SELECT *
        FROM medicine_conflicts
        WHERE (
          (LOWER(medicine_a) = LOWER(${medicine1}) AND LOWER(medicine_b) = LOWER(${medicine2}))
          OR
          (LOWER(medicine_a) = LOWER(${medicine2}) AND LOWER(medicine_b) = LOWER(${medicine1}))
        )
        LIMIT 1
      `;

      if (conflict.length > 0) {
        interactions.push(conflict[0]);
      }
    }
  }

  return {
    has_interactions: interactions.length > 0,
    interactions,
    critical: interactions.some((i) =>
      ["high", "critical"].includes(i.severity),
    ),
  };
}

/**
 * Create prescription risk alert
 * Called when high/critical risk detected
 */
export async function createRiskAlert(
  prescriptionId,
  doctorId,
  patientId,
  alertType,
  severity,
  message,
  conflictEntity,
) {
  const alert = await sql`
    INSERT INTO prescription_risk_alerts (
      prescription_id,
      doctor_id,
      patient_id,
      alert_type,
      severity,
      conflicting_entity,
      alert_message
    ) VALUES (
      ${prescriptionId},
      ${doctorId},
      ${patientId},
      ${alertType},
      ${severity},
      ${conflictEntity},
      ${message}
    )
    RETURNING *
  `;

  await logAudit({
    action: "risk_alert_created",
    table_name: "prescription_risk_alerts",
    record_id: alert[0].id,
    metadata: {
      prescription_id: prescriptionId,
      alert_type: alertType,
      severity: severity,
    },
  });

  return alert[0];
}

/**
 * Override prescription risk alert
 * Doctor must provide reason for override
 */
export async function overridePrescriptionRisk(
  alertId,
  doctorId,
  overrideReason,
) {
  // Verify doctor is the one overriding
  const alert = await sql`
    SELECT * FROM prescription_risk_alerts
    WHERE id = ${alertId}
  `;

  if (!alert || alert.length === 0) {
    throw new Error("Risk alert not found");
  }

  if (alert[0].doctor_id !== doctorId) {
    throw new Error("Only the prescribing doctor can override this alert");
  }

  // Update alert as overridden
  const updated = await sql`
    UPDATE prescription_risk_alerts
    SET is_overridden = true,
        override_reason = ${overrideReason},
        override_at = CURRENT_TIMESTAMP,
        acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ${alertId}
    RETURNING *
  `;

  await logAudit({
    action: "risk_alert_overridden",
    table_name: "prescription_risk_alerts",
    record_id: alertId,
    metadata: {
      override_reason: overrideReason,
      doctor_id: doctorId,
    },
  });

  return updated[0];
}

/**
 * Get pending alerts for a prescription
 */
export async function getPrescriptionAlerts(prescriptionId) {
  return await sql`
    SELECT *
    FROM prescription_risk_alerts
    WHERE prescription_id = ${prescriptionId}
      AND acknowledged_at IS NULL
    ORDER BY severity DESC
  `;
}

/**
 * Validate prescription before saving
 * Comprehensive safety check
 */
export async function validatePrescriptionSafety(prescriptionData) {
  const { patient_id, doctor_id, medicines } = prescriptionData;

  if (!patient_id || !doctor_id) {
    throw new Error("Patient and doctor IDs required");
  }

  if (!medicines || medicines.length === 0) {
    throw new Error("At least one medicine required");
  }

  const validationResult = {
    is_safe: true,
    alerts: [],
    requires_override: [],
  };

  // Check disease conflicts
  for (const medicine of medicines) {
    const diseaseCheck = await checkDiseaseConflicts(patient_id, medicine);
    if (diseaseCheck.has_conflict) {
      validationResult.is_safe = false;
      validationResult.alerts.push({
        type: "disease_conflict",
        medicine: medicine,
        severity: diseaseCheck.severity,
        details: diseaseCheck.conflicts,
      });

      if (diseaseCheck.critical) {
        validationResult.requires_override.push("disease_conflict");
      }
    }
  }

  // Check drug interactions
  const interactionCheck = await checkDrugInteractions(medicines);
  if (interactionCheck.has_interactions) {
    validationResult.is_safe = false;
    validationResult.alerts.push({
      type: "drug_interaction",
      severity: interactionCheck.critical ? "critical" : "moderate",
      details: interactionCheck.interactions,
    });

    if (interactionCheck.critical) {
      validationResult.requires_override.push("drug_interaction");
    }
  }

  // Check medication history for duplicate active prescriptions
  const activePrescriptions = await sql`
    SELECT DISTINCT medicine_name
    FROM prescriptions
    WHERE patient_id = ${patient_id}
      AND created_at > NOW() - INTERVAL '30 days'
      AND is_completed = false
  `;

  const duplicates = medicines.filter((m) =>
    activePrescriptions.some(
      (p) => p.medicine_name.toLowerCase() === m.toLowerCase(),
    ),
  );

  if (duplicates.length > 0) {
    validationResult.alerts.push({
      type: "duplicate_medication",
      medicines: duplicates,
      severity: "moderate",
      message: "Patient already has active prescriptions for these medicines",
    });
  }

  return validationResult;
}

/**
 * Get all active risks for a patient
 */
export async function getPatientActiveRisks(patientId) {
  const risks = await sql`
    SELECT *
    FROM prescription_risk_alerts
    WHERE patient_id = ${patientId}
      AND is_overridden = false
      AND severity IN ('high', 'critical')
    ORDER BY created_at DESC
  `;

  return {
    patient_id: patientId,
    active_risks: risks,
    critical_count: risks.filter((r) => r.severity === "critical").length,
    high_count: risks.filter((r) => r.severity === "high").length,
  };
}

/**
 * Get safety report for doctor
 */
export async function getDoctorSafetyReport(doctorId, days = 30) {
  const alerts = await sql`
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
      COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
      COUNT(CASE WHEN is_overridden = true THEN 1 END) as overridden_alerts,
      COUNT(CASE WHEN is_overridden = false THEN 1 END) as pending_alerts
    FROM prescription_risk_alerts
    WHERE doctor_id = ${doctorId}
      AND created_at > NOW() - INTERVAL '${days} days'
  `;

  const overrides = await sql`
    SELECT 
      COUNT(*) as total_overrides,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_overrides
    FROM prescription_risk_alerts
    WHERE doctor_id = ${doctorId}
      AND is_overridden = true
      AND created_at > NOW() - INTERVAL '${days} days'
  `;

  return {
    doctor_id: doctorId,
    period_days: days,
    alerts: alerts[0] || {},
    overrides: overrides[0] || {},
  };
}
