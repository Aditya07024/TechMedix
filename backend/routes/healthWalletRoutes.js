import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import cloudinary from "../config/cloudinary.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  createHealthWalletDocument,
  deleteHealthWalletDocument,
  getHealthWalletDocumentById,
  getHealthWalletDocumentsByPatientId,
} from "../models-pg/healthWalletDocument.js";

const router = express.Router();

const uploadDir = "uploads/health-wallet";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed"));
      return;
    }

    cb(null, true);
  },
});

router.get(
  "/documents",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const documents = await getHealthWalletDocumentsByPatientId(req.user.id);
      res.json({ success: true, data: documents });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/documents",
  authenticate,
  authorizeRoles("patient"),
  upload.array("documents", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "At least one document is required" });
      }

      const folder =
        process.env.CLOUDINARY_HEALTH_WALLET_FOLDER || "techmedix/health-wallet";

      const uploadedDocuments = await Promise.all(
        req.files.map(async (file) => {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            resource_type: "auto",
            folder,
            use_filename: true,
            unique_filename: true,
          });

          try {
            fs.unlinkSync(file.path);
          } catch (cleanupError) {
            console.warn(
              `HealthWallet temp cleanup failed for ${file.path}: ${cleanupError.message}`,
            );
          }

          return createHealthWalletDocument({
            patient_id: req.user.id,
            public_id: uploadResult.public_id,
            file_url: uploadResult.secure_url,
            file_name: file.originalname,
            resource_type: uploadResult.resource_type || "raw",
            format: uploadResult.format || path.extname(file.originalname).slice(1),
            bytes: uploadResult.bytes || file.size,
            mime_type: file.mimetype,
          });
        }),
      );

      res.status(201).json({ success: true, data: uploadedDocuments });
    } catch (error) {
      if (req.files?.length) {
        req.files.forEach((file) => {
          try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          } catch {}
        });
      }

      res.status(500).json({ success: false, error: error.message });
    }
  },
);

router.delete(
  "/documents/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const document = await getHealthWalletDocumentById(req.params.id);

      if (!document) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      if (String(document.patient_id) !== String(req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      try {
        await cloudinary.uploader.destroy(document.public_id, {
          resource_type: document.resource_type || "raw",
          invalidate: true,
        });
      } catch (cloudinaryError) {
        console.warn(
          `Cloudinary delete failed for ${document.public_id}: ${cloudinaryError.message}`,
        );
      }

      const deleted = await deleteHealthWalletDocument(req.params.id);
      res.json({ success: true, data: deleted });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
