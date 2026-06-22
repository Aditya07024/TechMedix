import { initiateWalletTopup } from '../services/paymentService.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  try {
    const result = await initiateWalletTopup({
      amount: 50,
      patientId: 'cd79a931-03de-4daa-b8b7-b3e021b82ce7' // valid patient ID from database
    });

    console.log("Returned Object:");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Failed to run initiateWalletTopup:", error.message);
    process.exit(1);
  }
}

run();
