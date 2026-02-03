import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/prescriptions";

// ensure folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const uploadPrescription = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");
