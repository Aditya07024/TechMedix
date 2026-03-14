import React, { useState, useEffect } from "react";
import { googleFitAPI } from "../../api/googleFitAPI";
import "./HealthMetricsSummary.css";

/**
 * Health Metrics Summary Component
 * Displays detailed health metrics with status information
 */
export default function HealthMetricsSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetricsSummary();
  }, []);

  const fetchMetricsSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await googleFitAPI.getGoogleFitMetricsSummary();
      setData(response);
      console.log("[METRICS-SUMMARY] Response:", response);
    } catch (err) {
      console.error("Failed to fetch metrics summary:", err);
      setError("Failed to load health metrics summary");
    } finally {
      setLoading(false);
    }
  };

  const getMetricIcon = (metricType) => {
    const icons = {
      steps: "👟",
      heart_rate: "❤️",
      sleep_duration: "😴",
      calories_burned: "🔥",
      calories: "🔥",
    };
    return icons[metricType] || "📊";
  };

  const getMetricLabel = (metricType) => {
    const labels = {
      steps: "Steps",
      heart_rate: "Heart Rate",
      sleep_duration: "Sleep Duration",
      calories_burned: "Calories Burned",
      calories: "Calories Burned",
    };
    return labels[metricType] || metricType;
  };

  const getMetricUnit = (metricType) => {
    const units = {
      steps: "steps",
      heart_rate: "bpm",
      sleep_duration: "hours",
      calories_burned: "kcal",
      calories: "kcal",
    };
    return units[metricType] || "";
  };

  if (loading) {
    return (
      <div className="metrics-summary-container loading">
        <div className="spinner"></div>
        <p>Loading health metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metrics-summary-container error">
        <p className="error-message">{error}</p>
        <button onClick={fetchMetricsSummary} className="btn-retry">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="metrics-summary-container">
        <p>No metrics data available</p>
      </div>
    );
  }

  return (
    <div className="metrics-summary-container">
      {/* Header */}
      <div className="summary-header">
        <h2>📊 Health Metrics Summary</h2>
        <p className="sync-date">
          Date: <strong>{data.date}</strong>
        </p>
      </div>

      {/* Summary Stats */}
      {data.summary && (
        <div className="summary-stats">
          <div className="stat-card">
            <div className="stat-value">
              {data.summary.totalMetricsRetrieved}
            </div>
            <div className="stat-label">Total Retrieved</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{data.summary.successfulMetrics}</div>
            <div className="stat-label">With Data</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{data.summary.metricsWithoutData}</div>
            <div className="stat-label">No Data</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">✓</div>
            <div className="stat-label">Last Sync</div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metrics-grid-detailed">
        <h3>Detailed Metrics</h3>
        <div className="metrics-list">
          {data.metrics && data.metrics.length > 0 ? (
            data.metrics.map((metric) => (
              <div
                key={metric.id}
                className={`metric-detail ${metric.value > 0 ? "active" : "inactive"}`}
              >
                <div className="metric-left">
                  <div className="metric-icon-lg">
                    {getMetricIcon(metric.metricType)}
                  </div>
                  <div className="metric-info-detail">
                    <h4>{getMetricLabel(metric.metricType)}</h4>
                    <p className="metric-type-code">{metric.metricType}</p>
                  </div>
                </div>

                <div className="metric-center">
                  <p className="metric-value-detail">
                    <span className="value">{metric.value.toFixed(2)}</span>
                    <span className="unit-detail">
                      {getMetricUnit(metric.metricType)}
                    </span>
                  </p>
                  <p className="metric-source">{metric.source}</p>
                </div>

                <div className="metric-right">
                  <span
                    className={`status-badge ${metric.value > 0 ? "success" : "empty"}`}
                  >
                    {metric.status}
                  </span>
                  <p className="recorded-time">
                    {new Date(metric.recordedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="no-metrics">
              <p>No metrics available for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Sync Info */}
      {data.summary && (
        <div className="sync-info">
          <p>
            <strong>Last Sync:</strong>{" "}
            {new Date(data.summary.lastSyncTime).toLocaleString()}
          </p>
          <p>
            <strong>Sync Type:</strong> Google Fit API
          </p>
        </div>
      )}

      {/* JSON Data Display (Optional) */}
      <details className="json-data-details">
        <summary>View JSON Data</summary>
        <div className="json-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
}
