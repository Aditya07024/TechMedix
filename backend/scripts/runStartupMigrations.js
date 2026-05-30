import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeCompletSchema } from "./initCompleteSchema.js";
import { runPrescriptionMigration } from "./runPrescriptionMigration.js";
import { runSafetyReportMigration } from "./runSafetyReportMigration.js";
import { runPriceIntelligenceMigration } from "./runPriceIntelligenceMigration.js";
import { runMedicalScansMigration } from "./runMedicalScansMigration.js";
import { runAppointmentMigration } from "./runAppointmentMigration.js";
import { runSupportTicketsMigration } from "./runSupportTicketsMigration.js";
import { runDoctorReviewsMigration } from "./runDoctorReviewsMigration.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  console.log("Starting TechMedix database migrations...");

  await initializeCompletSchema();
  await runPrescriptionMigration();
  await runSafetyReportMigration();
  await runPriceIntelligenceMigration();
  await runMedicalScansMigration();
  await runAppointmentMigration();
  await runSupportTicketsMigration();
  await runDoctorReviewsMigration();

  console.log("TechMedix database migrations completed");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration run failed:", error);
    process.exit(1);
  });
