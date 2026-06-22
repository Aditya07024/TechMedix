import sql from "../config/database.js";

async function run() {
  try {
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `;
    console.log("Users table exists:", tableExists[0].exists);
    if (tableExists[0].exists) {
      const users = await sql`SELECT id, email, role, password_hash FROM users`;
      console.log("Users in database:");
      console.log(users);
    }
  } catch (error) {
    console.error("Error checking users table:", error.message);
  } finally {
    process.exit(0);
  }
}

run();
