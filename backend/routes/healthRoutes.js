import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  createHealthMetric,
  getHealthMetricsByPatient,
  getLatestHealthMetrics,
  getHealthMetricsSummary,
  deleteHealthMetric,
} from "../models-pg/healthMetrics.js";

const router = express.Router();

/*
  SYNC HEALTH METRICS FROM MOBILE APP
  POST /api/health/sync
  Body: {
    metrics: [
      {
        metric_type: "steps",
        value: 8500,
        unit: "count",
        recorded_at: "2024-01-15T10:00:00Z",
        metadata: { device: "Pixel 7" }
      }
    ]
  }
*/
router.post(
  "/sync",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { metrics } = req.body;
      const patientId = req.user.id;

      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({
          error: "Metrics array is required and cannot be empty",
        });
      }

      const results = [];
      const errors = [];

      for (const metric of metrics) {
        try {
          const metricData = {
            patient_id: patientId,
            metric_type: metric.metric_type,
            value: parseFloat(metric.value),
            unit: metric.unit,
            recorded_at: new Date(metric.recorded_at),
            source: metric.source || "health_connect",
            metadata: metric.metadata || {},
          };

          // Validate required fields
          if (
            !metricData.metric_type ||
            isNaN(metricData.value) ||
            !metricData.unit
          ) {
            errors.push({
              metric: metric,
              error: "Missing required fields: metric_type, value, unit",
            });
            continue;
          }

          const result = await createHealthMetric(metricData);
          if (result) {
            results.push(result);
          } else {
            errors.push({
              metric: metric,
              error: "Failed to save metric",
            });
          }
        } catch (err) {
          errors.push({
            metric: metric,
            error: err.message,
          });
        }
      }

      res.json({
        success: results.length,
        errors: errors.length,
        data: results,
        errors_detail: errors,
      });
    } catch (error) {
      console.error("Health sync error:", error);
      res.status(500).json({ error: "Failed to sync health data" });
    }
  },
);

/*
  GET HEALTH METRICS FOR PATIENT
  GET /api/health/metrics?type=steps&start=2024-01-01&end=2024-01-31
*/
router.get(
  "/metrics",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const { type, start, end } = req.query;

      const metrics = await getHealthMetricsByPatient(
        patientId,
        type,
        start ? new Date(start) : null,
        end ? new Date(end) : null,
      );

      res.json(metrics);
    } catch (error) {
      console.error("Get health metrics error:", error);
      res.status(500).json({ error: "Failed to fetch health metrics" });
    }
  },
);

/*
  GET LATEST HEALTH METRICS
  GET /api/health/latest
*/
router.get(
  "/latest",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const metrics = await getLatestHealthMetrics(patientId);

      // Group by metric type for easier frontend consumption
      const grouped = metrics.reduce((acc, metric) => {
        acc[metric.metric_type] = metric;
        return acc;
      }, {});

      res.json(grouped);
    } catch (error) {
      console.error("Get latest health metrics error:", error);
      res.status(500).json({ error: "Failed to fetch latest health metrics" });
    }
  },
);

/*
  GET HEALTH METRICS SUMMARY
  GET /api/health/summary?days=7
*/
router.get(
  "/summary",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const days = parseInt(req.query.days) || 7;

      const summary = await getHealthMetricsSummary(patientId, days);
      res.json(summary);
    } catch (error) {
      console.error("Get health summary error:", error);
      res.status(500).json({ error: "Failed to fetch health summary" });
    }
  },
);

/*
  DELETE HEALTH METRIC
  DELETE /api/health/metrics/:id
*/
router.delete(
  "/metrics/:id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const patientId = req.user.id;

      const deleted = await deleteHealthMetric(id, patientId);
      if (deleted) {
        res.json({ message: "Health metric deleted successfully" });
      } else {
        res
          .status(404)
          .json({ error: "Health metric not found or already deleted" });
      }
    } catch (error) {
      console.error("Delete health metric error:", error);
      res.status(500).json({ error: "Failed to delete health metric" });
    }
  },
);

/*
  GET HEALTH INSIGHTS (AI-GENERATED)
  GET /api/health/insights
*/
router.get(
  "/insights",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;

      // Get latest health metrics
      const latestMetrics = await getLatestHealthMetrics(patientId);

      // Get 7-day summary
      const weeklySummary = await getHealthMetricsSummary(patientId, 7);

      // Call AI service for insights
      const aiResponse = await fetch(
        `${process.env.AI_SERVICE_URL || "http://localhost:5005"}/health-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patient_id: patientId,
            latest_metrics: latestMetrics,
            weekly_summary: weeklySummary,
          }),
        },
      );

      if (aiResponse.ok) {
        const insights = await aiResponse.json();
        res.json(insights);
      } else {
        res.json({ insights: ["AI insights temporarily unavailable"] });
      }
    } catch (error) {
      console.error("Get health insights error:", error);
      res.json({ insights: ["Unable to generate insights at this time"] });
    }
  },
);

export default router;
