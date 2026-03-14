import React, { useState, useEffect } from "react";
import { googleFitAPI } from "../../api/googleFitAPI";
import "./GoogleFitMetrics.css";

/**
 * Google Fit Metrics Display Component
 * Shows health metrics synced from Google Fit
 */
export default function GoogleFitMetrics() {
  const [metrics, setMetrics] = useState({
    steps: null,
    heart_rate: null,
    sleep_duration: null,
    calories: null,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [rawRows, setRawRows] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await googleFitAPI.getGoogleFitMetrics();

      console.log("[METRICS-FETCH] API Response:", response);

      if (response.success && response.data && Array.isArray(response.data)) {
        // Backend returns array of metric objects
        const metricMap = {};
        response.data.forEach((metric) => {
          // Map by metric_type for cleaner access
          metricMap[metric.metric_type] = metric;
          console.log(
            `[METRICS-FETCH] ${metric.metric_type}: value=${metric.value} unit=${metric.unit}`,
          );
        });
        setMetrics(metricMap);
        setLastSync(new Date());
        console.log("[METRICS-FETCH] Successfully mapped metrics:", metricMap);
      } else if (response.data && Array.isArray(response.data)) {
        // Fallback for different response format
        const metricMap = {};
        response.data.forEach((metric) => {
          metricMap[metric.metric_type] = metric;
        });
        setMetrics(metricMap);
        setLastSync(new Date());
      } else {
        console.log("[METRICS-FETCH] Response:", response);
        setError("No metrics data found in response");
      }
    } catch (err) {
      console.error("[METRICS-FETCH] Error:", err);
      setError(`Failed to load health metrics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const resp = await googleFitAPI.syncGoogleFitData();
      setLastSyncResult(resp);

      // Prefer showing what was just saved, without waiting for /metrics
      const saved = resp?.data?.data?.savedRows || resp?.data?.data || null;
      if (saved && typeof saved === "object") {
        const rows = Object.values(saved).filter(Boolean);
        if (rows.length > 0) {
          const metricMap = {};
          rows.forEach((row) => {
            const key = row.metric_type || row.metricType;
            if (key) metricMap[key] = row;
          });
          if (Object.keys(metricMap).length > 0) {
            setMetrics((prev) => ({ ...prev, ...metricMap }));
            setLastSync(new Date());
          }
        }
      }

      // Also refresh from DB to stay source-of-truth
      await fetchMetrics();
      setError(null);
    } catch (err) {
      console.error("Failed to sync data:", err);
      setError("Failed to sync health data. Please try again.");
    } finally {
      handleViewRaw();
      setSyncing(false);
    }
  };

  const handleDemoData = async () => {
    try {
      setSyncing(true);
      setError(null);
      await googleFitAPI.syncGoogleFitData(null, null, true);
      await fetchMetrics();
      setError(null);
    } catch (err) {
      console.error("Failed to load demo data:", err);
      setError("Failed to load demo data. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleViewRaw = async () => {
    try {
      setError(null);
      const data = await googleFitAPI.getGoogleFitMetricsRaw();
      setRawRows(data);
      setShowDebug(true);
    } catch (err) {
      console.error("Failed to load raw rows:", err);
      setError("Failed to load DB rows. Are you logged in?");
    }
  };
  const handleRefresh = async () => {
    try {
      setError(null);
      await fetchMetrics();
    } catch (err) {
      console.error("Failed to refresh metrics:", err);
      setError("Failed to refresh metrics. Please try again.");
    }
  };

  const getMetricCard = (metricType, metricData, unit, icon, label) => {
    // Extract value from different possible data formats
    let displayValue = null;
    let timestamp = null;
    let status = null;
    let isActive = false;

    if (metricData) {
      // If it's just a number
      if (typeof metricData === "number") {
        displayValue = metricData;
        isActive = displayValue > 0;
      }
      // If it's an object with value property
      else if (metricData.value !== undefined && metricData.value !== null) {
        displayValue = Number(metricData.value);
        timestamp = metricData.recorded_at;
        status = metricData.status;
        isActive = displayValue > 0;
      }
      // If it's an object with the metric-specific property
      else if (metricType === "heart_rate" && metricData.avgHeartRate) {
        displayValue = metricData.avgHeartRate;
        isActive = displayValue > 0;
      } else if (
        metricType === "sleep_duration" &&
        metricData.totalSleepHours
      ) {
        displayValue = metricData.totalSleepHours;
        isActive = displayValue > 0;
      } else if (metricType === "calories" && metricData.totalCalories) {
        displayValue = metricData.totalCalories;
        isActive = displayValue > 0;
      }
    }

    return (
      <div
        key={metricType}
        className={`metric-card ${isActive ? "active" : "inactive"}`}
      >
        <div className="metric-icon">{icon}</div>
        <div className="metric-info">
          <h4>{label}</h4>
          <p className="metric-value">
            {displayValue !== null && displayValue !== undefined ? (
              <>
                <span className="value">
                  {typeof displayValue === "number"
                    ? displayValue.toFixed(0)
                    : displayValue}
                </span>
                <span className="unit">{unit}</span>
              </>
            ) : (
              <span className="no-data">No data</span>
            )}
          </p>
          {status && (
            <p className="metric-status">
              {status.includes("✓") ? "✓ " : ""}
              {status.replace(/✓\s/, "")}
            </p>
          )}
          {(displayValue || timestamp) && (
            <p className="metric-timestamp">
              {timestamp
                ? new Date(timestamp).toLocaleDateString()
                : new Date().toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="google-fit-metrics-container">
      <div className="metrics-header">
        <h2>Health Metrics</h2>
        <div className="header-actions">
          <button
            className="btn-sync"
            onClick={handleSync}
            disabled={syncing || loading}
            title="Sync with Google Fit"
          >
            {syncing ? "Syncing..." : "🔄 Sync Now"}
          </button>
          {/* <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh from database"
          >
            ↻ Refresh
          </button> */}
          {/* <button
            className="btn-demo"
            onClick={handleViewRaw}
            disabled={loading}
            title="View raw DB rows for today"
          >
            🔍 View DB Rows
          </button> */}
          {/* <button
            className="btn-demo"
            onClick={handleDemoData}
            disabled={syncing || loading}
            title="Load demo/test data"
          >
            📊 Demo Data
          </button> */}
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="error-banner">{error}</div>}

      {/* Last Sync Info */}
      {lastSync && (
        <p className="last-sync-info">
          Last synced: {lastSync.toLocaleString()}
        </p>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading health metrics...</p>
        </div>
      )}

      {/* Metrics Grid */}
      {/* {!loading && (
        <div className="metrics-grid">
          {getMetricCard("steps", metrics.steps, "steps", "👟", "Steps Today")}
          {getMetricCard(
            "heart_rate",
            metrics.heart_rate,
            "bpm",
            "❤️",
            "Heart Rate",
          )}
          {getMetricCard(
            "sleep_duration",
            metrics.sleep_duration,
            "hours",
            "😴",
            "Sleep Duration",
          )}
          {getMetricCard(
            "calories",
            metrics.calories,
            "kcal",
            "🔥",
            "Calories Burned",
          )}
        </div>
      )} */}

      {/* Debug panel */}
      {showDebug && (
        <div className="debug-panel" style={{ marginTop: 16 }}>
          <h4 style={{ margin: 0 }}>Debug Output</h4>
          {lastSyncResult && (
            <>
              <p style={{ margin: "8px 0" }}>Last Sync Response:</p>
              <pre
                style={{
                  maxHeight: 240,
                  overflow: "auto",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                {JSON.stringify(
                  {
                    message: lastSyncResult?.message,
                    data: lastSyncResult?.data?.savedRows,
                  },
                  null,
                  2,
                )}
              </pre>
            </>
          )}
          {/* {rawRows && (
            <>
              <p style={{ margin: "8px 0" }}>DB Rows for Today:</p>
              <pre
                style={{
                  maxHeight: 320,
                  overflow: "auto",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                {JSON.stringify(rawRows, null, 2)}
              </pre>
            </>
          )} */}
        </div>
      )}

      {/* Empty State */}
      {/* {!loading && Object.values(metrics).every((m) => m === null) && (
        <div className="empty-state">
          <p>
            No health metrics yet. Click "Sync Now" to fetch data from Google
            Fit.
          </p>
        </div>
      )} */}
    </div>
  );
}
