import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications'
    `;
    console.log("notifications columns:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
