import sql from "../config/database.js";
import { extractTextFromImage } from "../services/ocrService.js";
import { summarizePrescription } from "../services/summarizerService.js";

const prescriptionAgent = {
  async execute({ prescriptionId, userId, workflowId }) {
    console.log("🧠 Summarizer Agent started");

    if (!prescriptionId) {
      throw new Error("prescriptionId missing");
    }

    const tx = sql;
    try {
      /* ───── LOAD PRESCRIPTION ───── */
      const rows = await tx`
        SELECT image
        FROM prescriptions
        WHERE id = ${prescriptionId}
          AND is_deleted IS NOT TRUE
      `;

      if (!rows.length) {
        throw new Error("Prescription not found");
      }

      const imagePath = rows[0].image;

      /* ───── OCR ───── */
      const rawText = await extractTextFromImage(imagePath);

      if (!rawText || !rawText.trim()) {
        throw new Error("OCR returned empty text");
      }

      await tx`
        UPDATE prescriptions
        SET extracted_text = ${rawText}
        WHERE id = ${prescriptionId}
      `;

      /* ───── SUMMARIZER ───── */
      let parsed;
      try {
        parsed = await summarizePrescription(rawText);
      } catch (err) {
        console.error("Summarizer failed:", err.message);
        parsed = { medicines: [] };
      }

      if (!parsed || typeof parsed !== "object") {
        parsed = { medicines: [] };
      }

      if (!Array.isArray(parsed.medicines)) {
        parsed.medicines = [];
      }

      parsed.medicines = parsed.medicines.map((m) => ({
        medicine_name: m.medicine_name ?? null,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
        duration: m.duration ?? null,
        instructions: m.instructions ?? null,
        confidence: typeof m.confidence === "number" ? m.confidence : 0.8,
      }));

      if (parsed.medicines.length === 0) {
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

      /* ───── CLEAN OLD DATA (SOFT SAFE) ───── */
      await tx`
        DELETE FROM prescription_medicines
        WHERE prescription_id = ${prescriptionId}
      `;

      /* ───── SAVE MEDICINES ───── */
      for (const med of parsed.medicines) {
        await tx`
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
      await tx`
        UPDATE prescriptions
        SET status = 'visited',
            processed_at = NOW()
        WHERE id = ${prescriptionId}
      `;

      /* ───── AUDIT LOG ───── */
      if (userId) {
        await tx`
          INSERT INTO audit_logs (
            user_id,
            action,
            entity_type,
            entity_id,
            created_at
          )
          VALUES (
            ${userId},
            'PROCESS_PRESCRIPTION',
            'prescription',
            ${prescriptionId},
            NOW()
          )
        `;
      }

      console.log("✅ Agent completed successfully");

      return parsed;
    } catch (error) {
      console.error("Prescription Agent Failed:", error.message);

      await tx`
        UPDATE prescriptions
        SET status = 'failed'
        WHERE id = ${prescriptionId}
      `;

      throw error;
    }
  },
};

export default prescriptionAgent;
