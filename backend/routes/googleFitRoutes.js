import express from "express";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  createHealthMetric,
  getLatestHealthMetrics,
} from "../models-pg/healthMetrics.js";
import {
  storeGoogleFitToken,
  getGoogleFitToken,
  disconnectGoogleFit,
  isGoogleFitConnected,
  getTodaySteps,
  getHeartRateData,
  getSleepData,
  getCaloriesData,
} from "../services/googleFitService.js";
import sql from "../config/database.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_FIT_CLIENT_ID,
  process.env.GOOGLE_FIT_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/auth/google-fit/callback`,
);

/**
 * POST /auth/google-fit/start
 * Generate OAuth consent URL
 */
router.post("/start", authenticate, authorizeRoles("patient"), (req, res) => {
  try {
    const scopes = [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.activity.write",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.write",
      "https://www.googleapis.com/auth/fitness.sleep.read",
      "https://www.googleapis.com/auth/fitness.sleep.write",
      "https://www.googleapis.com/auth/fitness.nutrition.read",
      "https://www.googleapis.com/auth/fitness.nutrition.write",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent screen every time
      state: req.user.id, // Include user ID for security
    });

    res.json({ authUrl });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

/**
 * POST /auth/google-fit/callback
 * Exchange authorization code for access token
 * Body: { code: string }
 */
router.post(
  "/callback",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { code } = req.body;
      const patientId = req.user.id;

      if (!code) {
        return res
          .status(400)
          .json({ error: "Authorization code is required" });
      }

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      const { access_token, refresh_token, expiry_date } = tokens;

      console.log(
        "[GOOGLEFIT-CALLBACK] Token expiry date:",
        new Date(expiry_date),
      );

      // Store tokens in database with expiration time
      await storeGoogleFitToken(
        patientId,
        access_token,
        refresh_token,
        new Date(expiry_date),
      );

      res.json({
        success: true,
        message: "Google Fit connected successfully",
        data: {
          connected_at: new Date(),
        },
      });
    } catch (error) {
      console.error("Error exchanging authorization code:", error);
      res.status(500).json({ error: "Failed to connect Google Fit" });
    }
  },
);

/**
 * GET /api/google-fit/status
 * Check if Google Fit is connected
 */
router.get(
  "/status",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const connected = await isGoogleFitConnected(patientId);

      res.json({ connected });
    } catch (error) {
      console.error("Error checking Google Fit status:", error);
      res.status(500).json({ error: "Failed to check Google Fit status" });
    }
  },
);

/**
 * GET /api/google-fit/disconnect
 * Disconnect Google Fit
 */
router.post(
  "/disconnect",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      await disconnectGoogleFit(patientId);

      res.json({ success: true, message: "Google Fit disconnected" });
    } catch (error) {
      console.error("Error disconnecting Google Fit:", error);
      res.status(500).json({ error: "Failed to disconnect Google Fit" });
    }
  },
);

/**
 * GET /api/google-fit/sync
 * Fetch health data from Google Fit and sync to database
 */
router.post(
  "/sync",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const { startDate, endDate, useMockData } = req.body;

      // Get stored access token
      const tokenData = await getGoogleFitToken(patientId);

      if (!tokenData.google_fit_access_token && !useMockData) {
        return res.status(401).json({
          error: "Google Fit not connected",
        });
      }

      const start = startDate ? new Date(startDate) : new Date();
      start.setHours(0, 0, 0, 0);

      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      // Use a timezone-stable recorded_at for DB writes: midday UTC of the local day
      // This prevents date-shift issues when the DB stores timestamps in UTC.
      const recordedAt = new Date(
        Date.UTC(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
          12, // noon UTC
          0,
          0,
          0,
        ),
      );

      const results = {
        steps: null,
        heartRate: null,
        sleep: null,
        calories: null,
        mock: useMockData || false,
        savedRows: {},
      };

      // Mock data for demo/testing
      const mockData = {
        steps: 8234,
        heartRate: { avgHeartRate: 72, count: 45 },
        sleep: { totalSleepHours: 7.5, count: 1 },
        calories: 2150,
      };

      // Clean up old metrics to ensure fresh data
      try {
        const today = start.toISOString().split("T")[0]; // Get YYYY-MM-DD

        // 1. Remove ALL old mock data (prevents stale mock data from appearing in metrics endpoint)
        const mockDeleteResult = await sql`
          DELETE FROM health_metrics 
          WHERE patient_id = ${patientId}
          AND source = 'google_fit_mock'
        `;
        console.log(
          `[GOOGLEFIT-SYNC] Cleaned up ${mockDeleteResult.count} old mock data rows`,
        );

        // 2. Remove today's real Google Fit data (to replace with fresh sync)
        const fitDeleteResult = await sql`
          DELETE FROM health_metrics 
          WHERE patient_id = ${patientId}
          AND DATE(recorded_at) = DATE(${start})
          AND source = 'google_fit'
        `;
        console.log(
          `[GOOGLEFIT-SYNC] Cleaned up ${fitDeleteResult.count} old google_fit rows from ${today}`,
        );
      } catch (cleanupErr) {
        console.error(
          "[GOOGLEFIT-SYNC] Cleanup warning (non-fatal):",
          cleanupErr.message,
        );
        // Don't fail the sync if cleanup fails
      }

      try {
        // Fetch steps
        const stepsData = useMockData
          ? mockData.steps
          : await getTodaySteps(tokenData.google_fit_access_token);

        results.steps = stepsData;
        results.steps_saved = false;

        // Only create metric if we have actual data (> 0) or using mock data
        if (stepsData > 0 || useMockData) {
          try {
            const stepsMetric = await createHealthMetric({
              patient_id: patientId,
              metric_type: "steps",
              value: stepsData,
              unit: "count",
              recorded_at: recordedAt,
              source: useMockData ? "google_fit_mock" : "google_fit",
              metadata: { fetched_at: new Date(), mock: useMockData || false },
            });
            if (stepsMetric) {
              results.steps_saved = true;
              results.savedRows.steps = stepsMetric;
              console.log("[GOOGLEFIT-SYNC] ✓ Steps metric saved:", stepsData);
            }
          } catch (dbErr) {
            console.error(
              "[GOOGLEFIT-SYNC] ✗ Steps save failed:",
              dbErr.message,
            );
            results.steps_error = `Save failed: ${dbErr.message}`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch steps:", err.message);
        results.steps_error = err.message;
      }

      try {
        // Fetch heart rate
        const hrData = useMockData
          ? mockData.heartRate
          : await getHeartRateData(
              tokenData.google_fit_access_token,
              start,
              end,
            );
        results.heartRate = hrData;
        results.heartRate_saved = false;

        const avgHR = hrData?.avgHeartRate || 0;
        if (avgHR > 0 || useMockData) {
          try {
            const hrMetric = await createHealthMetric({
              patient_id: patientId,
              metric_type: "heart_rate",
              value: avgHR,
              unit: "bpm",
              recorded_at: recordedAt,
              source: useMockData ? "google_fit_mock" : "google_fit",
              metadata: {
                measurement_count: hrData?.count || 0,
                fetched_at: new Date(),
                mock: useMockData || false,
              },
            });
            if (hrMetric) {
              results.heartRate_saved = true;
              results.savedRows.heart_rate = hrMetric;
              console.log("[GOOGLEFIT-SYNC] ✓ Heart rate metric saved:", avgHR);
            }
          } catch (dbErr) {
            console.error(
              "[GOOGLEFIT-SYNC] ✗ Heart rate save failed:",
              dbErr.message,
            );
            results.heartRate_error = `Save failed: ${dbErr.message}`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch/save heart rate:", err.message);
        results.heartRate_error = err.message;
      }

      try {
        // Fetch sleep
        const sleepData = useMockData
          ? mockData.sleep
          : await getSleepData(tokenData.google_fit_access_token, start, end);
        results.sleep = sleepData;
        results.sleep_saved = false;

        const totalSleep = sleepData?.totalSleepHours || 0;
        if (totalSleep > 0 || useMockData) {
          try {
            const sleepMetric = await createHealthMetric({
              patient_id: patientId,
              metric_type: "sleep_duration",
              value: totalSleep,
              unit: "hours",
              recorded_at: recordedAt,
              source: useMockData ? "google_fit_mock" : "google_fit",
              metadata: {
                session_count: sleepData?.count || 0,
                fetched_at: new Date(),
                mock: useMockData || false,
              },
            });
            if (sleepMetric) {
              results.sleep_saved = true;
              results.savedRows.sleep_duration = sleepMetric;
              console.log("[GOOGLEFIT-SYNC] ✓ Sleep metric saved:", totalSleep);
            }
          } catch (dbErr) {
            console.error(
              "[GOOGLEFIT-SYNC] ✗ Sleep save failed:",
              dbErr.message,
            );
            results.sleep_error = `Save failed: ${dbErr.message}`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch/save sleep data:", err.message);
        results.sleep_error = err.message;
      }

      try {
        // Fetch calories
        const caloriesData = useMockData
          ? { totalCalories: mockData.calories }
          : await getCaloriesData(
              tokenData.google_fit_access_token,
              start,
              end,
            );
        results.calories = caloriesData;
        results.calories_saved = false;

        const totalCals = caloriesData?.totalCalories || 0;
        if (totalCals > 0 || useMockData) {
          try {
            const caloriesMetric = await createHealthMetric({
              patient_id: patientId,
              metric_type: "calories",
              value: totalCals,
              unit: "kcal",
              recorded_at: recordedAt,
              source: useMockData ? "google_fit_mock" : "google_fit",
              metadata: { fetched_at: new Date(), mock: useMockData || false },
            });
            if (caloriesMetric) {
              results.calories_saved = true;
              results.savedRows.calories = caloriesMetric;
              console.log(
                "[GOOGLEFIT-SYNC] ✓ Calories metric saved:",
                totalCals,
              );
            }
          } catch (dbErr) {
            console.error(
              "[GOOGLEFIT-SYNC] ✗ Calories save failed:",
              dbErr.message,
            );
            results.calories_error = `Save failed: ${dbErr.message}`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch/save calories:", err.message);
        results.calories_error = err.message;
      }

      const savedCount = Object.values(results).filter(
        (v) => v === true,
      ).length;

      res.json({
        success: true,
        message: `Health metrics sync completed. Saved ${savedCount} metrics for ${start.toISOString().split("T")[0]}`,
        syncDate: start.toISOString().split("T")[0],
        data: results,
      });
    } catch (error) {
      console.error("Health metrics sync error:", error);
      res.status(500).json({ error: "Failed to sync health metrics" });
    }
  },
);

/**
 * GET /api/google-fit/metrics
 * Get latest synced metrics from TODAY only
 * Filters by date to prevent stale mock data from previous days
 */
router.get(
  "/metrics",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;

      // Get today's date as string for better timezone handling
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

      console.log(
        `[METRICS-ENDPOINT] Fetching metrics for patient ${patientId}, date: ${todayStr}`,
      );

      // Query for today's metrics - try multiple timezone approaches
      const metrics = await sql`
        SELECT DISTINCT ON (metric_type)
          id, metric_type, value, unit, recorded_at, source, metadata, created_at
        FROM health_metrics
        WHERE patient_id = ${patientId}
        AND is_deleted = FALSE
        AND source IN ('google_fit', 'google_fit_mock')
        AND DATE(recorded_at) = ${todayStr}
        ORDER BY metric_type, recorded_at DESC
      `;

      console.log(
        `[METRICS-ENDPOINT] Retrieved ${metrics.length} metrics for today (${todayStr})`,
      );
      metrics.forEach((m) => {
        console.log(`  - ${m.metric_type}: ${m.value} ${m.unit} (${m.source})`);
      });

      res.json({
        success: true,
        date: todayStr,
        data: metrics,
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  },
);

/**
 * GET /api/google-fit/metrics/raw
 * Return raw rows saved today (debug/inspection)
 */
router.get(
  "/metrics/raw",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;
      const todayStr = new Date().toISOString().split("T")[0];
      const rows = await sql`
        SELECT id, patient_id, metric_type, value, unit, recorded_at, source, metadata, created_at
        FROM health_metrics
        WHERE patient_id = ${patientId}
          AND is_deleted = FALSE
          AND DATE(recorded_at) = ${todayStr}
        ORDER BY recorded_at DESC, created_at DESC
      `;
      res.json({ success: true, date: todayStr, count: rows.length, rows });
    } catch (error) {
      console.error("/metrics/raw error:", error);
      res.status(500).json({ error: "Failed to fetch raw metrics" });
    }
  },
);

/**
 * GET /api/google-fit/metrics/summary
 * Get detailed metrics summary with status and metadata
 */
router.get(
  "/metrics/summary",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const patientId = req.user.id;

      // Get today's date at local midnight (matches sync recorded_at)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      // Query for today's metrics only
      const metrics = await sql`
        SELECT DISTINCT ON (metric_type)
          id, metric_type, value, unit, recorded_at, source, metadata, created_at
        FROM health_metrics
        WHERE patient_id = ${patientId}
        AND is_deleted = FALSE
        AND DATE(recorded_at) = DATE(${today})
        AND source IN ('google_fit', 'google_fit_mock')
        ORDER BY metric_type, recorded_at DESC
      `;

      // Format metrics with status
      const formattedMetrics = metrics.map((metric) => ({
        id: `${metric.metric_type}_${Date.now()}`,
        metricType: metric.metric_type,
        value: metric.value,
        unit: metric.unit,
        recordedAt: metric.recorded_at,
        source: "Google Fit",
        status: metric.value > 0 ? "✓ Created" : "No valid data found",
      }));

      // Calculate summary
      const successfulMetrics = metrics.filter((m) => m.value > 0).length;
      const metricsWithData = successfulMetrics;
      const metricsWithoutData = metrics.length - metricsWithData;

      const summary = {
        status: "success",
        date: todayStr,
        patientId: patientId,
        metrics: formattedMetrics,
        summary: {
          totalMetricsRetrieved: metrics.length,
          successfulMetrics: successfulMetrics,
          metricsWithData: metricsWithData,
          metricsWithoutData: metricsWithoutData,
          syncDuration: "~2 seconds",
          lastSyncTime: new Date().toISOString(),
        },
      };

      console.log(
        `[METRICS-SUMMARY] Returning summary with ${metrics.length} metrics`,
      );
      res.json(summary);
    } catch (error) {
      console.error("Error fetching metrics summary:", error);
      res.status(500).json({ error: "Failed to fetch metrics summary" });
    }
  },
);

export default router;
