/**
 * Create price intelligence tables (platforms, medicine_prices, price_history, price_reports, price_alerts).
 * Syncs initial medicine_prices from medicines table if empty.
 */
import sql from "../config/database.js";

const run = async (fn) => {
  try {
    await fn();
  } catch (e) {
    if (!e.message?.includes("already exists")) console.warn("Migration:", e.message);
  }
};

export async function runPriceIntelligenceMigration() {
  try {
    await run(() =>
      sql`CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        region VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(() =>
      sql`CREATE TABLE IF NOT EXISTS medicine_prices (
        id SERIAL PRIMARY KEY,
        medicine_name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        platform_id INTEGER,
        type VARCHAR(50) DEFAULT 'brand',
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_mp_name ON medicine_prices(medicine_name)`);
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_mp_name_price ON medicine_prices(medicine_name, price)`);
    await run(() =>
      sql`CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        medicine_name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        platform_id INTEGER,
        source VARCHAR(50) DEFAULT 'manual',
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_ph_med ON price_history(medicine_name)`);
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_ph_name_recorded ON price_history(medicine_name, recorded_at DESC)`);
    await run(() =>
      sql`CREATE TABLE IF NOT EXISTS price_reports (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE CASCADE,
        total_original_price DECIMAL(10,2) DEFAULT 0,
        total_replaced_price DECIMAL(10,2) DEFAULT 0,
        savings DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(() =>
      sql`CREATE TABLE IF NOT EXISTS price_alerts (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        medicine_name VARCHAR(255) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        target_value DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_price_alerts_patient ON price_alerts(patient_id)`);
    await run(() => sql`CREATE INDEX IF NOT EXISTS idx_price_alerts_is_deleted ON price_alerts(is_deleted)`);

    const platformCount = await sql`SELECT COUNT(*)::int as n FROM platforms`;
    if (platformCount[0]?.n === 0) {
      await sql`INSERT INTO platforms (name, region) VALUES ('Default', 'All')`;
    }

    const count = await sql`SELECT COUNT(*)::int as n FROM medicine_prices`;
    if (count[0]?.n === 0) {
      const defaultPlatform = await sql`SELECT id FROM platforms LIMIT 1`;
      const platformId = defaultPlatform[0]?.id ?? null;
      const meds = await sql`SELECT name, price FROM medicines WHERE price > 0`;
      for (const m of meds) {
        try {
          await sql`
            INSERT INTO medicine_prices (medicine_name, price, platform_id, type)
            VALUES (${m.name}, ${m.price}, ${platformId}, 'brand')
          `;
        } catch (e) {
          console.warn("medicine_prices insert:", e.message);
        }
        try {
          await sql`
            INSERT INTO price_history (medicine_name, price, platform_id, source)
            VALUES (${m.name}, ${m.price}, ${platformId}, 'seed')
          `;
        } catch (_) {}
      }
    }

    console.log("✓ Price intelligence migration complete");
  } catch (err) {
    console.warn("⚠ Price intelligence migration:", err.message);
  }
}
