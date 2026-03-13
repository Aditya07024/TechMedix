import sql from "../config/database.js";

/**
 * Initialize complete database schema
 * This creates all necessary tables for TechMedix
 */
export async function initializeCompletSchema() {
  try {
    console.log("🔄 Initializing complete database schema...");

    // 1️⃣ USERS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone VARCHAR(20),
        date_of_birth DATE,
        allergies TEXT[],
        medical_conditions TEXT[],
        role VARCHAR(50) NOT NULL DEFAULT 'patient',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 2️⃣ DOCTORS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS doctors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        specialty VARCHAR(255) NOT NULL,
        consultation_fee NUMERIC DEFAULT 500,
        experience INTEGER,
        branch_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // in case column didn't exist in older installations
    await sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC DEFAULT 500;
    `;

    // 3️⃣ PATIENTS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        age INTEGER,
        gender VARCHAR(50),
        phone VARCHAR(20),
        blood_group VARCHAR(10),
        medical_history TEXT,
        unique_code VARCHAR(10) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 4️⃣ APPOINTMENTS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        appointment_date DATE NOT NULL,
        slot_time TIME NOT NULL,
        status VARCHAR(50) DEFAULT 'booked',
        share_history BOOLEAN DEFAULT FALSE,
        recording_consent_patient BOOLEAN DEFAULT FALSE,
        follow_up_date DATE,
        branch_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 5️⃣ PAYMENTS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id),
        doctor_id UUID REFERENCES doctors(id),
        amount NUMERIC NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        transaction_id VARCHAR(255),
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 5b️⃣ WALLETS
    await sql`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
        balance NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL, -- 'credit' | 'debit'
        amount NUMERIC NOT NULL CHECK (amount >= 0),
        source VARCHAR(50),         -- e.g., 'appointment_cancel', 'payment'
        reference_id UUID,          -- appointment_id or payment_id
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_wallets_patient ON wallets(patient_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_patient ON wallet_transactions(patient_id)`;

    // 5c️⃣ DOCTOR ANALYTICS
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_analytics (
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        completed_appointments INTEGER DEFAULT 0,
        cancelled_appointments INTEGER DEFAULT 0,
        total_patients_seen INTEGER DEFAULT 0,
        avg_consultation_duration_minutes NUMERIC DEFAULT 0,
        revenue_estimated NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_doc_analytics_doctor ON doctor_analytics(doctor_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_doc_analytics_date ON doctor_analytics(date)`;

    // 6️⃣ RECORDINGS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS recordings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        audio_url VARCHAR(500) NOT NULL,
        duration INTEGER,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 7️⃣ PATIENT DATA (EHR)
    await sql`
      CREATE TABLE IF NOT EXISTS patient_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        email VARCHAR(255),
        symptoms JSONB,
        predicted_disease VARCHAR(255),
        confidence NUMERIC,
        related_symptoms TEXT[],
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
        ai_risk_assessment JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 8️⃣ DOCTOR SCHEDULE
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        consultation_duration INTEGER DEFAULT 30,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, day_of_week)
      );
    `;

    // 9️⃣ PRESCRIPTIONS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
        image_url TEXT,
        extracted_text TEXT,
        status VARCHAR(50) DEFAULT 'processing',
        risk_score NUMERIC,
        risk_level VARCHAR(50),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 🔟 DRUG INTERACTIONS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS drug_interactions (
        id SERIAL PRIMARY KEY,
        medicine_a VARCHAR(255) NOT NULL,
        medicine_b VARCHAR(255) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        description TEXT,
        mechanism TEXT,
        recommendation TEXT,
        source VARCHAR(50),
        confidence NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 1️⃣1️⃣ SAFETY WARNINGS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS safety_warnings (
        id SERIAL PRIMARY KEY,
        prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
        warning_type VARCHAR(100),
        medicine VARCHAR(255),
        severity VARCHAR(50),
        description TEXT,
        recommendation TEXT,
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 1️⃣2️⃣ MEDICINES TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS medicines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        salt VARCHAR(255),
        price NUMERIC,
        info TEXT,
        benefits TEXT,
        sideeffects TEXT,
        usage TEXT,
        working TEXT,
        safetyadvice TEXT,
        image TEXT,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 1️⃣3️⃣ REPORTS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        file_path VARCHAR(255),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        ai_report TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;

    // 1️⃣4️⃣ VISITS TABLE
    await sql`
      CREATE TABLE IF NOT EXISTS visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES doctors(id),
        patient_id UUID REFERENCES patients(id),
        visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `;

    // 1️⃣5️⃣ HEALTH METRICS TABLE (Android Health Connect Integration)
    await sql`
      CREATE TABLE IF NOT EXISTS health_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL, -- 'steps', 'heart_rate', 'sleep_duration', 'calories_burned', 'activity'
        value NUMERIC NOT NULL,
        unit VARCHAR(50) NOT NULL, -- 'count', 'bpm', 'hours', 'kcal', etc.
        recorded_at TIMESTAMP NOT NULL,
        source VARCHAR(100) DEFAULT 'health_connect',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP
      );
    `;

    // Create Indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_patients_unique_code ON patients(unique_code)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_doctor_id ON payments(doctor_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_recordings_doctor_id ON recordings(doctor_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_recordings_patient_id ON recordings(patient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_patient_data_patient_id ON patient_data(patient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_doctor_schedule_doctor_id ON doctor_schedule(doctor_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_health_metrics_patient_id ON health_metrics(patient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_health_metrics_type ON health_metrics(metric_type)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_health_metrics_recorded_at ON health_metrics(recorded_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_health_metrics_patient_type_date ON health_metrics(patient_id, metric_type, recorded_at)`;
    } catch (err) {
      console.warn("⚠️ Some indexes may already exist:", err.message);
    }

    console.log("✅ Database schema initialized successfully!");
    return true;
  } catch (error) {
    console.warn("⚠️ Schema initialization error (continuing):", error.message);
    return false;
  }
}
