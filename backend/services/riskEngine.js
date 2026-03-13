import sql from "../config/database.js";
import { checkInteractionDB } from "./interactionChecker.js";
import { checkAllergies } from "./allergyChecker.js";
import { checkDosage } from "./dosageChecker.js";
import { checkDiseaseConflicts } from "./diseaseConflictChecker.js";
// ================= MAIN RISK ENGINE =================
export async function runRiskAnalysis(prescriptionId, io) {
  const prescription = await sql`
    SELECT p.id, p.patient_id, a.doctor_id
    FROM prescriptions p
    LEFT JOIN appointments a ON p.appointment_id = a.id
    WHERE p.id = ${prescriptionId}
      AND COALESCE(p.is_deleted, false) = false
  `;

  if (!prescription.length) {
    throw new Error("Prescription not found");
  }

  const { patient_id, doctor_id } = prescription[0];
  const safeDoctorId = doctor_id || null;

  const medicines = await sql`
    SELECT medicine_name
    FROM prescription_medicines
    WHERE prescription_id = ${prescriptionId}
  `;

  const interactionAlerts = [];

  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const interaction = await checkInteractionDB(
        medicines[i].medicine_name,
        medicines[j].medicine_name
      );

      if (interaction) {
        interactionAlerts.push({
          type: "drug_interaction",
          severity: interaction.severity || "high",
          message: interaction.description ||
            `Interaction found between ${medicines[i].medicine_name} and ${medicines[j].medicine_name}`
        });
      }
    }
  }

  const allergyAlerts = await checkAllergies(prescriptionId);
  const dosageAlerts = await checkDosage(prescriptionId);
  const diseaseAlerts = await checkDiseaseConflicts(prescriptionId);

  const allAlerts = [
    ...interactionAlerts,
    ...allergyAlerts,
    ...dosageAlerts,
    ...diseaseAlerts
  ];

  let riskScore = 0;

  for (const alert of allAlerts) {
    if (alert.severity === "low") riskScore += 10;
    if (alert.severity === "medium") riskScore += 25;
    if (alert.severity === "high") riskScore += 50;
    if (alert.severity === "critical") riskScore += 75;
  }

  if (riskScore > 100) riskScore = 100;

  try {
    await sql`BEGIN`;

    let isBlocked = false;

    if (riskScore >= 70) {
      isBlocked = true;

      await sql`
        UPDATE prescriptions
        SET status = 'blocked'
        WHERE id = ${prescriptionId}
      `;

      if (io && safeDoctorId) {
        io.to(`doctor-${safeDoctorId}`).emit("prescriptionBlocked", {
          prescription_id: prescriptionId,
          risk_score: riskScore
        });
      }
    }

    for (const alert of allAlerts) {
      await sql`
        INSERT INTO risk_alerts (
          prescription_id,
          patient_id,
          doctor_id,
          alert_type,
          severity,
          message
        )
        SELECT
          ${prescriptionId},
          ${patient_id},
          ${safeDoctorId},
          ${alert.type},
          ${alert.severity},
          ${alert.message}
        WHERE NOT EXISTS (
          SELECT 1 FROM risk_alerts
          WHERE prescription_id = ${prescriptionId}
            AND alert_type = ${alert.type}
            AND message = ${alert.message}
        )
      `;

      await sql`
        INSERT INTO patient_notifications (
          patient_id,
          prescription_id,
          title,
          message,
          severity
        )
        SELECT
          ${patient_id},
          ${prescriptionId},
          'Prescription Risk Alert',
          ${alert.message},
          ${alert.severity}
        WHERE NOT EXISTS (
          SELECT 1 FROM patient_notifications
          WHERE prescription_id = ${prescriptionId}
            AND message = ${alert.message}
        )
      `;

      if (io) {
        if (safeDoctorId) {
          io.to(`doctor-${safeDoctorId}`).emit("riskAlert", alert);
        }

        io.to(`patient-${patient_id}`).emit("patientNotification", {
          prescription_id: prescriptionId,
          message: alert.message,
          severity: alert.severity
        });
      }
    }

    await sql`
      UPDATE prescriptions
      SET risk_score = ${riskScore}
      WHERE id = ${prescriptionId}
    `;

    await sql`COMMIT`;

    return {
      alerts: allAlerts,
      risk_score: riskScore,
      blocked: isBlocked
    };

  } catch (error) {
    await sql`ROLLBACK`;
    throw error;
  }
}

// ================= OVERRIDE BLOCK =================
export async function overrideBlockedPrescription(prescriptionId, doctorId, reason, io) {
  try {
    await sql`BEGIN`;

    const prescription = await sql`
      SELECT patient_id, status
      FROM prescriptions
      WHERE id = ${prescriptionId}
    `;

    if (!prescription.length) {
      throw new Error("Prescription not found");
    }

    if (prescription[0].status !== 'blocked') {
      throw new Error("Only blocked prescriptions can be overridden");
    }

    const { patient_id } = prescription[0];

    await sql`
      UPDATE prescriptions
      SET status = 'approved'
      WHERE id = ${prescriptionId}
    `;

    await sql`
      INSERT INTO prescription_audit_log (
        prescription_id,
        doctor_id,
        action,
        reason
      )
      SELECT
        ${prescriptionId},
        ${doctorId},
        'override_block',
        ${reason}
      WHERE NOT EXISTS (
        SELECT 1 FROM prescription_audit_log
        WHERE prescription_id = ${prescriptionId}
          AND action = 'override_block'
      )
    `;

    await sql`
      INSERT INTO patient_notifications (
        patient_id,
        prescription_id,
        title,
        message,
        severity
      )
      SELECT
        ${patient_id},
        ${prescriptionId},
        'Prescription Approved After Review',
        'Your prescription was reviewed and approved by the doctor.',
        'low'
      WHERE NOT EXISTS (
        SELECT 1 FROM patient_notifications
        WHERE prescription_id = ${prescriptionId}
          AND title = 'Prescription Approved After Review'
      )
    `;

    await sql`COMMIT`;

    if (io) {
      io.to(`doctor-${doctorId}`).emit("overrideSuccess", {
        prescription_id: prescriptionId
      });

      io.to(`patient-${patient_id}`).emit("prescriptionApproved", {
        prescription_id: prescriptionId
      });
    }

    return {
      success: true,
      message: "Prescription override recorded"
    };

  } catch (error) {
    await sql`ROLLBACK`;
    throw error;
  }
}