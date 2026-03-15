import sql from "../config/database.js";

export async function runAppointmentMigration() {
  const statements = [
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20)`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS follow_up_date DATE`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`,
  ];

  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
    } catch (error) {
      console.warn(`⚠ appointment migration warning: ${error.message}`);
    }
  }

  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
      ON appointments(doctor_id, appointment_date)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
      ON appointments(patient_id, appointment_date)
    `;
    console.log("✓ appointment migration complete");
  } catch (error) {
    console.warn(`⚠ appointment migration warning: ${error.message}`);
  }
}
