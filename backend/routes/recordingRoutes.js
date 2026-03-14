import express from "express";
import {
  saveRecording,
  getPatientRecordings,
  getDoctorRecordings,
} from "../services/recordingService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";
import axios from "axios";

const router = express.Router();

// Ensure recordings directory exists
const recordingsDir = "uploads/recordings";
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Multer storage config (save to disk first, then upload to Cloudinary)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, recordingsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Save recording
router.post(
  "/",
  authenticate,
  authorizeRoles("doctor"),
  upload.single("audio"),
  async (req, res) => {
    try {
      const reqId = `U${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      console.log(`[RecordingUpload ${reqId}] POST /api/recordings`);
      const { appointment_id, patient_id } = req.body;
      console.log(
        `[RecordingUpload ${reqId}] by user=${req.user?.id} role=${req.user?.role} patient_id=${patient_id} appointment_id=${appointment_id}`,
      );

      if (!patient_id) {
        console.log(`[RecordingUpload ${reqId}] Missing patient_id`);
        return res.status(400).json({
          success: false,
          error: "patient_id is required",
        });
      }

      if (!req.file) {
        console.log(`[RecordingUpload ${reqId}] No file received`);
        return res.status(400).json({
          success: false,
          error: "Audio file is required",
        });
      }

      console.log(
        `[RecordingUpload ${reqId}] File: name=${req.file.originalname} path=${req.file.path} size=${req.file.size} type=${req.file.mimetype}`,
      );

      let fileUrl;
      const hasCloudinary =
        !!process.env.CLOUDINARY_CLOUD_NAME &&
        !!process.env.CLOUDINARY_API_KEY &&
        !!process.env.CLOUDINARY_API_SECRET;

      if (hasCloudinary) {
        console.log(`[RecordingUpload ${reqId}] Cloudinary detected. Uploading...`);
        // Upload to Cloudinary (audio is handled as resource_type "video")
        const folder = process.env.CLOUDINARY_FOLDER || "techmedix/recordings";
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video",
          folder,
          use_filename: true,
          unique_filename: true,
        });
        fileUrl = uploadResult.secure_url;
        console.log(
          `[RecordingUpload ${reqId}] Uploaded to Cloudinary public_id=${uploadResult.public_id} url=${fileUrl}`,
        );
        // Best-effort: remove local temp file after successful upload
        try {
          fs.unlinkSync(req.file.path);
          console.log(`[RecordingUpload ${reqId}] Temp file removed`);
        } catch (e) {
          console.warn(`[RecordingUpload ${reqId}] Temp cleanup failed: ${e.message}`);
        }
      } else {
        console.log(`[RecordingUpload ${reqId}] Cloudinary not configured. Using local URL.`);
        // Fallback: serve from local uploads directory
        const normalizedPath = req.file.path.replace(/\\/g, "/");
        fileUrl = `${process.env.BACKEND_URL}/${normalizedPath}`;
      }

      const recordingData = {
        appointment_id: appointment_id ? appointment_id : null,
        patient_id,
        doctor_id: req.user.id,
        file_url: fileUrl,
        duration: 0,
      };

      console.log(`[RecordingUpload ${reqId}] Saving to DB...`);
      const recording = await saveRecording(recordingData);
      console.log(`[RecordingUpload ${reqId}] Success id=${recording.id}`);
      res.json({ success: true, recording });
    } catch (error) {
      console.error(`[RecordingUpload ERROR] ${error.stack || error.message}`);
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

// Get patient recordings
router.get(
  "/patient/:patientId",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const reqId = `L${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const { patientId } = req.params;
      console.log(
        `[RecordingList ${reqId}] GET /api/recordings/patient/${patientId} user=${req.user?.id} role=${req.user?.role}`,
      );
      if (
        req.user.role === "patient" &&
        String(req.user.id) !== String(patientId)
      ) {
        console.log(`[RecordingList ${reqId}] Forbidden for patient ${req.user?.id}`);
        return res.status(403).json({
          success: false,
          error: "You can only view your own recordings",
        });
      }
      const recordings = await getPatientRecordings(patientId);
      console.log(`[RecordingList ${reqId}] Returned ${recordings.length} items`);
      // file_url from DB already contains full URL
      res.json(recordings);
    } catch (error) {
      console.error(`[RecordingList ERROR] ${error.stack || error.message}`);
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

// Get doctor recordings
router.get(
  "/doctor/:doctorId",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      if (String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own recordings",
        });
      }
      const recordings = await getDoctorRecordings(doctorId);

      // Attach public URL for audio playback (already in database)
      const recordingsWithUrl = recordings.map((rec) => ({
        ...rec,
        audio_url: rec.file_url, // file_url from DB already contains full URL
      }));

      res.json(recordingsWithUrl);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

// Download/stream recording with server-side logs for debugging
router.get(
  "/:id/download",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    const reqId = `D${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    try {
      const { id } = req.params;
      console.log(`[RecordingDownload ${reqId}] GET /api/recordings/${id}/download user=${req.user?.id} role=${req.user?.role}`);

      const rec = await getRecordingById(id);
      if (!rec) {
        console.log(`[RecordingDownload ${reqId}] Not found`);
        return res.status(404).json({ success: false, error: "Recording not found" });
      }

      if (req.user.role === "patient" && String(req.user.id) !== String(rec.patient_id)) {
        console.log(`[RecordingDownload ${reqId}] Forbidden for patient ${req.user.id}`);
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      if (req.user.role === "doctor" && String(req.user.id) !== String(rec.doctor_id)) {
        console.log(`[RecordingDownload ${reqId}] Forbidden for doctor ${req.user.id}`);
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const url = rec.audio_url;
      console.log(`[RecordingDownload ${reqId}] Streaming from ${url}`);

      const upstream = await axios.get(url, { responseType: "stream" });
      const len = upstream.headers["content-length"];
      const type = upstream.headers["content-type"] || "audio/mpeg";
      console.log(`[RecordingDownload ${reqId}] Headers type=${type} length=${len || "?"}`);

      res.setHeader("Content-Type", type);
      if (len) res.setHeader("Content-Length", len);
      res.setHeader("Content-Disposition", `attachment; filename=recording-${rec.id}.mp3`);

      upstream.data.on("end", () => {
        console.log(`[RecordingDownload ${reqId}] Completed for id=${id}`);
      });
      upstream.data.on("error", (e) => {
        console.error(`[RecordingDownload ${reqId}] Stream error: ${e.message}`);
      });

      upstream.data.pipe(res);
    } catch (error) {
      console.error(`[RecordingDownload ERROR] ${error.stack || error.message}`);
      res.status(500).json({ success: false, error: "Failed to download recording" });
    }
  },
);

export default router;
