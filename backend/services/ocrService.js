import Tesseract from "tesseract.js";
import fs from "fs";
import sharp from "sharp";
import path from "path";

export async function extractTextFromImage(imagePath) {
  let processedPath;

  try {
    if (!imagePath) {
      throw new Error("Image path missing");
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error("Image file not found");
    }

    // Create unique processed file (avoids race conditions)
    const uniqueName = `processed_${Date.now()}_${path.basename(imagePath)}.png`;
    processedPath = path.join(path.dirname(imagePath), uniqueName);

    /* 🔥 IMAGE PREPROCESSING (optimized for prescriptions) */
    await sharp(imagePath)
      .rotate() // auto-orient
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(150)
      .resize({ width: 2000, withoutEnlargement: false })
      .toFile(processedPath);

    console.log("🔍 OCR started using Tesseract (FREE)");

    const { data } = await Tesseract.recognize(
      processedPath,
      "eng",
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`🧠 OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: "1",
      }
    );

    if (!data?.text) {
      throw new Error("OCR returned empty result");
    }

    return data.text;

  } catch (err) {
    console.error("❌ OCR Error:", err.message);
    throw new Error("Failed to extract text from image");

  } finally {
    // Safe cleanup
    if (processedPath && fs.existsSync(processedPath)) {
      try {
        fs.unlinkSync(processedPath);
      } catch (_) {
        console.warn("⚠ Failed to cleanup processed OCR file");
      }
    }
  }
}