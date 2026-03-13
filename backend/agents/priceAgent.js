import sql from "../config/database.js";
import { validateDosage } from "../services/dosageValidator.js";
import {
  analyzeMedicinePrice,
  recordPriceHistory,
} from "../services/priceIntelligenceService.js";

export async function runPriceAgent({ prescriptionId }) {
  if (!prescriptionId) {
    throw new Error("prescriptionId required");
  }

  return await sql.begin(async (tx) => {
    const meds = await tx`
      SELECT medicine_name, dosage
      FROM prescription_medicines
      WHERE prescription_id = ${prescriptionId}
    `;

    if (!meds.length) {
      return {
        success: true,
        total_original_price: 0,
        total_replaced_price: 0,
        savings: 0,
        replacements: [],
        warnings: [],
        price_insights: []
      };
    }

    let totalOriginal = 0;
    let totalReplaced = 0;

    const replacements = [];
    const warnings = [];

    for (const med of meds) {
      const baseName = med.medicine_name
        .replace(/\d+\s?(mg|ml|mcg)/gi, "")
        .replace(/\b(tab|tablet|cap|capsule)\b/gi, "")
        .trim();

      const dosageCheck = await validateDosage({
        medicineName: baseName,
        dosage: med.dosage,
        frequencyPerDay: 1
      });

      /* ───── ORIGINAL PRICE ───── */
      let brandRow = await tx`
        SELECT price, medicine_name
        FROM medicine_prices
        WHERE medicine_name ILIKE ${'%' + baseName + '%'}
        ORDER BY price DESC
        LIMIT 1
      `;

      if (!brandRow.length) {
        brandRow = await tx`
          SELECT price, name as medicine_name
          FROM medicines
          WHERE name ILIKE ${'%' + baseName + '%'} OR salt ILIKE ${'%' + baseName + '%'}
          ORDER BY price DESC
          LIMIT 1
        `;
      }

      const origPrice = Number(brandRow[0]?.price ?? 0);
      totalOriginal += origPrice;

      if (!origPrice) {
        warnings.push({
          type: "price",
          severity: "low",
          medicine: med.medicine_name,
          description: "Original price not found",
          recommendation: "Verify manually at pharmacy"
        });
        continue;
      }

      if (!dosageCheck.valid) {
        totalReplaced += origPrice;

        warnings.push({
          type: "dosage",
          severity: dosageCheck.severity,
          medicine: med.medicine_name,
          description: dosageCheck.reason,
          recommendation: "Consult doctor immediately"
        });
        continue;
      }

      /* ───── FIND CHEAPER ───── */
      let cheaper = await tx`
        SELECT medicine_name, price
        FROM medicine_prices
        WHERE medicine_name ILIKE ${'%' + baseName + '%'}
          AND price < ${origPrice}
        ORDER BY price ASC
        LIMIT 1
      `;

      if (!cheaper.length) {
        cheaper = await tx`
          SELECT name as medicine_name, price
          FROM medicines
          WHERE (name ILIKE ${'%' + baseName + '%'} OR salt ILIKE ${'%' + baseName + '%'})
            AND price < ${origPrice}
          ORDER BY price ASC
          LIMIT 1
        `;
      }

      if (cheaper.length) {
        const best = cheaper[0];
        const replacedPrice = Number(best.price);
        totalReplaced += replacedPrice;

        replacements.push({
          original: brandRow[0]?.medicine_name || med.medicine_name,
          replaced_with: best.medicine_name,
          original_price: origPrice,
          replaced_price: replacedPrice,
          savings: origPrice - replacedPrice,
          reason: "Safety cleared + cheaper equivalent"
        });

        // Record price history snapshot
        try {
          await recordPriceHistory({
            medicineName: best.medicine_name,
            price: replacedPrice
          });
        } catch (_) {}

      } else {
        totalReplaced += origPrice;
      }
    }

    /* ───── SAVE REPORT ───── */
    try {
      await tx`
        INSERT INTO price_reports (
          prescription_id,
          total_original_price,
          total_replaced_price,
          savings,
          created_at
        )
        VALUES (
          ${prescriptionId},
          ${totalOriginal},
          ${totalReplaced},
          ${totalOriginal - totalReplaced},
          NOW()
        )
      `;
    } catch (_) {}

    const insights = [];

    for (const med of meds) {
      const baseName = med.medicine_name
        .replace(/\d+\s?(mg|ml|mcg)/gi, "")
        .replace(/\b(tab|tablet|cap|capsule)\b/gi, "")
        .trim();

      try {
        const intel = await analyzeMedicinePrice(baseName);
        insights.push({
          medicine: med.medicine_name,
          ...intel,
        });
      } catch (_) {
        insights.push({
          medicine: med.medicine_name,
          recommendation: "monitor",
          dataPoints: 0,
        });
      }
    }

    return {
      success: true,
      total_original_price: totalOriginal,
      total_replaced_price: totalReplaced,
      savings: totalOriginal - totalReplaced,
      replacements,
      warnings,
      price_insights: insights,
    };
  });
}