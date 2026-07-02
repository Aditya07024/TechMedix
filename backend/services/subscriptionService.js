import sql from "../config/database.js";

/**
 * Ensure subscription tables exist (called on app startup)
 */
export async function ensureSubscriptionTables() {
  try {
    // 1. Individual / Hospital Subscription Plans
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        price NUMERIC DEFAULT 0,
        trial_duration_days INT DEFAULT 90,
        duration_days INT DEFAULT 30,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Alter plans to add plan_type and max_doctors if they do not exist
    await sql`
      ALTER TABLE subscription_plans
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'individual',
      ADD COLUMN IF NOT EXISTS max_doctors INTEGER DEFAULT 1
    `;

    // 2. Doctor Subscriptions
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL,
        plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'trial',
        trial_start_date TIMESTAMPTZ,
        trial_end_date TIMESTAMPTZ,
        paid_start_date TIMESTAMPTZ,
        paid_end_date TIMESTAMPTZ,
        activated_by TEXT,
        amount_paid NUMERIC DEFAULT 0,
        payment_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_subscriptions_doctor_id
      ON doctor_subscriptions (doctor_id)
    `;

    // 3. Hospitals
    await sql`
      CREATE TABLE IF NOT EXISTS hospitals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `;

    // 4. Link doctors to hospitals (add hospital_id UUID column to doctors table)
    await sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL
    `;

    // 5. Hospital Subscriptions
    await sql`
      CREATE TABLE IF NOT EXISTS hospital_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'active',
        max_doctors INTEGER DEFAULT 5,
        start_date TIMESTAMPTZ DEFAULT NOW(),
        end_date TIMESTAMPTZ,
        amount_paid NUMERIC DEFAULT 0,
        payment_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(hospital_id)
      )
    `;

    console.log("✓ Subscription and Hospital tables ready");
  } catch (err) {
    console.error("Failed to ensure subscription tables:", err.message);
  }
}

// ─── PLAN CRUD (Admin) ───

export async function createPlan({ name, price, trial_duration_days, duration_days, features, plan_type = "individual", max_doctors = 1 }) {
  const result = await sql`
    INSERT INTO subscription_plans (name, price, trial_duration_days, duration_days, features, plan_type, max_doctors)
    VALUES (
      ${name},
      ${Number(price) || 0},
      ${Number(trial_duration_days) || 90},
      ${Number(duration_days) || 30},
      ${sql.json(Array.isArray(features) ? features : [])},
      ${plan_type},
      ${Number(max_doctors) || 1}
    )
    RETURNING *
  `;
  return result[0];
}

export async function updatePlan(planId, updates) {
  const result = await sql`
    UPDATE subscription_plans
    SET
      name = COALESCE(${updates.name || null}, name),
      price = COALESCE(${updates.price != null ? Number(updates.price) : null}, price),
      trial_duration_days = COALESCE(${updates.trial_duration_days != null ? Number(updates.trial_duration_days) : null}, trial_duration_days),
      duration_days = COALESCE(${updates.duration_days != null ? Number(updates.duration_days) : null}, duration_days),
      features = COALESCE(${updates.features ? sql.json(updates.features) : null}, features),
      plan_type = COALESCE(${updates.plan_type || null}, plan_type),
      max_doctors = COALESCE(${updates.max_doctors != null ? Number(updates.max_doctors) : null}, max_doctors),
      is_active = COALESCE(${updates.is_active != null ? updates.is_active : null}, is_active),
      updated_at = NOW()
    WHERE id = ${planId}
    RETURNING *
  `;
  if (!result.length) throw new Error("Plan not found");
  return result[0];
}

export async function deletePlan(planId) {
  const result = await sql`
    DELETE FROM subscription_plans
    WHERE id = ${planId}
    RETURNING id
  `;
  if (!result.length) throw new Error("Plan not found");
  return { success: true };
}

export async function listPlans(activeOnly = false) {
  if (activeOnly) {
    return sql`
      SELECT * FROM subscription_plans
      WHERE is_active = TRUE
      ORDER BY price ASC, created_at ASC
    `;
  }
  return sql`
    SELECT * FROM subscription_plans
    ORDER BY price ASC, created_at ASC
  `;
}

// ─── DOCTOR SUBSCRIPTION ───

/**
 * Create a trial subscription for a newly registered doctor.
 * 3-month (90 day) free trial by default.
 */
export async function createTrialSubscription(doctorId) {
  const existing = await sql`
    SELECT id FROM doctor_subscriptions
    WHERE doctor_id = ${doctorId}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0];
  }

  const trialStart = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 90);

  const result = await sql`
    INSERT INTO doctor_subscriptions (doctor_id, status, trial_start_date, trial_end_date)
    VALUES (${doctorId}, 'trial', ${trialStart.toISOString()}, ${trialEnd.toISOString()})
    RETURNING *
  `;

  return result[0];
}

/**
 * Get the subscription for a doctor
 */
export async function getDoctorSubscription(doctorId) {
  const rows = await sql`
    SELECT ds.*, sp.name AS plan_name, sp.price AS plan_price, sp.features AS plan_features, sp.plan_type, sp.max_doctors,
           d.hospital_id, h.name AS hospital_name
    FROM doctor_subscriptions ds
    LEFT JOIN subscription_plans sp ON ds.plan_id = sp.id
    LEFT JOIN doctors d ON ds.doctor_id = d.id
    LEFT JOIN hospitals h ON d.hospital_id = h.id
    WHERE ds.doctor_id = ${doctorId}
    LIMIT 1
  `;

  if (!rows.length) return null;
  return rows[0];
}

/**
 * Check if a doctor has valid access (trial still valid OR active paid subscription)
 * Also checks if the doctor is linked to a hospital with an active subscription.
 */
export async function checkSubscriptionValid(doctorId) {
  // First, check if linked to a hospital and if the hospital has a valid subscription
  const docInfo = await sql`
    SELECT hospital_id FROM doctors WHERE id = ${doctorId} AND is_deleted = FALSE LIMIT 1
  `;

  if (docInfo.length && docInfo[0].hospital_id) {
    const hospitalId = docInfo[0].hospital_id;
    const hospitalSub = await sql`
      SELECT hs.*, sp.name AS plan_name, sp.price AS plan_price, h.name AS hospital_name
      FROM hospital_subscriptions hs
      JOIN hospitals h ON hs.hospital_id = h.id
      LEFT JOIN subscription_plans sp ON hs.plan_id = sp.id
      WHERE hs.hospital_id = ${hospitalId}
      LIMIT 1
    `;

    if (hospitalSub.length) {
      const hs = hospitalSub[0];
      const now = new Date();
      const end = hs.end_date ? new Date(hs.end_date) : null;

      if (hs.status === "active" && (!end || now <= end)) {
        return {
          valid: true,
          status: "hospital_covered",
          hospital_id: hospitalId,
          hospital_name: hs.hospital_name,
          plan_name: hs.plan_name || "Hospital Corporate Package",
          paid_end_date: hs.end_date,
          message: `Covered by hospital subscription: ${hs.hospital_name}`,
        };
      }
    }
  }

  const sub = await getDoctorSubscription(doctorId);

  // No subscription at all — create trial
  if (!sub) {
    await createTrialSubscription(doctorId);
    return { valid: true, status: "trial", message: "Trial started" };
  }

  const now = new Date();

  // Trial period
  if (sub.status === "trial") {
    const trialEnd = new Date(sub.trial_end_date);
    if (now <= trialEnd) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      return {
        valid: true,
        status: "trial",
        days_left: daysLeft,
        trial_end_date: sub.trial_end_date,
        message: `Trial active — ${daysLeft} days remaining`,
      };
    }
    // Trial expired
    return {
      valid: false,
      status: "trial_expired",
      trial_end_date: sub.trial_end_date,
      message: "Your free trial has expired. Please subscribe to continue using the dashboard.",
    };
  }

  // Active paid subscription
  if (sub.status === "active") {
    const paidEnd = new Date(sub.paid_end_date);
    if (now <= paidEnd) {
      const daysLeft = Math.ceil((paidEnd - now) / (1000 * 60 * 60 * 24));
      return {
        valid: true,
        status: "active",
        plan_name: sub.plan_name,
        plan_price: sub.plan_price,
        days_left: daysLeft,
        paid_end_date: sub.paid_end_date,
        message: `Active subscription — ${daysLeft} days remaining`,
      };
    }
    // Paid subscription expired — update status
    await sql`
      UPDATE doctor_subscriptions
      SET status = 'expired', updated_at = NOW()
      WHERE doctor_id = ${doctorId}
    `;
    return {
      valid: false,
      status: "expired",
      paid_end_date: sub.paid_end_date,
      message: "Your subscription has expired. Please renew to continue using the dashboard.",
    };
  }

  // Expired or cancelled
  return {
    valid: false,
    status: sub.status,
    message: "Your subscription is not active. Please contact admin to renew.",
  };
}

/**
 * Admin activates a paid subscription for a doctor
 */
export async function activateSubscription({ doctorId, planId, durationDays, amountPaid, paymentNotes, activatedBy }) {
  let planDuration = Number(durationDays) || 30;
  if (planId) {
    const plan = await sql`SELECT * FROM subscription_plans WHERE id = ${planId} LIMIT 1`;
    if (plan.length && !durationDays) {
      planDuration = plan[0].duration_days || 30;
    }
  }

  const paidStart = new Date();
  const paidEnd = new Date();
  paidEnd.setDate(paidEnd.getDate() + planDuration);

  const existing = await sql`
    SELECT id FROM doctor_subscriptions WHERE doctor_id = ${doctorId} LIMIT 1
  `;

  let result;
  if (existing.length > 0) {
    result = await sql`
      UPDATE doctor_subscriptions
      SET
        plan_id = ${planId || null},
        status = 'active',
        paid_start_date = ${paidStart.toISOString()},
        paid_end_date = ${paidEnd.toISOString()},
        activated_by = ${activatedBy || null},
        amount_paid = ${Number(amountPaid) || 0},
        payment_notes = ${paymentNotes || null},
        updated_at = NOW()
      WHERE doctor_id = ${doctorId}
      RETURNING *
    `;
  } else {
    result = await sql`
      INSERT INTO doctor_subscriptions (doctor_id, plan_id, status, paid_start_date, paid_end_date, activated_by, amount_paid, payment_notes)
      VALUES (${doctorId}, ${planId || null}, 'active', ${paidStart.toISOString()}, ${paidEnd.toISOString()}, ${activatedBy || null}, ${Number(amountPaid) || 0}, ${paymentNotes || null})
      RETURNING *
    `;
  }

  return result[0];
}

/**
 * Admin: get all doctors with their subscription status
 */
export async function getAllDoctorsWithSubscription() {
  const rows = await sql`
    SELECT 
      d.id AS doctor_id,
      d.name AS doctor_name,
      d.email AS doctor_email,
      d.specialty,
      ds.id AS subscription_id,
      ds.status AS subscription_status,
      ds.trial_start_date,
      ds.trial_end_date,
      ds.paid_start_date,
      ds.paid_end_date,
      ds.amount_paid,
      ds.payment_notes,
      sp.name AS plan_name,
      sp.price AS plan_price,
      d.hospital_id,
      h.name AS hospital_name
    FROM doctors d
    LEFT JOIN doctor_subscriptions ds ON ds.doctor_id = d.id
    LEFT JOIN subscription_plans sp ON ds.plan_id = sp.id
    LEFT JOIN hospitals h ON d.hospital_id = h.id
    WHERE d.is_deleted = FALSE
    ORDER BY d.name ASC
  `;

  return rows.map((row) => {
    const now = new Date();
    let computed_status = row.subscription_status || "none";

    if (row.hospital_id) {
      computed_status = "hospital_covered";
    } else {
      if (computed_status === "trial" && row.trial_end_date) {
        const end = new Date(row.trial_end_date);
        if (now > end) computed_status = "trial_expired";
      }
      if (computed_status === "active" && row.paid_end_date) {
        const end = new Date(row.paid_end_date);
        if (now > end) computed_status = "expired";
      }
    }

    return { ...row, computed_status };
  });
}

// ─── HOSPITAL PORTAL SERVICES ───

/**
 * Get active subscription for a hospital
 */
export async function getHospitalSubscription(hospitalId) {
  const result = await sql`
    SELECT hs.*, sp.name AS plan_name, sp.price AS plan_price, sp.features AS plan_features
    FROM hospital_subscriptions hs
    LEFT JOIN subscription_plans sp ON hs.plan_id = sp.id
    WHERE hs.hospital_id = ${hospitalId}
    LIMIT 1
  `;
  return result.length ? result[0] : null;
}

/**
 * Link a doctor to a hospital (enforcing slots limit)
 */
export async function linkDoctorToHospital(hospitalId, doctorEmail) {
  const doctor = await sql`
    SELECT id, name, email, hospital_id FROM doctors WHERE email = ${doctorEmail.toLowerCase().trim()} AND is_deleted = FALSE LIMIT 1
  `;

  if (!doctor.length) {
    throw new Error("Doctor with this email not found on TechMedix.");
  }

  const doc = doctor[0];
  if (doc.hospital_id === hospitalId) {
    throw new Error("Doctor is already linked to this hospital.");
  }

  // Check hospital's subscription slot limit
  const hs = await getHospitalSubscription(hospitalId);
  if (!hs || hs.status !== "active") {
    throw new Error("Your hospital does not have an active subscription package.");
  }

  const now = new Date();
  if (hs.end_date && now > new Date(hs.end_date)) {
    throw new Error("Your subscription has expired. Please renew to link doctors.");
  }

  // Count currently linked doctors
  const countRes = await sql`
    SELECT COUNT(*) AS count FROM doctors WHERE hospital_id = ${hospitalId} AND is_deleted = FALSE
  `;
  const currentCount = Number(countRes[0].count);

  if (currentCount >= hs.max_doctors) {
    throw new Error(`Limit reached. Your subscription allows linking up to ${hs.max_doctors} doctors.`);
  }

  // Link the doctor
  const updated = await sql`
    UPDATE doctors
    SET hospital_id = ${hospitalId}, updated_at = NOW()
    WHERE id = ${doc.id}
    RETURNING id, name, email, hospital_id
  `;

  return updated[0];
}

/**
 * Unlink a doctor from a hospital
 */
export async function unlinkDoctorFromHospital(hospitalId, doctorId) {
  const result = await sql`
    UPDATE doctors
    SET hospital_id = NULL, updated_at = NOW()
    WHERE id = ${doctorId} AND hospital_id = ${hospitalId}
    RETURNING id, name, email, hospital_id
  `;

  if (!result.length) {
    throw new Error("Doctor is not linked to this hospital or not found.");
  }
  return result[0];
}

/**
 * List all doctors linked to a hospital
 */
export async function listHospitalDoctors(hospitalId) {
  return sql`
    SELECT id, name, email, specialty, consultation_fee, created_at
    FROM doctors
    WHERE hospital_id = ${hospitalId} AND is_deleted = FALSE
    ORDER BY name ASC
  `;
}

/**
 * Admin / Hospital activates subscription package for a hospital
 */
export async function activateHospitalSubscription({ hospitalId, planId, durationDays, amountPaid, paymentNotes }) {
  let planDuration = Number(durationDays) || 30;
  let maxDoctors = 5; // Default slots
  if (planId) {
    const plan = await sql`SELECT * FROM subscription_plans WHERE id = ${planId} LIMIT 1`;
    if (plan.length) {
      planDuration = plan[0].duration_days || 30;
      maxDoctors = plan[0].max_doctors || 5;
    }
  }

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + planDuration);

  const existing = await sql`
    SELECT id FROM hospital_subscriptions WHERE hospital_id = ${hospitalId} LIMIT 1
  `;

  let result;
  if (existing.length > 0) {
    result = await sql`
      UPDATE hospital_subscriptions
      SET
        plan_id = ${planId || null},
        status = 'active',
        max_doctors = ${maxDoctors},
        start_date = ${start.toISOString()},
        end_date = ${end.toISOString()},
        amount_paid = ${Number(amountPaid) || 0},
        payment_notes = ${paymentNotes || null},
        updated_at = NOW()
      WHERE hospital_id = ${hospitalId}
      RETURNING *
    `;
  } else {
    result = await sql`
      INSERT INTO hospital_subscriptions (hospital_id, plan_id, status, max_doctors, start_date, end_date, amount_paid, payment_notes)
      VALUES (${hospitalId}, ${planId || null}, 'active', ${maxDoctors}, ${start.toISOString()}, ${end.toISOString()}, ${Number(amountPaid) || 0}, ${paymentNotes || null})
      RETURNING *
    `;
  }

  return result[0];
}

/**
 * Admin: Get all hospitals with subscription status
 */
export async function getAllHospitalsWithSubscription() {
  const rows = await sql`
    SELECT 
      h.id AS hospital_id,
      h.name AS hospital_name,
      h.email AS hospital_email,
      h.phone,
      hs.id AS subscription_id,
      hs.status AS subscription_status,
      hs.max_doctors,
      hs.start_date,
      hs.end_date,
      hs.amount_paid,
      hs.payment_notes,
      sp.name AS plan_name,
      sp.price AS plan_price,
      (SELECT COUNT(*) FROM doctors d WHERE d.hospital_id = h.id AND d.is_deleted = FALSE) AS linked_doctors_count
    FROM hospitals h
    LEFT JOIN hospital_subscriptions hs ON hs.hospital_id = h.id
    LEFT JOIN subscription_plans sp ON hs.plan_id = sp.id
    WHERE h.is_deleted = FALSE
    ORDER BY h.name ASC
  `;

  return rows.map((row) => {
    const now = new Date();
    let computed_status = row.subscription_status || "none";

    if (computed_status === "active" && row.end_date) {
      const end = new Date(row.end_date);
      if (now > end) computed_status = "expired";
    }

    return { ...row, computed_status };
  });
}
