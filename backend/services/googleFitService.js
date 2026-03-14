import axios from "axios";
import sql from "../config/database.js";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";

// Initialize OAuth2 client for token refresh
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_FIT_CLIENT_ID,
  process.env.GOOGLE_FIT_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/auth/google-fit/callback`,
);

/**
 * Google Fit Service
 * Handles OAuth token exchange and API calls to Google Fitness API
 */

/**
 * Refresh Google Fit access token using refresh token
 * @param {string} refreshToken - Google OAuth refresh token
 * @returns {Object} - { accessToken, expiresAt }
 */
export const refreshGoogleFitToken = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const { access_token, expiry_date } = credentials;

    console.log("[GOOGLEFIT-REFRESH] Token refreshed successfully");
    console.log("[GOOGLEFIT-REFRESH] New expiry:", new Date(expiry_date));

    return {
      accessToken: access_token,
      expiresAt: new Date(expiry_date),
    };
  } catch (error) {
    console.error("[GOOGLEFIT-REFRESH] Failed to refresh token:", error.message);
    throw error;
  }
};

/**
 * Google Fit Service
 * Handles OAuth token exchange and API calls to Google Fitness API
 */

/**
 * Fetch aggregated health data from Google Fit
 * @param {string} accessToken - Google OAuth access token
 * @param {string} metricType - 'steps', 'heart_rate', 'sleep_duration', 'calories'
 * @param {Date} startDate - Start date for aggregation
 * @param {Date} endDate - End date for aggregation
 */
export const fetchGoogleFitData = async (
  accessToken,
  metricType,
  startDate,
  endDate,
) => {
  try {
    const startTimeMillis = new Date(startDate).getTime();
    const endTimeMillis = new Date(endDate).getTime();

    // Map metric types to Google Fit data source IDs
    const dataTypeMap = {
      steps: "com.google.step_count.delta",
      heart_rate: "com.google.heart_rate.bpm",
      sleep_duration: "com.google.sleep.segment",
      calories: "com.google.calories.expended",
      activity: "com.google.activity.segment",
    };

    const dataTypeName = dataTypeMap[metricType];

    if (!dataTypeName) {
      throw new Error(`Unsupported metric type: ${metricType}`);
    }

    const requestBody = {
      aggregateBy: [
        {
          dataTypeName: dataTypeName,
          // For derived data sources, only specify dataTypeName
          // Don't include dataSourceId for derived sources - it causes 403 errors
        },
      ],
      bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
      startTimeMillis,
      endTimeMillis,
    };

    const response = await axios.post(
      `${GOOGLE_FIT_API_BASE}/dataset:aggregate`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    // Check if it's a 403 (permission) error
    if (error.response?.status === 403) {
      console.error(
        `[403] Permission denied for ${metricType}. User needs to re-authorize with all scopes.`,
      );
      throw new Error(
        `Access denied for ${metricType}. Please disconnect and reconnect Google Fit, then authorize all permissions.`,
      );
    }
    console.error(
      `Error fetching ${metricType} from Google Fit:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Get today's steps from Google Fit
 */
export const getTodaySteps = async (accessToken) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const data = await fetchGoogleFitData(
      accessToken,
      "steps",
      today,
      tomorrow,
    );

    // Debug log to see actual response structure
    console.log(
      "[GOOGLEFIT-STEPS] Full response:",
      JSON.stringify(data, null, 2),
    );

    // Return 0 if no data
    if (!data || typeof data !== "object") {
      console.log("[GOOGLEFIT-STEPS] No data or invalid response");
      return 0;
    }

    // Safely extract steps data with multiple fallbacks
    try {
      if (data.bucket && Array.isArray(data.bucket) && data.bucket.length > 0) {
        const bucket = data.bucket[0];
        if (
          bucket &&
          bucket.dataset &&
          Array.isArray(bucket.dataset) &&
          bucket.dataset.length > 0
        ) {
          const dataset = bucket.dataset[0];
          if (
            dataset &&
            dataset.point &&
            Array.isArray(dataset.point) &&
            dataset.point.length > 0
          ) {
            const point = dataset.point[0];
            if (
              point &&
              point.value &&
              Array.isArray(point.value) &&
              point.value.length > 0 &&
              point.value[0]
            ) {
              const value = point.value[0].intVal || point.value[0] || 0;
              console.log("[GOOGLEFIT-STEPS] Extracted steps:", value);
              return value;
            }
          }
        }
      }
    } catch (e) {
      console.error("[GOOGLEFIT-STEPS] Error parsing nested data:", e.message);
    }

    // No valid data found, return 0
    console.log("[GOOGLEFIT-STEPS] No valid steps data found");
    return 0;
  } catch (error) {
    console.error("[GOOGLEFIT-STEPS] Fatal error:", error.message);
    // Return 0 instead of throwing to prevent UI from breaking
    return 0;
  }
};

/**
 * Get average heart rate for a date range
 */
export const getHeartRateData = async (accessToken, startDate, endDate) => {
  try {
    const data = await fetchGoogleFitData(
      accessToken,
      "heart_rate",
      startDate,
      endDate,
    );

    console.log(
      "[GOOGLEFIT-HEARTRATE] Full response:",
      JSON.stringify(data, null, 2),
    );

    if (!data || typeof data !== "object") {
      console.log("[GOOGLEFIT-HEARTRATE] No data or invalid response");
      return { avgHeartRate: 0, points: [], count: 0 };
    }

    const points = [];
    try {
      if (data && data.bucket && Array.isArray(data.bucket)) {
        data.bucket.forEach((bucket) => {
          if (
            bucket &&
            bucket.dataset &&
            Array.isArray(bucket.dataset) &&
            bucket.dataset[0] &&
            bucket.dataset[0].point &&
            Array.isArray(bucket.dataset[0].point)
          ) {
            bucket.dataset[0].point.forEach((point) => {
              if (
                point &&
                point.value &&
                Array.isArray(point.value) &&
                point.value[0]
              ) {
                const heartRate = point.value[0].fpVal || point.value[0] || 0;
                points.push({
                  heartRate,
                  timestamp: point.startTimeNanos,
                });
              }
            });
          }
        });
      }
    } catch (e) {
      console.error("[GOOGLEFIT-HEARTRATE] Error parsing data:", e.message);
    }

    const avgHeartRate =
      points.length > 0
        ? Math.round(
            points.reduce((sum, p) => sum + p.heartRate, 0) / points.length,
          )
        : 0;

    console.log("[GOOGLEFIT-HEARTRATE] Extracted:", {
      avgHeartRate,
      count: points.length,
    });
    return { avgHeartRate, points, count: points.length };
  } catch (error) {
    console.error("[GOOGLEFIT-HEARTRATE] Fatal error:", error.message);
    return { avgHeartRate: 0, points: [], count: 0 };
  }
};

/**
 * Get sleep data from Google Fit
 */
export const getSleepData = async (accessToken, startDate, endDate) => {
  try {
    const data = await fetchGoogleFitData(
      accessToken,
      "sleep_duration",
      startDate,
      endDate,
    );

    console.log(
      "[GOOGLEFIT-SLEEP] Full response:",
      JSON.stringify(data, null, 2),
    );

    if (!data || typeof data !== "object") {
      console.log("[GOOGLEFIT-SLEEP] No data or invalid response");
      return { totalSleepHours: 0, sessions: [], count: 0 };
    }

    const sleepSessions = [];
    let totalSleepMs = 0;

    try {
      if (data && data.bucket && Array.isArray(data.bucket)) {
        data.bucket.forEach((bucket) => {
          if (
            bucket &&
            bucket.dataset &&
            Array.isArray(bucket.dataset) &&
            bucket.dataset[0] &&
            bucket.dataset[0].point &&
            Array.isArray(bucket.dataset[0].point)
          ) {
            bucket.dataset[0].point.forEach((point) => {
              if (point && point.startTimeNanos && point.endTimeNanos) {
                const startTime = parseInt(point.startTimeNanos / 1e6);
                const endTime = parseInt(point.endTimeNanos / 1e6);
                const durationMs = endTime - startTime;
                const durationHours = durationMs / (1000 * 60 * 60);

                sleepSessions.push({
                  startTime: new Date(startTime),
                  endTime: new Date(endTime),
                  durationHours: Math.round(durationHours * 10) / 10,
                  sleepType:
                    point.value && point.value[0] ? point.value[0].intVal : 0,
                });

                totalSleepMs += durationMs;
              }
            });
          }
        });
      }
    } catch (e) {
      console.error("[GOOGLEFIT-SLEEP] Error parsing data:", e.message);
    }

    const totalSleepHours =
      Math.round((totalSleepMs / (1000 * 60 * 60)) * 10) / 10;

    console.log("[GOOGLEFIT-SLEEP] Extracted:", {
      totalSleepHours,
      count: sleepSessions.length,
    });
    return {
      totalSleepHours,
      sessions: sleepSessions,
      count: sleepSessions.length,
    };
  } catch (error) {
    console.error("[GOOGLEFIT-SLEEP] Fatal error:", error.message);
    return { totalSleepHours: 0, sessions: [], count: 0 };
  }
};

/**
 * Get calories data from Google Fit
 */
export const getCaloriesData = async (accessToken, startDate, endDate) => {
  try {
    const data = await fetchGoogleFitData(
      accessToken,
      "calories",
      startDate,
      endDate,
    );

    console.log(
      "[GOOGLEFIT-CALORIES] Full response:",
      JSON.stringify(data, null, 2),
    );

    if (!data || typeof data !== "object") {
      console.log("[GOOGLEFIT-CALORIES] No data or invalid response");
      return { totalCalories: 0 };
    }

    let totalCalories = 0;

    try {
      if (data && data.bucket && Array.isArray(data.bucket)) {
        data.bucket.forEach((bucket) => {
          if (
            bucket &&
            bucket.dataset &&
            Array.isArray(bucket.dataset) &&
            bucket.dataset[0] &&
            bucket.dataset[0].point &&
            Array.isArray(bucket.dataset[0].point)
          ) {
            bucket.dataset[0].point.forEach((point) => {
              if (
                point &&
                point.value &&
                Array.isArray(point.value) &&
                point.value[0]
              ) {
                totalCalories += point.value[0].fpVal || 0;
              }
            });
          }
        });
      }
    } catch (e) {
      console.error("[GOOGLEFIT-CALORIES] Error parsing data:", e.message);
    }

    console.log("[GOOGLEFIT-CALORIES] Extracted:", {
      totalCalories: Math.round(totalCalories),
    });
    return {
      totalCalories: Math.round(totalCalories),
    };
  } catch (error) {
    console.error("[GOOGLEFIT-CALORIES] Fatal error:", error.message);
    return { totalCalories: 0 };
  }
};

/**
 * Store Google Fit access token for a patient
 */
export const storeGoogleFitToken = async (
  patientId,
  accessToken,
  refreshToken,
  expiresAt = null,
) => {
  try {
    // Calculate expiration time if not provided
    // Google access tokens typically expire in 3600 seconds (1 hour)
    const tokenExpiresAt = expiresAt || new Date(Date.now() + 3600 * 1000);

    const result = await sql`
      UPDATE patients
      SET 
        google_fit_access_token = ${accessToken},
        google_fit_refresh_token = ${refreshToken},
        google_fit_token_expires_at = ${tokenExpiresAt},
        google_fit_connected_at = NOW()
      WHERE id = ${patientId}
      RETURNING id, google_fit_access_token, google_fit_connected_at
    `;

    if (result.length === 0) {
      throw new Error("Patient not found");
    }

    return result[0];
  } catch (error) {
    console.error("Error storing Google Fit token:", error);
    throw error;
  }
};

/**
 * Get Google Fit access token for a patient
 * Automatically refreshes token if expired
 */
export const getGoogleFitToken = async (patientId) => {
  try {
    const result = await sql`
      SELECT 
        google_fit_access_token,
        google_fit_refresh_token,
        google_fit_token_expires_at,
        google_fit_connected_at
      FROM patients
      WHERE id = ${patientId}
    `;

    if (result.length === 0) {
      throw new Error("Patient not found");
    }

    const tokenData = result[0];

    // Check if token is expired
    const expiresAt = tokenData.google_fit_token_expires_at
      ? new Date(tokenData.google_fit_token_expires_at)
      : null;
    const now = new Date();

    // If token is expired or expiring in next 5 minutes, refresh it
    if (
      expiresAt &&
      expiresAt.getTime() - now.getTime() < 5 * 60 * 1000
    ) {
      console.log(
        "[GOOGLEFIT-TOKEN] Token expired or expiring soon, refreshing...",
      );

      if (!tokenData.google_fit_refresh_token) {
        throw new Error(
          "Token expired and no refresh token available. Please reconnect Google Fit.",
        );
      }

      try {
        const { accessToken, expiresAt: newExpiresAt } =
          await refreshGoogleFitToken(tokenData.google_fit_refresh_token);

        // Store the new token
        await storeGoogleFitToken(
          patientId,
          accessToken,
          tokenData.google_fit_refresh_token,
          newExpiresAt,
        );

        console.log("[GOOGLEFIT-TOKEN] Token refreshed and stored successfully");

        return {
          google_fit_access_token: accessToken,
          google_fit_refresh_token: tokenData.google_fit_refresh_token,
          google_fit_token_expires_at: newExpiresAt,
          google_fit_connected_at: tokenData.google_fit_connected_at,
        };
      } catch (refreshError) {
        console.error(
          "[GOOGLEFIT-TOKEN] Failed to refresh token:",
          refreshError.message,
        );
        throw new Error(
          "Failed to refresh Google Fit token. Please reconnect Google Fit.",
        );
      }
    }

    return tokenData;
  } catch (error) {
    console.error("Error retrieving Google Fit token:", error);
    throw error;
  }
};

/**
 * Disconnect Google Fit
 */
export const disconnectGoogleFit = async (patientId) => {
  try {
    const result = await sql`
      UPDATE patients
      SET 
        google_fit_access_token = NULL,
        google_fit_refresh_token = NULL,
        google_fit_connected_at = NULL
      WHERE id = ${patientId}
      RETURNING id
    `;

    if (result.length === 0) {
      throw new Error("Patient not found");
    }

    return result[0];
  } catch (error) {
    console.error("Error disconnecting Google Fit:", error);
    throw error;
  }
};

/**
 * Check if Google Fit is connected for a patient
 */
export const isGoogleFitConnected = async (patientId) => {
  try {
    const result = await sql`
      SELECT google_fit_access_token, google_fit_connected_at
      FROM patients
      WHERE id = ${patientId}
    `;

    if (result.length === 0) {
      return false;
    }

    return !!result[0].google_fit_access_token;
  } catch (error) {
    console.error("Error checking Google Fit connection:", error);
    return false;
  }
};
