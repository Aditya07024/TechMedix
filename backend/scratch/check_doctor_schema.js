import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'doctors' AND column_name = 'id'
    `;
    console.log("doctors.id type:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
