import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { analyzeXray, getXrayHistory } from "../controllers/xrayController.js";

const router = express.Router();

// Ensure upload dir exists
const uploadDir = path.resolve("uploads/xrays");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const allowed = new Set(["image/jpeg", "image/png", "image/jpg"]);
const fileFilter = (req, file, cb) => {
  if (!allowed.has(file.mimetype)) {
    return cb(new Error("Invalid file type. Only JPG/PNG allowed."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/scan/xray/analyze
router.post(
  "/analyze",
  authenticate,
  authorizeRoles("patient"),
  upload.single("image"),
  analyzeXray,
);

// GET /api/scan/xray/history
router.get(
  "/history",
  authenticate,
  authorizeRoles("patient"),
  getXrayHistory,
);

export default router;
