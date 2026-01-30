import dotenv from "dotenv";
dotenv.config(); // Load environment variables FIRST

import express from "express";
const app = express();
import sql from "./config/database.js"; // Neon serverless SQL connection
import axios from "axios";
import cors from "cors";
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
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import prescriptionSafetyRouter from "./routes/prescriptionSafety.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";

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

// -------------------- LangChain Agent Setup --------------------
const llm = new ChatOpenAI({
  temperature: 0.3,
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});

// ML prediction tool
const mlTool = new DynamicTool({
  name: "DiseasePredictionTool",
  description: "Predict disease based on patient symptoms",
  func: async (input) => {
    const { data } = await axios.post(
      "http://localhost:5001/predict-disease",
      { symptoms: JSON.parse(input) },
      { headers: { "Content-Type": "application/json" } }
    );
    return JSON.stringify(data);
  },
});

// EHR analysis tool
const ehrTool = new DynamicTool({
  name: "EHRAnalyzer",
  description: "Analyze patient vitals and flag medical risks",
  func: async (input) => {
    const ehr = JSON.parse(input);
    const alerts = [];

    if (ehr?.bloodPressure?.systolic > 140) alerts.push("High blood pressure");
    if (ehr?.glucose > 140) alerts.push("High glucose level");
    if (ehr?.spo2 < 92) alerts.push("Low oxygen saturation");

    return alerts.length ? alerts.join(", ") : "Vitals are within normal range";
  },
});

async function getMedicalAgent() {
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: [mlTool, ehrTool],
  });

  return new AgentExecutor({
    agent,
    tools: [mlTool, ehrTool],
    verbose: true,
  });
}
// ---------------------------------------------------------------

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL || "http://localhost:8080"; // Set default to 8080

// CORS configuration - allow all origins in development for mobile app compatibility
// In production, restrict to specific origins
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : true, // Allow all origins in development (needed for mobile apps)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser()); // Use cookie-parser middleware

// Add multer for file uploads
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });

// Test PostgreSQL connection on startup (non-blocking)
async function testConnection() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log("✓ Connected to PostgreSQL (Neon):", result[0]);
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

app.post("/aipop", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Talk like a pharmacist and a doctor. Give results in points like user can easy to understand",
          },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message,
    );
    res.status(500).json({ error: "AI service error" });
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
app.post("/api/patientdata", async (req, res) => {
  try {
    const { patientId, email, symptoms, ehr, medicines, prescription } =
      req.body;

    // Use LangChain medical agent
    const agent = await getMedicalAgent();

    const agentResult = await agent.run(`
Patient symptoms: ${JSON.stringify(symptoms)}
EHR data: ${JSON.stringify(ehr)}
Medicines: ${JSON.stringify(medicines)}
Prescription: ${JSON.stringify(prescription)}

1. Predict the disease
2. Estimate confidence
3. Provide medical insights in bullet points
`);

    let predictedDisease = "Agent prediction unavailable";
    let confidence = 0;
    let relatedSymptoms = [];
    let aiInsights = agentResult;

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
      confidence: toNumOrNull(confidence),
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
app.get("/api/patientdata/:patientId", async (req, res) => {
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
app.get("/api/patient/:id", async (req, res) => {
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
app.get("/api/patient/:id/excel", async (req, res) => {
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

app.use("/auth", authRouter);
app.use("/auth/doctor", doctorAuthRouter); // Add doctor auth router

app.listen(8080, () => {
  console.log("Server is running on port 8080");
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
        aiInsights: record.aiInsights,
        predictedDisease: record.predictedDisease,
        confidence: record.confidence,
        relatedSymptoms: record.relatedSymptoms,
      })),
    };

    res.status(200).json(patientPublicData);
  } catch (error) {
    console.error("Error fetching public patient data:", error);
    res.status(500).json({ error: "Failed to retrieve public patient data." });
  }
});
