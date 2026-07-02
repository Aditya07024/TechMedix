import dotenv from "dotenv";
import path from "path";
dotenv.config();

import sql from "./config/database.js";

async function run() {
  try {
    const staff = await sql`SELECT id, name, email, username FROM staff LIMIT 10`;
    console.log("STAFF IN DATABASE:", staff);

    const users = await sql`SELECT id, email, role FROM users LIMIT 10`;
    console.log("USERS IN DATABASE:", users);

    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}
run();
