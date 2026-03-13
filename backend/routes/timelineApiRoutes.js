import express from "express";
import { getPatientMedicalTimeline } from "../controllers/timelineController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get patient timeline
router.get("/:patient_id/timeline", authenticate, getPatientMedicalTimeline);

export default router;
