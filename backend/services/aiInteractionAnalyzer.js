// backend/services/aiInteractionAnalyzer.js
// Uses local FLAN-T5 model for drug interaction analysis - no Gemini/API key required

import { pipeline } from "@xenova/transformers";

const MODEL = "Xenova/flan-t5-base";

let generator = null;
const interactionCache = new Map();

async function getGenerator() {
  if (!generator) {
    console.log("📦 Loading FLAN-T5 for interaction analysis (first run may download ~250MB)...");
    generator = await pipeline("text2text-generation", MODEL);
    console.log("✅ FLAN-T5 model loaded:", MODEL);
  }
  return generator;
}

/**
 * Parse FLAN-T5 output into structured interaction result.
 * FLAN-T5 may return short phrases - we extract yes/no and severity.
 */
function parseModelOutput(text, medA, medB) {
  const lower = (text || "").toLowerCase();
  const found = /yes|interaction|dangerous|avoid|risk|warning|contraindicated/i.test(lower);
  let severity = "medium";
  if (/critical|severe|life.?threatening|fatal/i.test(lower)) severity = "critical";
  else if (/high|serious|major/i.test(lower)) severity = "high";
  else if (/low|minor|mild/i.test(lower)) severity = "low";

  return {
    interaction_found: found,
    severity,
    description: found ? `Potential interaction between ${medA} and ${medB}. ${text}` : "",
    mechanism: found ? "Possible pharmacological interaction. Consult healthcare provider." : "",
    recommendation: found ? "Consult your doctor or pharmacist before taking these together." : "",
    confidence: 0.6,
  };
}

/**
 * Known dangerous pairs (conservative - reduces false negatives).
 * Check this first before calling the model.
 */
const KNOWN_INTERACTIONS = [
  [["warfarin", "aspirin"], "high", "Increased bleeding risk"],
  [["warfarin", "ibuprofen"], "high", "Increased bleeding risk"],
  [["methotrexate", "naproxen"], "high", "Increased toxicity"],
  [["lisinopril", "potassium"], "high", "Hyperkalemia risk"],
  [["metformin", "contrast"], "medium", "Lactic acidosis risk"],
];

function checkKnownInteractions(medA, medB) {
  const a = (medA || "").toLowerCase();
  const b = (medB || "").toLowerCase();
  for (const [[drug1, drug2], severity, desc] of KNOWN_INTERACTIONS) {
    const match1 = a.includes(drug1) && b.includes(drug2);
    const match2 = a.includes(drug2) && b.includes(drug1);
    if (match1 || match2) {
      return {
        interaction_found: true,
        severity,
        description: desc,
        mechanism: "Known drug interaction from medical literature.",
        recommendation: "Consult your doctor before taking these together.",
        confidence: 0.95,
      };
    }
  }
  return null;
}

export async function analyzeInteractionAI(medA, medB) {
  const cleanA = (medA || "").trim().toLowerCase();
  const cleanB = (medB || "").trim().toLowerCase();

  const cacheKey = [cleanA, cleanB].sort().join("|");
  if (interactionCache.has(cacheKey)) {
    return interactionCache.get(cacheKey);
  }

  const known = checkKnownInteractions(cleanA, cleanB);
  if (known) {
    interactionCache.set(cacheKey, known);
    return known;
  }

  try {
    const gen = await getGenerator();
    const prompt = `Is there a clinically significant drug interaction between ${cleanA} and ${cleanB}? Answer yes or no with severity.`;
    const output = await gen(prompt, { max_new_tokens: 50, do_sample: false });

    const first = Array.isArray(output) ? output[0] : output;
    const text = first?.generated_text ?? (typeof output === "string" ? output : "") ?? "";

    const result = parseModelOutput(text, cleanA, cleanB);
    interactionCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("⚠ AI interaction analysis failed:", err.message);
    const fallback = {
      interaction_found: false,
      severity: "low",
      description: "",
      mechanism: "",
      recommendation: "Consult your doctor if you have concerns about your medications.",
      confidence: 0,
    };
    interactionCache.set(cacheKey, fallback);
    return fallback;
  }
}
