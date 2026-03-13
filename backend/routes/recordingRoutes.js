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

const router = express.Router();

// Ensure recordings directory exists
const recordingsDir = "uploads/recordings";
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Multer storage config
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
      const { appointment_id, patient_id } = req.body;

      if (!patient_id) {
        return res.status(400).json({
          success: false,
          error: "patient_id is required",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Audio file is required",
        });
      }

      // Normalize file path for browser access
      const normalizedPath = req.file.path.replace(/\\/g, "/");
      const fileUrl = `${process.env.BACKEND_URL || "http://localhost:8080"}/${normalizedPath}`;

      const recordingData = {
        appointment_id: appointment_id ? appointment_id : null,
        patient_id,
        doctor_id: req.user.id,
        file_url: fileUrl,
        duration: 0,
      };

      const recording = await saveRecording(recordingData);
      res.json({ success: true, recording });
    } catch (error) {
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
      const { patientId } = req.params;
      if (
        req.user.role === "patient" &&
        String(req.user.id) !== String(patientId)
      ) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own recordings",
        });
      }
      const recordings = await getPatientRecordings(patientId);
      // file_url from DB already contains full URL
      res.json(recordings);
    } catch (error) {
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

export default router;
