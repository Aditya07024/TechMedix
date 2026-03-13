import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as prescriptionIntel from "../services/prescriptionIntelligenceService.js";

const router = express.Router();

/**
 * Get generic alternatives for a medicine
 */
router.get("/alternatives/:medicineName", authenticate, async (req, res) => {
  try {
    const { medicineName } = req.params;

    const alternatives =
      await prescriptionIntel.getGenericAlternatives(medicineName);

    res.json(alternatives);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get price comparison for medicines
 */
router.get(
  "/price-comparison/:medicineName",
  authenticate,
  async (req, res) => {
    try {
      const { medicineName } = req.params;

      const comparison =
        await prescriptionIntel.getPriceComparison(medicineName);

      res.json(comparison);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get cost-effective alternatives for multiple medicines
 */
router.post("/cost-effective-alternatives", authenticate, async (req, res) => {
  try {
    const { medicines } = req.body;

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: "Medicines array required" });
    }

    const suggestions =
      await prescriptionIntel.getCostEffectiveAlternatives(medicines);

    res.json(suggestions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get medicine recommendations for condition
 */
router.post(
  "/recommendations",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { diseaseOrSymptom, patientId } = req.body;

      if (!diseaseOrSymptom) {
        return res.status(400).json({ error: "Disease or symptom required" });
      }

      // Get patient's existing diseases
      const diseases = await sql`
      SELECT disease_name
      FROM patient_diseases
      WHERE patient_id = ${patientId}
        AND is_active = true
    `;

      const patientDiseases = diseases.map((d) => d.disease_name);

      const recommendations =
        await prescriptionIntel.getMedicineRecommendations(
          diseaseOrSymptom,
          patientDiseases,
        );

      res.json(recommendations);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get medicine availability and pricing
 */
router.get("/availability/:medicineName", authenticate, async (req, res) => {
  try {
    const { medicineName } = req.params;

    const availability =
      await prescriptionIntel.getMedicineAvailability(medicineName);

    res.json(availability);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get medicine price trends
 */
router.get("/price-trends/:medicineName", authenticate, async (req, res) => {
  try {
    const { medicineName } = req.params;
    const { days = 90 } = req.query;

    const trends = await prescriptionIntel.getMedicinePriceTrends(
      medicineName,
      parseInt(days),
    );

    res.json(trends);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Generate prescription comparison summary
 * For patient to see alternatives before purchase
 */
router.get(
  "/prescription/:prescriptionId/summary",
  authenticate,
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;

      // Get prescription to verify patient access
      const prescription = await sql`
      SELECT patient_id FROM prescriptions WHERE id = ${prescriptionId}
    `;

      if (!prescription || prescription.length === 0) {
        return res.status(404).json({ error: "Prescription not found" });
      }

      if (
        req.user.id !== prescription[0].patient_id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const summary =
        await prescriptionIntel.generatePrescriptionComparisonSummary(
          prescriptionId,
          req.user.id,
        );

      res.json(summary);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get smart prescription suggestions for doctor
 */
router.post(
  "/smart-suggestions",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { patientId, medicines } = req.body;

      if (!patientId || !medicines || medicines.length === 0) {
        return res
          .status(400)
          .json({ error: "Patient ID and medicines required" });
      }

      // Get price comparisons for all medicines
      const comparisons = await Promise.all(
        medicines.map((med) => prescriptionIntel.getPriceComparison(med)),
      );

      // Get cost-effective alternatives
      const alternatives =
        await prescriptionIntel.getCostEffectiveAlternatives(medicines);

      // Calculate total estimated cost
      const estimatedCost = comparisons.reduce((sum, comp) => {
        const price = parseFloat(comp.price_range?.cheapest?.price || 0);
        return sum + price;
      }, 0);

      res.json({
        prescribed_medicines: medicines,
        estimated_cost: estimatedCost.toFixed(2),
        price_comparisons: comparisons,
        cost_saving_suggestions: alternatives,
        generic_alternatives: await Promise.all(
          medicines.map((med) => prescriptionIntel.getGenericAlternatives(med)),
        ),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
