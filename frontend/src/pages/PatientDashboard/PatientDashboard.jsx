import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  appointmentAPI,
  prescriptionAPI,
  // timelineAPI,
  notificationAPI,
  // queueAPI,
} from "../../api/techmedixAPI";
import { patientDataApi } from "../../api";
import AppointmentBooking from "../../components/AppointmentBooking/AppointmentBooking";
import PatientQueuePosition from "../../components/PatientQueuePosition/PatientQueuePosition";
import MedicalTimeline from "../../components/MedicalTimeline/MedicalTimeline";
import NotificationCenter from "../../components/NotificationCenter/NotificationCenter";
import PrescriptionView from "../../components/PrescriptionView/PrescriptionView";
import HealthMetrics from "../../components/HealthMetrics/HealthMetrics";
import "./PatientDashboard.css";
import HealthChat from "../../components/HealthChat/HealthChat";
import HealthWallet from "../HealthWallet/HealthWallet";
/**
 * PATIENT DASHBOARD
 * Central hub for patient - shows appointments, queue, prescriptions, timeline, notifications
 */
export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qrData, setQrData] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [queueInfo, setQueueInfo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState(null);
  const [healthChatOpen, setHealthChatOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const handleDownloadRecording = async (rec) => {
    try {
      const res = await fetch(`/api/recordings/${rec.id}/download`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Download failed: ${text}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${rec.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Download error: ${e.message}`);
    }
  };
  const fetchRecordings = async (pid) => {
    try {
      const recRes = await fetch(`/api/recordings/patient/${pid}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecordings(Array.isArray(recData) ? recData : []);
      } else {
        setRecordings([]);
      }
    } catch (err) {
      console.error("Failed to load recordings:", err);
      setRecordings([]);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      loadDoctors();
      generateQR(user.id);
    }
  }, [user]);

  const loadDoctors = async () => {
    try {
      const response = await fetch("/api/admin/doctors", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      console.log("Doctors loaded:", data);
      setDoctors(data.data || []);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      setDoctors([]); // Set empty array on error
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [apptRes, prescRes, notifRes] = await Promise.allSettled([
        appointmentAPI.getByPatient(user.id),
        prescriptionAPI.getByPatient(user.id),
        notificationAPI.getByUser(user.id),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(apptRes.value.data.data || []);
      }
      if (prescRes.status === "fulfilled") {
        setPrescriptions(prescRes.value.data.data || []);
      }
      if (notifRes.status === "fulfilled") {
        setNotifications(notifRes.value.data.data || []);
      }

      try {
        const medRes = await fetch(`/api/user/${user.id}/medicines`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const medData = await medRes.json();
        setMedicines(medData || []);
      } catch (err) {
        console.error("Failed to load medicines:", err);
      }

      // Load recordings for this patient
      await fetchRecordings(user.id);

      // Load wallet balance
      try {
        const wbRes = await fetch(`/api/payments/wallet/balance`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        });
        const wbData = await wbRes.json();
        if (wbRes.ok) {
          setWalletBalance(Number(wbData.balance || 0));
        } else {
          console.warn("Wallet balance error:", wbData?.error);
          setWalletBalance(0);
        }
      } catch (err) {
        console.error("Failed to load wallet balance:", err);
        setWalletBalance(0);
      }
    } catch (err) {
      setError("Failed to load dashboard data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    try {
      await appointmentAPI.cancel(
        appointmentId,
        "Patient requested cancellation",
      );
      setAppointments(appointments.filter((a) => a.id !== appointmentId));
      alert("Appointment cancelled successfully");
    } catch (err) {
      alert("Failed to cancel appointment: " + err.message);
    }
  };

  const handleDeleteMedicine = async (medicineId) => {
    try {
      await fetch(`/api/medicines/${medicineId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setMedicines((prev) => prev.filter((m) => m.id !== medicineId));
    } catch (err) {
      console.error("Failed to delete medicine:", err);
      alert("Failed to delete medicine");
    }
  };

  const handleCompareWithSalt = (medicineName) => {
    navigate("/search", {
      state: { medicine: medicineName },
    });
  };

  const handleRescheduleAppointment = async (appointmentId) => {
    setRescheduleAppointmentId(appointmentId);
    setRescheduleDate("");
    setRescheduleTime("");
    setShowRescheduleModal(true);
    return;
  };
  const generateQR = async (patientId) => {
    try {
      const res = await patientDataApi.generatePatientQR(patientId);
      setQrData(res.data.qr);
    } catch (err) {
      console.error("QR generation error:", err);
      alert("Failed to generate QR code");
    }
  };

  if (loading)
    return (
      <div className="patient-dashboard">
        <p>Loading...</p>
      </div>
    );

  return (
    <div className="patient-dashboard">
      {healthChatOpen && (
        <HealthChat open={healthChatOpen} onClose={() => setHealthChatOpen(false)} />
      )}
      <header className="dashboard-header">
        <h1>Welcome, {user?.name}</h1>
        <p className="patient-id">Patient ID: {user?.id}</p>
        <div style={{ marginLeft: "auto" }}>
          <button className="action-btn" onClick={() => setHealthChatOpen(true)}>
            💬 Health Chatbot
          </button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          📊 Home
        </button>
        <button
          className={`tab-btn ${activeTab === "appointments" ? "active" : ""}`}
          onClick={() => setActiveTab("appointments")}
        >
          📅 Appointments
        </button>
        <button
          className={`tab-btn ${activeTab === "prescriptions" ? "active" : ""}`}
          onClick={() => setActiveTab("prescriptions")}
        >
          💊 Prescriptions
        </button>
        <button
          className={`tab-btn ${activeTab === "timeline" ? "active" : ""}`}
          onClick={() => (window.location.href = "/new/dashboard")}
        >
          📜 Record
        </button>
        <button
          className={`tab-btn ${activeTab === "recordings" ? "active" : ""}`}
          onClick={() => setActiveTab("recordings")}
        >
          🎧 Recordings
        </button>
        <button
          className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          🚦 Queue
        </button>
        <button
          className={`tab-btn`}
          onClick={() => navigate("/health-wallet")}
        >
          Document Wallet
        </button>
      </div>

      <div className="dashboard-content">
        {error && <div className="error-message">{error}</div>}

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="tab-content home-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>
                  {appointments.filter((a) => a.status === "booked").length}
                </h3>
                <p>Total Appointments</p>
              </div>
              <div className="stat-card">
                <h3>{medicines.length}</h3>
                <p>Active Prescriptions</p>
              </div>
              <div className="stat-card">
                <p style={{ fontWeight: "600", marginBottom: "0px" }}>
                  Patient QR
                </p>

                {qrData ? (
                  <div className="qr-image">
                    <img
                      src={qrData}
                      alt="Patient QR Code"
                      style={{ width: "90px", height: "90px" }}
                    />
                    <p className="qr-text">Scan to open profile</p>
                  </div>
                ) : (
                  <button
                    className="action-btn"
                    onClick={() => generateQR(user.id)}
                    style={{ fontSize: "12px", padding: "6px 10px" }}
                  >
                    Generate QR
                  </button>
                )}
              </div>
            <div className="stat-card">
              <p style={{ marginBottom: "6px", fontWeight: "600" }}>
                Health Status
              </p>
                {(() => {
                  const score = medicines.length
                    ? Math.min(medicines.length * 20, 100)
                    : 40; // baseline health status when no meds are listed
                  const color =
                    score > 70
                      ? "#22c55e"
                      : score > 40
                      ? "#f59e0b"
                      : "#ef4444";
                  return (
                    <>
                      <div
                        style={{
                          width: "100%",
                          background: "#eee",
                          borderRadius: 8,
                          height: 12,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            width: `${score}%`,
                            background: color,
                            height: "100%",
                            borderRadius: 8,
                            transition: "width 300ms ease-in-out",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "12px", color: "#555" }}>
                        {score}% Health Score
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

<div className="quick-actions">
              <h3>Quick Actions</h3>
              <button
                className="action-btn"
                onClick={() => setActiveTab("appointments")}
              >
                📅 Book Appointment
              </button>
              <button
                className="action-btn"
                onClick={() => (window.location.href = "/upload-prescription")}
              >
                💊 Upload Prescription
              </button>
              <button
                className="action-btn"
                onClick={() => (window.location.href = "/form")}
              >
                📜 Add new Data
              </button>
            </div>

            <div className="stat-card">
              <p style={{ fontWeight: "600", marginBottom: 6 }}>Wallet Balance</p>
              <h3>₹{Number(walletBalance).toFixed(2)}</h3>
              <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Use at payment: Pay with Wallet
              </p>
            </div>

            <HealthMetrics patientId={user?.id} />

            
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="tab-content appointments-tab">
            <h2>Your Appointments</h2>

            <div className="section">
              <h3>📅 Book New Appointment</h3>

              {/* Doctor Selection */}
              <div
                className="doctor-selection"
                style={{ marginBottom: "20px" }}
              >
                <label
                  htmlFor="doctor-select"
                  style={{
                    display: "block",
                    marginBottom: "10px",
                    fontWeight: "600",
                  }}
                >
                  Select a Doctor: ({doctors.length} available)
                </label>
                {doctors.length === 0 ? (
                  <div
                    style={{
                      padding: "15px",
                      backgroundColor: "#fff3cd",
                      borderRadius: "6px",
                      color: "#856404",
                    }}
                  >
                    ⏳ Loading doctors... If this persists, please refresh the
                    page.
                  </div>
                ) : (
                  <select
                    id="doctor-select"
                    value={selectedDoctorId || ""}
                    onChange={(e) =>
                      setSelectedDoctorId(
                        e.target.value ? e.target.value : null,
                      )
                    }
                    style={{
                      padding: "10px 15px",
                      fontSize: "16px",
                      borderRadius: "6px",
                      border: "2px solid #e0e0e0",
                      width: "100%",
                      maxWidth: "400px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">-- Select a Doctor --</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.name || `ID: ${doctor.id}`}{" "}
                        {doctor.specialty ? `(${doctor.specialty})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Show booking form only after doctor is selected */}
              {selectedDoctorId ? (
                <AppointmentBooking
                  patientId={user?.id}
                  doctorId={selectedDoctorId}
                  doctorName={
                    doctors.find(
                      (d) => String(d.id) === String(selectedDoctorId),
                    )?.name
                  }
                  doctorSpecialty={
                    doctors.find(
                      (d) => String(d.id) === String(selectedDoctorId),
                    )?.specialty
                  }
                />
              ) : (
                <div
                  style={{
                    padding: "20px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                    color: "#666",
                  }}
                >
                  👆 Please select a doctor above to view available appointment
                  slots.
                </div>
              )}
            </div>

            <div className="section">
              <h3>Upcoming Appointments</h3>
              <div className="appointments-list">
                {appointments.length === 0 ? (
                  <p>No appointments scheduled</p>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="appointment-card">
                      <div className="apt-info">
                        <h4>{apt.doctor_name || "Dr. " + apt.doctor_id}</h4>
                        <div className="appointment-meta">
                          <div className="appointment-meta-row">
                            <span className="appointment-meta-icon">📅</span>
                            <span>
                              {new Date(
                                apt.appointment_date,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="appointment-meta-row">
                            <span className="appointment-meta-icon">🕐</span>
                            <span>{apt.slot_time}</span>
                          </div>
                        </div>
                        <div className="appointment-status-row">
                          <span className="appointment-status-label">
                            Status:
                          </span>
                          <span className={`status ${apt.status}`}>
                            {apt.status}
                          </span>
                        </div>
                      </div>
                      <div className="apt-actions">
                        {apt.status === "booked" && (
                          <>
                            <button
                              className="btn-reschedule"
                              onClick={() =>
                                handleRescheduleAppointment(apt.id)
                              }
                            >
                              Reschedule
                            </button>
                            <button
                              className="btn-cancel"
                              onClick={() => handleCancelAppointment(apt.id)}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRESCRIPTIONS TAB */}
        {activeTab === "prescriptions" && (
          <div className="tab-content prescriptions-tab">
            <h2>Your Prescriptions</h2>

            <div style={{ marginBottom: "20px" }}>
              <div className="prescriptions-section-header">
                <h3>Extracted Medicines</h3>
                <button
                  className="action-btn"
                  onClick={() => navigate("/upload-prescription")}
                >
                  Upload Prescription
                </button>
              </div>

              {medicines.length === 0 ? (
                <p>No medicines found</p>
              ) : (
                <div className="prescription-details-table-wrap">
                  <table className="prescription-details-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {medicines.map((med, idx) => (
                        <tr key={idx}>
                          <td>{med.medicine_name}</td>
                          <td>{med.dosage || "—"}</td>
                          <td>{med.frequency || "—"}</td>
                          <td>{med.duration || "—"}</td>
                          <td style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="btn-reschedule"
                              onClick={() =>
                                handleCompareWithSalt(med.medicine_name)
                              }
                            >
                              Compare with Salt
                            </button>

                            <button
                              className="btn-cancel"
                              disabled={!med.id}
                              onClick={() => handleDeleteMedicine(med.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* to be implemented later on  */}

            {/* <PrescriptionView patientId={user?.id} /> */}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="tab-content timeline-tab">
            <h2>Medical Timeline</h2>
            <MedicalTimeline patientId={user?.id} />
          </div>
        )}

        {/* QUEUE TAB */}
        {activeTab === "queue" && (
          <div className="tab-content queue-tab">
            <h2>Queue Status</h2>
            {appointments.some((a) => a.status === "booked") ? (
              <PatientQueuePosition
                appointmentId={
                  appointments.find((a) => a.status === "booked")?.id
                }
                patientId={user?.id}
              />
            ) : (
              <p>No active appointments in queue</p>
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === "notifications" && (
          <div className="tab-content notifications-tab">
            <h2>Notifications</h2>
            <NotificationCenter userId={user?.id} />
          </div>
        )}

        {/* RECORDINGS TAB */}
        {activeTab === "recordings" && (
          <div className="tab-content recordings-tab">
            <h2>Your Voice Notes</h2>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
              <p style={{ margin: 0 }}>Latest voice notes from your doctor.</p>
              <button className="action-btn" onClick={() => fetchRecordings(user?.id)} style={{ padding: "6px 10px" }}>Refresh</button>
            </div>
            {recordings.length === 0 ? (
              <p>No recordings yet. Your doctor’s voice notes will appear here.</p>
            ) : (
              <div className="recordings-list" style={{ display: "grid", gap: 12 }}>
                {recordings.map((r) => (
                  <div
                    key={r.id}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fff" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <strong>Doctor:</strong>
                      <span>{r.doctor_name || "-"}</span>
                    </div>
                    <audio controls src={r.file_url} style={{ width: "100%" }} />
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => handleDownloadRecording(r)}
                        className="action-btn"
                        style={{ padding: "6px 10px" }}
                      >
                        ⬇️ Download
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, color: "#555" }}>
                      <div>
                        <strong>Date:</strong> {r.appointment_date ? new Date(r.appointment_date).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                      </div>
                      {r.slot_time && (
                        <div>
                          <strong>Time:</strong> {String(r.slot_time).slice(0,5)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Reschedule Appointment</h3>

            <label>Select New Date</label>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />

            <label>Select New Time</label>
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
            />

            <div className="modal-actions">
              <button
                className="btn-reschedule"
                onClick={async () => {
                  if (!rescheduleDate || !rescheduleTime) {
                    alert("Please select both date and time");
                    return;
                  }
                  try {
                    await appointmentAPI.reschedule(
                      rescheduleAppointmentId,
                      rescheduleDate,
                      rescheduleTime,
                    );
                    setShowRescheduleModal(false);
                    loadDashboardData();
                    alert("Appointment rescheduled successfully");
                  } catch (err) {
                    alert("Failed to reschedule: " + err.message);
                  }
                }}
              >
                Confirm
              </button>

              <button
                className="btn-cancel"
                onClick={() => setShowRescheduleModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
