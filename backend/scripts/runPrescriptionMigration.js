/**
 * Ensures prescriptions table has user_id_int and patient_id (integer columns).
 * Run automatically on server startup so upload works without manual migration.
 */
import sql from "../config/database.js";

export async function runPrescriptionMigration() {
  try {
    // 1) Drop FK so we can make user_id nullable (ignore if constraint name differs or already dropped)
    await sql`ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_user_id_fkey`;
  } catch (_) {
    // Constraint might have different name; continue
  }

  try {
    await sql`ALTER TABLE prescriptions ALTER COLUMN user_id DROP NOT NULL`;
  } catch (_) {
    // Already nullable
  }

  try {
    await sql`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS user_id_int INTEGER`;
    await sql`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id INTEGER`;
  } catch (err) {
    console.warn("⚠ Prescription migration warning:", err.message);
  }
}
