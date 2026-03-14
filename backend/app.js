import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import multer from "multer";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") }); // Load from backend/.env

import express from "express";
const app = express();

import http from "http";
import { Server } from "socket.io";

import {
  registerQueueHandlers,
  registerNotificationHandlers,
} from "./socket/queueHandlers.js";
import { startCronJobs } from "./cron/jobs.js";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
startNotificationScheduler(io);
startCronJobs(io);

app.set("io", io);

// Register Socket.IO handlers
registerQueueHandlers(io);
registerNotificationHandlers(io);

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-doctor-room", (doctorId) => {
    socket.join(`doctor-${doctorId}`);
    console.log(`Socket joined doctor-${doctorId}`);
  });

  socket.on("join-patient-room", (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`Socket joined patient-${patientId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

import sql from "./config/database.js"; // Neon serverless SQL connection
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRouter from "./routes/authRouter.js";
import QRCode from "qrcode";
import doctorAuthRouter from "./routes/doctorAuthRouter.js";
import { authenticate, authorizeRoles } from "./middleware/auth.js";
import _ from "lodash";
import ExcelJS from "exceljs";
import {
  getPatientById,
  getPatientByUniqueCode,
  deletePatient as deletePatientById,
  updatePatient,
} from "./models-pg/patient.js";
import {
  createPatientData,
  getPatientDataByPatientId,
  getPatientDataById,
  deletePatientData,
  deletePatientDataByPatientId,
} from "./models-pg/patientData.js";
import { createReport, getReportById } from "./models-pg/report.js";
import { searchMedicines } from "./models-pg/medicine.js";
import prescriptionSafetyRouter from "./routes/prescriptionSafety.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import priceRoutes from "./routes/priceRoutes.js";
import { runPrescriptionMigration } from "./scripts/runPrescriptionMigration.js";
import { runSafetyReportMigration } from "./scripts/runSafetyReportMigration.js";
import { runPriceIntelligenceMigration } from "./scripts/runPriceIntelligenceMigration.js";
import { initializeCompletSchema } from "./scripts/initCompleteSchema.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import doctorScheduleRoutes from "./routes/doctorScheduleRoutes.js";
import queueRoutes from "./routes/queueRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { cancelExpiredAppointments } from "./services/cleanupService.js";
import recordingRoutes from "./routes/recordingRoutes.js";
import { sendAppointmentReminders } from "./services/notificationService.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import doctorDashboardRoutes from "./routes/doctorDashboardRoutes.js";
import patientNotificationRoutes from "./routes/patientNotificationRoutes.js";
import { startNotificationScheduler } from "./services/notificationScheduler.js";
import doctorDelayRoutes from "./routes/doctorDelayRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminBranchRoutes from "./routes/adminBranchRoutes.js";
import appointmentManagementRoutes from "./routes/appointmentManagementRoutes.js";
import timelineManagementRoutes from "./routes/timelineManagementRoutes.js";
import queueManagementRoutes from "./routes/queueManagementRoutes.js";
import safetyManagementRoutes from "./routes/safetyManagementRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import prescriptionIntelligenceRoutes from "./routes/prescriptionIntelligenceRoutes.js";
import notificationManagementRoutes from "./routes/notificationManagementRoutes.js";
import appointmentApiRoutes from "./routes/appointmentApiRoutes.js";
import prescriptionApiRoutes from "./routes/prescriptionApiRoutes.js";
import queueApiRoutes from "./routes/queueApiRoutes.js";
import timelineApiRoutes from "./routes/timelineApiRoutes.js";
import notificationApiRoutes from "./routes/notificationApiRoutes.js";
import scheduleApiRoutes from "./routes/scheduleApiRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import healthWalletRoutes from "./routes/healthWalletRoutes.js";

// Map a patient_data DB row to the frontend/Mongoose-like shape (camelCase, _id, ehr object)
function mapPatientDataRowToFrontend(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    timestamp: row.created_at,
    created_at: row.created_at,
    patientId: row.patient_id,
    email: row.email,
    symptoms: row.symptoms ?? {},
    ehr: {
      bloodPressure:
        row.blood_pressure_systolic != null ||
        row.blood_pressure_diastolic != null
          ? {
              systolic: row.blood_pressure_systolic,
              diastolic: row.blood_pressure_diastolic,
            }
          : undefined,
      heartRate: row.heart_rate,
      glucose: row.glucose,
      cholesterol: row.cholesterol,
      temperature: row.temperature,
      spo2: row.spo2,
      bmi: row.bmi,
      weight: row.weight,
      sleep: row.sleep,
      steps: row.steps,
    },
    medicines: row.medicines ?? [],
    prescription: row.prescription ?? [],
    aiInsights: row.ai_insights,
    predictedDisease: row.predicted_disease,
    confidence: row.confidence,
    relatedSymptoms: row.related_symptoms ?? [],
  };
}

// Map patient row to frontend (exclude password, camelCase)
function mapPatientRowToFrontend(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    address: row.address ?? null,
    bloodGroup: row.blood_group,
    medicalHistory: row.medical_history,
    uniqueCode: row.unique_code,
    createdAt: row.created_at,
  };
}

// Coerce form values to number or null for DB integer/numeric columns (Postgres rejects "")
function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Lightweight rule-based insights (no external service)
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function analyzeVitals(ehr = {}) {
  const s = toNumber(ehr?.bloodPressure?.systolic);
  const d = toNumber(ehr?.bloodPressure?.diastolic);
  const hr = toNumber(ehr?.heartRate);
  const glu = toNumber(ehr?.glucose);
  const chol = toNumber(ehr?.cholesterol);
  const temp = toNumber(ehr?.temperature);
  const spo2 = toNumber(ehr?.spo2);
  const bmi = toNumber(ehr?.bmi);
  const sleep = toNumber(ehr?.sleep);
  const steps = toNumber(ehr?.steps);

  const findings = [];
  const signals = { strong: 0, medium: 0 };

  // Blood pressure
  if (s != null && d != null) {
    if (s >= 140 || d >= 90) {
      findings.push("Elevated blood pressure — consistent with hypertension.");
      signals.strong++;
    } else if (s >= 130 || d >= 85) {
      findings.push("Prehypertensive range — monitor BP and reduce sodium.");
      signals.medium++;
    }
  }

  // Heart rate
  if (hr != null) {
    if (hr > 100) {
      findings.push("Tachycardia detected (>100 bpm).");
      signals.medium++;
    } else if (hr < 55) {
      findings.push("Bradycardia detected (<55 bpm); verify if athletic baseline.");
      signals.medium++;
    }
  }

  // Glucose (casual reading heuristic)
  if (glu != null) {
    if (glu >= 200) {
      findings.push("High glucose suggests diabetes — consult for HbA1c.");
      signals.strong++;
    } else if (glu >= 140) {
      findings.push("Borderline high glucose — consider fasting test.");
      signals.medium++;
    }
  }

  // Cholesterol
  if (chol != null) {
    if (chol >= 240) {
      findings.push("High total cholesterol — lifestyle + lipid panel follow‑up.");
      signals.medium++;
    } else if (chol >= 200) {
      findings.push("Borderline cholesterol — monitor diet and recheck.");
    }
  }

  // Temperature
  if (temp != null && temp >= 38.0) {
    findings.push("Fever present (≥38°C) — possible infection or inflammation.");
    signals.medium++;
  }

  // SpO2
  if (spo2 != null && spo2 < 94) {
    findings.push("Low SpO₂ (<94%) — evaluate respiratory status if symptomatic.");
    signals.strong++;
  }

  // BMI
  if (bmi != null) {
    if (bmi >= 30) {
      findings.push("Obesity range — weight management recommended.");
      signals.medium++;
    } else if (bmi >= 25) {
      findings.push("Overweight range — consider nutrition and activity plan.");
    }
  }

  // Lifestyle
  if (sleep != null && sleep < 6) {
    findings.push("Short sleep duration (<6h) — improve sleep hygiene.");
  }
  if (steps != null && steps < 5000) {
    findings.push("Low daily activity — aim for ≥7k steps/day if feasible.");
  }

  return { findings, signals };
}

function guessCondition(ehr = {}, symptoms = {}) {
  const s = toNumber(ehr?.bloodPressure?.systolic);
  const d = toNumber(ehr?.bloodPressure?.diastolic);
  const glu = toNumber(ehr?.glucose);
  const temp = toNumber(ehr?.temperature);
  const spo2 = toNumber(ehr?.spo2);
  const bmi = toNumber(ehr?.bmi);

  const sx = Object.keys(symptoms || {}).filter((k) => {
    const v = symptoms[k];
    if (v === true) return true;
    if (typeof v === "number") return v > 0.5;
    if (typeof v === "string") return v.length > 0;
    return false;
  });

  let label = "No acute condition suspected";
  let conf = 0.35;

  if ((s != null && d != null) && (s >= 140 || d >= 90)) {
    label = "Hypertension";
    conf = 0.75;
    if (bmi != null && bmi >= 30) conf += 0.05;
  }
  if (glu != null && glu >= 200) {
    label = "Diabetes Mellitus (suspected)";
    conf = Math.max(conf, 0.78);
  }
  if (temp != null && temp >= 38) {
    label = "Acute Infection (suspected)";
    conf = Math.max(conf, 0.65);
  }
  if (spo2 != null && spo2 < 94) {
    label = "Respiratory compromise (suspected)";
    conf = Math.max(conf, 0.8);
  }

  // Slight boost with supporting symptoms
  conf = clamp(conf + Math.min(sx.length * 0.02, 0.1), 0.0, 0.95);
  return { label, confidence: conf, relatedSymptoms: sx };
}

async function generateMedicalInsightsLocal(payload) {
  // Try external service first if available; otherwise use local rules
  try {
    const res = await axios.post("http://localhost:5005/insights", payload, {
      timeout: 2000,
    });
    if (res?.data?.aiInsights) {
      return {
        text: String(res.data.aiInsights).slice(0, 2000),
        predictedDisease: res.data.predictedDisease || "Agent prediction",
        confidence: Number(res.data.confidence ?? 0.6),
        relatedSymptoms: res.data.relatedSymptoms || [],
      };
    }
  } catch (e) {
    // fall through to local rules
  }

  const { findings, signals } = analyzeVitals(payload?.ehr || {});
  const guess = guessCondition(payload?.ehr || {}, payload?.symptoms || {});

  const lines = [];
  lines.push("Personalized Health Insights:");
  if (findings.length) {
    for (const f of findings) lines.push(`- ${f}`);
  } else {
    lines.push("- Vitals within general ranges. Keep tracking health metrics.");
  }
  lines.push("");
  lines.push(`ML Predicted Disease: ${guess.label} (Confidence: ${(guess.confidence * 100).toFixed(0)}%)`);
  if (guess.relatedSymptoms.length) {
    lines.push(`Related symptoms: ${guess.relatedSymptoms.join(", ")}`);
  }

  return {
    text: lines.join("\n").slice(0, 2000),
    predictedDisease: guess.label,
    confidence: guess.confidence,
    relatedSymptoms: guess.relatedSymptoms,
  };
}

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL || "http://localhost:8080"; // Set default to 8080

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow audio files to be accessed by frontend
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  }),
);

// CORS configuration - allow all origins in development for mobile app compatibility
// In production, restrict to specific origins
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : true, // Allow all origins in development (needed for mobile apps)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser()); // Use cookie-parser middleware
app.use("/uploads", express.static("uploads"));

// Add multer for file uploads

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });

// Test PostgreSQL connection on startup (non-blocking); run prescription migration so upload works
async function testConnection() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log("✓ Connected to PostgreSQL (Neon):", result[0]);

    // Initialize all database tables
    await initializeCompletSchema();

    // Run specialized migrations
    await runPrescriptionMigration();
    await runSafetyReportMigration();
    await runPriceIntelligenceMigration();
  } catch (err) {
    console.warn("⚠ Database connection warning:", err.message);
    console.warn(
      "Note: The application will continue running, but database queries may fail",
    );
    // Don't exit - allow server to start even if DB connection fails initially
  }
}

// Test connection asynchronously
testConnection();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Medicine routes will be implemented in a dedicated medicineRoutes.js file
// For now, these endpoints are temporarily disabled

app.get("/test", (req, res) => {
  res.json({ message: "API is working correctly with PostgreSQL/Neon" });
});

// AI health check route
app.get("/api/ai/health", async (req, res) => {
  try {
    await axios.post(
      "http://localhost:5005/insights",
      { symptoms: {}, ehr: {}, medicines: [], prescription: [] },
      { timeout: 2000 },
    );
    res.json({ status: "AI service running" });
  } catch {
    res.status(503).json({ status: "AI service unavailable" });
  }
});

// Multi-turn Health Chatbot — uses patient's EHR + insights as context
app.post("/api/health-chat", authenticate, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Fetch recent EHR/insights for this patient
    const rows = await getPatientDataByPatientId(req.user.id);
    const recent = rows.slice(0, 5).map(mapPatientDataRowToFrontend);

    const context = {
      patient_id: req.user.id,
      latest_metrics: recent[0]?.ehr || {},
      ai_insights_latest: recent[0]?.aiInsights || null,
      predicted_disease_latest: recent[0]?.predictedDisease || null,
      confidence_latest: recent[0]?.confidence || null,
      history_len: recent.length,
    };

    // Try local service first
    try {
      const local = await axios.post(
        "http://localhost:5005/insights",
        { chat: messages, context },
        { timeout: 2000 }
      );
      const text = local.data?.reply || local.data?.aiInsights;
      if (text) return res.json({ reply: String(text).slice(0, 2000) });
    } catch (_) {}

    // Fallback to LLM chat API (same key/baseUrl as AiPop)
    if (!apiKey || !baseUrl) {
      return res.status(503).json({ error: "AI service unavailable" });
    }

    const systemPrompt = `You are TechMedix Health Assistant. Answer conversationally using the patient's context below.
Context JSON: ${JSON.stringify(context)}
Rules:
- You may only assist with health-related, medical, wellness, symptoms, medicines, reports, prescriptions, appointments, and patient-record questions.
- If the user asks anything outside health context, reply only with: "I can only assist with your health related issues."
- Do not answer out-of-context questions, even briefly.
- Be helpful and concise for health-related questions.
- Use the context when relevant; otherwise say you need more data.
- Do not provide definitive diagnoses or prescribe; suggest seeking medical advice where appropriate.
- If metrics are borderline, explain simply and suggest next steps.`;

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: String(m.content || "") })),
      ],
      temperature: 0.3,
      max_tokens: 700,
    };

    const llm = await axios.post(`${baseUrl}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    const reply = llm.data?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
    res.json({ reply: reply.slice(0, 2000) });
  } catch (err) {
    console.error("health-chat error:", err.message);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

// New route for report uploads
app.post("/api/upload-report", upload.single("report"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const reportPath = req.file.path;
  const userId = req.body.userId || "anonymous"; // Assuming you have user authentication

  // Placeholder for AI API integration
  let aiGeneratedReport = "";
  try {
    // In a real application, you would send the file content to an AI API here.
    // For demonstration, we'll mock a response.
    // const aiResponse = await axios.post('YOUR_AI_API_ENDPOINT', { file: reportPath });
    // aiGeneratedReport = aiResponse.data.reportContent;

    // Mock AI response
    aiGeneratedReport = `AI analysis of ${req.file.originalname}:
    - Suggestion 1: Consult a specialist for further evaluation.
    - Precaution 1: Avoid self-medication.
    - This report is for informational purposes only and not a substitute for professional medical advice.`;

    const newReport = await createReport({
      userId,
      filePath: reportPath,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      aiReport: aiGeneratedReport,
    });

    res.status(200).json({
      message: "Report uploaded and processed successfully",
      aiReport: aiGeneratedReport,
      reportId: newReport.id,
    });
  } catch (error) {
    console.error("Error processing report:", error);
    res.status(500).json({ error: "Failed to process report" });
  }
});
// New route to fetch a single report
app.get("/api/reports/:id", async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to save EHR data and get AI insights
app.post("/api/patientdata", authenticate, async (req, res) => {
  try {
    const { patientId, email, symptoms, ehr, medicines, prescription } =
      req.body;

    // Determine if AI insights should be generated
    const shouldRunAI =
      symptoms ||
      ehr ||
      (medicines?.length ?? 0) > 0 ||
      (prescription?.length ?? 0) > 0;

    let ai = null;
    if (shouldRunAI) {
      ai = await generateMedicalInsightsLocal({ symptoms, ehr, medicines, prescription });
    }
    const aiInsights = ai?.text || "AI insights could not be generated at this time. Data saved successfully.";
    let predictedDisease = ai?.predictedDisease || "Agent prediction unavailable";
    let confidence = Number(ai?.confidence || 0);
    let relatedSymptoms = ai?.relatedSymptoms || [];

    const row = await createPatientData({
      patientId,
      email: email ?? "",
      symptoms: symptoms ?? {},
      bloodPressureSystolic: toNumOrNull(ehr?.bloodPressure?.systolic),
      bloodPressureDiastolic: toNumOrNull(ehr?.bloodPressure?.diastolic),
      heartRate: toNumOrNull(ehr?.heartRate),
      glucose: toNumOrNull(ehr?.glucose),
      cholesterol: toNumOrNull(ehr?.cholesterol),
      temperature: toNumOrNull(ehr?.temperature),
      spo2: toNumOrNull(ehr?.spo2),
      bmi: toNumOrNull(ehr?.bmi),
      weight: toNumOrNull(ehr?.weight),
      sleep: toNumOrNull(ehr?.sleep),
      steps: toNumOrNull(ehr?.steps),
      medicines: medicines ?? [],
      prescription: prescription ?? [],
      aiInsights,
      predictedDisease,
      confidence: Number(confidence),
      relatedSymptoms,
    });

    const patientData = mapPatientDataRowToFrontend(row);

    res.status(201).json({
      message: "EHR data saved and insights generated successfully",
      patientData,
    });
  } catch (error) {
    console.error("Error saving EHR data or generating AI insights:", error);
    res
      .status(500)
      .json({ error: "Failed to save EHR data or generate AI insights" });
  }
});

// Route to fetch EHR history for a patient
app.get("/api/patientdata/:patientId", authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const rows = await getPatientDataByPatientId(patientId);
    const patientEHRHistory = rows.map(mapPatientDataRowToFrontend);
    res.status(200).json(patientEHRHistory);
  } catch (error) {
    console.error("Error fetching patient EHR history:", error);
    res.status(500).json({ error: "Failed to fetch patient EHR history" });
  }
});

// Route to fetch patient information by ID
app.get("/api/patient/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await getPatientById(id);
    if (!row) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.status(200).json(mapPatientRowToFrontend(row));
  } catch (error) {
    console.error("Error fetching patient information:", error);
    res.status(500).json({ error: "Failed to fetch patient information" });
  }
});

// New route to generate QR code for a patient
app.get(
  "/api/patient/:id/generate-qr",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const { id } = req.params;
      let patient = await getPatientById(id);

      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Ensure the authenticated user is either the patient themselves or a doctor
      if (req.user.role === "patient" && String(req.user.id) !== String(id)) {
        return res.status(403).json({
          message:
            "Unauthorized: You can only generate QR for your own record.",
        });
      }

      let uniqueCode = patient.unique_code;
      if (!uniqueCode) {
        uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        await updatePatient(id, { uniqueCode });
      }

      console.log("QR Code data (unique ID only):", uniqueCode);

      const qrCodeImage = await QRCode.toDataURL(uniqueCode.toString(), {
        width: 200,
        margin: 2,
        errorCorrectionLevel: "L",
      });

      res.status(200).json({
        qr: qrCodeImage,
        uniqueCode,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  },
);

// New route for doctors to access patient data via unique code
app.get(
  "/api/doctor/patient-data/:uniqueCode",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { uniqueCode } = req.params;
      console.log(
        "Doctor dashboard received uniqueCode for search:",
        uniqueCode,
      );
      const patientRow = await getPatientByUniqueCode(uniqueCode);
      console.log("Result of getPatientByUniqueCode:", patientRow);

      if (!patientRow) {
        console.log("Patient not found in DB with uniqueCode:", uniqueCode);
        return res
          .status(404)
          .json({ message: "Patient not found with this code." });
      }

      const rows = await getPatientDataByPatientId(patientRow.id);
      const ehrHistory = rows.map(mapPatientDataRowToFrontend);

      res.status(200).json({
        patient: mapPatientRowToFrontend(patientRow),
        ehrHistory,
      });
    } catch (error) {
      console.error("Error fetching patient data for doctor:", error);
      res.status(500).json({ error: "Failed to retrieve patient data." });
    }
  },
);

// New route for patients to delete their own record
app.delete(
  "/api/patient/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (String(req.user.id) !== String(id)) {
        return res.status(403).json({
          message: "Unauthorized: You can only delete your own record.",
        });
      }

      const deletedPatient = await deletePatientById(id);

      if (!deletedPatient) {
        return res.status(404).json({ message: "Patient not found." });
      }

      await deletePatientDataByPatientId(id);

      res.status(200).json({
        message: "Patient record and associated data deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting patient record:", error);
      res.status(500).json({ error: "Failed to delete patient record." });
    }
  },
);

// New route for patients to delete a specific patient data record
app.delete(
  "/api/patientdata/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to delete PatientData record with ID: ${id}`);

      const patientDataRecord = await getPatientDataById(id);

      if (!patientDataRecord) {
        console.log(`Patient data record with ID ${id} not found.`);
        return res
          .status(404)
          .json({ message: "Patient data record not found." });
      }
      console.log(
        `Found PatientData record. patient_id: ${patientDataRecord.patient_id}`,
      );
      console.log(`Authenticated user ID: ${req.user.id}`);

      if (String(req.user.id) !== String(patientDataRecord.patient_id)) {
        console.log("Authorization failed: User ID mismatch.");
        return res.status(403).json({
          message:
            "Unauthorized: You can only delete your own patient data records.",
        });
      }
      console.log("Authorization successful. Deleting record...");

      await deletePatientData(id);

      console.log(`Patient data record with ID ${id} deleted successfully.`);
      res
        .status(200)
        .json({ message: "Patient data record deleted successfully." });
    } catch (error) {
      console.error("Error deleting patient data record:", error);
      res.status(500).json({ error: "Failed to delete patient data record." });
    }
  },
);

// Helper function to clean patient data based on the provided rules
const cleanPatientData = (data) => {
  // Rule 5: No Duplicates or Noise – Remove repeated, corrupted, or irrelevant data.
  // This example focuses on removing duplicates based on content.
  const uniqueData = _.uniqWith(data, _.isEqual);

  // Future improvements could include:
  // - Schema validation to remove corrupted data
  // - Filtering irrelevant fields if necessary (though current schema seems appropriate)
  // - More sophisticated duplicate detection if just content comparison is not enough
  //   (e.g., considering a timestamp window for "similar" entries)

  // Rule 1: No Bias – Data should represent all groups equally.
  // Rule 2: Balanced Samples – Each class or category should have enough and similar data points.
  // Rule 3: Accurate Labels – Ensure all data is correctly labeled.
  // Rule 4: Diverse Sources – Collect data from varied and reliable sources.
  // Rule 6: Transparency – Document how and where the data was collected.
  // Rule 7: Privacy Protection – Follow GDPR/HIPAA or similar standards; don’t include personal info without consent.
  // These rules are primarily for data collection and model training,
  // and are assumed to be handled at earlier stages or require broader system changes.
  // For the purpose of displaying/exporting a single user's history,
  // we ensure we're not introducing new biases or exposing unnecessary PII.

  return uniqueData;
};

// New route for exporting patient data to Excel
app.get("/api/patient/:id/excel", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const patientRow = await getPatientById(id);
    if (!patientRow)
      return res.status(404).json({ error: "Patient not found" });

    const rows = await getPatientDataByPatientId(id);
    const allPatientEHRHistory = rows.map(mapPatientDataRowToFrontend);
    const cleanedEHRHistory = cleanPatientData(allPatientEHRHistory);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Patient History");

    // Define columns
    worksheet.columns = [
      { header: "Record ID", key: "_id", width: 30 },
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Predicted Disease", key: "predictedDisease", width: 30 },
      { header: "Confidence", key: "confidence", width: 15 },
      { header: "AI Insights", key: "aiInsights", width: 50 },
      { header: "Symptoms", key: "symptoms", width: 50 },
      {
        header: "EHR - Blood Pressure (Systolic)",
        key: "bpSystolic",
        width: 25,
      },
      {
        header: "EHR - Blood Pressure (Diastolic)",
        key: "bpDiastolic",
        width: 25,
      },
      { header: "EHR - Heart Rate", key: "heartRate", width: 20 },
      { header: "EHR - Glucose", key: "glucose", width: 15 },
      { header: "EHR - Cholesterol", key: "cholesterol", width: 20 },
      { header: "EHR - Temperature", key: "temperature", width: 20 },
      { header: "EHR - SpO2", key: "spo2", width: 15 },
      { header: "EHR - BMI", key: "bmi", width: 15 },
      { header: "EHR - Weight", key: "weight", width: 15 },
      { header: "EHR - Sleep", key: "sleep", width: 15 },
      { header: "EHR - Steps", key: "steps", width: 15 },
      { header: "Medicines", key: "medicines", width: 50 },
      { header: "Prescriptions", key: "prescription", width: 50 },
    ];

    // Add rows from cleaned data
    cleanedEHRHistory.forEach((record) => {
      worksheet.addRow({
        _id: record._id,
        timestamp: record.timestamp,
        predictedDisease: record.predictedDisease,
        confidence: record.confidence,
        aiInsights: record.aiInsights,
        symptoms: JSON.stringify(record.symptoms),
        bpSystolic: record.ehr?.bloodPressure?.systolic,
        bpDiastolic: record.ehr?.bloodPressure?.diastolic,
        heartRate: record.ehr?.heartRate,
        glucose: record.ehr?.glucose,
        cholesterol: record.ehr?.cholesterol,
        temperature: record.ehr?.temperature,
        spo2: record.ehr?.spo2,
        bmi: record.ehr?.bmi,
        weight: record.ehr?.weight,
        sleep: record.ehr?.sleep,
        steps: record.ehr?.steps,
        medicines: record.medicines.map((med) => med.name).join(", "),
        prescription: record.prescription
          .map((pres) => pres.medicine)
          .join(", "),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=patient_history_${patientRow.id}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating Excel file:", err);
    res.status(500).json({ error: "Failed to generate Excel file." });
  }
});
app.use("/api/appointments", appointmentRoutes);
app.use("/api/appointments-v2", appointmentManagementRoutes);

app.use("/auth", authRouter);
app.use("/auth/doctor", doctorAuthRouter); // Add doctor auth router

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server with Socket.io is running on port ${PORT}`);

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    console.log(`✓ GEMINI_API_KEY loaded (length: ${key.length})`);
    if (key.length < 35)
      console.warn("⚠ GEMINI_API_KEY seems too short - check for typos");
  } else {
    console.warn(
      "⚠ GEMINI_API_KEY not set - prescription AI extraction will fail",
    );
  }
});

// Add this function near the top of the file
const retryAxios = async (url, data, config = {}, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post(url, data, config);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
// app.use("/api/prescriptions", prescriptionSafetyRouter);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/prescription", prescriptionRoutes); // frontend calls /prescription/upload
app.use("/api", safetyRoutes);
app.use("/api", priceRoutes);
app.use("/api/schedule", doctorScheduleRoutes);
app.use("/queue", queueRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/timeline", timelineManagementRoutes);
app.use("/api/recordings", recordingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notifications-v2", notificationManagementRoutes);
app.use("/api/doctor", doctorDashboardRoutes);
app.use("/api/patient-notifications", patientNotificationRoutes);
app.use("/api/doctor", doctorDelayRoutes);
app.use("/api/queue-v2", queueManagementRoutes);
app.use("/api/safety", safetyManagementRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/prescription-intelligence", prescriptionIntelligenceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/health-wallet", healthWalletRoutes);
app.use("/api/admin", adminBranchRoutes);

// New API Routes (Clean Architecture)
app.use("/api/v2/appointments", appointmentApiRoutes);
app.use("/api/v2/prescriptions", prescriptionApiRoutes);
app.use("/api/v2/queue", queueApiRoutes);
app.use("/api/v2/timeline", timelineApiRoutes);
app.use("/api/v2/notifications", notificationApiRoutes);
app.use("/api/v2/schedule", scheduleApiRoutes);

app.get("/api/user/:userId/medicines", authenticate, async (req, res) => {
  const reqId = `M${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const { userId } = req.params;
  console.log(`[Medicines ${reqId}] GET /api/user/${userId}/medicines user=${req.user?.id} role=${req.user?.role}`);

  const medicines = await sql`
    SELECT 
      pm.id,
      pm.medicine_name,
      pm.dosage,
      pm.frequency,
      pm.duration,
      p.created_at
    FROM prescription_medicines pm
    JOIN prescriptions p
    ON pm.prescription_id = p.id
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC
  `;

  console.log(`[Medicines ${reqId}] rows=${medicines.length}`);
  res.json(medicines);
});
app.delete("/api/medicines/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: "Invalid medicine id" });
  }

  await sql`
    DELETE FROM prescription_medicines
    WHERE id = ${id}
  `;

  res.json({ success: true });
});
// Medicine search (by name or salt) for prescription "Compare with salt"
app.get("/api/medicines/search", authenticate, async (req, res) => {
  try {
    const q = (
      req.query.q ||
      req.query.medicine ||
      req.query.solution ||
      ""
    ).trim();
    if (!q) {
      return res.json({ medicineData: null, similarMedicines: [] });
    }
    const rows = await searchMedicines(q);
    const medicines = rows.map((r) => ({
      _id: r.id,
      id: r.id,
      name: r.name,
      salt: r.salt,
      price: r.price,
      info: r.info,
      benefits: r.benefits,
      sideeffects: r.sideeffects,
      usage: r.usage,
      working: r.working,
      safetyadvice: r.safetyadvice,
      image: r.image,
      link: r.link,
    }));
    const medicineData = medicines[0] || null;
    const similarMedicines = medicines.slice(1);
    res.json({ medicineData, similarMedicines: medicines });
  } catch (err) {
    console.error("Medicines search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// New route for public access to patient data via unique code (for QR code)
app.get("/api/public/patient-history/:uniqueCode", async (req, res) => {
  try {
    const { uniqueCode } = req.params;
    const patientRow = await getPatientByUniqueCode(uniqueCode);

    if (!patientRow) {
      return res
        .status(404)
        .json({ message: "Patient not found with this code." });
    }

    const rows = await getPatientDataByPatientId(patientRow.id);
    const allPatientEHRHistory = rows.map(mapPatientDataRowToFrontend);
    const cleanedEHRHistory = cleanPatientData(allPatientEHRHistory);

    const patientPublicData = {
      name: patientRow.name,
      age: patientRow.age,
      gender: patientRow.gender,
      bloodGroup: patientRow.blood_group || null,
      medicalHistory: patientRow.medical_history || null,
      ehrHistory: cleanedEHRHistory.map((record) => ({
        symptoms: record.symptoms,
        ehr: record.ehr,
        medicines: record.medicines,
        prescription: record.prescription,
        timestamp: record.timestamp,
        // Remove AI insights and predictions from public response
        // aiInsights: record.aiInsights,
        // predictedDisease: record.predictedDisease,
        // confidence: record.confidence,
        // relatedSymptoms: record.relatedSymptoms,
      })),
    };

    res.status(200).json(patientPublicData);
  } catch (error) {
    console.error("Error fetching public patient data:", error);
    res.status(500).json({ error: "Failed to retrieve public patient data." });
  }
});

app.get("/api/diseases", async (req, res) => {
  const rows = await sql`SELECT category, symptom FROM diseases`;

  const grouped = {};

  rows.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r.symptom);
  });

  res.json(grouped);
});

// AI Pop Health Assistant Endpoint
app.post("/aipop", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Invalid or missing prompt" });
    }

    let reply = "";

    // Try local AI service first
    try {
      const localResponse = await axios.post(
        "http://localhost:5005/insights",
        {
          symptoms: { query: prompt },
          ehr: {},
          medicines: [],
          prescription: [],
        },
        { timeout: 5000 },
      );
      reply = localResponse.data.aiInsights || localResponse.data.reply || "";
    } catch (localError) {
      console.warn(
        "Local AI service unavailable, falling back to LLM:",
        localError.message,
      );

      // Fallback to OpenAI/LLM API if configured
      if (apiKey && baseUrl) {
        try {
          const llmResponse = await axios.post(
            `${baseUrl}/chat/completions`,
            {
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "You are TechMedix AI Medical Assistant. Provide helpful health information and medical guidance. Be concise and user-friendly.",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              temperature: 0.3,
              max_tokens: 500,
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              timeout: 10000,
            },
          );

          reply =
            llmResponse.data.choices?.[0]?.message?.content ||
            "Unable to generate response";
        } catch (llmError) {
          console.error("LLM API error:", llmError.message);
          reply =
            "I'm having trouble processing your request right now. Please try again later.";
        }
      } else {
        reply = "AI service is currently unavailable. Please check back soon.";
      }
    }

    // Ensure we have a valid reply
    if (!reply) {
      reply =
        "I couldn't generate a response. Please try rephrasing your question.";
    }

    res.json({ reply: reply.substring(0, 2000) }); // Limit response length
  } catch (error) {
    console.error("AiPop endpoint error:", error);
    res.status(500).json({
      error: "Failed to process AI request",
      reply: "An error occurred. Please try again.",
    });
  }
});

// Global error handler (must be last middleware)
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});
