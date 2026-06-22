import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const user = await sql`
      SELECT id, email, password_hash, role
      FROM users
      WHERE email = 'demo@gmail.com'
    `;
    
    console.log("User details:");
    console.log(user);
    process.exit(0);
  } catch (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
}

run();
