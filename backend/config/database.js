import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

// Ensure .env is loaded
dotenv.config();

// Initialize Neon SQL connection
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set!");
  process.exit(1);
}

console.log(
  "✓ DATABASE_URL configured (length:",
  process.env.DATABASE_URL.length,
  ")",
);

// Create the SQL function for Neon serverless
const sql = neon(process.env.DATABASE_URL);

export default sql;
