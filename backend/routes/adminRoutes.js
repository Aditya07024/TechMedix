import express from "express";
import sql from "../config/database.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/dashboard", requireAdmin, async (req, res) => {
  try {
    const [
      doctors,
      patients,
      appointmentsToday,
      completedToday,
      activeQueue,
      totalPrescriptions,
      blockedPrescriptions,
      riskAlertsToday,
      revenueToday,
    ] = await Promise.all([
      sql`SELECT COUNT(*) AS count FROM doctors WHERE is_deleted = FALSE`,
      sql`SELECT COUNT(*) AS count FROM patients WHERE is_deleted = FALSE`,
      sql`
        SELECT COUNT(*) AS count
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
          AND is_deleted = FALSE
      `,
      sql`
        SELECT COUNT(*) AS count
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
          AND status IN ('completed','visited')
          AND is_deleted = FALSE
      `,
      sql`
        SELECT COUNT(*) AS count
        FROM appointments
        WHERE status IN ('booked','arrived')
          AND is_deleted = FALSE
      `,
      sql`SELECT COUNT(*) AS count FROM prescriptions WHERE is_deleted = FALSE`,
      sql`
        SELECT COUNT(*) AS count
        FROM prescriptions
        WHERE status = 'blocked'
          AND is_deleted = FALSE
      `,
      sql`
        SELECT COUNT(*) AS count
        FROM risk_alerts
        WHERE created_at::date = CURRENT_DATE
      `,
      sql`
        SELECT COALESCE(SUM(d.consultation_fee), 0) AS total
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.status IN ('completed','visited')
          AND a.appointment_date = CURRENT_DATE
          AND a.is_deleted = FALSE
          AND d.is_deleted = FALSE
      `,
    ]);

    res.json({
      total_doctors: Number(doctors[0].count),
      total_patients: Number(patients[0].count),
      appointments_today: Number(appointmentsToday[0].count),
      completed_today: Number(completedToday[0].count),
      active_queue: Number(activeQueue[0].count),
      total_prescriptions: Number(totalPrescriptions[0].count),
      blocked_prescriptions: Number(blockedPrescriptions[0].count),
      risk_alerts_today: Number(riskAlertsToday[0].count),
      estimated_revenue_today: Number(revenueToday[0].total || 0),
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ error: "Dashboard failed" });
  }
});

// GET all doctors - accessible to all patients for booking
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await sql`
      SELECT id, name, email, specialty, consultation_fee
      FROM doctors
      ORDER BY name ASC
    `;

    res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch doctors: " + error.message,
    });
  }
});

// GET single doctor (public) including fee
router.get("/doctors/:id", async (req, res) => {
  try {
    const [doctor] = await sql`
      SELECT id, name, email, specialty, consultation_fee
      FROM doctors
      WHERE id = ${req.params.id}
        AND is_deleted = FALSE
    `;
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, error: "Doctor not found" });
    }
    res.json({ success: true, data: doctor });
  } catch (error) {
    console.error("Error fetching doctor:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
