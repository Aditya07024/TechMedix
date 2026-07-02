import sql from "../config/database.js";

async function main() {
  try {
    const queueEntries = await sql`
      SELECT id, appointment_id, patient_id, doctor_id, status, queue_date
      FROM queue
      ORDER BY queued_at DESC
      LIMIT 10
    `;
    console.log("Recent queue entries:", queueEntries);

    const appointments = await sql`
      SELECT id, patient_id, doctor_id, status, appointment_date
      FROM appointments
      ORDER BY created_at DESC
      LIMIT 10
    `;
    console.log("Recent appointments:", appointments);

    process.exit(0);
  } catch (err) {
    console.error("Error checking queue table:", err);
    process.exit(1);
  }
}

main();
