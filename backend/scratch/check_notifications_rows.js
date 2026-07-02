import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT *
      FROM notifications
      LIMIT 5
    `;
    console.log("notifications rows:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
