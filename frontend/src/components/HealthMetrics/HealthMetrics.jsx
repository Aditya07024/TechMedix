import React, { useState, useEffect } from "react";
import "./HealthMetrics.css";
import { API_BASE_URL } from "../../utils/apiBase";
import {
  Activity,
  Flame,
  Footprints,
  HeartPulse,
  Lightbulb,
  MoonStar,
} from "lucide-react";

const HealthMetrics = ({ patientId }) => {
  const [healthData, setHealthData] = useState({});
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (patientId) {
      loadHealthData();
    }
  }, [patientId]);

  const loadHealthData = async () => {
    try {
      setLoading(true);

      // Load latest metrics and insights in parallel
      const [metricsRes, insightsRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/health/latest`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }),
        fetch(`${API_BASE_URL}/api/health/insights`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }),
      ]);

      if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
        const metricsData = await metricsRes.value.json();
        setHealthData(metricsData);
      }

      if (insightsRes.status === "fulfilled" && insightsRes.value.ok) {
        const insightsData = await insightsRes.value.json();
        setInsights(insightsData.insights || []);
      }
    } catch (err) {
      setError("Failed to load health data");
      console.error("Health data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value, unit) => {
    // Convert to number if string, handle null/undefined
    const numValue =
      value === null || value === undefined ? 0 : parseFloat(value);

    if (isNaN(numValue)) return "N/A";

    if (unit === "count") return Math.round(numValue).toLocaleString();
    if (unit === "hours") return numValue.toFixed(1);
    if (unit === "kcal") return Math.round(numValue);
    if (unit === "bpm") return Math.round(numValue);
    return numValue.toFixed(1);
  };

  const getMetricIcon = (type) => {
    switch (type) {
      case "steps":
        return Footprints;
      case "heart_rate":
        return HeartPulse;
      case "sleep_duration":
        return MoonStar;
      case "calories_burned":
        return Flame;
      case "activity":
        return Activity;
      default:
        return Activity;
    }
  };

  const getMetricLabel = (type) => {
    switch (type) {
      case "steps":
        return "Daily Steps";
      case "heart_rate":
        return "Heart Rate";
      case "sleep_duration":
        return "Sleep Hours";
      case "calories_burned":
        return "Calories Burned";
      case "activity":
        return "Activity";
      default:
        return type.replace("_", " ").toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="health-metrics">
        <h3>Health Metrics</h3>
        <div className="loading">Loading health data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="health-metrics">
        <h3>Health Metrics</h3>
        <div className="error">{error}</div>
      </div>
    );
  }

  const metricsList = Object.entries(healthData);

  return (
    <div className="health-metrics">
      <h3>Health Metrics</h3>

      {metricsList.length === 0 ? (
        <div className="no-data">
          <p>No health data available</p>
          <p>
            Connect your Android device with Health Connect to sync health
            metrics
          </p>
        </div>
      ) : (
        <div className="metrics-grid">
          {metricsList.map(([type, data]) => (
            <div key={type} className="metric-card">
              <div className="metric-icon">
                {React.createElement(getMetricIcon(type), {
                  size: 24,
                  strokeWidth: 2,
                })}
              </div>
              <div className="metric-content">
                <div className="metric-value">
                  {formatValue(data.value, data.unit)}
                  <span className="metric-unit">{data.unit}</span>
                </div>
                <div className="metric-label">{getMetricLabel(type)}</div>
                <div className="metric-date">
                  {new Date(data.recorded_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="health-insights">
          <h4>AI Health Insights</h4>
          <div className="insights-list">
            {insights.map((insight, index) => (
              <div key={index} className="insight-item">
                <span className="insight-icon">
                  <Lightbulb size={16} strokeWidth={2} />
                </span>
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthMetrics;
