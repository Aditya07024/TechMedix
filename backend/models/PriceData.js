import sql from "../config/database.js";

/*
  GET PRICES FOR MEDICINE (Sorted Lowest First)
*/
export const getPricesForMedicine = async (medicineId) => {
  try {
    return await sql`
      SELECT 
        mp.id,
        mp.medicine_id,
        mp.platform_id,
        mp.price,
        mp.discount,
        mp.stock_status,
        p.name AS platform_name,
        p.logo_url
      FROM medicine_prices mp
      JOIN platforms p ON mp.platform_id = p.id
      WHERE mp.medicine_id = ${medicineId}
      ORDER BY mp.price ASC
    `;
  } catch (error) {
    console.error("Fetch medicine prices failed:", error);
    return [];
  }
};