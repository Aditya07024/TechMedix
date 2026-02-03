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
    WHERE salt_name ILIKE ${'%' + medicineName + '%'}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      valid: true,
      note: "No dosage reference found"
    };
  }

  const limit = rows[0];
  const totalDailyDose = doseMg * frequencyPerDay;

  if (limit.max_single_dose_mg && doseMg > limit.max_single_dose_mg) {
    return {
      valid: false,
      severity: "high",
      reason: `Single dose exceeds safe limit (${limit.max_single_dose_mg}mg)`
    };
  }

  if (limit.max_daily_dose_mg && totalDailyDose > limit.max_daily_dose_mg) {
    return {
      valid: false,
      severity: "critical",
      reason: `Daily dose exceeds safe limit (${limit.max_daily_dose_mg}mg/day)`
    };
  }

  return { valid: true };
}