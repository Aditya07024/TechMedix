import dotenv from "dotenv";
import path from "path";
dotenv.config();

import { updateQueueStatus } from "../services/staffService.js";

async function run() {
  try {
    const result = await updateQueueStatus({
      queueId: '693f7ca2-c1fe-4ce9-91d5-5003f2324fa7',
      status: 'in_progress',
      staffId: '152204de-357a-42de-b0a2-8e2d25d0b13c',
    });
    console.log("SUCCESS:", result);
    process.exit(0);
  } catch (err) {
    console.error("ERROR OCCURRED:", err);
    process.exit(1);
  }
}
run();
