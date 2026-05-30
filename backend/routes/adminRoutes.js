import express from "express";
import sql from "../config/database.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard", authenticate, requireAdmin, async (req, res) => {
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

// GET all branches with stats (doctor and patient count)
router.get(
  "/branches",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const branches = await sql`
        SELECT b.*,
          (SELECT COUNT(*)::int FROM doctors d WHERE d.branch_id = b.id AND d.is_deleted = FALSE) AS doctor_count,
          (SELECT COUNT(DISTINCT patient_id)::int FROM appointments a WHERE a.branch_id = b.id AND a.is_deleted = FALSE) AS patient_count
        FROM branches b
        ORDER BY b.name ASC
      `;
      res.json({ success: true, data: branches });
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET payment list for transactions
router.get(
  "/payments",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const payments = await sql`
        SELECT p.*, pt.name AS patient_name
        FROM payments p
        LEFT JOIN patients pt ON p.patient_id = pt.id
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      res.json({ success: true, data: payments });
    } catch (err) {
      console.error("Failed to fetch payments:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET all types of users with role filter
router.get(
  "/users",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const role = req.query.role || null;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      let query = sql`
        SELECT id, name, role, email, phone, created_at FROM (
          SELECT id::text, name, 'patient' AS role, email, phone, created_at FROM patients WHERE is_deleted = FALSE
          UNION ALL
          SELECT id::text, name, 'doctor' AS role, email, null AS phone, created_at FROM doctors WHERE is_deleted = FALSE
          UNION ALL
          SELECT id::text, name, role::text, email, phone, created_at FROM staff
          UNION ALL
          SELECT id::text, full_name AS name, role::text, email, phone, created_at FROM users WHERE role = 'admin' AND is_deleted = FALSE
        ) all_users
      `;

      if (role) {
        query = sql`${query} WHERE role = ${role}`;
      }

      const users = await sql`
        ${query}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      res.json({ success: true, data: users });
    } catch (err) {
      console.error("Failed to fetch users:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET payout summary for all doctors
router.get(
  "/payouts/summary",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const docSummaries = await sql`
        SELECT 
          d.id AS doctor_id,
          d.name AS doctor_name,
          d.specialty,
          COALESCE((
            SELECT SUM(amount) 
            FROM payments 
            WHERE doctor_id = d.id 
              AND status = 'paid' 
              AND payment_method IN ('online', 'wallet')
              AND COALESCE(is_deleted, FALSE) = FALSE
          ), 0)::numeric AS online_collected,
          COALESCE((
            SELECT SUM(amount) 
            FROM payments 
            WHERE doctor_id = d.id 
              AND status = 'paid' 
              AND payment_method = 'cash'
              AND COALESCE(is_deleted, FALSE) = FALSE
          ), 0)::numeric AS offline_collected,
          COALESCE((
            SELECT SUM(amount) 
            FROM doctor_payouts 
            WHERE doctor_id = d.id
          ), 0)::numeric AS total_paid_out
        FROM doctors d
        WHERE d.is_deleted = FALSE
        ORDER BY d.name ASC
      `;

      const data = docSummaries.map(row => {
        const online_collected = Number(row.online_collected);
        const offline_collected = Number(row.offline_collected);
        const total_paid_out = Number(row.total_paid_out);
        return {
          doctor_id: row.doctor_id,
          doctor_name: row.doctor_name,
          specialty: row.specialty,
          total_collected: online_collected, // For backwards compatibility
          online_collected,
          offline_collected,
          total_paid_out,
          pending_payout: online_collected - total_paid_out
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      console.error("Failed to fetch payout summary:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST create doctor payout
router.post(
  "/payouts",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { doctor_id, amount, reference_notes } = req.body;
      if (!doctor_id || !amount) {
        return res.status(400).json({ success: false, error: "doctor_id and amount are required" });
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, error: "amount must be a positive number" });
      }

      const payout = await sql`
        INSERT INTO doctor_payouts (doctor_id, amount, reference_notes)
        VALUES (${doctor_id}, ${numericAmount}, ${reference_notes || null})
        RETURNING *
      `;

      res.status(201).json({ success: true, data: payout[0] });
    } catch (err) {
      console.error("Failed to create payout:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET payout history
router.get(
  "/payouts/history",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const payouts = await sql`
        SELECT dp.*, d.name AS doctor_name, d.specialty
        FROM doctor_payouts dp
        JOIN doctors d ON dp.doctor_id = d.id
        ORDER BY dp.payout_date DESC
      `;
      res.json({ success: true, data: payouts });
    } catch (err) {
      console.error("Failed to fetch payout history:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
