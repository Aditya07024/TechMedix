import sql from "../config/database.js";

export async function runDoctorReviewsMigration() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor ON doctor_reviews(doctor_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_doctor_reviews_patient ON doctor_reviews(patient_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_doctor_reviews_appointment ON doctor_reviews(appointment_id)`;

    console.log("✅ doctor_reviews migration complete");
  } catch (err) {
    console.warn("⚠️ doctor_reviews migration failed:", err.message);
  }
}
