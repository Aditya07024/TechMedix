import express from "express";
const app = express();
import mongoose from "mongoose";
import Medicine from "./models/medicine.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import authRouter from "./routes/authRouter.js";
// import  authenticate  from "./middleware/auth.js";

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL;


app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Add multer for file uploads
import multer from 'multer';
import Report from './models/report.js'; // We'll create this model next

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });

async function main() {
  await mongoose.connect("mongodb+srv://adityakumar07024:adityakumar07024@cluster0.1a1j7eo.mongodb.net/");
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
          { salt: { $regex: medicine, $options: "i" } }
        ]
      }).select(
        "name price salt info benefits sideeffects usage working safetyadvice image link"
      );

      if (medicineData) {
        salt = medicineData.salt;
        // Find similar medicines with same salt excluding the found medicine
        similarMedicines = await Medicine.find({
          salt: salt,
          _id: { $ne: medicineData._id }
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
            { salt: { $regex: medicine, $options: "i" } }
          ]
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
      return res.status(404).json({ message: "No medicines found matching your query." });
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
app.post('/api/upload-report', upload.single('report'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const reportPath = req.file.path;
  const userId = req.body.userId || 'anonymous'; // Assuming you have user authentication

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

    res.status(200).json({ message: 'Report uploaded and processed successfully', aiReport: aiGeneratedReport, reportId: newReport._id });

  } catch (error) {
    console.error('Error processing report:', error);
    res.status(500).json({ error: 'Failed to process report' });
  }
});

// New route to fetch a single report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use("/auth", authRouter);

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
