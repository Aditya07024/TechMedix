import sql from "../config/database.js";

export async function findInteraction(drugA, drugB) {
  try {
    const result = await sql`
      SELECT *
      FROM drug_interactions
      WHERE (medicine_a = ${drugA} AND medicine_b = ${drugB})
         OR (medicine_a = ${drugB} AND medicine_b = ${drugA})
      LIMIT 1
    `;

    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Drug interaction lookup failed:", error);
    return null;
  }
}