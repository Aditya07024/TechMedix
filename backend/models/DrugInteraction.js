import sql from "../config/database.js";

export const findInteraction = async (medA, medB) => {
  const res = await sql`
    SELECT * FROM drug_interactions
    WHERE
      (medicine_a = ${medA} AND medicine_b = ${medB})
      OR
      (medicine_a = ${medB} AND medicine_b = ${medA})
  `;
  return res;
};