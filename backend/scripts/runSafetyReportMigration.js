/**
 * Make safety_reports.user_id nullable.
 * Auth uses patients (integer IDs), not users (UUIDs). Reports are linked via prescription_id.
 */
import sql from "../config/database.js";

export async function runSafetyReportMigration() {
  try {
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='safety_reports' AND column_name='user_id'
        ) THEN
          ALTER TABLE safety_reports ALTER COLUMN user_id DROP NOT NULL;
        END IF;
      END
      $$;
    `;
    await sql`ALTER TABLE safety_reports ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`;
    await sql`CREATE INDEX IF NOT EXISTS idx_safety_reports_prescription ON safety_reports(prescription_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_safety_reports_is_deleted ON safety_reports(is_deleted)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_safety_reports_user ON safety_reports(user_id)`;
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'safety_reports_prescription_id_fkey'
        ) THEN
          ALTER TABLE safety_reports
          ADD CONSTRAINT safety_reports_prescription_id_fkey
          FOREIGN KEY (prescription_id)
          REFERENCES prescriptions(id)
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `;
    console.log("✓ Safety reports migration completed (nullable user_id + soft delete + indexes + FK)");
  } catch (err) {
    if (err.code === "42701" || err.message?.includes("does not exist")) {
      // Column constraint might already be dropped
      return;
    }
    console.warn("⚠ Safety report migration:", err.message);
  }
}
