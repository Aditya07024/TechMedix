import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Link, useNavigate } from "react-router-dom";
import { assets } from "../../assets/assets";
import { patientApi } from "../../api"; // Import patientApi
import { useAuth } from "../../context/AuthContext"; // Import useAuth
import { patientDataApi } from "../../api"; // Import patientDataApi
import HealthChat from "../../components/HealthChat/HealthChat";

const METRIC_META = {
  bloodPressure: { icon: "🩺", label: "Blood Pressure" },
  heartRate: { icon: "❤️", label: "Heart Rate" },
  glucose: { icon: "🧪", label: "Glucose" },
  cholesterol: { icon: "🫀", label: "Cholesterol" },
  temperature: { icon: "🌡️", label: "Temperature" },
  spo2: { icon: "🫁", label: "SpO2" },
  bmi: { icon: "⚖️", label: "BMI" },
  weight: { icon: "🏋️", label: "Weight" },
  sleep: { icon: "😴", label: "Sleep" },
  steps: { icon: "👟", label: "Steps" },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const Dashboard = () => {
  const [qrData, setQrData] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;
  const [ehrHistory, setEhrHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { logout } = useAuth(); // Get logout function from AuthContext
  const navigate = useNavigate(); // For redirection after deletion

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    console.debug("Dashboard: storedUser from localStorage:", storedUser);
    if (!storedUser || !storedUser.id) {
      setError("User not logged in or patient ID not found.");
      setLoading(false);
      return;
    }
    setUser(storedUser);

    const fetchData = async () => {
      try {
        setLoading(true);
        const patientId = storedUser.id;
        const [patientRes, ehrRes] = await Promise.allSettled([
          axios.get(`${API_URL}/api/patient/${patientId}`),
          axios.get(`${API_URL}/api/patientdata/${patientId}`),
        ]);

        if (patientRes.status === "fulfilled" && patientRes.value?.data) {
          setUser({ ...storedUser, ...patientRes.value.data });
        }
        if (ehrRes.status === "fulfilled" && Array.isArray(ehrRes.value.data)) {
          setEhrHistory(ehrRes.value.data);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch patient data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL]);

  // 📱 Generate QR code (protected route)
  const generateQR = async (patientId) => {
    try {
      const res = await patientDataApi.generatePatientQR(patientId);
      setQrData(res.data.qr);
    } catch (err) {
      console.error("QR generation error:", err);
      alert("Failed to generate QR code");
    }
  };

  // 📊 Build chart data for a given metric
  const getChartDataForMetric = (metricName) => {
    const sorted = ehrHistory
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const labels = sorted.map((record) =>
      new Date(record.timestamp).toLocaleDateString()
    );

    const data = sorted.map((record) => {
      if (metricName.includes(".")) {
        const [parent, child] = metricName.split(".");
        return record.ehr?.[parent]?.[child];
      }
      return record.ehr?.[metricName];
    });

    return {
      labels,
      datasets: [
        {
          label: metricName.replace(/_/g, " ").toUpperCase(),
          data,
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: hoveredMetric
          ? `Trend for ${hoveredMetric.replace(/_/g, " ")}`
          : "Health Metric Trend",
      },
    },
  };

  // 🧮 Compute a simple health status score (0-100) from latest metrics
  const computeHealthScore = (metrics) => {
    if (!metrics) return 0;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const scoreMetric = (
      value,
      idealMin,
      idealMax,
      warningMin,
      warningMax,
    ) => {
      const num = toNumber(value);
      if (num == null) return null;
      if (num >= idealMin && num <= idealMax) return 100;

      if (num < idealMin) {
        if (num <= warningMin) return 35;
        const ratio = (num - warningMin) / (idealMin - warningMin);
        return Math.round(clamp(35 + ratio * 65, 35, 99));
      }

      if (num >= warningMax) return 35;
      const ratio = (warningMax - num) / (warningMax - idealMax);
      return Math.round(clamp(35 + ratio * 65, 35, 99));
    };

    const scores = [];

    const systolicScore = scoreMetric(
      metrics?.bloodPressure?.systolic,
      90,
      120,
      80,
      160,
    );
    if (systolicScore != null) scores.push(systolicScore);

    const diastolicScore = scoreMetric(
      metrics?.bloodPressure?.diastolic,
      60,
      80,
      50,
      100,
    );
    if (diastolicScore != null) scores.push(diastolicScore);

    const heartRateScore = scoreMetric(metrics?.heartRate, 60, 100, 45, 130);
    if (heartRateScore != null) scores.push(heartRateScore);

    const glucoseScore = scoreMetric(metrics?.glucose, 70, 99, 55, 180);
    if (glucoseScore != null) scores.push(glucoseScore);

    const cholesterolScore = scoreMetric(
      metrics?.cholesterol,
      125,
      200,
      100,
      280,
    );
    if (cholesterolScore != null) scores.push(cholesterolScore);

    const temperatureScore = scoreMetric(
      metrics?.temperature,
      36.1,
      37.2,
      35,
      39.5,
    );
    if (temperatureScore != null) scores.push(temperatureScore);

    const spo2Score = scoreMetric(metrics?.spo2, 95, 100, 88, 100);
    if (spo2Score != null) scores.push(spo2Score);

    const bmiScore = scoreMetric(metrics?.bmi, 18.5, 24.9, 16, 35);
    if (bmiScore != null) scores.push(bmiScore);

    const sleepScore = scoreMetric(metrics?.sleep, 7, 9, 4, 12);
    if (sleepScore != null) scores.push(sleepScore);

    if (!scores.length) return 0;
    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  };

  const handleDeleteRecord = async (recordId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this health record? This action cannot be undone."
      )
    ) {
      try {
        setLoading(true);
        await patientDataApi.deletePatientDataRecord(recordId);
        alert("Health record deleted successfully.");
        // Update EHR history in the state to reflect the deletion
        setEhrHistory((prevEhrHistory) =>
          prevEhrHistory.filter((record) => record._id !== recordId)
        );
      } catch (err) {
        console.error("Error deleting health record:", err);
        setError(
          err.response?.data?.message || "Failed to delete health record."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      try {
        setLoading(true);
        await patientApi.deletePatient(user.id);
        alert("Your account has been deleted successfully.");
        logout(); // Log out the user from the frontend
        navigate("/"); // Redirect to home page
      } catch (err) {
        console.error("Error deleting account:", err);
        setError(err.response?.data?.message || "Failed to delete account.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <p>Loading EHR history...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;

  const latestRecord =
    ehrHistory && ehrHistory.length
      ? ehrHistory
          .slice()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      : null;

  const latestMetrics = latestRecord?.ehr || {};
  const getMetricMeta = (key) => {
    const fallbackLabel = key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();

    return METRIC_META[key] || { icon: "📋", label: fallbackLabel };
  };

  return (
    <div className="dashboard-container">
      <div className="dash-toolbar">
        <h2 className="dash-title">My Health Dashboard</h2>
        {/* <div className="dash-actions">
          <a href="/form" className="Documents-btn"><p className="text">➕ Add Data</p></a>
          <a href="/upload-prescription" className="Documents-btn"><p className="text">📄 Upload Prescription</p></a>
          <button onClick={() => setChatOpen(true)} className="Documents-btn"><p className="text">💬 Health Chatbot</p></button>
        </div> */}
      </div>
      {chatOpen && <HealthChat open={chatOpen} onClose={() => setChatOpen(false)} />}
      <div className="dashboard-grid">
        {/* 🧍 Patient Information (Top-Left) */}
        <div className="dashboard-tile left">
          <div className="card">
            <div className="top-section">
              <div className="border">
                {user?.gender === "m" ||
                user?.gender?.toUpperCase() === "male" ? (
                  <img
                    src={assets.male_avatar}
                    alt="Male Avatar"
                    className="avatar-img"
                  />
                ) : user?.gender === "f" ||
                  user?.gender?.toUpperCase() === "female" ? (
                  <img
                    src={assets.female_avatar}
                    alt="Female Avatar"
                    className="avatar-img"
                  />
                ) : (
                  <img
                    src={assets.male_avatar}
                    alt="Default Avatar"
                    className="avatar-img"
                  />
                )}
              </div>
            </div>
            <div className="bottom-section">
              <span className="title">{user?.name || "User name"}</span>
              <div className="row row1">
                <div className="item">
                  <span className="big-text">Age</span>
                  <span className="regular-text">{user?.age ?? "-"}</span>
                </div>
                <div className="item">
                  <span className="big-text">Gender</span>
                  <span className="regular-text">{user?.gender || "-"}</span>
                </div>
                <div className="item">
                  <span className="big-text">Blood Group</span>
                  <span className="regular-text">
                    {user?.bloodGroup || "-"}
                  </span>
                </div>
              </div>
              <div className="row row2">
                <div className="item">
                  Medical History: {user?.medicalHistory || "-"}
                </div>
              </div>
              <div className="row row3">
                <div className="item">Email: {user?.email || "-"}</div>
                <div className="item">Phone no: {user?.phone || "-"}</div>
              </div>
              <button
                className="delete-record-button"
                onClick={handleDeleteAccount}
              >
                Delete My Record
              </button>
            </div>
          </div>
        </div>

        {/* 📊 Recent Data & Hover-to-Chart (Top-Right) */}
        <div className="dashboard-tile top-right">
          <div>
            <h3>Recent Patient Data</h3>

            {Object.keys(latestMetrics).length > 0 ? (
              <ul className="metric-list">
                {Object.entries(latestMetrics).map(([k, v]) => {
                  const metricMeta = getMetricMeta(k);

                  return k !== "bloodPressure" ? (
                    <li
                      key={k}
                      className="metric-card"
                      onMouseEnter={() => setHoveredMetric(k)}
                      onMouseLeave={() => setHoveredMetric(null)}
                    >
                      <span className="metric-card-icon" aria-hidden="true">
                        {metricMeta.icon}
                      </span>
                      <div className="metric-card-copy">
                        <strong>{metricMeta.label}</strong>
                        <span>{String(v)}</span>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={k}
                      className="metric-card"
                      onMouseEnter={() =>
                        setHoveredMetric("bloodPressure.systolic")
                      }
                      onMouseLeave={() => setHoveredMetric(null)}
                    >
                      <span className="metric-card-icon" aria-hidden="true">
                        {metricMeta.icon}
                      </span>
                      <div className="metric-card-copy">
                        <strong>{metricMeta.label}</strong>
                        <span>
                          {latestMetrics.bloodPressure?.systolic}/
                          {latestMetrics.bloodPressure?.diastolic} mmHg
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No metrics available</p>
            )}
          </div>
          <div className="button-div">
            <button
              onClick={() => setChatOpen(true)}
              className="Documents-btn chatbot-icon-btn"
              aria-label="Open Health Chatbot"
              style={{ marginTop: 16 }}
            >
              <img
                src={assets.doctor_ai_icon}
                alt=""
                className="chatbot-icon-image"
              />
            </button>
            {/* <Link
              to="/dashboard"
              className="go-to-home-data-button"
              style={{ marginTop: 16 }}
            >
              <button className="Documents-btn">
                <p className="text">Home</p>
              </button>
            </Link> */}
            <Link
              to="/form"
              className="add-new-data-button"
              style={{ marginTop: 16 }}
            >
              <button className="Documents-btn">
                <p className="text">Add new Data</p>
              </button>
            </Link>

            
            
          </div>
        </div>

        {/* 📊 Health Status or Chart (Bottom-Left) */}
        <div className="dashboard-tile left">
          <div className="chart-section">
            {hoveredMetric ? (
              <div className="chart-container">
                <Line
                  options={chartOptions}
                  data={getChartDataForMetric(hoveredMetric)}
                />
              </div>
            ) : (
              <div className="status">
                <h4>Health Status</h4>
                {latestRecord ? (
                  (() => {
                    const score = computeHealthScore(latestMetrics);
                    return (
                      <>
                        <div
                          style={{
                            width: "100%",
                            background: "#eee",
                            borderRadius: 8,
                            height: 16,
                          }}
                        >
                          <div
                            style={{
                              width: `${score}%`,
                              background:
                                score > 70
                                  ? "#22c55e"
                                  : score > 40
                                  ? "#f59e0b"
                                  : "#ef4444",
                              height: "100%",
                              borderRadius: 8,
                              transition: "width 300ms ease-in-out",
                            }}
                            aria-label={`Health score ${score}`}
                          />
                        </div>
                        <p style={{ marginTop: 10, color: "#555" }}>
                          {score}% Health Score
                        </p>
                      </>
                    );
                  })()
                ) : (
                  <p>No recent record available.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 📚 Previous Records (Bottom-Right) */}
        <div className="dashboard-container">
          <h2>Patient Dashboard</h2>

          {ehrHistory.length === 0 ? (
            <p>No EHR data found. Add your first health record!</p>
          ) : (
            <div className="ehr-timeline">
              {ehrHistory.map((record, index) => (
                <div key={record._id} className="ehr-record-card">
                  {/* Dropdown for each record */}
                  <div className="dropdown">
                    <input
                      hidden
                      className="sr-only"
                      name={`state-dropdown-${index}`}
                      id={`state-dropdown-${index}`}
                      type="checkbox"
                    />
                    <label
                      aria-label="dropdown scrollbar"
                      htmlFor={`state-dropdown-${index}`}
                      className="trigger"
                    >
                      <h3>
                        Record on:{" "}
                        {new Date(record.timestamp).toLocaleDateString()}
                      </h3>{" "}
                    </label>

                    <ul
                      className="list webkit-scrollbar"
                      role="list"
                      dir="auto"
                    >
                      <li className="listitem" role="listitem">
                        <article className="article">
                          <h4>Health Metrics:</h4>
                          <ul>
                            {Object.entries(record.ehr).map(
                              ([key, value]) =>
                                value !== null &&
                                typeof value !== "object" && (
                                  <li key={key}>
                                    <strong>{key}:</strong> {value}
                                  </li>
                                )
                            )}
                          </ul>
                        </article>
                      </li>

                      {record.symptoms &&
                        Object.keys(record.symptoms).length > 0 && (
                          <li className="listitem" role="listitem">
                            <article className="article">
                              <h4>Symptoms:</h4>
                              <ul>
                                {Object.entries(record.symptoms).map(
                                  ([key, value]) => (
                                    <li key={key}>
                                      <strong>{key}:</strong> {value}
                                    </li>
                                  )
                                )}
                              </ul>
                            </article>
                          </li>
                        )}

                      {record.medicines && record.medicines.length > 0 && (
                        <li className="listitem" role="listitem">
                          <article className="article">
                            <h4>Medicines:</h4>
                            <ul>
                              {record.medicines.map((med, i) => (
                                <li key={i}>
                                  {med.name} - {med.dosage} ({med.frequency})
                                </li>
                              ))}
                            </ul>
                          </article>
                        </li>
                      )}

                      {record.prescription &&
                        record.prescription.length > 0 && (
                          <li className="listitem" role="listitem">
                            <article className="article">
                              <h4>Prescriptions:</h4>
                              <ul>
                                {record.prescription.map((pres, i) => (
                                  <li key={i}>
                                    {pres.medicine} - {pres.dosage} (
                                    {pres.duration})
                                  </li>
                                ))}
                              </ul>
                            </article>
                          </li>
                        )}

                      {record.predictedDisease && (
                        <li className="listitem" role="listitem">
                          <article className="article">
                            <h4>ML Predicted Disease:</h4>
                            <p>{record.predictedDisease}</p>
                          </article>
                        </li>
                      )}

                      {record.relatedSymptoms &&
                        record.relatedSymptoms.length > 0 && (
                          <li className="listitem" role="listitem">
                            <article className="article">
                              <h4>Related Symptoms:</h4>
                              <ul>
                                {record.relatedSymptoms.map((symptom, i) => (
                                  <li key={i}>{symptom.replace(/_/g, " ")}</li>
                                ))}
                              </ul>
                            </article>
                          </li>
                        )}

                      {record.aiInsights && (
                        <li className="listitem" role="listitem">
                          <article className="article">
                            <h4>AI Insights:</h4>
                            <p>{record.aiInsights}</p>
                          </article>
                        </li>
                      )}
                    </ul>
                    <button
                      onClick={() => handleDeleteRecord(record._id)}
                      className="delete-ehr-record-button"
                    >
                      Delete Record
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
