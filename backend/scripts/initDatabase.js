import pkg from "pg";
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in environment variables");
  process.exit(1);
}

const schema = `
-- Drop existing tables if they exist (for fresh setup)
DROP TABLE IF EXISTS patient_data CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

-- Doctors table
CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  specialty VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Patients table
CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR(50),
  phone VARCHAR(20),
  blood_group VARCHAR(10),
  medical_history TEXT,
  unique_code VARCHAR(10) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Medicines table
CREATE TABLE medicines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  info TEXT,
  benefits TEXT NOT NULL,
  sideeffects TEXT NOT NULL,
  usage TEXT,
  working TEXT NOT NULL,
  safetyadvice TEXT NOT NULL,
  image TEXT DEFAULT 'https://img1.exportersindia.com/product_images/bc-full/2022/1/1169423/warfarin-sodium-tablets-1642579071-6164622.jpeg',
  link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Reports table
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  file_path VARCHAR(255),
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  ai_report TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Patient Data (Health Records) table
CREATE TABLE patient_data (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  symptoms JSONB,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  glucose INTEGER,
  cholesterol INTEGER,
  temperature NUMERIC,
  spo2 INTEGER,
  bmi NUMERIC,
  weight NUMERIC,
  sleep INTEGER,
  steps INTEGER,
  medicines JSONB,
  prescription JSONB,
  ai_insights TEXT,
  predicted_disease VARCHAR(255),
  confidence NUMERIC,
  related_symptoms TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_unique_code ON patients(unique_code);
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_patient_data_patient_id ON patient_data(patient_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_doctors_is_deleted ON doctors(is_deleted);
CREATE INDEX idx_patients_is_deleted ON patients(is_deleted);
CREATE INDEX idx_medicines_is_deleted ON medicines(is_deleted);
CREATE INDEX idx_reports_is_deleted ON reports(is_deleted);
CREATE INDEX idx_patient_data_is_deleted ON patient_data(is_deleted);
`;

async function initializeDatabase() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to Neon database");

    await client.query(schema);
    console.log("✅ Database schema created successfully!");
  } catch (error) {
    console.error("❌ Error initializing database:");
    console.error("Message:", error.message);
    console.error("Details:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initializeDatabase();
