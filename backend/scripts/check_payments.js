import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const payments = await sql`
      SELECT id, patient_id, doctor_id, amount, payment_method, status, razorpay_order_id, created_at
      FROM payments
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log("--- Latest Payments in Database ---");
    console.log(JSON.stringify(payments, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Database query failed:", error.message);
    process.exit(1);
  }
}

run();
