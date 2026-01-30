import sql from "../config/database.js";

export const findMedicineByName = async (name) => {
  const res = await sql`
    SELECT * FROM medicines_master
    WHERE generic_name ILIKE ${name}
       OR ${name} = ANY(brand_names)
  `;
  return res[0];
};