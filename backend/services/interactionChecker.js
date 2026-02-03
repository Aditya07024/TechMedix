import DrugInteraction from "../models/DrugInteraction.js";

export async function checkInteractionDB(a, b) {
  return await DrugInteraction.findOne({
    where: {
      medicine_a: a,
      medicine_b: b
    }
  }) || await DrugInteraction.findOne({
    where: {
      medicine_a: b,
      medicine_b: a
    }
  });
}