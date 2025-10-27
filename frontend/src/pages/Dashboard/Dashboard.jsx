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
    let score = 0;
    let count = 0;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // Heart rate (resting) ideal ~60-100 bpm
    if (typeof metrics.heartRate === "number") {
      const hr = metrics.heartRate;
      let s = 100;
      if (hr < 50) s = clamp(50 + (hr / 50) * 50, 0, 100);
      else if (hr > 110) s = clamp(100 - ((hr - 110) / 60) * 60, 0, 100);
      score += s;
      count++;
    }

    // Blood pressure systolic ideal ~90-120
    if (
      metrics.bloodPressure &&
      typeof metrics.bloodPressure.systolic === "number"
    ) {
      const sys = metrics.bloodPressure.systolic;
      let s = 100;
      if (sys < 90) s = clamp(50 + (sys / 90) * 50, 0, 100);
      else if (sys > 140) s = clamp(100 - ((sys - 140) / 60) * 60, 0, 100);
      score += s;
      count++;
    }

    // Blood pressure diastolic ideal ~60-80
    if (
      metrics.bloodPressure &&
      typeof metrics.bloodPressure.diastolic === "number"
    ) {
      const dia = metrics.bloodPressure.diastolic;
      let s = 100;
      if (dia < 60) s = clamp(50 + (dia / 60) * 50, 0, 100);
      else if (dia > 90) s = clamp(100 - ((dia - 90) / 40) * 60, 0, 100);
      score += s;
      count++;
    }

    // Blood sugar (fasting) ideal ~70-100
    if (typeof metrics.bloodSugar === "number") {
      const bs = metrics.bloodSugar;
      let s = 100;
      if (bs < 70) s = clamp(50 + (bs / 70) * 50, 0, 100);
      else if (bs > 126) s = clamp(100 - ((bs - 126) / 100) * 60, 0, 100);
      score += s;
      count++;
    }

    if (count === 0) return 0;
    return Math.round(score / count);
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* 🧍 Patient Information (Top-Left) */}
        <div className="dashboard-tile left">
          <div className="card">
            <div className="top-section">
              <div className="border">
                {user?.gender === "m" ||
                user?.gender?.toLowerCase() === "male" ? (
                  <img
                    src={assets.male_avatar}
                    alt="Male Avatar"
                    className="avatar-img"
                  />
                ) : user?.gender === "f" ||
                  user?.gender?.toLowerCase() === "female" ? (
                  <img
                    src={assets.female_avatar}
                    alt="Female Avatar"
                    className="avatar-img"
                  />
                ) : (
                  <img
                    src="/assets/default_avatar.jpg"
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
                {Object.entries(latestMetrics).map(([k, v]) =>
                  k !== "bloodPressure" ? (
                    <li
                      key={k}
                      onMouseEnter={() => setHoveredMetric(k)}
                      onMouseLeave={() => setHoveredMetric(null)}
                    >
                      <strong>{k}</strong>: {String(v)}
                    </li>
                  ) : (
                    <li
                      key={k}
                      onMouseEnter={() =>
                        setHoveredMetric("bloodPressure.systolic")
                      }
                      onMouseLeave={() => setHoveredMetric(null)}
                    >
                      <strong>Blood Pressure</strong>:{" "}
                      {latestMetrics.bloodPressure?.systolic}/
                      {latestMetrics.bloodPressure?.diastolic} mmHg
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p>No metrics available</p>
            )}
          </div>
          <div className="button-div">
            <Link
              to="/form"
              className="add-new-data-button"
              style={{ marginTop: 16 }}
            >
              <button className="Documents-btn">
                <p className="text">Add new Data</p>
              </button>
            </Link>

            <div className="qr-section">
              <button className="qr-button" onClick={() => generateQR(user.id)}>
                Generate QR
              </button>
              {qrData && (
                <div className="qr-image">
                  <img src={qrData} alt="Patient QR Code" />
                  <p className="qr-text">Scan to open profile</p>
                </div>
              )}
            </div>
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
                            <p>
                              {record.predictedDisease} (Confidence:{" "}
                              {(record.confidence * 100).toFixed(2)}%)
                            </p>
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
