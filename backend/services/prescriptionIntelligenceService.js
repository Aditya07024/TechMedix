import sql from "../config/database.js";

/**
 * Get generic alternatives for a medicine
 * Shows cheaper generic options
 */
export async function getGenericAlternatives(medicineName) {
  const alternatives = await sql`
    SELECT 
      ma.id,
      ma.medicine_name,
      ma.generic_name,
      ma.alternative_medicine,
      ma.alternative_generic,
      ma.therapeutic_equivalence,
      ma.cost_difference,
      ma.evidence_score,
      (SELECT price FROM medicine_price_data WHERE medicine_name = ma.alternative_medicine LIMIT 1) as alternative_price,
      (SELECT price FROM medicine_price_data WHERE medicine_name = ma.medicine_name LIMIT 1) as original_price
    FROM medicine_alternatives
    WHERE LOWER(medicine_name) = LOWER(${medicineName})
      OR LOWER(alternative_medicine) = LOWER(${medicineName})
    ORDER BY cost_difference DESC
  `;

  if (alternatives.length === 0) {
    return {
      medicine: medicineName,
      has_alternatives: false,
      alternatives: [],
    };
  }

  return {
    medicine: medicineName,
    has_alternatives: true,
    alternatives: alternatives.map((alt) => ({
      ...alt,
      savings_percentage: alt.cost_difference
        ? ((alt.cost_difference / alt.original_price) * 100).toFixed(2)
        : 0,
    })),
  };
}

/**
 * Get price comparison for medicines
 * Shows original vs generic vs alternatives with prices from pharmacies
 */
export async function getPriceComparison(medicineName) {
  // Get all pricing data for this medicine
  const priceData = await sql`
    SELECT 
      id,
      medicine_name,
      generic_name,
      manufacturer,
      price,
      mrp,
      discount_percentage,
      (mrp - price) as savings_amount
    FROM medicine_price_data
    WHERE LOWER(medicine_name) = LOWER(${medicineName})
    ORDER BY price ASC
  `;

  if (priceData.length === 0) {
    return {
      medicine: medicineName,
      pricing_available: false,
    };
  }

  const cheapest = priceData[0];
  const mostExpensive = priceData[priceData.length - 1];

  // Get alternatives with prices
  const alternatives = await sql`
    SELECT 
      ma.alternative_medicine,
      ma.alternative_generic,
      ma.cost_difference,
      ma.therapeutic_equivalence,
      ma.evidence_score,
      mp.price as alternative_price,
      mp.mrp as alternative_mrp,
      mp.manufacturer
    FROM medicine_alternatives ma
    LEFT JOIN medicine_price_data mp ON LOWER(mp.medicine_name) = LOWER(ma.alternative_medicine)
    WHERE LOWER(ma.medicine_name) = LOWER(${medicineName})
    ORDER BY mp.price ASC
    LIMIT 5
  `;

  return {
    medicine: medicineName,
    pricing_available: true,
    price_range: {
      cheapest: {
        medicine: cheapest.medicine_name,
        price: cheapest.price,
        mrp: cheapest.mrp,
        manufacturer: cheapest.manufacturer,
      },
      most_expensive: {
        medicine: mostExpensive.medicine_name,
        price: mostExpensive.price,
        mrp: mostExpensive.mrp,
      },
      price_difference: (mostExpensive.price - cheapest.price).toFixed(2),
      average_price: (
        priceData.reduce((sum, p) => sum + p.price, 0) / priceData.length
      ).toFixed(2),
    },
    variants_available: priceData.length,
    all_variants: priceData,
    cheaper_alternatives: alternatives
      .filter((a) => a.therapeutic_equivalence)
      .map((alt) => ({
        medicine: alt.alternative_medicine,
        generic_name: alt.alternative_generic,
        price: alt.alternative_price,
        manufacturer: alt.manufacturer,
        savings: (cheapest.price - alt.alternative_price).toFixed(2),
        evidence_score: alt.evidence_score,
      })),
  };
}

/**
 * Get medicine recommendations based on symptoms/disease
 * AI-powered prescription suggestions
 */
export async function getMedicineRecommendations(
  diseaseOrSymptom,
  patientDiseases = [],
) {
  // Get medicines related to this condition
  const recommendations = await sql`
    SELECT DISTINCT
      pm.medicine_name,
      pm.generic_name,
      pm.dosage,
      pm.frequency,
      COUNT(*) as prescription_count,
      (SELECT COUNT(*) FROM prescriptions p2 WHERE LOWER(p2.medicine_name) = LOWER(pm.medicine_name)) as total_prescribed
    FROM prescription_medicines pm
    WHERE LOWER(pm.medicine_name) LIKE LOWER(${`%${diseaseOrSymptom}%`})
    GROUP BY pm.medicine_name, pm.generic_name, pm.dosage, pm.frequency
    ORDER BY total_prescribed DESC
    LIMIT 10
  `;

  // Check for conflicts with patient's existing diseases
  const conflicts = [];
  for (const rec of recommendations) {
    for (const disease of patientDiseases) {
      const conflict = await sql`
        SELECT * FROM disease_medicine_conflicts
        WHERE disease_name = ${disease}
          AND LOWER(medicine_name) = LOWER(${rec.medicine_name})
        LIMIT 1
      `;
      if (conflict.length > 0) {
        conflicts.push({
          medicine: rec.medicine_name,
          disease: disease,
          severity: conflict[0].severity,
        });
      }
    }
  }

  return {
    condition: diseaseOrSymptom,
    recommended_medicines: recommendations,
    conflicts_with_patient_history: conflicts,
  };
}

/**
 * Get cost-effective alternative suggestions
 * Helps reduce prescription costs for patients
 */
export async function getCostEffectiveAlternatives(medicines) {
  const suggestions = [];

  for (const medicine of medicines) {
    const comparison = await getPriceComparison(medicine);
    const alternatives = await getGenericAlternatives(medicine);

    if (alternatives.has_alternatives && alternatives.alternatives.length > 0) {
      const cheapestAlt = alternatives.alternatives[0];

      suggestions.push({
        original_medicine: medicine,
        suggested_alternative: cheapestAlt.alternative_medicine,
        generic_name: cheapestAlt.alternative_generic,
        estimated_monthly_savings: (cheapestAlt.cost_difference * 30).toFixed(
          2,
        ),
        therapeutic_equivalence: cheapestAlt.therapeutic_equivalence,
        evidence_score: cheapestAlt.evidence_score,
      });
    }
  }

  return {
    total_suggestions: suggestions.length,
    total_potential_monthly_savings: suggestions
      .reduce((sum, s) => sum + parseFloat(s.estimated_monthly_savings || 0), 0)
      .toFixed(2),
    suggestions,
  };
}

/**
 * Track medicine price trends
 */
export async function getMedicinePriceTrends(medicineName, days = 90) {
  // This would ideally track price history over time
  // For now, return current pricing data grouped by date

  const history = await sql`
    SELECT 
      DATE(CURRENT_TIMESTAMP) as date,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price,
      COUNT(DISTINCT pharmacy_id) as pharmacies_stocked
    FROM medicine_price_data
    WHERE LOWER(medicine_name) = LOWER(${medicineName})
  `;

  return {
    medicine: medicineName,
    price_data: history[0],
    trend: "stable", // In production, calculate actual trend
  };
}

/**
 * Get medicine inventory status from pharmacies
 */
export async function getMedicineAvailability(medicineName) {
  const availability = await sql`
    SELECT 
      pharmacy_id,
      medicine_name,
      price,
      mrp,
      discount_percentage,
      last_updated
    FROM medicine_price_data
    WHERE LOWER(medicine_name) = LOWER(${medicineName})
    ORDER BY price ASC
  `;

  return {
    medicine: medicineName,
    available_at: availability.length,
    lowest_price: availability[0]?.price,
    highest_price: availability[availability.length - 1]?.price,
    details: availability,
  };
}

/**
 * Generate prescription summary with alternatives
 * Full comparison for patient before purchase
 */
export async function generatePrescriptionComparisonSummary(
  prescriptionId,
  patientId,
) {
  const prescription = await sql`
    SELECT 
      p.id,
      p.medicine_name,
      p.dosage,
      p.frequency,
      p.duration_days,
      u.name as doctor_name
    FROM prescriptions p
    JOIN users u ON p.doctor_id = u.id
    WHERE p.id = ${prescriptionId}
      AND p.patient_id = ${patientId}
  `;

  if (!prescription || prescription.length === 0) {
    throw new Error("Prescription not found");
  }

  const med = prescription[0];
  const priceComparison = await getPriceComparison(med.medicine_name);
  const alternatives = await getGenericAlternatives(med.medicine_name);

  // Calculate monthly cost
  const frequency = parseInt(med.frequency) || 3; // default 3x daily
  const totalDailyDoses = frequency * (med.duration_days || 30);
  const estimatedMonthlyCost = priceComparison.pricing_available
    ? (
        parseFloat(priceComparison.price_range.cheapest.price) * totalDailyDoses
      ).toFixed(2)
    : "To be determined";

  return {
    prescription: {
      medicine: med.medicine_name,
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration_days,
      doctor: med.doctor_name,
    },
    pricing: {
      original_medicine: priceComparison.price_range?.cheapest || null,
      estimated_monthly_cost: estimatedMonthlyCost,
      variants_available: priceComparison.variants_available,
    },
    cheaper_alternatives: alternatives.alternatives
      .filter((alt) => alt.therapeutic_equivalence)
      .slice(0, 3)
      .map((alt) => ({
        medicine: alt.alternative_medicine,
        savings: alt.cost_difference,
        evidence_score: alt.evidence_score,
      })),
    recommendation:
      estimatedMonthlyCost > 100 && alternatives.has_alternatives
        ? `Consider generic alternatives to save money`
        : null,
  };
}
