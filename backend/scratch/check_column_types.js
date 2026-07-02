import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('patients', 'patient_notifications') AND column_name IN ('id', 'patient_id')
    `;
    console.log("Column types:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
