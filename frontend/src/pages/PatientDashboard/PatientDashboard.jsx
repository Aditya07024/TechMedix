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
import HealthMetrics from "../../components/HealthMetrics/HealthMetrics";
import "./PatientDashboard.css";
import HealthChat from "../../components/HealthChat/HealthChat";
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";
import { assets } from "../../assets/assets";

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

const getDashboardCacheKey = (patientId) =>
  `patient-dashboard-cache-${patientId}`;

const readDashboardCache = (patientId) => {
  if (!patientId) return null;

  try {
    const rawCache = sessionStorage.getItem(getDashboardCacheKey(patientId));
    if (!rawCache) return null;

    const parsedCache = JSON.parse(rawCache);
    if (!parsedCache?.timestamp || !parsedCache?.data) return null;

    return parsedCache;
  } catch (error) {
    console.error("Failed to read patient dashboard cache:", error);
    return null;
  }
};

const writeDashboardCache = (patientId, data) => {
  if (!patientId) return;

  try {
    sessionStorage.setItem(
      getDashboardCacheKey(patientId),
      JSON.stringify({
        timestamp: Date.now(),
        data,
      }),
    );
  } catch (error) {
    console.error("Failed to write patient dashboard cache:", error);
  }
};

const readMedicineReminders = () => {
  try {
    const rawReminders = localStorage.getItem("medicineReminders");
    if (!rawReminders) return [];

    const parsed = JSON.parse(rawReminders);
    return Array.isArray(parsed)
      ? parsed.map((reminder) => ({
          ...reminder,
          completed: Array.isArray(reminder.completed)
            ? reminder.completed
            : [],
        }))
      : [];
  } catch (error) {
    console.error("Failed to read medicine reminders:", error);
    return [];
  }
};

const writeMedicineReminders = (reminders) => {
  try {
    localStorage.setItem("medicineReminders", JSON.stringify(reminders));
  } catch (error) {
    console.error("Failed to write medicine reminders:", error);
  }
};

const toReminderDate = (reminder) => {
  const [hourValue = 0, minuteValue = 0] = String(reminder?.time || "00:00")
    .split(":")
    .map(Number);
  const hour12 = hourValue % 12;
  const hour24 = reminder?.period === "PM" ? hour12 + 12 : hour12;
  const nextReminder = new Date();
  nextReminder.setHours(hour24, minuteValue, 0, 0);

  const today = new Date().toDateString();
  const alreadyHandledToday =
    reminder?.completed?.includes(today) ||
    reminder?.lastTriggeredOn === today;

  if (nextReminder <= new Date() || alreadyHandledToday) {
    nextReminder.setDate(nextReminder.getDate() + 1);
  }

  return nextReminder;
};
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
  const [metricsRefresh, setMetricsRefresh] = useState(0);
  const [ehrHistory, setEhrHistory] = useState([]);
  const [medicineReminders, setMedicineReminders] = useState([]);

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

  // Google Fit handlers
  const handleGoogleFitConnected = () => {
    setMetricsRefresh((prev) => prev + 1);
    console.log("Google Fit connected successfully");
  };

  const handleGoogleFitDisconnected = () => {
    setMetricsRefresh((prev) => prev + 1);
    console.log("Google Fit disconnected");
  };
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
        const nextRecordings = Array.isArray(recData) ? recData : [];
        setRecordings(nextRecordings);
        writeDashboardCache(user?.id, {
          appointments,
          prescriptions,
          medicines,
          notifications,
          walletBalance,
          recordings: nextRecordings,
          ehrHistory,
          doctors,
          qrData,
        });
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
      const cache = readDashboardCache(user.id);
      const cacheIsFresh =
        cache?.timestamp &&
        Date.now() - cache.timestamp < DASHBOARD_CACHE_TTL_MS;

      if (cache?.data) {
        setAppointments(cache.data.appointments || []);
        setPrescriptions(cache.data.prescriptions || []);
        setMedicines(cache.data.medicines || []);
        setNotifications(cache.data.notifications || []);
        setWalletBalance(Number(cache.data.walletBalance || 0));
        setRecordings(cache.data.recordings || []);
        setEhrHistory(cache.data.ehrHistory || []);
        setDoctors(cache.data.doctors || []);
        setQrData(cache.data.qrData || null);
        setLoading(false);
      }

      if (!cacheIsFresh) {
        loadDashboardData({ showLoader: !cache?.data });
      }
    }
  }, [user]);

  useEffect(() => {
    const syncReminders = () => {
      setMedicineReminders(readMedicineReminders());
    };

    syncReminders();
    window.addEventListener("focus", syncReminders);
    window.addEventListener("storage", syncReminders);

    return () => {
      window.removeEventListener("focus", syncReminders);
      window.removeEventListener("storage", syncReminders);
    };
  }, []);

  const loadDashboardData = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
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

      let nextEhrHistory = [];
      try {
        const ehrRes = await patientDataApi.getEHRHistory(user.id);
        nextEhrHistory = Array.isArray(ehrRes.data) ? ehrRes.data : [];
        setEhrHistory(nextEhrHistory);
      } catch (err) {
        console.error("Failed to load patient data for health status:", err);
        setEhrHistory([]);
      }

      let nextMedicines = [];
      try {
        const medRes = await fetch(`/api/user/${user.id}/medicines`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const medData = await medRes.json();
        nextMedicines = Array.isArray(medData) ? medData : [];
        setMedicines(nextMedicines);
      } catch (err) {
        console.error("Failed to load medicines:", err);
      }

      // Load recordings for this patient
      let nextRecordings = [];
      try {
        const recRes = await fetch(`/api/recordings/patient/${user.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          credentials: "include",
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          nextRecordings = Array.isArray(recData) ? recData : [];
          setRecordings(nextRecordings);
        } else {
          setRecordings([]);
        }
      } catch (err) {
        console.error("Failed to load recordings:", err);
        setRecordings([]);
      }

      // Load wallet balance
      let nextWalletBalance = 0;
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
          nextWalletBalance = Number(wbData.balance || 0);
          setWalletBalance(nextWalletBalance);
        } else {
          console.warn("Wallet balance error:", wbData?.error);
          setWalletBalance(0);
        }
      } catch (err) {
        console.error("Failed to load wallet balance:", err);
        setWalletBalance(0);
      }

      let nextDoctors = [];
      try {
        const response = await fetch("/api/admin/doctors", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await response.json();
        console.log("Doctors loaded:", data);
        nextDoctors = Array.isArray(data?.data) ? data.data : [];
        setDoctors(nextDoctors);
      } catch (err) {
        console.error("Failed to load doctors:", err);
        setDoctors([]);
      }

      let nextQrData = null;
      try {
        const qrRes = await patientDataApi.generatePatientQR(user.id);
        nextQrData = qrRes.data?.qr || null;
        setQrData(nextQrData);
      } catch (err) {
        console.error("QR generation error:", err);
      }

      writeDashboardCache(user.id, {
        appointments:
          apptRes.status === "fulfilled" ? apptRes.value.data.data || [] : [],
        prescriptions:
          prescRes.status === "fulfilled" ? prescRes.value.data.data || [] : [],
        medicines: nextMedicines,
        notifications:
          notifRes.status === "fulfilled" ? notifRes.value.data.data || [] : [],
        walletBalance: nextWalletBalance,
        recordings: nextRecordings,
        ehrHistory: nextEhrHistory,
        doctors: nextDoctors,
        qrData: nextQrData,
      });
    } catch (err) {
      setError("Failed to load dashboard data: " + err.message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    try {
      await appointmentAPI.cancel(
        appointmentId,
        "Patient requested cancellation",
      );
      const updatedAppointments = appointments.filter((a) => a.id !== appointmentId);
      setAppointments(updatedAppointments);
      writeDashboardCache(user?.id, {
        appointments: updatedAppointments,
        prescriptions,
        medicines,
        notifications,
        walletBalance,
        recordings,
        ehrHistory,
        doctors,
        qrData,
      });
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

      const updatedMedicines = medicines.filter((m) => m.id !== medicineId);
      setMedicines(updatedMedicines);
      writeDashboardCache(user?.id, {
        appointments,
        prescriptions,
        medicines: updatedMedicines,
        notifications,
        walletBalance,
        recordings,
        ehrHistory,
        doctors,
        qrData,
      });
    } catch (err) {
      console.error("Failed to delete medicine:", err);
      alert("Failed to delete medicine");
    }
  };

  const handleCompareWithSalt = (medicineName) => {
    navigate("/search", {
      state: {
        medicine: medicineName,
        compareBySalt: true,
      },
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
      const nextQrData = res.data.qr;
      setQrData(nextQrData);
      writeDashboardCache(user?.id, {
        appointments,
        prescriptions,
        medicines,
        notifications,
        walletBalance,
        recordings,
        ehrHistory,
        doctors,
        qrData: nextQrData,
      });
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

  const latestRecord =
    ehrHistory && ehrHistory.length
      ? ehrHistory
          .slice()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      : null;
  const latestMetrics = latestRecord?.ehr || null;
  const currentDateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const unreadAlertsCount = notifications.filter(
    (n) => n?.is_read === false || n?.isRead === false || n?.read === false,
  ).length;
  const nextReminder =
    medicineReminders.length > 0
      ? medicineReminders
          .slice()
          .sort((a, b) => toReminderDate(a) - toReminderDate(b))[0]
      : null;
  const nextReminderTime = nextReminder
    ? toReminderDate(nextReminder).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;
  const isReminderTakenToday = nextReminder
    ? nextReminder.completed?.includes(new Date().toDateString())
    : false;
  const bookedAppointments = appointments.filter((a) => a.status === "booked");
  const nextAppointment =
    bookedAppointments.length > 0
      ? bookedAppointments
          .slice()
          .sort(
            (a, b) =>
              new Date(`${a.appointment_date} ${a.slot_time || "00:00"}`) -
              new Date(`${b.appointment_date} ${b.slot_time || "00:00"}`),
          )[0]
      : null;
  const healthScore = latestMetrics ? computeHealthScore(latestMetrics) : 0;
  const healthScoreColor =
    healthScore > 70 ? "#90c976" : healthScore > 40 ? "#f2b84b" : "#ef6b6b";
  const healthSummaryMessage = latestMetrics
    ? healthScore > 70
      ? "Heart rate is within a typical resting range."
      : healthScore > 40
        ? "A few metrics need attention. Keep tracking them."
        : "Please review your latest health metrics with a doctor."
    : "No patient data available yet.";
  const patientInitial = (user?.name || "A").charAt(0).toUpperCase();
  const patientFirstName = user?.name?.split(" ")[0] || "Patient";

  const handleToggleReminderTaken = (reminderId) => {
    const today = new Date().toDateString();
    const updatedReminders = medicineReminders.map((reminder) => {
      if (reminder.id !== reminderId) return reminder;

      const completed = reminder.completed?.includes(today)
        ? reminder.completed.filter((date) => date !== today)
        : [...(reminder.completed || []), today];

      return {
        ...reminder,
        completed,
        lastTriggeredOn:
          reminder.completed?.includes(today) ? null : today,
      };
    });

    setMedicineReminders(updatedReminders);
    writeMedicineReminders(updatedReminders);
  };

  const handleDeleteReminder = (reminderId) => {
    const updatedReminders = medicineReminders.filter(
      (reminder) => reminder.id !== reminderId,
    );
    setMedicineReminders(updatedReminders);
    writeMedicineReminders(updatedReminders);
  };

  return (
    <div className="patient-dashboard">
      {healthChatOpen && (
        <HealthChat
          open={healthChatOpen}
          onClose={() => setHealthChatOpen(false)}
        />
      )}
      <div className="patient-layout">
        <aside className="patient-sidebar">
          <div className="sidebar-avatar">{patientInitial}</div>
          <button
            className={`sidebar-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <span className="sidebar-icon">H</span>
            <span className="sidebar-label">Home</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === "appointments" ? "active" : ""}`}
            onClick={() => setActiveTab("appointments")}
          >
            <span className="sidebar-icon">A</span>
            <span className="sidebar-label">Appointments</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === "prescriptions" ? "active" : ""}`}
            onClick={() => setActiveTab("prescriptions")}
          >
            <span className="sidebar-icon">P</span>
            <span className="sidebar-label">Prescriptions</span>
          </button>
          <button className="sidebar-item" onClick={() => navigate("/new/dashboard")}>
            <span className="sidebar-icon">R</span>
            <span className="sidebar-label">Records</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === "recordings" ? "active" : ""}`}
            onClick={() => setActiveTab("recordings")}
          >
            <span className="sidebar-icon">V</span>
            <span className="sidebar-label">Recordings</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            <span className="sidebar-icon">Q</span>
            <span className="sidebar-label">Queue</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === "health" ? "active" : ""}`}
            onClick={() => setActiveTab("health")}
          >
            <span className="sidebar-icon">M</span>
            <span className="sidebar-label">Metrics</span>
          </button>
          <button className="sidebar-item" onClick={() => navigate("/health-wallet")}>
            <span className="sidebar-icon">W</span>
            <span className="sidebar-label">Wallet</span>
          </button>
        </aside>

        <div className="dashboard-content">
          <header className="dashboard-header">
            <h1>Welcome, {user?.name}</h1>
            <p>{currentDateLabel}</p>
          </header>

        {error && <div className="error-message">{error}</div>}

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="tab-content home-tab">
            <div className="home-grid">
              <div className="home-card qr-card">
                <div className="home-card-title">Patient QR</div>
                <div className="qr-body">
                  {qrData ? (
                    <img src={qrData} alt="Patient QR Code" className="qr-image-ui" />
                  ) : (
                    <button className="action-btn" onClick={() => generateQR(user.id)}>
                      Generate QR
                    </button>
                  )}
                  <p>Scan to open profile</p>
                </div>
              </div>

              <div className="home-card wallet-card">
                <div className="home-card-title"> Wallet</div>
                <h3>₹{Number(walletBalance).toFixed(2)}</h3>
                <p>Available balance for care payments</p>
                <span className="ready-pill">Ready</span>
              </div>

              <div className="home-card mini-card">
                <div className="home-card-title">SCHEDULED CARE</div>
                <h3>{bookedAppointments.length}</h3>
                <p>Total appointments</p>
              </div>

              <div className="home-card mini-card">
                <div className="home-card-title">PRESCRIPTIONS</div>
                <h3>{medicines.length}</h3>
                <p>Active</p>
              </div>

              <div className="home-card mini-card reminder-summary-card">
                <div className="home-card-title">UNREAD ALERTS</div>
                {nextReminder ? (
                  <>
                    <h3>{nextReminder.medicine}</h3>
                    <p>
                      {nextReminder.dosage} at {nextReminderTime}
                    </p>
                    <div className="reminder-summary-actions">
                      <button
                        className={`reminder-status-btn ${
                          isReminderTakenToday ? "taken" : ""
                        }`}
                        onClick={() => handleToggleReminderTaken(nextReminder.id)}
                      >
                        {isReminderTakenToday ? "Taken" : "Not Taken"}
                      </button>
                      <button
                        className="reminder-delete-btn"
                        onClick={() => handleDeleteReminder(nextReminder.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{unreadAlertsCount}</h3>
                    <p>No upcoming reminder. Notifications and reminders appear here.</p>
                  </>
                )}
              </div>

              <div className="home-card mini-card health-card compact-health-card">
                <div className="home-card-title">HEALTH SCORE</div>
                <div className="score-track">
                  <div style={{ width: `${healthScore}%`, background: healthScoreColor }} />
                </div>
                <span className="score-text">
                  {latestMetrics ? `${healthScore}% overall score` : "No patient data available"}
                </span>
              </div>
            </div>

            <div className="home-actions">
              <button className="action-btn" onClick={() => setActiveTab("appointments")}>
                Book Appointment
              </button>
              <button className="action-btn" onClick={() => navigate("/upload-prescription")}>
                Upload Prescription
              </button>
              <button className="action-btn" onClick={() => navigate("/form")}>
                Add New Data
              </button>
              <button className="action-btn" onClick={() => setHealthChatOpen(true)}>
                Open Health Chat
              </button>
            </div>

            <div className="metrics-panel">
              <HealthMetrics patientId={user?.id} />
            </div>

            <div className="home-lower-grid">
              <div className="home-card activity-card">
                <div
                  className="activity-ring"
                  style={{
                    background: `conic-gradient(${healthScoreColor} ${Math.max(
                      healthScore,
                      4,
                    )}%, #edf3e6 0)`,
                  }}
                >
                  <div className="activity-ring-inner">{patientInitial}</div>
                </div>
                <p className="activity-label">your activity today</p>
                <h2>{healthScore}%</h2>
                <button className="ghost-link-btn" onClick={() => setActiveTab("health")}>
                  View activity
                </button>
              </div>

              <div className="home-card appointment-highlight-card">
                <div className="home-card-title">Upcoming Appointment</div>
                {nextAppointment ? (
                  <>
                    <h3>{nextAppointment.doctor_name || "Doctor Assigned"}</h3>
                    <p>
                      {new Date(nextAppointment.appointment_date).toLocaleDateString("en-GB")}
                      {nextAppointment.slot_time ? ` at ${nextAppointment.slot_time}` : ""}
                    </p>
                    <div className="appointment-status-strip">
                      <span>{nextAppointment.status}</span>
                    </div>
                    <button
                      className="ghost-link-btn"
                      onClick={() => setActiveTab("appointments")}
                    >
                      Manage appointment
                    </button>
                  </>
                ) : (
                  <>
                    <p>No upcoming appointment booked yet.</p>
                    <button
                      className="ghost-link-btn"
                      onClick={() => setActiveTab("appointments")}
                    >
                      Book appointment
                    </button>
                  </>
                )}
              </div>

              <div className="home-card support-card">
                <div className="home-card-title">Support Chat</div>
                <div className="support-bubble">
                  Hello mr/mrs {patientFirstName}! Need help?
                </div>
                <p>{healthSummaryMessage}</p>
                <button className="ghost-link-btn" onClick={() => setHealthChatOpen(true)}>
                  Open chat
                </button>
              </div>
            </div>
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

        {/* HEALTH METRICS TAB - Google Fit Integration */}
        {activeTab === "health" && (
          <div className="tab-content health-metrics-tab">
            <h2>Health Metrics & Google Fit</h2>
            <div className="health-metrics-container">
              {/* Google Fit Connect Section */}
              <div className="google-fit-section">
                <GoogleFitConnect
                  onConnected={handleGoogleFitConnected}
                  onDisconnected={handleGoogleFitDisconnected}
                />
              </div>

              {/* Google Fit Metrics Display Section */}
              <div className="google-fit-metrics-section">
                <GoogleFitMetrics key={metricsRefresh} />
              </div>
            </div>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <p style={{ margin: 0 }}>Latest voice notes from your doctor.</p>
              <button
                className="action-btn"
                onClick={() => fetchRecordings(user?.id)}
                style={{ padding: "6px 10px" }}
              >
                Refresh
              </button>
            </div>
            {recordings.length === 0 ? (
              <p>
                No recordings yet. Your doctor’s voice notes will appear here.
              </p>
            ) : (
              <div className="recordings-list">
                {recordings.map((r) => (
                  <div key={r.id} className="recording-card">
                    <div className="recording-card-header">
                      <strong>Doctor:</strong>
                      <span>{r.doctor_name || "-"}</span>
                    </div>
                    <audio
                      controls
                      src={r.file_url}
                      className="recording-audio"
                    />
                    <div className="recording-meta">
                      <div>
                        <strong>Date:</strong>{" "}
                        {r.appointment_date
                          ? new Date(r.appointment_date).toLocaleDateString()
                          : new Date(r.created_at).toLocaleDateString()}
                      </div>
                      {r.slot_time && (
                        <div>
                          <strong>Time:</strong>{" "}
                          {String(r.slot_time).slice(0, 5)}
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
      </div>

      <button
        type="button"
        className="doctor-ai-fab"
        onClick={() => setHealthChatOpen(true)}
        aria-label="Open Doctor AI chat"
        title="Doctor AI"
      >
        <span className="doctor-ai-fab-icon">
          <img src={assets.doctor_ai_icon} alt="" className="doctor-ai-fab-image" />
        </span>
      </button>

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
