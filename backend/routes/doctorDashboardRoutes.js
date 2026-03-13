import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// ================= DOCTOR DASHBOARD =================
router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const doctorId = req.user.id;

      const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
    `;

      const blockedResult = await sql`
      SELECT COUNT(*) as blocked
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
        AND p.status = 'blocked'
    `;

      const highRiskResult = await sql`
      SELECT COUNT(*) as high_risk
      FROM risk_alerts r
      JOIN prescriptions p ON r.prescription_id = p.id
      JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
        AND (r.severity = 'high' OR r.severity = 'critical')
    `;

      const avgRiskResult = await sql`
      SELECT COALESCE(AVG(risk_score),0) as avg_risk
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
    `;
      const upcomingFollowUps = await sql`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ${doctorId}
        AND follow_up_date >= CURRENT_DATE
        AND status IN ('completed','visited')
        AND is_deleted = FALSE
    `;

      res.json({
        total_prescriptions: Number(totalResult[0].total || 0),
        blocked_prescriptions: Number(blockedResult[0].blocked || 0),
        high_risk_alerts: Number(highRiskResult[0].high_risk || 0),
        average_risk_score: Number(avgRiskResult[0].avg_risk || 0),
        upcoming_follow_ups: Number(upcomingFollowUps[0].count),
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).json({ error: "Dashboard failed" });
    }
  },
);

// ================= DOCTOR ANALYTICS =================
router.get(
  "/analytics",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const doctorId = req.user.id;

      const patientsToday = await sql`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ${doctorId}
        AND appointment_date = CURRENT_DATE
        AND status IN ('completed','visited','arrived','booked')
        AND is_deleted = FALSE
    `;

      // 🔹 Fetch doctor branch
      const doctorBranch = await sql`
      SELECT branch_id FROM doctors
      WHERE id = ${doctorId}
    `;

      const branchId = doctorBranch.length ? doctorBranch[0].branch_id : null;

      const revenueToday = await sql`
      SELECT COALESCE(SUM(p.amount),0) as total
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.branch_id = ${branchId}
        AND DATE(p.created_at) = CURRENT_DATE
        AND p.status IN ('completed','visited')
        AND a.is_deleted = FALSE
    `;

      const avgConsultation = await sql`
      SELECT COALESCE(AVG(duration),0) as avg_time
      FROM consultation_recordings cr
      JOIN appointments a ON cr.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
        AND cr.duration IS NOT NULL
    `;

      const blockedPrescriptions = await sql`
      SELECT COUNT(*) as count
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
        AND p.status = 'blocked'
    `;

      const avgRisk = await sql`
      SELECT COALESCE(AVG(risk_score),0) as avg_risk
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = ${doctorId}
        AND a.is_deleted = FALSE
    `;

      const weeklyLoad = await sql`
      SELECT appointment_date as date,
             COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ${doctorId}
        AND appointment_date >= CURRENT_DATE - INTERVAL '7 days'
        AND is_deleted = FALSE
      GROUP BY appointment_date
      ORDER BY appointment_date ASC
    `;

      res.json({
        total_patients_today: Number(patientsToday[0].count),
        total_revenue_today: Number(revenueToday[0].total),
        avg_consultation_time_minutes: Number(avgConsultation[0].avg_time),
        total_blocked_prescriptions: Number(blockedPrescriptions[0].count),
        average_risk_score: Number(avgRisk[0].avg_risk),
        patient_load_last_7_days: weeklyLoad,
      });
    } catch (error) {
      console.error("Doctor analytics error:", error);
      res.status(500).json({ error: "Analytics failed" });
    }
  },
);

router.put(
  "/assign-branch/:doctorId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    const { branchId } = req.body;

    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    // Check if branch exists
    const branchExists = await sql`
      SELECT id FROM branches WHERE id = ${branchId}
    `;
    if (!branchExists.length) {
      return res.status(404).json({ error: "Branch not found" });
    }

    await sql`
      UPDATE doctors
      SET branch_id = ${branchId}
      WHERE id = ${req.params.doctorId}
    `;

    res
      .status(200)
      .json({ success: true, message: "Branch assigned successfully" });
  },
);

export default router;
