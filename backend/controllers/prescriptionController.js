import {
  createPrescription,
  getPrescriptionById,
  updatePrescriptionOverride,
  getPrescriptionsByPatient,
  getPrescriptionsByDoctor,
  requestRefill,
  completePrescription,
} from "../services/prescriptionService.js";
import {
  checkDiseaseConflicts,
  checkDrugInteractions,
} from "../services/safetyEngine.js";
import { logAudit } from "../services/auditService.js";

export async function createPrescriptionHandler(req, res) {
  try {
    const { visit_id, doctor_id, patient_id, medicines, special_instructions } =
      req.body;

    // Safety Check 1: Disease-Medicine Conflicts
    const diseaseConflicts = await Promise.all(
      medicines.map((med) => checkDiseaseConflicts(patient_id, med.name)),
    ).then((results) => results.flat());

    const drugConflicts = await checkDrugInteractions(medicines);

    if (diseaseConflicts.length > 0 || drugConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Safety conflicts detected",
        disease_conflicts: diseaseConflicts,
        drug_conflicts: drugConflicts,
        requires_override: diseaseConflicts.some(
          (c) => c.severity === "high" || c.severity === "critical",
        ),
      });
    }

    const prescription = await createPrescription({
      visit_id,
      doctor_id,
      patient_id,
      medicines,
      special_instructions,
    });

    await logAudit({
      user_id: doctor_id,
      action: "prescription_created",
      entity_id: prescription.id,
      entity_type: "prescription",
      details: { patient_id, medicines_count: medicines.length },
    });

    res.status(201).json({ success: true, data: prescription });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function overridePrescription(req, res) {
  try {
    const { prescription_id } = req.params;
    const { override_reason } = req.body;
    const doctor_id = req.user?.id;

    const result = await updatePrescriptionOverride(
      prescription_id,
      doctor_id,
      override_reason,
    );

    await logAudit({
      user_id: doctor_id,
      action: "prescription_override",
      entity_id: prescription_id,
      entity_type: "prescription",
      details: { override_reason },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getPrescription(req, res) {
  try {
    const { prescription_id } = req.params;
    const prescription = await getPrescriptionById(prescription_id);

    // Access control
    if (
      req.user?.id !== prescription.patient_id &&
      req.user?.id !== prescription.doctor_id &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
}

export async function getPatientPrescriptions(req, res) {
  try {
    const { patient_id } = req.params;

    if (req.user?.id !== patient_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const prescriptions = await getPrescriptionsByPatient(patient_id);
    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getDoctorPrescriptions(req, res) {
  try {
    const { doctor_id } = req.params;

    if (req.user?.id !== doctor_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const prescriptions = await getPrescriptionsByDoctor(doctor_id);
    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function requestRefillHandler(req, res) {
  try {
    const { prescription_id } = req.params;
    const patient_id = req.user?.id;

    const result = await requestRefill(prescription_id, patient_id);

    await logAudit({
      user_id: patient_id,
      action: "refill_requested",
      entity_id: prescription_id,
      entity_type: "prescription",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function completePrescriptionHandler(req, res) {
  try {
    const { prescription_id } = req.params;

    const result = await completePrescription(prescription_id);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
