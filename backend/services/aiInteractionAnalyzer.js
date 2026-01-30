import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeInteractionAI(medA, medB) {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `
You are a clinical pharmacology expert.

Analyze interaction between:
Medicine A: ${medA}
Medicine B: ${medB}

Return ONLY valid JSON:
{
  "interaction_found": true/false,
  "severity": "low|medium|high|critical",
  "description": "",
  "mechanism": "",
  "recommendation": "",
  "confidence": 0.0
}
`;

  const res = await model.generateContent(prompt);
  const text = res.response.text();

  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}