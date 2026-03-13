import sql from "../config/database.js";
import { parseDosage } from "./dosageParser.js";

/**
 * Validates dosage against known safe limits
 * NO medical reasoning — pure numeric safety
 */
export async function validateDosage({
  medicineName,
  dosage,
  frequencyPerDay = 1
}) {
  if (!medicineName) {
    return { valid: true, note: "Medicine name missing" };
  }

  const normalizedName = (medicineName || "").toString().trim().toLowerCase();
  const doseMg = parseDosage(dosage);

  // If dosage not in mg, skip safely
  if (!doseMg) {
    return {
      valid: true,
      note: "Dosage unit not in mg, skipped validation"
    };
  }

  const rows = await sql`
    SELECT *
    FROM dosage_limits
    WHERE LOWER(salt_name) = ${normalizedName}
       OR LOWER(salt_name) ILIKE ${normalizedName + '%'}
    ORDER BY max_daily_dose_mg DESC NULLS LAST
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      valid: true,
      note: "No dosage reference found"
    };
  }

  const limit = rows[0];
  const safeFrequency = Number(frequencyPerDay) || 1;
  const totalDailyDose = doseMg * safeFrequency;

  if (limit.max_single_dose_mg && doseMg > limit.max_single_dose_mg) {
    return {
      valid: false,
      severity: "high",
      reason: `Single dose exceeds safe limit (${limit.max_single_dose_mg}mg)`,
      confidence: 1.0
    };
  }

  if (limit.max_daily_dose_mg && totalDailyDose > limit.max_daily_dose_mg) {
    return {
      valid: false,
      severity: "critical",
      reason: `Daily dose exceeds safe limit (${limit.max_daily_dose_mg}mg/day)`,
      confidence: 1.0
    };
  }

  return {
    valid: true,
    evaluatedDoseMg: doseMg,
    totalDailyDose
  };
}