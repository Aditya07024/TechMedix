/**
 * Make safety_reports.user_id nullable.
 * Auth uses patients (integer IDs), not users (UUIDs). Reports are linked via prescription_id.
 */
import sql from "../config/database.js";

export async function runSafetyReportMigration() {
  try {
    await sql`ALTER TABLE safety_reports ALTER COLUMN user_id DROP NOT NULL`;
    console.log("✓ safety_reports.user_id is now nullable");
  } catch (err) {
    if (err.code === "42701" || err.message?.includes("does not exist")) {
      // Column constraint might already be dropped
      return;
    }
    console.warn("⚠ Safety report migration:", err.message);
  }
}
