import sql from "../config/database.js";

async function main() {
  try {
    const patientId = "cd79a931-03de-4daa-b8b7-b3e021b82ce7";
    const patient = await sql`
      SELECT id, name
      FROM patients
      WHERE id = ${patientId}
    `;
    console.log("Patient query result:", patient);

    const allPatients = await sql`
      SELECT id, name
      FROM patients
      LIMIT 5
    `;
    console.log("Some patients:", allPatients);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
