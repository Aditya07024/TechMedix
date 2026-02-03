import { extractTextFromImage } from "../backend/services/ocrService.js";

const text = await extractTextFromImage("uploads/test.jpeg");
console.log(text);