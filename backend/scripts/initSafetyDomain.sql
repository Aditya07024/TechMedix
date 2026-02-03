CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE prescription_status AS ENUM ('processing', 'completed', 'failed');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE warning_type AS ENUM ('interaction', 'allergy', 'dosage', 'contraindication');
CREATE TYPE agent_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE price_type AS ENUM ('brand', 'generic');
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  date_of_birth DATE,
  allergies TEXT[],
  medical_conditions TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  extracted_text TEXT,
  status prescription_status DEFAULT 'processing',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_prescriptions_user_id ON prescriptions(user_id);
CREATE TABLE prescription_medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pm_prescription_id ON prescription_medicines(prescription_id);
CREATE TABLE safety_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID UNIQUE REFERENCES prescriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_warnings INTEGER DEFAULT 0,
  risk_level risk_level,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE safety_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  safety_report_id UUID REFERENCES safety_reports(id) ON DELETE CASCADE,
  warning_type warning_type,
  severity risk_level,
  medicine_1 VARCHAR(255),
  medicine_2 VARCHAR(255),
  description TEXT,
  recommendation TEXT,
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID,
  agent_name VARCHAR(255),
  status agent_status,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

CREATE INDEX idx_agent_logs_workflow ON agent_logs(workflow_id);
CREATE TABLE drug_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_a VARCHAR(255),
  medicine_b VARCHAR(255),
  interaction_type VARCHAR(255),
  severity risk_level,
  description TEXT,
  mechanism TEXT,
  recommendation TEXT,
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interaction_pair ON drug_interactions(medicine_a, medicine_b);
CREATE TABLE medicines_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generic_name VARCHAR(255),
  brand_names TEXT[],
  active_ingredient VARCHAR(255),
  medicine_class VARCHAR(255),
  standard_dosages TEXT[],
  common_side_effects TEXT[],
  is_prescription_required BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE price_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID REFERENCES medicines_master(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255),
  type price_type,
  price DECIMAL(10,2),
  pharmacy_name VARCHAR(255),
  in_stock BOOLEAN,
  last_updated TIMESTAMP
);
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255),
  dosage VARCHAR(100),
  scheduled_time TIME,
  frequency VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_scheduled TIMESTAMP
);

CREATE INDEX idx_reminders_user ON reminders(user_id);