// backend/services/summarizerService.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let model;

function getModel() {
  if (!model) {
    model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });
    console.log("✅ Gemini model loaded");
  }
  return model;
}

export async function summarizePrescription(ocrText) {
  if (!ocrText || !ocrText.trim()) {
    throw new Error("No OCR text provided to summarizer");
  }

  console.log("\n📄 OCR TEXT SENT TO GEMINI:\n");
  console.log(ocrText);

  const prompt = `
You are a medical prescription extraction engine.

STRICT RULES (VERY IMPORTANT):
- Output MUST be valid JSON
- Output ONLY JSON
- No explanations
- No markdown
- No text outside JSON
- If a field is missing, use null
- medicines must ALWAYS be an array

JSON SCHEMA (FOLLOW EXACTLY):
{
  "medicines": [
    {
      "medicine_name": string,
      "dosage": string | null,
      "frequency": string | null,
      "duration": string | null,
      "instructions": string | null,
      "confidence": number
    }
  ]
}

PRESCRIPTION TEXT:
"""
${ocrText}
"""
`;

  console.log("\n🧠 GEMINI PROMPT:\n", prompt);

  const result = await getModel().generateContent(prompt);
  const rawOutput = result.response.text().trim();

  console.log("\n✨ RAW GEMINI OUTPUT:\n", rawOutput);

  const jsonStart = rawOutput.indexOf("{");
  const jsonEnd = rawOutput.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Gemini did not return JSON");
  }

  const safeJsonText = rawOutput.slice(jsonStart, jsonEnd + 1);

  let normalizedJson = safeJsonText
    .replace(/'/g, '"')
    .replace(/(\w+)\s*:/g, '"$1":');

  let parsed;
  try {
    parsed = JSON.parse(normalizedJson);
  } catch (err) {
    console.error("❌ JSON PARSE FAILED");
    console.error(normalizedJson);
    throw new Error("Invalid JSON from Gemini");
  }

  console.log("\n✅ PARSED MODEL JSON:\n");
  console.dir(parsed, { depth: null });

  return parsed;
}