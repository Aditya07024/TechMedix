import sql from "../config/database.js";

async function main() {
  try {
    const res = await sql`
      SELECT *
      FROM doctors
      LIMIT 2
    `;
    console.log("doctors rows:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
