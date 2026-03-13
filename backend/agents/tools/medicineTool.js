

import { DynamicTool } from "langchain/tools";
import sql from "../../config/database.js";

/**
 * Medicine Intelligence Tool
 * - Finds medicine from DB
 * - Returns basic info
 * - Returns cheapest available price
 */

export const medicineTool = new DynamicTool({
  name: "MedicineInfoTool",
  description:
    "Fetch medicine details, safety info, and lowest available price",

  func: async (input) => {
    try {
      if (!input) {
        return JSON.stringify({
          status: "error",
          message: "No medicine name provided",
        });
      }

      const medicineName = input.trim();

      // 1️⃣ Find medicine
      const medicine = await sql`
        SELECT *
        FROM medicines
        WHERE LOWER(name) = LOWER(${medicineName})
        LIMIT 1
      `;

      if (!medicine.length) {
        return JSON.stringify({
          status: "not_found",
          message: "Medicine not found in database",
        });
      }

      const med = medicine[0];

      // 2️⃣ Get lowest price (if price table exists)
      const prices = await sql`
        SELECT *
        FROM medicine_prices
        WHERE medicine_id = ${med.id}
        ORDER BY price ASC
        LIMIT 1
      `;

      return JSON.stringify({
        status: "success",
        medicine: {
          id: med.id,
          name: med.name,
          salt: med.salt,
          price: prices.length ? prices[0].price : med.price,
          info: med.info,
          benefits: med.benefits,
          sideeffects: med.sideeffects,
          usage: med.usage,
          safetyadvice: med.safetyadvice,
        },
      });
    } catch (error) {
      console.error("MedicineTool error:", error.message);

      return JSON.stringify({
        status: "error",
        message: "Failed to fetch medicine details",
      });
    }
  },
});