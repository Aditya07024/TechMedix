import sql from "../config/database.js";

export async function runSupportTicketsMigration() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'wallet',
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_support_tickets_patient ON support_tickets(patient_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`;

    console.log("✅ support_tickets migration complete");
  } catch (err) {
    console.warn("⚠️ support_tickets migration failed:", err.message);
  }
}
