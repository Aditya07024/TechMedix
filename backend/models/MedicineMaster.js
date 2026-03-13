import sql from "../config/database.js";

export const findMedicineByName = async (name) => {
  try {
    const result = await sql`
      SELECT *
      FROM medicine_catalog
      WHERE LOWER(generic_name) = LOWER(${name})
         OR LOWER(generic_name) ILIKE '%' || LOWER(${name}) || '%'
         OR LOWER(${name}) = ANY(brand_names)
      LIMIT 1
    `;

    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Medicine lookup failed:", error);
    return null;
  }
};