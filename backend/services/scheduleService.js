import sql from "../config/database.js";

let doctorScheduleDurationColumnPromise;

async function getDoctorScheduleDurationColumn() {
  if (!doctorScheduleDurationColumnPromise) {
    doctorScheduleDurationColumnPromise = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'doctor_schedule'
        AND column_name IN ('consultation_duration_minutes', 'consultation_duration')
    `
      .then((rows) => {
        const names = rows.map((row) => row.column_name);
        if (names.includes("consultation_duration_minutes")) {
          return "consultation_duration_minutes";
        }
        if (names.includes("consultation_duration")) {
          return "consultation_duration";
        }
        return "consultation_duration_minutes";
      })
      .catch(() => "consultation_duration_minutes");
  }

  return doctorScheduleDurationColumnPromise;
}

// Ensure optional schedule columns exist (booking_mode, max_bookings_per_slot)
let ensureScheduleColumnsPromise;
async function ensureScheduleColumns() {
  if (!ensureScheduleColumnsPromise) {
    ensureScheduleColumnsPromise = sql`
      ALTER TABLE IF EXISTS doctor_schedule
      ADD COLUMN IF NOT EXISTS booking_mode VARCHAR(32) DEFAULT 'slot',
      ADD COLUMN IF NOT EXISTS max_bookings_per_slot INTEGER DEFAULT 1
    `
      .then(() => true)
      .catch((err) => {
        console.warn("Could not ensure schedule columns:", err.message);
        ensureScheduleColumnsPromise = null;
        return false;
      });
  }

  return ensureScheduleColumnsPromise;
}

// -----------------------------
// Medicine Frequency Helper
// -----------------------------
export function getTimesFromFrequency(freq) {
  if (!freq || typeof freq !== "string") return ["08:00"];

  const map = {
    OD: ["08:00"],
    BD: ["08:00", "20:00"],
    TDS: ["08:00", "14:00", "20:00"],
    QID: ["06:00", "12:00", "18:00", "00:00"],
  };

  return map[freq.trim().toUpperCase()] || ["08:00"];
}

// -----------------------------
// Doctor Schedule Management
// -----------------------------

export async function setDoctorSchedule(data) {
  const {
    doctor_id,
    day_of_week,
    start_time,
    end_time,
    consultation_duration_minutes,
    consultation_duration, // Support both field names
    booking_mode,
    max_bookings_per_slot,
    is_active,
  } = data;

  // Input validation
  if (
    !doctor_id ||
    day_of_week === undefined ||
    day_of_week === null ||
    !start_time ||
    !end_time
  ) {
    throw new Error("Missing required schedule fields");
  }

  // Use either field name
  const duration = consultation_duration_minutes || consultation_duration || 30;
  const safeDuration = Number(duration);
  const durationColumn = await getDoctorScheduleDurationColumn();
  const safeIsActive = is_active !== undefined ? !!is_active : true;

  // make sure optional booking columns exist
  await ensureScheduleColumns();

  if (!safeDuration || safeDuration <= 0) {
    throw new Error("Invalid consultation duration");
  }

  if (start_time >= end_time) {
    throw new Error("Start time must be before end time");
  }

  // Check if schedule already exists for this day
  const existing = await sql`
    SELECT id FROM doctor_schedule
    WHERE doctor_id = ${doctor_id}
      AND day_of_week = ${parseInt(day_of_week)}
  `;

  // If exists, update it; otherwise insert
  if (existing.length > 0) {
    if (durationColumn === "consultation_duration") {
      return await sql`
        UPDATE doctor_schedule
        SET start_time = ${start_time},
            end_time = ${end_time},
            consultation_duration = ${safeDuration},
            booking_mode = ${booking_mode || "slot"},
            max_bookings_per_slot = ${Number(max_bookings_per_slot) || 1},
            is_active = ${safeIsActive},
            updated_at = CURRENT_TIMESTAMP
        WHERE doctor_id = ${doctor_id}
          AND day_of_week = ${parseInt(day_of_week)}
        RETURNING *
      `;
    }

    return await sql`
      UPDATE doctor_schedule
      SET start_time = ${start_time},
          end_time = ${end_time},
          consultation_duration_minutes = ${safeDuration},
          booking_mode = ${booking_mode || "slot"},
          max_bookings_per_slot = ${Number(max_bookings_per_slot) || 1},
          is_active = ${safeIsActive},
          updated_at = CURRENT_TIMESTAMP
      WHERE doctor_id = ${doctor_id}
        AND day_of_week = ${parseInt(day_of_week)}
      RETURNING *
    `;
  }

  if (durationColumn === "consultation_duration") {
    return await sql`
      INSERT INTO doctor_schedule
      (doctor_id, day_of_week, start_time, end_time, consultation_duration, booking_mode, max_bookings_per_slot, is_active)
      VALUES
      (${doctor_id}, ${parseInt(day_of_week)}, ${start_time}, ${end_time}, ${safeDuration}, ${booking_mode || "slot"}, ${Number(max_bookings_per_slot) || 1}, ${safeIsActive})
      RETURNING *
    `;
  }

  return await sql`
    INSERT INTO doctor_schedule
    (doctor_id, day_of_week, start_time, end_time, consultation_duration_minutes, booking_mode, max_bookings_per_slot, is_active)
    VALUES
    (${doctor_id}, ${parseInt(day_of_week)}, ${start_time}, ${end_time}, ${safeDuration}, ${booking_mode || "slot"}, ${Number(max_bookings_per_slot) || 1}, ${safeIsActive})
    RETURNING *
  `;
}

export async function getDoctorSchedule(doctorId) {
  return await sql`
    SELECT *
    FROM doctor_schedule
    WHERE doctor_id = ${doctorId}
    ORDER BY day_of_week
  `;
}

/**
 * Generate available time slots for a doctor on a specific date
 * Returns array of available time slots
 *
 * @param doctorId - Doctor UUID
 * @param targetDate - Date object (e.g., 2024-03-15)
 * @param durationMinutes - Slot duration (default 30 mins)
 * @returns Array of available slot objects {start_time, end_time, available: true/false}
 */
export async function getAvailableTimeSlots(
  doctorId,
  targetDate,
  durationMinutes = 30,
) {
  if (!doctorId || !targetDate) {
    throw new Error("Doctor ID and target date required");
  }

  // Doctor IDs are UUID strings
  const safeDoctorId = doctorId;

  // Get day of week (0-6) in UTC to avoid local timezone shifts
  const [year, month, dateVal] = String(targetDate).split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, dateVal)).getUTCDay();

  console.log("🔍 Getting slots for:", {
    doctorId: safeDoctorId,
    targetDate,
    dayOfWeek,
  });

  // Get doctor schedule for this day of week
  // ensure optional columns exist so selecting booking_mode/max_bookings works
  await ensureScheduleColumns();

  const schedule = await sql`
    SELECT * FROM doctor_schedule
    WHERE doctor_id = ${safeDoctorId}
      AND day_of_week = ${dayOfWeek}
      AND is_active = true
    LIMIT 1
  `;

  console.log("📅 Schedule found:", schedule.length > 0 ? schedule[0] : "NONE");

  if (schedule.length === 0) {
    // Return helpful debugging info
    const allSchedules = await sql`
      SELECT * FROM doctor_schedule
      WHERE doctor_id = ${safeDoctorId}
    `;
    console.log("⚠️ All schedules for doctor:", allSchedules);
    return {
      available: false,
      message: "Doctor not available on this day",
      schedules: allSchedules,
    };
  }

  const { start_time, end_time, consultation_duration_minutes } = schedule[0];
  const slotDuration = durationMinutes || consultation_duration_minutes;

  console.log("⏰ Time range:", { start_time, end_time, slotDuration });

  // Booking mode support (optional fields on doctor_schedule):
  // booking_mode: 'slot' (default - 1 booking per slot), 'limit' (use max_bookings_per_slot), 'unlimited'
  const bookingMode = schedule[0].booking_mode || schedule[0].mode || "slot";
  const maxPerSlot = Number(
    schedule[0].max_bookings_per_slot || schedule[0].max_bookings || 1,
  );

  // Get booked appointments counts for this doctor on target date grouped by slot_time
  const bookedCounts = await sql`
    SELECT slot_time, COUNT(*)::int AS cnt
    FROM appointments
    WHERE doctor_id = ${safeDoctorId}
      AND appointment_date = ${targetDate}
      AND status NOT IN ('cancelled')
    GROUP BY slot_time
  `;

  const bookedMap = {};
  for (const row of bookedCounts) {
    bookedMap[row.slot_time] = Number(row.cnt || 0);
  }

  // Generate all possible slots within working hours
  const slots = [];
  const [startHour, startMin] = start_time.split(":").map(Number);
  const [endHour, endMin] = end_time.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  for (
    let i = startMinutes;
    i + slotDuration <= endMinutes;
    i += slotDuration
  ) {
    const slotHour = Math.floor(i / 60);
    const slotMin = i % 60;
    const slotStartTime = `${String(slotHour).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;

    const existing = bookedMap[slotStartTime] || 0;

    let isAvailable = true;
    if (bookingMode === "unlimited") {
      isAvailable = true;
    } else if (bookingMode === "limit") {
      isAvailable = existing < maxPerSlot;
    } else {
      // default 'slot' mode - single booking allowed per slot
      isAvailable = existing < 1;
    }

    slots.push({
      start_time: slotStartTime,
      duration_minutes: slotDuration,
      is_available: isAvailable,
      booked_count: existing,
      max_bookings_per_slot: bookingMode === "unlimited" ? null : maxPerSlot,
      booking_mode: bookingMode,
    });
  }

  console.log("✅ Generated slots:", slots.length);

  return { available: true, slots, date: targetDate };
}

/**
 * Get available dates in the next N days for a doctor
 *
 * @param doctorId - Doctor UUID
 * @param days - Number of days to check (default 30)
 * @returns Array of dates with availability
 */
export async function getAvailableDateRange(doctorId, days = 30) {
  if (!doctorId) {
    throw new Error("Doctor ID required");
  }

  // Get doctor's schedule
  const schedule = await sql`
    SELECT * FROM doctor_schedule
    WHERE doctor_id = ${doctorId}
      AND is_active = true
  `;

  // If no schedule, return empty dates
  if (schedule.length === 0) {
    return { doctor_id: doctorId, available_dates: [] };
  }

  const activeDays = new Set(schedule.map((s) => s.day_of_week));
  const availableDates = [];

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    if (activeDays.has(date.getDay())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const dayVal = String(date.getDate()).padStart(2, "0");
      availableDates.push(`${year}-${month}-${dayVal}`);
    }
  }

  return {
    success: true,
    doctor_id: doctorId,
    available_dates: availableDates,
    data: availableDates,
  };
}
