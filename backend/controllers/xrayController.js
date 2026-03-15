import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";
import { analyzeChestXray } from "../services/aiService.js";
import { createMedicalScan } from "../models-pg/medicalScan.js";
import { getMedicalScansByPatient } from "../models-pg/medicalScan.js";

function hasCloudinary() {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export const analyzeXray = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const patientId = req.user?.id;
    if (!patientId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Upload to Cloudinary if configured; otherwise keep local path
    let fileUrl = null;
    let cloudinaryPublicId = null;
    if (hasCloudinary()) {
      const folder = process.env.CLOUDINARY_FOLDER
        ? `${process.env.CLOUDINARY_FOLDER}/xrays`
        : "techmedix/xrays";
      const uploadRes = await cloudinary.uploader.upload(req.file.path, {
        folder,
        resource_type: "image",
      });
      fileUrl = uploadRes.secure_url;
      cloudinaryPublicId = uploadRes.public_id;
    } else {
      // public URL served by Express static handler
      fileUrl = `/uploads/xrays/${path.basename(req.file.path)}`;
    }

    const requestHeatmap = String(req.query.heatmap || "false").toLowerCase() === "true";

    // Call Python AI service with the local file
    const ai = await analyzeChestXray({
      filePath: req.file.path,
      requestHeatmap,
    });

    console.log("AI Response:", JSON.stringify(ai, null, 2));

    if (!ai || typeof ai.primary_diagnosis !== "string") {
      console.error("Invalid AI response - expected primary_diagnosis string but got:", {
        received: ai,
        primary_diagnosis: ai?.primary_diagnosis,
        type: typeof ai?.primary_diagnosis
      });
      throw new Error("Invalid AI service response");
    }

    let heatmapUrl = null;
    if (requestHeatmap && ai.heatmap && ai.heatmap.base64 && hasCloudinary()) {
      const folder = process.env.CLOUDINARY_FOLDER
        ? `${process.env.CLOUDINARY_FOLDER}/xrays/heatmaps`
        : "techmedix/xrays/heatmaps";
      const dataUri = `data:${ai.heatmap.mime || "image/png"};base64,${ai.heatmap.base64}`;
      const heatmapUpload = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: "image",
      });
      heatmapUrl = heatmapUpload.secure_url;
    }

    // Persist in Postgres
    const row = await createMedicalScan({
      patientId,
      scanType: "chest_xray",
      fileUrl,
      prediction: ai.primary_diagnosis,
      confidence: ai.confidence,
      heatmapUrl,
      all_diagnostics: ai.all_diagnostics,
    });

    // Cleanup local file if Cloudinary used
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    return res.status(201).json({
      id: row.id,
      primary_diagnosis: ai.primary_diagnosis,
      confidence: Number(ai.confidence || 0),
      all_diagnostics: ai.all_diagnostics,
      fileUrl,
      heatmapUrl,
      createdAt: row.created_at,
      message: "X-ray analyzed successfully",
    });
  } catch (err) {
    console.error("analyzeXray error:", err);
    return res.status(500).json({ error: "Failed to analyze X-ray" });
  }
};

export const getXrayHistory = async (req, res) => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: "Unauthorized" });
    const rows = await getMedicalScansByPatient(patientId);
    const list = rows.map((r) => ({
      id: r.id,
      scanType: r.scan_type,
      fileUrl: r.file_url,
      prediction: r.prediction,
      confidence: Number(r.confidence || 0),
      all_diagnostics: r.all_diagnostics || null,
      heatmapUrl: r.heatmap_url || null,
      createdAt: r.created_at,
    }));
    res.json({ scans: list });
  } catch (err) {
    console.error("getXrayHistory error:", err);
    res.status(500).json({ error: "Failed to fetch scans" });
  }
};
