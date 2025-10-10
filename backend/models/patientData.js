import mongoose from "mongoose";

const patientDataSchema = new mongoose.Schema({
  // Reference to registered user (if exists)
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  email: { type: String, required: true },

  // Symptoms can be dynamic (e.g., fever, cough, etc.)
  symptoms: { type: Object, required: true },

  // Store structured EHR (Electronic Health Record)
  ehr: {
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
    },
    heartRate: Number,
    glucose: Number,
    cholesterol: Number,
    temperature: Number,
    spo2: Number,
    bmi: Number,
    weight: Number,
    sleep: Number,
    steps: Number,
  },

  // Store medicines as array for flexibility
  medicines: [
    {
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
    },
  ],

  // Store prescriptions in structured format (optional)
  prescription: [
    {
      medicine: String,
      dosage: String,
      duration: String,
    },
  ],

  // Track when the record was created
  timestamp: { type: Date, default: Date.now },
  aiInsights: { type: String }, // New field for AI-generated insights
  predictedDisease: { type: String }, // New field for ML predicted disease
  confidence: { type: Number }, // New field for ML prediction confidence
  relatedSymptoms: { type: [String] }, // New field for symptoms related to the predicted disease
});

const PatientData = mongoose.model("PatientData", patientDataSchema);
export default PatientData;
