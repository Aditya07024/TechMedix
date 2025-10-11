import express from "express";
const app = express();
import mongoose from "mongoose";
import Medicine from "./models/medicine.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import cookieParser from "cookie-parser"; // Import cookie-parser
import authRouter from "./routes/authRouter.js";
// import  authenticate  from "./middleware/auth.js";
import QRCode from "qrcode";
import doctorAuthRouter from "./routes/doctorAuthRouter.js"; // Import doctor auth router
import { authenticate, authorizeRoles } from "./middleware/auth.js"; // Import authenticate and authorizeRoles

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL;

console.log("Backend CORS origin set to:", process.env.FRONTEND_URL);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser()); // Use cookie-parser middleware

// Add multer for file uploads
import multer from "multer";
import Report from "./models/report.js"; // We'll create this model next
import PatientData from "./models/patientData.js"; // New import for PatientData
import Patient from "./models/patient.js"; // New import for Patient

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });
async function main() {
  await mongoose.connect(process.env.MONGO_URL);
}
main()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/medicines", async (req, res) => {
  const allMedicines = await Medicine.find();
  res.json(allMedicines);
});

//new medicine route
app.post("/new", async (req, res) => {
  const newMedicine = new Medicine(req.body);
  await newMedicine.save();
  console.log(newMedicine);
  // res.redirect("/");
  console.log("Medicine saved");
  res.status(201).json(newMedicine);
});

//edit route
app.get("/medicines/:id", async (req, res) => {
  try {
    const updated = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// delete route
app.delete("/medicines/:id", async (req, res) => {
  try {
    const deleted = await Medicine.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    res.json({ message: "Medicine deleted successfully" });
  } catch (err) {
    console.error("Error deleting medicine:", err);
    res.status(500).json({ error: "Failed to delete medicine" });
  }
});

// update route
app.put("/medicines/:id", async (req, res) => {
  try {
    const updated = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Medicine not found" });
    res.json(updated);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});

app.get("/api/medicines/search", async (req, res) => {
  try {
    const { medicine, solution } = req.query;
    console.log("Search Query:", { medicine, solution });

    let medicineData = null,
      salt = null,
      similarMedicines = [];

    if (medicine) {
      // Search by medicine name or salt and include all fields
      medicineData = await Medicine.findOne({
        $or: [
          { name: { $regex: `^${medicine}$`, $options: "i" } },
          { salt: { $regex: medicine, $options: "i" } },
        ],
      }).select(
        "name price salt info benefits sideeffects usage working safetyadvice image link"
      );

      if (medicineData) {
        salt = medicineData.salt;
        // Find similar medicines with same salt excluding the found medicine
        similarMedicines = await Medicine.find({
          salt: salt,
          _id: { $ne: medicineData._id },
        })
          .select(
            "name price salt info benefits sideeffects usage working safetyadvice image link"
          )
          .sort({ name: 1 })
          .limit(10);
      } else {
        // If no exact medicineData found, do a broader search on both name and salt fields
        similarMedicines = await Medicine.find({
          $or: [
            { name: { $regex: medicine, $options: "i" } },
            { salt: { $regex: medicine, $options: "i" } },
          ],
        })
          .select(
            "name price salt info benefits sideeffects usage working safetyadvice image link"
          )
          .sort({ name: 1 })
          .limit(10);
        if (similarMedicines.length > 0) {
          salt = similarMedicines[0].salt;
        }
      }
    } else if (solution) {
      // Search by salt/solution
      similarMedicines = await Medicine.find({
        salt: { $regex: solution, $options: "i" },
      })
        .select(
          "name price salt info benefits sideeffects usage working safetyadvice image link"
        )
        .sort({ name: 1 })
        .limit(10);
      salt = solution;
    }

    if (!medicineData && similarMedicines.length === 0) {
      return res
        .status(404)
        .json({ message: "No medicines found matching your query." });
    }

    console.log("Search Results:", {
      medicineData,
      salt,
      similarMedicines,
    });
    res.json({ medicineData, salt, similarMedicines });
  } catch (error) {
    console.error("Error in search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/medicines/:id", async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }
    res.json(medicine);
  } catch (error) {
    console.error("Error fetching medicine:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/allmedicines", async (req, res) => {
  res.send(await Medicine.find());
});

app.get("/test", (req, res) => {
  let sampleMedicine = new Medicine({
    name: "Warfarin Soodiumm",
    price: 100,
    info: "Warfarin is an anticoagulant used to prevent blood clots.",
    category: "Anticoagulant",
    salt: "Warfarin Sodium",
    benefits: "Prevents blood clots, reduces risk of stroke.",
    sideeffects: "Bleeding, nausea, diarrhea.",
    usage: "As directed by a healthcare provider.",
    working: "Inhibits vitamin K epoxide reductase, reducing clotting factors.",
    safetyadvice: "Avoid alcohol, monitor INR levels regularly.",
  });
  sampleMedicine
    .save()
    .then(() => {
      console.log("Sample medicine saved successfully!");
      res.send("Sample medicine saved successfully!");
    })
    .catch((err) => {
      console.error("Error saving sample medicine:", err);
      res.status(500).send("Error saving sample medicine: " + err.message);
    });
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
      }
    );
    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
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

    const newReport = new Report({
      userId,
      filePath: reportPath,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      aiReport: aiGeneratedReport,
    });
    await newReport.save();

    res.status(200).json({
      message: "Report uploaded and processed successfully",
      aiReport: aiGeneratedReport,
      reportId: newReport._id,
    });
  } catch (error) {
    console.error("Error processing report:", error);
    res.status(500).json({ error: "Failed to process report" });
  }
});
// New route to fetch a single report
app.get("/api/reports/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
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

    const newPatientData = new PatientData({
      patientId,
      email,
      symptoms,
      ehr,
      medicines,
      prescription,
    });

    // Call ML model for disease prediction
    try {
      console.log("Sending symptoms to ML model:", symptoms);
      const mlResponse = await retryAxios(
        "http://localhost:5001/predict-disease",
        { symptoms },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 5000,
        }
      );
      console.log("ML model response:", mlResponse.data);
      const { predicted_disease, confidence, related_symptoms } =
        mlResponse.data; // Destructure related_symptoms
      newPatientData.predictedDisease = predicted_disease;
      newPatientData.confidence = confidence;
      newPatientData.relatedSymptoms = related_symptoms; // Save related symptoms
    } catch (mlError) {
      console.error("Error calling ML model API:", mlError.message);
      console.error(
        "ML model API response:",
        mlError.response?.data || "No response data"
      );
      console.error(
        "ML model API status:",
        mlError.response?.status || "No status"
      );
      console.error("Full error:", mlError);
      newPatientData.predictedDisease = "ML Prediction Failed";
      newPatientData.confidence = 0;
    }

    // Call ChatGPT API for insights
    const prompt = `Generate health insights and recommendations based on the following patient EHR data and predicted disease. Be concise and act as a medical assistant, providing actionable advice in bullet points:
    Predicted Disease: ${newPatientData.predictedDisease}
    Symptoms: ${JSON.stringify(symptoms)}
    EHR: ${JSON.stringify(ehr)}
    Medicines: ${JSON.stringify(medicines)}
    Prescription: ${JSON.stringify(prescription)}`;

    const aiResponse = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful medical assistant. Give insights and recommendations in bullet points.",
          },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const aiInsights = aiResponse.data.choices[0].message.content;

    // Update the saved patient data with AI insights
    newPatientData.aiInsights = aiInsights;
    await newPatientData.save();

    res.status(201).json({
      message: "EHR data saved and insights generated successfully",
      patientData: newPatientData,
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
    const patientEHRHistory = await PatientData.find({ patientId }).sort({
      timestamp: -1,
    });
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
    const patient = await Patient.findById(id).select("-password"); // Exclude password
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.status(200).json(patient);
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
      const patient = await Patient.findById(id);

      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Ensure the authenticated user is either the patient themselves or a doctor
      if (req.user.role === "patient" && req.user.id !== id) {
        return res.status(403).json({
          message:
            "Unauthorized: You can only generate QR for your own record.",
        });
      }

      // Data to be encoded in the QR code (e.g., patient ID, unique code)
      const qrData = JSON.stringify({
        patientId: patient._id,
        uniqueCode: patient.uniqueCode,
        // Add any other non-sensitive data you want to include in the QR code
      });

      const qrCodeImage = await QRCode.toDataURL(qrData);

      res.status(200).json({ qrCode: qrCodeImage });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  }
);

// New route for doctors to access patient data via unique code
app.get(
  "/api/doctor/patient-data/:uniqueCode",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { uniqueCode } = req.params;
      const patient = await Patient.findOne({ uniqueCode }).select("-password"); // Exclude password

      if (!patient) {
        return res
          .status(404)
          .json({ message: "Patient not found with this code." });
      }

      // Optionally, fetch latest EHR data for the patient as well
      const patientEHRHistory = await PatientData.find({
        patientId: patient._id,
      }).sort({
        timestamp: -1,
      });

      res.status(200).json({ patient, ehrHistory: patientEHRHistory });
    } catch (error) {
      console.error("Error fetching patient data for doctor:", error);
      res.status(500).json({ error: "Failed to retrieve patient data." });
    }
  }
);

// New route for patients to delete their own record
app.delete(
  "/api/patient/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Ensure the authenticated user is deleting their own record
      if (req.user.id !== id) {
        return res.status(403).json({
          message: "Unauthorized: You can only delete your own record.",
        });
      }

      const deletedPatient = await Patient.findByIdAndDelete(id);

      if (!deletedPatient) {
        return res.status(404).json({ message: "Patient not found." });
      }

      // Optionally, delete associated EHR data as well
      await PatientData.deleteMany({ patientId: id });

      res.status(200).json({
        message: "Patient record and associated data deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting patient record:", error);
      res.status(500).json({ error: "Failed to delete patient record." });
    }
  }
);

// New route for patients to delete a specific patient data record
app.delete(
  "/api/patientdata/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params; // This is the PatientData record ID
      console.log(`Attempting to delete PatientData record with ID: ${id}`);

      const patientDataRecord = await PatientData.findById(id);

      if (!patientDataRecord) {
        console.log(`Patient data record with ID ${id} not found.`);
        return res
          .status(404)
          .json({ message: "Patient data record not found." });
      }
      console.log(
        `Found PatientData record. PatientData.patientId: ${patientDataRecord.patientId.toString()}`
      );
      console.log(`Authenticated user ID: ${req.user.id}`);

      // Ensure the authenticated user is the owner of this patient data record
      if (req.user.id !== patientDataRecord.patientId.toString()) {
        console.log("Authorization failed: User ID mismatch.");
        return res.status(403).json({
          message:
            "Unauthorized: You can only delete your own patient data records.",
        });
      }
      console.log("Authorization successful. Deleting record...");

      await PatientData.findByIdAndDelete(id);

      console.log(`Patient data record with ID ${id} deleted successfully.`);
      res
        .status(200)
        .json({ message: "Patient data record deleted successfully." });
    } catch (error) {
      console.error("Error deleting patient data record:", error);
      res.status(500).json({ error: "Failed to delete patient data record." });
    }
  }
);

app.post("/api/patient/:id/qr", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch patient and latest EHR
    const patient = await Patient.findById(id);
    const latestEHR = await PatientData.find({ patientId: id })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const dataToEncode = {
      id: patient._id,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      bloodType: patient.bloodGroup || null,
      latestEHR: latestEHR[0]?.ehr || null,
    };

    // Convert to QR code Data URL
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(dataToEncode), {
      width: 300,
      margin: 2,
    });

    res.json({ qr: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate QR code" });
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
