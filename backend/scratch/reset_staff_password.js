import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcrypt";
dotenv.config();

import sql from "../config/database.js";

async function run() {
  try {
    const hash = await bcrypt.hash("12345678", 10);

    // Update staff table
    await sql`
      UPDATE staff
      SET password_hash = ${hash}
      WHERE email = 'staff@gmail.com'
    `;
    console.log("Updated staff table password hash");

    // Update users table
    await sql`
      UPDATE users
      SET password_hash = ${hash}
      WHERE email = 'staff@gmail.com'
    `;
    console.log("Updated users table password hash");

    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}
run();
