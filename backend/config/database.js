import dotenv from "dotenv";
import postgres from "postgres";

// Ensure .env is loaded
dotenv.config();

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "ERROR: SUPABASE_DB_URL or DATABASE_URL environment variable is not set!",
  );
  process.exit(1);
}

console.log(
  "✓ Database connection string configured (length:",
  connectionString.length,
  ")",
);

const sql = postgres(connectionString, {
  ssl: "require",
});

sql.query = (query, params = []) => sql.unsafe(query, params);

export default sql;
