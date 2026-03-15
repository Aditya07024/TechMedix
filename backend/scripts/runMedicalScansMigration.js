import sql from "../config/database.js";

// Creates the medical_scans table and indexes if they don't exist
export async function runMedicalScansMigration() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS medical_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        scan_type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        prediction TEXT,
        confidence NUMERIC,
        heatmap_url TEXT,
        all_diagnostics JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Add all_diagnostics column if it doesn't exist
    await sql`
      ALTER TABLE medical_scans
      ADD COLUMN IF NOT EXISTS all_diagnostics JSONB;
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_medical_scans_patient ON medical_scans(patient_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_medical_scans_type ON medical_scans(scan_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_medical_scans_created_at ON medical_scans(created_at)`;

    console.log("✅ medical_scans migration complete");
  } catch (err) {
    console.warn("⚠️ medical_scans migration failed:", err.message);
  }
}

