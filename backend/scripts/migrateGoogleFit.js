/**
 * Database Migration: Add Google Fit columns to patients table
 * Run this script once to set up the database schema
 *
 * Usage: node scripts/migrateGoogleFit.js
 */

import sql from "../config/database.js";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

async function runMigration() {
  try {
    console.log("Starting Google Fit migration...");

    // Add Google Fit related columns to patients table
    await sql`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS google_fit_access_token TEXT,
      ADD COLUMN IF NOT EXISTS google_fit_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_fit_connected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS google_fit_token_expires_at TIMESTAMP
    `;

    console.log("✓ Added Google Fit columns to patients table");

    // Create index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_patients_google_fit_connected 
      ON patients(google_fit_connected_at)
    `;

    console.log("✓ Created index for Google Fit connected patients");

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
