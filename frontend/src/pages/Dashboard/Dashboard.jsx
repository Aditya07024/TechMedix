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
import { Link } from "react-router-dom";
import { assets } from '../../assets/assets';

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

  const generateQR = async (patientId) => {
    try {
      const res = await axios.post(`${API_URL}/api/patient/${patientId}/qr`, {}, { 
        withCredentials: true 
      });
      setQrData(res.data.qr);
    } catch (err) {
      console.error("QR generation error:", err);
      alert("Failed to generate QR code");
    }
  };

  const getChartDataForMetric = (metricName) => {
    const labels = ehrHistory
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((record) => new Date(record.timestamp).toLocaleDateString());
    
    const data = ehrHistory
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((record) => {
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
          data: data,
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

  if (loading) return <p>Loading EHR history...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;

  const latestRecord = ehrHistory && ehrHistory.length
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
                {user?.gender === "m" || user?.gender?.toLowerCase() === "male" ? (
                  <img
                    src={assets.male_avatar}
                    alt="Male Avatar"
                    className="avatar-img"
                  />
                ) : user?.gender === "f" || user?.gender?.toLowerCase() === "female" ? (
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
                  <span className="regular-text">{user?.bloodGroup || "-"}</span>
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
            </div>
          </div>
        </div>

        {/* 🤖 ML Prediction (Top-Right) */}
        <div className="dashboard-tile right">
          <h3>Latest Insights</h3>
          {latestRecord ? (
            <div className="space-y-4">
              {latestRecord.predictedDisease && (
                <div className="ml-prediction">
                  <h4>ML Predicted Disease:</h4>
                  <p>
                    {latestRecord.predictedDisease} (Confidence:{" "}
                    {(latestRecord.confidence * 100).toFixed(2)}%)
                  </p>
                </div>
              )}
              {latestRecord.relatedSymptoms &&
                latestRecord.relatedSymptoms.length > 0 && (
                  <div className="related-symptoms">
                    <h4>Related Symptoms:</h4>
                    <ul>
                      {latestRecord.relatedSymptoms.map((symptom, i) => (
                        <li key={i}>{symptom.replace(/_/g, " ")}</li>
                      ))}
                    </ul>
                  </div>
                )}
              {latestRecord.aiInsights && (
                <div className="ai-insights">
                  <h4>AI Insights:</h4>
                  <p>{latestRecord.aiInsights}</p>
                </div>
              )}
            </div>
          ) : (
            <p>No recent record to display insights.</p>
          )}
          
          <Link to="/form" className="add-new-data-button">
            <button className="Documents-btn">
              <span className="folderContainer">
                <svg
                  className="fileBack"
                  width="146"
                  height="113"
                  viewBox="0 0 146 113"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 4C0 1.79086 1.79086 0 4 0H50.3802C51.8285 0 53.2056 0.627965 54.1553 1.72142L64.3303 13.4371C65.2799 14.5306 66.657 15.1585 68.1053 15.1585H141.509C143.718 15.1585 145.509 16.9494 145.509 19.1585V109C145.509 111.209 143.718 113 141.509 113H3.99999C1.79085 113 0 111.209 0 109V4Z"
                    fill="url(#paint0_linear_117_4)"
                  ></path>
                  <defs>
                    <linearGradient
                      id="paint0_linear_117_4"
                      x1="0"
                      y1="0"
                      x2="72.93"
                      y2="95.4804"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#8F88C2"></stop>
                      <stop offset="1" stopColor="#5C52A2"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <svg
                  className="filePage"
                  width="88"
                  height="99"
                  viewBox="0 0 88 99"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="88" height="99" fill="url(#paint0_linear_117_6)"></rect>
                  <defs>
                    <linearGradient
                      id="paint0_linear_117_6"
                      x1="0"
                      y1="0"
                      x2="81"
                      y2="160.5"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="white"></stop>
                      <stop offset="1" stopColor="#686868"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <svg
                  className="fileFront"
                  width="160"
                  height="79"
                  viewBox="0 0 160 79"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0.29306 12.2478C0.133905 9.38186 2.41499 6.97059 5.28537 6.97059H30.419H58.1902C59.5751 6.97059 60.9288 6.55982 62.0802 5.79025L68.977 1.18034C70.1283 0.410771 71.482 0 72.8669 0H77H155.462C157.87 0 159.733 2.1129 159.43 4.50232L150.443 75.5023C150.19 77.5013 148.489 79 146.474 79H7.78403C5.66106 79 3.9079 77.3415 3.79019 75.2218L0.29306 12.2478Z"
                    fill="url(#paint0_linear_117_5)"
                  ></path>
                  <defs>
                    <linearGradient
                      id="paint0_linear_117_5"
                      x1="38.7619"
                      y1="8.71323"
                      x2="66.9106"
                      y2="82.8317"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#C3BBFF"></stop>
                      <stop offset="1" stopColor="#51469A"></stop>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <p className="text">Add new Data</p>
            </button>
          </Link>

          <div className="qr-section">
            <button
              className="qr-button"
              onClick={() => generateQR(user.id)}
            >
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

        {/* 📊 Recent EHR + Chart (Bottom-Left) */}
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
              <div>
                <h4>Recent Metrics</h4>
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
            )}
          </div>
        </div>

        {/* 📚 Previous Records (Bottom-Right) */}
        <div className="dashboard-tile right">
          <h3>Your Records</h3>
          {ehrHistory && ehrHistory.length > 0 ? (
            <div className="records-dropdown">
              <label htmlFor="record-select">Select record:</label>
              <select
                id="record-select"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const rec = ehrHistory.find(
                    (r) => String(r._id) === selectedId
                  );
                  setSelectedRecord(rec || null);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  -- choose a record --
                </option>
                {ehrHistory.map((r) => (
                  <option key={r._id} value={r._id}>
                    {new Date(r.timestamp).toLocaleString()}
                  </option>
                ))}
              </select>

              {selectedRecord ? (
                <div className="selected-record">
                  <h4>
                    Record on{" "}
                    {new Date(selectedRecord.timestamp).toLocaleString()}
                  </h4>
                  <div className="ehr-details">
                    <h4>Health Metrics:</h4>
                    <ul>
                      {Object.entries(selectedRecord.ehr || {}).map(
                        ([key, value]) =>
                          value !== null &&
                          typeof value !== "object" && (
                            <li key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </li>
                          )
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="select-prompt">Select a record to view details.</p>
              )}
            </div>
          ) : (
            <p>No EHR records available.</p>
          )}
        </div>
      </div>
    </div>
  );
};