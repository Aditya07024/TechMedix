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

  try {
    // Add foreign key for patient_id
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'prescriptions_patient_id_fkey'
        ) THEN
          ALTER TABLE prescriptions
          ADD CONSTRAINT prescriptions_patient_id_fkey
          FOREIGN KEY (patient_id) REFERENCES patients(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `;
  } catch (err) {
    console.warn("⚠ Prescription migration warning:", err.message);
  }

  try {
    // Add index for faster lookup
    await sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id_int ON prescriptions(user_id_int)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id)`;
  } catch (err) {
    console.warn("⚠ Prescription migration warning:", err.message);
  }

  try {
    // Ensure soft delete support exists
    await sql`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`;
  } catch (err) {
    console.warn("⚠ Prescription migration warning:", err.message);
  }
}
