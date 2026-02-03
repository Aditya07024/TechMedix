// backend/services/ocrService.js
import Tesseract from "tesseract.js";
import fs from "fs";
import sharp from "sharp";
import path from "path";

export async function extractTextFromImage(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error("Image file not found");
    }

    const processedPath = imagePath + "_processed.png";

    // 🔥 STEP 1: IMAGE PREPROCESSING (CRITICAL)
    await sharp(imagePath)
      .grayscale()
      .normalize()
      .threshold(160)
      .resize({ width: 1800 }) // improves text clarity
      .toFile(processedPath);

    console.log("🔍 OCR started using Tesseract (FREE)");

    const result = await Tesseract.recognize(
      processedPath,
      "eng",
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`🧠 OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // 👈 VERY IMPORTANT
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // 👈 BEST QUALITY
        preserve_interword_spaces: "1",
      }
    );

    fs.unlinkSync(processedPath); // cleanup

    return result.data.text;
  } catch (err) {
    console.error("❌ OCR Error:", err.message);
    throw new Error("Failed to extract text from image");
  }
}