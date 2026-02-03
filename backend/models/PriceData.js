import sql from "../config/database.js";

export const getPricesForMedicine = async (medicineId) => {
  return await sql`
    SELECT * FROM price_data
    WHERE medicine_id = ${medicineId}
    ORDER BY price ASC
  `;
};