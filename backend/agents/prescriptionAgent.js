import sql from "../config/database.js";
import { extractTextFromImage } from "../services/ocrService.js";
import { summarizePrescription } from "../services/summarizerService.js";

const prescriptionAgent = {
  async execute({ prescriptionId, userId, workflowId }) {
    console.log("🧠 Summarizer Agent started");

    if (!prescriptionId) {
      throw new Error("prescriptionId missing");
    }

    /* ───── LOAD PRESCRIPTION ───── */
    const rows = await sql`
      SELECT image_url
      FROM prescriptions
      WHERE id = ${prescriptionId}
    `;

    if (!rows.length) {
      throw new Error("Prescription not found");
    }

    const imagePath = rows[0].image_url;

    /* ───── OCR ───── */
    console.log("\n📄 Running OCR on image:", imagePath);
    const rawText = await extractTextFromImage(imagePath);

    if (!rawText || !rawText.trim()) {
      throw new Error("OCR returned empty text");
    }

    console.log("\n📄 OCR TEXT RECEIVED:\n");
    console.log(rawText);

    /* ───── SAVE OCR TEXT ───── */
    await sql`
      UPDATE prescriptions
      SET extracted_text = ${rawText}
      WHERE id = ${prescriptionId}
    `;

    /* ───── SUMMARIZER ───── */
    console.log("\n🧠 Sending OCR text to summarizer...");

    let parsed;
    try {
      // ✅ IMPORTANT: summarizer already returns parsed JSON OBJECT
      parsed = await summarizePrescription(rawText);
    } catch (err) {
      console.error("❌ Summarizer failed:", err.message);
      parsed = { medicines: [] };
    }

    /* ───── NORMALIZE OUTPUT ───── */
    if (!parsed || typeof parsed !== "object") {
      parsed = { medicines: [] };
    }

    if (!Array.isArray(parsed.medicines)) {
      parsed.medicines = [];
    }

    parsed.medicines = parsed.medicines.map(m => ({
      medicine_name: m.medicine_name ?? null,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      duration: m.duration ?? null,
      instructions: m.instructions ?? null,
      confidence: typeof m.confidence === "number" ? m.confidence : 0.8,
    }));

    /* ───── FALLBACK ───── */
    if (parsed.medicines.length === 0) {
      console.warn("⚠ Gemini returned EMPTY medicines — fallback applied");
      parsed.medicines = [
        {
          medicine_name: "UNKNOWN (Manual Review Required)",
          dosage: null,
          frequency: null,
          duration: null,
          instructions: null,
          confidence: 0.25,
        },
      ];
    }

    console.log("\n✅ PARSED MODEL JSON:");
    console.dir(parsed, { depth: null });

    /* ───── CLEAN OLD DATA ───── */
    await sql`
      DELETE FROM prescription_medicines
      WHERE prescription_id = ${prescriptionId}
    `;

    /* ───── SAVE MEDICINES ───── */
    console.log("\n💾 SAVING MEDICINES TO DB:");
    console.table(
      parsed.medicines.map(m => ({
        medicine_name: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        confidence: m.confidence,
      }))
    );

    for (const med of parsed.medicines) {
      await sql`
        INSERT INTO prescription_medicines (
          prescription_id,
          medicine_name,
          dosage,
          frequency,
          duration,
          instructions,
          confidence
        )
        VALUES (
          ${prescriptionId},
          ${med.medicine_name},
          ${med.dosage},
          ${med.frequency},
          ${med.duration},
          ${med.instructions},
          ${med.confidence}
        )
      `;
    }

    /* ───── MARK COMPLETE ───── */
    await sql`
      UPDATE prescriptions
      SET status = 'completed', processed_at = NOW()
      WHERE id = ${prescriptionId}
    `;

    console.log("✅ Agent completed successfully");
    return parsed;
  },
};

export default prescriptionAgent;