-- Price Intelligence System (Agent-3)
-- No scraping - internal DB only. Focus on trends, insights, alerts.

-- Platforms (pharmacies/retailers)
CREATE TABLE IF NOT EXISTS platforms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  region VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- medicine_prices: current price snapshot (synced from medicines or manual/CSV)
-- Used by priceAgent for brand vs generic comparison
CREATE TABLE IF NOT EXISTS medicine_prices (
  id SERIAL PRIMARY KEY,
  medicine_name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  type VARCHAR(50) DEFAULT 'brand',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicine_prices_name ON medicine_prices(medicine_name);
CREATE INDEX IF NOT EXISTS idx_medicine_prices_platform ON medicine_prices(platform_id);

-- price_history: historical prices for trend analysis
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  medicine_name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  source VARCHAR(50) DEFAULT 'manual',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_medicine ON price_history(medicine_name);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);

-- price_reports: prescription price analysis results
CREATE TABLE IF NOT EXISTS price_reports (
  id SERIAL PRIMARY KEY,
  prescription_id UUID,
  total_original_price DECIMAL(10,2) DEFAULT 0,
  total_replaced_price DECIMAL(10,2) DEFAULT 0,
  savings DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_reports_prescription ON price_reports(prescription_id);

-- price_alerts: user-defined alerts
CREATE TABLE IF NOT EXISTS price_alerts (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  target_value DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_patient ON price_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(patient_id, is_active) WHERE is_active = true;

-- Seed default platform
INSERT INTO platforms (name, region) VALUES ('Default', 'All')
ON CONFLICT (name) DO NOTHING;
