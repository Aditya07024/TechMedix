import express from "express";
import prescriptionAgent from "../agents/prescriptionAgent.js";
import { extractTextFromImage } from "../services/ocrService.js";
import {
  createPrescription,
  getPrescriptionsByUser
} from "../models/Prescription.js";

const router = express.Router();

router.post("/summarize/:prescriptionId", async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    // Fetch prescription record
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    // Resolve imagePath from prescription record
    const imagePath = prescription.imagePath;

    // Extract OCR text from image
    const rawText = await extractTextFromImage(imagePath);

    // Call prescriptionAgent.execute with OCR text
    const result = await prescriptionAgent.execute({
      text: rawText
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

export default router;