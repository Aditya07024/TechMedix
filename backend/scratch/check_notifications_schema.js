import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'user_id'
    `;
    console.log("notifications.user_id type:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
