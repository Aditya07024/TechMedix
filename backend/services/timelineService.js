import sql from "../config/database.js";

export async function getPatientTimeline(patientId) {
  if (!patientId) {
    throw new Error("patientId is required");
  }
  const pid = String(patientId);

  // Fetch all timeline-related data
  const [appointments, prescriptions, visits, diseases, reports] =
    await Promise.all([
      sql`
      SELECT 
        a.id,
        a.doctor_id,
        d.name as doctor_name,
        a.appointment_date,
        a.status,
        a.created_at
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id::text = ${pid}
    `,
      sql`
      SELECT 
  p.id,
  p.medicine_name,
  p.dosage,
  p.frequency,
  p.duration_days,
  p.created_at,
  d.name as doctor_name
      FROM prescriptions p
      LEFT JOIN doctors d ON p.doctor_id = d.id
      WHERE p.patient_id::text = ${pid}
      ORDER BY p.created_at DESC
    `,
      sql`
      SELECT 
        v.id,
        v.appointment_id,
        v.visit_type,
        v.chief_complaint,
        v.diagnosis,
        v.created_at,
        d.name as doctor_name
      FROM visits v
      LEFT JOIN doctors d ON v.doctor_id = d.id
      WHERE v.patient_id::text = ${pid}
      ORDER BY v.created_at DESC
    `,
      sql`
      SELECT 
        id,
        disease_name,
        diagnosed_on
      FROM patient_diseases
      WHERE patient_id::text = ${pid}
      ORDER BY diagnosed_on DESC
    `,
      sql`
      SELECT 
        id,
        created_at
      FROM reports
      WHERE patient_id::text = ${pid}
      ORDER BY created_at DESC
    `,
    ]);

  // Build comprehensive timeline
  const timeline = [];

  // Add appointments
  appointments.forEach((a) => {
    timeline.push({
      type: "appointment",
      id: a.id,
      date: a.appointment_date || a.created_at,
      title: `Appointment with ${a.doctor_name || "Doctor"}`,
      status: a.status,
      details: {
        doctor_name: a.doctor_name,
        appointment_date: a.appointment_date,
        status: a.status,
      },
    });
  });

  // Add prescriptions
  prescriptions.forEach((p) => {
    timeline.push({
      type: "prescription",
      id: p.id,
      date: p.created_at,
      title: `Prescription: ${p.medicine_name}`,
      status: "active",
      details: {
        medicine_name: p.medicine_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration_days: p.duration_days,
        doctor_name: p.doctor_name,
      },
    });
  });

  // Add visits
  visits.forEach((v) => {
    timeline.push({
      type: "visit",
      id: v.id,
      date: v.created_at,
      title:
        v.visit_type === "consultation" ? "Consultation" : "Follow-up Visit",
      status: "completed",
      details: {
        visit_type: v.visit_type,
        chief_complaint: v.chief_complaint,
        diagnosis: v.diagnosis,
        doctor_name: v.doctor_name,
      },
    });
  });

  // Add diseases
  diseases.forEach((d) => {
    timeline.push({
      type: "disease",
      id: d.id,
      date: d.diagnosed_on,
      title: `Diagnosis: ${d.disease_name}`,
      status: "active",
      details: {
        disease_name: d.disease_name,
        diagnosed_on: d.diagnosed_on,
      },
    });
  });

  // Add reports
  reports.forEach((r) => {
    timeline.push({
      type: "report",
      id: r.id,
      date: r.created_at,
      title: "Medical Report",
      status: "completed",
      details: {
        created_at: r.created_at,
      },
    });
  });

  // Sort by date descending (newest first)
  timeline.sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  // Group by month
  const grouped = {};
  timeline.forEach((item) => {
    const date = new Date(item.date);
    const monthKey = date.toLocaleString("default", {
      year: "numeric",
      month: "long",
    });
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(item);
  });

  return {
    patient_id: patientId,
    total_events: timeline.length,
    timeline: timeline.slice(0, 500),
    grouped_by_month: grouped,
  };
}

/**
 * Get timeline filtered by category
 */
export async function getPatientTimelineByCategory(patientId, category) {
  const validCategories = [
    "appointment",
    "prescription",
    "visit",
    "disease",
    "report",
  ];

  if (!validCategories.includes(category)) {
    throw new Error(
      `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    );
  }

  const fullTimeline = await getPatientTimeline(patientId);
  const filtered = fullTimeline.timeline.filter(
    (item) => item.type === category,
  );

  return {
    patient_id: patientId,
    category,
    count: filtered.length,
    items: filtered,
  };
}

/**
 * Get recent timeline events (last N items)
 */
export async function getRecentTimelineEvents(patientId, limit = 10) {
  const timeline = await getPatientTimeline(patientId);
  return {
    patient_id: patientId,
    recent_count: Math.min(limit, timeline.timeline.length),
    recent_events: timeline.timeline.slice(0, limit),
  };
}
