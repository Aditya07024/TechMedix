// backend/services/summarizerService.js
// Uses facebook/bart-large-cnn (via Xenova) for summarization + medicine extraction
// No Gemini/API key required - runs fully offline

import { pipeline } from "@xenova/transformers";
import { extractMedicinesFromText } from "./medicineParser.js";

const BART_MODEL = "Xenova/bart-large-cnn";
const MAX_INPUT_LENGTH = 900; // BART limit ~1024 tokens, leave margin

let summarizer = null;

async function getSummarizer() {
  if (!summarizer) {
    console.log("📦 Loading BART summarization model (first run downloads ~1.6GB)...");
    summarizer = await pipeline("summarization", BART_MODEL);
    console.log("✅ BART model loaded:", BART_MODEL);
  }
  return summarizer;
}

/**
 * Truncate text to fit BART's input limit
 */
function truncateForBart(text) {
  if (!text || text.length <= MAX_INPUT_LENGTH) return text;
  return text.slice(0, MAX_INPUT_LENGTH) + "...";
}

/**
 * Summarize prescription OCR text with BART, then extract medicines
 */
export async function summarizePrescription(ocrText) {
  if (!ocrText || !ocrText.trim()) {
    throw new Error("No OCR text provided to summarizer");
  }

  console.log("\n📄 OCR TEXT SENT TO BART:\n");
  console.log(ocrText);

  try {
    const generator = await getSummarizer();
    const truncated = truncateForBart(ocrText);
    const output = await generator(truncated, {
      max_new_tokens: 150,
      min_length: 30,
      do_sample: false,
    });

    let summary = "";
    if (Array.isArray(output) && output[0]?.summary_text) {
      summary = output[0].summary_text;
    } else if (output?.summary_text) {
      summary = output.summary_text;
    } else if (typeof output === "string") {
      summary = output;
    } else {
      summary = JSON.stringify(output);
    }

    console.log("\n✨ BART SUMMARY:\n", summary);

    // Extract medicines from BART summary AND original OCR (BART may drop details)
    const fromSummary = extractMedicinesFromText(summary);
    const fromOcr = extractMedicinesFromText(ocrText);

    // Merge, deduplicate by normalized medicine name (prefer OCR for richer data)
    const seen = new Set();
    const medicines = [];
    for (const m of [...fromOcr, ...fromSummary]) {
      const key = (m.medicine_name || "").toLowerCase().replace(/\s+/g, " ");
      if (!key || key.length < 3) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      medicines.push({
        medicine_name: m.medicine_name ?? null,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
        duration: m.duration ?? null,
        instructions: m.instructions ?? null,
        confidence: typeof m.confidence === "number" ? m.confidence : 0.75,
      });
    }

    const parsed = { medicines };
    console.log("\n✅ PARSED MEDICINES:\n");
    console.dir(parsed, { depth: null });
    return parsed;
  } catch (err) {
    console.error("❌ BART summarizer failed:", err.message);
    // Fallback: extract from raw OCR only
    const medicines = extractMedicinesFromText(ocrText);
    if (medicines.length > 0) {
      console.log("⚠ Using raw OCR extraction fallback");
      return {
        medicines: medicines.map((m) => ({
          medicine_name: m.medicine_name ?? null,
          dosage: m.dosage ?? null,
          frequency: m.frequency ?? null,
          duration: m.duration ?? null,
          instructions: m.instructions ?? null,
          confidence: typeof m.confidence === "number" ? m.confidence : 0.7,
        })),
      };
    }
    throw err;
  }
}
