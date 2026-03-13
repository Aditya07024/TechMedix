import sql from "../config/database.js";
import { logAudit } from "../services/auditService.js";
export async function bookAppointment(data) {
  const {
    patient_id,
    doctor_id,
    appointment_date,
    slot_time,
    share_history = false,
    recording_consent_patient = false,
  } = data;

  // -----------------------------
  // 1️⃣ Validate Doctor Schedule
  // -----------------------------
  const day = new Date(appointment_date).getDay();

  const schedule = await sql`
    SELECT * FROM doctor_schedule
    WHERE doctor_id = ${doctor_id}
    AND day_of_week = ${day}
  `;

  if (schedule.length === 0) {
    throw new Error("Doctor not available on this day");
  }

  const { start_time, end_time } = schedule[0];

  if (slot_time < start_time || slot_time > end_time) {
    throw new Error("Slot outside doctor's working hours");
  }

  // -----------------------------
  // 2️⃣ Check if slot already booked
  // -----------------------------
  const existing = await sql`
    SELECT id FROM appointments
    WHERE doctor_id = ${doctor_id}
      AND appointment_date = ${appointment_date}
      AND slot_time = ${slot_time}
      AND is_deleted = FALSE
  `;

  if (existing.length > 0) {
    throw new Error("Slot already booked");
  }

  // -----------------------------
  // 3️⃣ Fetch Doctor Branch
  // -----------------------------
  const doctor = await sql`
    SELECT branch_id FROM doctors
    WHERE id = ${doctor_id}
  `;

  if (!doctor.length) {
    throw new Error("Doctor not found");
  }

  const branch_id = doctor[0].branch_id;

  // -----------------------------
  // 4️⃣ Insert Appointment
  // -----------------------------
  const result = await sql`
    INSERT INTO appointments
    (
      patient_id,
      doctor_id,
      appointment_date,
      slot_time,
      share_history,
      recording_consent_patient,
      branch_id,
      status
    )
    VALUES
    (
      ${patient_id},
      ${doctor_id},
      ${appointment_date},
      ${slot_time},
      ${share_history},
      ${recording_consent_patient},
      ${branch_id},
      'booked'
    )
    RETURNING *
  `;

  return result[0];
}

export async function getPatientAppointments(patientId) {
  const rows = await sql`
    SELECT a.*, d.name as doctor_name,
           pay.status AS payment_status,
           pay.payment_method,
           pay.id as payment_id
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN payments pay ON pay.appointment_id = a.id AND COALESCE(pay.is_deleted,false)=FALSE
    WHERE a.patient_id = ${patientId}
      AND a.status != 'cancelled'
      AND a.is_deleted = FALSE
    ORDER BY appointment_date DESC
  `;

  // map completed->visited for UI consistency
  return rows.map((r) => ({
    ...r,
    status: r.status === 'completed' ? 'visited' : r.status,
  }));
}

export async function getDoctorAppointments(doctorId) {
  const rows = await sql`
    SELECT a.*, p.name as patient_name,
           pay.status AS payment_status,
           pay.payment_method,
           pay.id AS payment_id,
           pay.amount AS payment_amount
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN payments pay ON pay.appointment_id = a.id AND COALESCE(pay.is_deleted,false)=FALSE
    WHERE a.doctor_id = ${doctorId}
      AND a.status != 'cancelled'
      AND a.is_deleted = FALSE
    ORDER BY appointment_date DESC
  `;

  return rows.map((r) => ({
    ...r,
    status: r.status === 'completed' ? 'visited' : r.status,
  }));
}

export async function completeAppointment(appointmentId, followUpDate) {
  const updated = await sql`
    UPDATE appointments
    SET status = 'visited',
        follow_up_date = ${followUpDate}
    WHERE id = ${appointmentId}
      AND status IN ('booked','arrived')
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!updated.length) {
    throw new Error("Cannot complete this appointment");
  }

  await sql`
    INSERT INTO visits (
      appointment_id,
      doctor_id,
      patient_id
    )
    SELECT id, doctor_id, patient_id
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  await logAudit({
    action: "appointment_completed",
    table_name: "appointments",
    record_id: appointmentId,
    metadata: { followUpDate },
  });

  return { success: true };
}

export async function cancelAppointment(appointmentId, userRole, reason) {
  const result = await sql`
    UPDATE appointments
    SET status = 'cancelled',
        cancellation_reason = ${reason},
        cancelled_by = ${userRole}
    WHERE id = ${appointmentId}
      AND status IN ('booked','arrived')
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!result.length) {
    throw new Error("Cannot cancel this appointment");
  }

  await logAudit({
    action: "appointment_cancelled",
    table_name: "appointments",
    record_id: appointmentId,
    metadata: { cancelled_by: userRole, reason },
  });

  return result[0];
}

export async function rescheduleAppointment(appointmentId, newDate, newSlot) {
  // Get appointment details
  const appointment = await sql`
    SELECT doctor_id
    FROM appointments
    WHERE id = ${appointmentId}
      AND status = 'booked'
      AND is_deleted = FALSE
  `;

  if (!appointment.length) {
    throw new Error("Only booked appointments can be rescheduled");
  }

  const doctorId = appointment[0].doctor_id;

  // Validate schedule
  const day = new Date(newDate).getDay();

  const schedule = await sql`
    SELECT * FROM doctor_schedule
    WHERE doctor_id = ${doctorId}
      AND day_of_week = ${day}
  `;

  if (!schedule.length) {
    throw new Error("Doctor not available that day");
  }

  // Check slot collision
  const conflict = await sql`
    SELECT id FROM appointments
    WHERE doctor_id = ${doctorId}
      AND appointment_date = ${newDate}
      AND slot_time = ${newSlot}
      AND is_deleted = FALSE
  `;

  if (conflict.length) {
    throw new Error("Slot already booked");
  }

  const updated = await sql`
    UPDATE appointments
    SET appointment_date = ${newDate},
        slot_time = ${newSlot}
    WHERE id = ${appointmentId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  await logAudit({
    action: "appointment_rescheduled",
    table_name: "appointments",
    record_id: appointmentId,
    metadata: { newDate, newSlot },
  });

  return updated[0];
}

export async function getAppointmentById(appointmentId) {
  const appointment = await sql`
    SELECT a.*, d.name as doctor_name, p.name as patient_name, d.consultation_fee
    FROM appointments a
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = ${appointmentId}
      AND a.is_deleted = FALSE
  `;

  if (appointment.length === 0) {
    throw new Error("Appointment not found");
  }

  // normalize status for client
  const appt = appointment[0];
  if (appt.status === 'completed') {
    appt.status = 'visited';
  }
  return appt;
}

export async function updateAppointmentStatus(appointmentId, status) {
  // only expose the simplified set of statuses to callers
  const validStatuses = [
    "booked",
    "visited",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  // map the external status to the database value
  let dbStatus = status;
  if (status === "visited") {
    dbStatus = "completed"; // keep legacy value for analytics/queue
  }

  const updated = await sql`
    UPDATE appointments
    SET status = ${dbStatus},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${appointmentId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (updated.length === 0) {
    throw new Error("Appointment not found");
  }

  await logAudit({
    action: "appointment_status_updated",
    table_name: "appointments",
    record_id: appointmentId,
    metadata: { new_status: status, db_status: dbStatus },
  });

  // return user-facing status
  const result = updated[0];
  result.status = status === "visited" ? "visited" : result.status;
  return result;
}
