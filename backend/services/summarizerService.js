// backend/services/summarizerService.js
import { pipeline } from "@xenova/transformers";

let summarizer = null;

export async function summarizePrescription(text) {
  if (!summarizer) {
    console.log("🧠 Loading FLAN-T5 summarizer model...");
    summarizer = await pipeline(
      "text2text-generation",
      "Xenova/flan-t5-base"
    );
    console.log("✅ Model loaded successfully");
  }

  const prompt = `
You are a medical assistant.

Extract ONLY the medicines from the prescription text below.

Return STRICT JSON in this exact format:
{
  "medicines": [
    {
      "medicine_name": "",
      "dosage": "",
      "frequency": "",
      "duration": "",
      "instructions": ""
    }
  ]
}

Rules:
- Do NOT explain
- Do NOT add extra text
- If missing, use null

PRESCRIPTION TEXT:
${text}
`;

  console.log("\n🧠 MODEL PROMPT:\n", prompt);

  const result = await summarizer(prompt, {
    max_new_tokens: 512,
    temperature: 0,
  });

  console.log("\n✨ RAW MODEL OUTPUT:\n", result[0].generated_text);

  return result[0].generated_text;
}