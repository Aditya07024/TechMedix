import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as analyticsService from "../services/doctorAnalyticsService.js";
import sql from "../config/database.js";

const router = express.Router();

/**
 * Get doctor's dashboard metrics (comprehensive overview)
 */
router.get("/doctor/:doctorId/dashboard", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Verify doctor can view their own analytics
    if (req.user.id !== doctorId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Can only view your own analytics" });
    }

    const metrics = await analyticsService.getDoctorDashboardMetrics(doctorId);

    res.json(metrics);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get daily analytics for specific date
 */
router.get("/doctor/:doctorId/daily/:date", authenticate, async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    if (req.user.id !== doctorId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const analytics = await analyticsService.getDoctorDailyAnalytics(
      doctorId,
      date,
    );

    if (!analytics) {
      return res.json({ message: "No analytics data for this date" });
    }

    res.json(analytics);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get analytics for date range
 */
router.get("/doctor/:doctorId/range", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date required" });
    }

    if (req.user.id !== doctorId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const analytics = await analyticsService.getDoctorAnalyticsBetweenDates(
      doctorId,
      startDate,
      endDate,
    );

    res.json(analytics);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get revenue metrics
 */
router.get("/doctor/:doctorId/revenue", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { days = 30 } = req.query;

    if (req.user.id !== doctorId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const revenue = await analyticsService.getDoctorRevenueMetrics(
      doctorId,
      parseInt(days),
    );

    res.json(revenue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get comparative analytics (doctor vs peers)
 */
router.get("/doctor/:doctorId/comparative", authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { days = 30 } = req.query;

    if (req.user.id !== doctorId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const comparative = await analyticsService.getDoctorComparativeAnalytics(
      doctorId,
      parseInt(days),
    );

    res.json(comparative);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * ADMIN ENDPOINTS - View all doctors' analytics
 */

/**
 * Get all doctors' analytics summary
 */
router.get(
  "/all/summary",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { days = 30 } = req.query;

      // Get all doctors
      const doctors = await sql`
        SELECT id, name 
        FROM doctors 
        WHERE COALESCE(is_deleted,false)=FALSE
        ORDER BY name
      `;

      const summaries = [];
      for (const doctor of doctors) {
        const analytics = await analyticsService.getDoctorDashboardMetrics(
          doctor.id,
        );
        summaries.push({
          doctor_id: doctor.id,
          doctor_name: doctor.name,
          ...analytics,
        });
      }

      // Calculate platform metrics
      const totalCompletedAppointments = summaries.reduce(
        (sum, d) => sum + (d.today?.completed || 0),
        0,
      );
      const totalRevenue = summaries.reduce(
        (sum, d) => sum + parseFloat(d.this_month?.total_revenue || 0),
        0,
      );
      const avgConversionRate = (
        summaries.reduce(
          (sum, d) => sum + parseFloat(d.today?.conversion_rate || 0),
          0,
        ) / summaries.length
      ).toFixed(2);

      res.json({
        platform_summary: {
          total_doctors: doctors.length,
          total_completed_today: totalCompletedAppointments,
          total_revenue_this_month: totalRevenue.toFixed(2),
          avg_conversion_rate: avgConversionRate,
        },
        doctors: summaries,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Export analytics report
 */
router.get(
  "/doctor/:doctorId/export/:format",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId, format } = req.params;
      const { startDate, endDate } = req.query;

      if (!["csv", "json"].includes(format)) {
        return res.status(400).json({ error: "Format must be csv or json" });
      }

      if (req.user.id !== doctorId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const analytics = await analyticsService.getDoctorAnalyticsBetweenDates(
        doctorId,
        startDate,
        endDate,
      );

      if (format === "json") {
        res.json(analytics);
      } else {
        // Generate CSV
        const headers = [
          "Date",
          "Completed",
          "Cancelled",
          "Avg Duration",
          "Revenue",
        ];
        const rows = analytics.daily_breakdown.map((d) => [
          d.date,
          d.completed_appointments,
          d.cancelled_appointments,
          d.avg_consultation_duration_minutes,
          d.revenue_estimated,
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="analytics_${doctorId}_${startDate}_${endDate}.csv"`,
        );
        res.send(csv);
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get system analytics (Admin overview)
 */
router.get(
  "/system",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const [
        doctors,
        patients,
        appointments,
        payments,
        bookingsToday,
        bookingsThisMonth,
        onlinePayments,
        offlinePayments,
      ] = await Promise.all([
        sql`SELECT COUNT(*) AS count FROM doctors WHERE is_deleted = FALSE`,
        sql`SELECT COUNT(*) AS count FROM patients WHERE is_deleted = FALSE`,
        sql`SELECT COUNT(*) AS count FROM appointments WHERE is_deleted = FALSE`,
        sql`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' AND COALESCE(is_deleted, false) = FALSE`,
        sql`SELECT COUNT(*) AS count FROM appointments WHERE is_deleted = FALSE AND DATE(created_at) = CURRENT_DATE`,
        sql`SELECT COUNT(*) AS count FROM appointments WHERE is_deleted = FALSE AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
        sql`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' AND payment_method IN ('online', 'wallet') AND COALESCE(is_deleted, false) = FALSE`,
        sql`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' AND payment_method = 'cash' AND COALESCE(is_deleted, false) = FALSE`,
      ]);

      const [completedAppts] = await sql`
        SELECT COUNT(*) AS count FROM appointments 
        WHERE status IN ('completed', 'visited') AND is_deleted = FALSE
      `;

      const totalAppts = Number(appointments[0].count);
      const conversionRate = totalAppts > 0 ? Math.round((Number(completedAppts?.count || 0) / totalAppts) * 100) : 0;

      res.json({
        success: true,
        data: {
          total_patients: Number(patients[0].count),
          total_doctors: Number(doctors[0].count),
          total_appointments: totalAppts,
          total_revenue: Number(payments[0].total),
          conversion_rate: conversionRate,
          avg_rating: 4.8,
          bookings_today: Number(bookingsToday[0].count),
          bookings_this_month: Number(bookingsThisMonth[0].count),
          online_revenue: Number(onlinePayments[0].total),
          offline_revenue: Number(offlinePayments[0].total),
        }
      });
    } catch (err) {
      console.error("Failed to fetch system stats:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
