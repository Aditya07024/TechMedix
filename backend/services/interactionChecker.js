import { findInteraction } from "../models/DrugInteraction.js";

function normalize(name) {
  return (name || "").toString().trim().toLowerCase();
}

export async function checkInteractionDB(drugA, drugB) {
  const cleanA = normalize(drugA);
  const cleanB = normalize(drugB);

  if (!cleanA || !cleanB) {
    return null;
  }

  try {
    return await findInteraction(cleanA, cleanB);
  } catch (err) {
    console.error("DB interaction check failed:", err.message);
    return null;
  }
}