import express from "express";
import {
  markPatientArrived,
  markPatientInProgress,
  markPatientCompleted,
  getQueue,
  getQueuePos,
  skipPatientInQueue,
  resetQueueForDoctor,
} from "../controllers/queueController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Mark patient arrived
router.post("/:appointment_id/arrived", authenticate, markPatientArrived);

// Mark patient in progress
router.post(
  "/:appointment_id/in-progress",
  authenticate,
  markPatientInProgress,
);

// Mark patient completed
router.post("/:appointment_id/completed", authenticate, markPatientCompleted);

// Get queue for doctor
router.get("/doctor/:doctor_id", authenticate, getQueue);

// Get queue position
router.get("/position/:appointment_id", authenticate, getQueuePos);

// Skip patient
router.post("/:appointment_id/skip", authenticate, skipPatientInQueue);

// Reset queue
router.post("/doctor/:doctor_id/reset", authenticate, resetQueueForDoctor);

export default router;
