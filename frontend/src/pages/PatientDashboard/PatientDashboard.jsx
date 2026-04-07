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
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarDays,
  Download,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CircleHelp,
  FileText,
  Flame,
  FolderHeart,
  Footprints,
  HeartPulse,
  House,
  LayoutGrid,
  Menu,
  MessageSquareText,
  Mic,
  MoonStar,
  Pill,
  Play,
  Plus,
  QrCode,
  RefreshCcw,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Wallet,
} from "lucide-react";

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
  const [recordingTranscripts, setRecordingTranscripts] = useState({});
  const [transcribingIds, setTranscribingIds] = useState({});
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

  const handleTranscribeRecording = async (recordingId) => {
    try {
      setTranscribingIds((prev) => ({ ...prev, [recordingId]: true }));

      const response = await fetch(`/api/recordings/${recordingId}/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to transcribe recording");
      }

      setRecordingTranscripts((prev) => ({
        ...prev,
        [recordingId]: data.text || "No transcript returned.",
      }));
    } catch (error) {
      console.error("Failed to transcribe recording:", error);
      setRecordingTranscripts((prev) => ({
        ...prev,
        [recordingId]: `Transcription failed: ${error.message}`,
      }));
    } finally {
      setTranscribingIds((prev) => ({ ...prev, [recordingId]: false }));
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
  const activeMedicationCards = medicines.slice(0, 2);
  const prescriptionsFoundLabel = `${medicines.length} prescription${medicines.length === 1 ? "" : "s"} found`;
  const latestMetricDateLabel = latestRecord?.timestamp
    ? new Date(latestRecord.timestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No recent metrics";
  const latestRecordDateLabel = latestRecord?.timestamp
    ? new Date(latestRecord.timestamp).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  const formatMetricValue = (value, formatter = (v) => String(v)) =>
    value === null || value === undefined || value === "" ? "--" : formatter(value);
  const derivedHealthScores = ehrHistory
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-7)
    .map((record) => computeHealthScore(record?.ehr || null))
    .filter((value) => Number.isFinite(value) && value > 0);
  const recordCards = [
    {
      label: "Heart Rate",
      value: formatMetricValue(latestMetrics?.heartRate),
      unit: "BPM",
      noteLeft: latestMetricDateLabel,
      noteRight:
        latestMetrics?.heartRate == null
          ? "Unavailable"
          : Number(latestMetrics?.heartRate) >= 60 &&
            Number(latestMetrics?.heartRate) <= 100
          ? "Normal"
          : "Attention",
      icon: HeartPulse,
      trend: "up",
      delta: latestMetrics?.heartRate == null ? "--" : "Live",
    },
    {
      label: "Steps",
      value: formatMetricValue(latestMetrics?.steps, (v) => Number(v).toLocaleString()),
      unit: "Steps",
      noteLeft: latestMetricDateLabel,
      noteRight:
        latestMetrics?.steps == null
          ? "Unavailable"
          : Number(latestMetrics?.steps) >= 8000
            ? "On Track"
            : "Below Goal",
      icon: Footprints,
      trend: "up",
      delta: latestMetrics?.steps == null ? "--" : "Live",
    },
    {
      label: "Sleep",
      value: formatMetricValue(latestMetrics?.sleep),
      unit: "Hours",
      noteLeft: latestMetricDateLabel,
      noteRight:
        latestMetrics?.sleep == null
          ? "Unavailable"
          : Number(latestMetrics?.sleep) >= 7
            ? "Healthy"
            : "Low",
      icon: MoonStar,
      trend: "flat",
      delta: latestMetrics?.sleep == null ? "--" : "Live",
    },
    {
      label: "Weight",
      value: formatMetricValue(latestMetrics?.weight),
      unit: "lbs",
      noteLeft: latestMetricDateLabel,
      noteRight: latestMetrics?.weight == null ? "Unavailable" : "Recorded",
      icon: Scale,
      trend: "down",
      delta: latestMetrics?.weight == null ? "--" : "Live",
    },
    {
      label: "Blood Oxygen",
      value: formatMetricValue(latestMetrics?.spo2),
      unit: "% SpO2",
      noteLeft: latestMetricDateLabel,
      noteRight:
        latestMetrics?.spo2 == null
          ? "Unavailable"
          : Number(latestMetrics?.spo2) >= 95
            ? "Normal"
            : "Low",
      icon: ShieldCheck,
      trend: "up",
      delta: latestMetrics?.spo2 == null ? "--" : "Live",
    },
    {
      label: "Calories",
      value: formatMetricValue(latestMetrics?.calories_burned, (v) =>
        Number(v).toLocaleString(),
      ),
      unit: "kcal",
      noteLeft: latestMetricDateLabel,
      noteRight: latestMetrics?.calories_burned == null ? "Unavailable" : "Recorded",
      icon: Flame,
      trend: "down",
      delta: latestMetrics?.calories_burned == null ? "--" : "Live",
    },
  ];
  const recordHistoryItems =
    ehrHistory.length > 0
      ? ehrHistory.slice(0, 2).map((record, index) => ({
          title: `Record update ${index + 1}`,
          date: new Date(record.timestamp).toLocaleDateString("en-GB", {
            month: "short",
            day: "2-digit",
          }),
          tone: index === 0 ? "good" : "alert",
        }))
      : [
          { title: "No recent record", date: "Unavailable", tone: "alert" },
        ];
  const recordTrendBars = derivedHealthScores;
  const sidebarItems = [
    { id: "home", label: "Home", icon: House, action: () => setActiveTab("home") },
    {
      id: "appointments",
      label: "Appointments",
      icon: CalendarDays,
      action: () => setActiveTab("appointments"),
    },
    {
      id: "prescriptions",
      label: "Prescriptions",
      icon: FileText,
      action: () => setActiveTab("prescriptions"),
    },
    {
      id: "records",
      label: "Records",
      icon: FolderHeart,
      action: () => setActiveTab("records"),
    },
    {
      id: "recordings",
      label: "Recordings",
      icon: Mic,
      action: () => setActiveTab("recordings"),
    },
    { id: "queue", label: "Queue", icon: Clock3, action: () => setActiveTab("queue") },
    {
      id: "health",
      label: "Metrics",
      icon: Activity,
      action: () => setActiveTab("health"),
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      action: () => setActiveTab("wallet"),
    },
  ];
  const topNavItems = [
    { id: "home", label: "Home", action: () => setActiveTab("home") },
    { id: "appointments", label: "Appointments", action: () => setActiveTab("appointments") },
    { id: "records", label: "Records", action: () => setActiveTab("records") },
    { id: "support", label: "Support", action: () => setHealthChatOpen(true) },
  ];

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
          <div className="sidebar-brand sidebar-brand-card">
            <div className="sidebar-avatar">
              <img src={assets.logo} alt="TechMedix logo" />
            </div>
            <div className="sidebar-brand-copy static-copy">
              <strong>TechMedix</strong>
              <span>Clinical sanctuary</span>
            </div>
          </div>
          <div className="sidebar-nav">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                  onClick={item.action}
                >
                  <span className="sidebar-icon">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="sidebar-label">{item.label}</span>
                  <ChevronRight className="sidebar-arrow" size={16} strokeWidth={2} />
                </button>
              );
            })}
          </div>
          <div className="sidebar-footer">
            <button type="button" className="sidebar-footer-link">
              <Settings size={17} strokeWidth={2} />
              <span>Settings</span>
            </button>
            <button type="button" className="sidebar-footer-link">
              <CircleHelp size={17} strokeWidth={2} />
              <span>Support</span>
            </button>
          </div>
        </aside>

        <div className="dashboard-content">

        {error && <div className="error-message">{error}</div>}

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="tab-content home-tab">
            <div className="section-intro">
              <div>
                <span className="section-kicker">Personal dashboard</span>
                <h2>Welcome back, {patientFirstName}.</h2>
                <p>Your health sanctuary is up to date.</p>
              </div>
              <button className="action-btn top-cta-btn" onClick={() => setActiveTab("appointments")}>
                <CalendarDays size={16} strokeWidth={2} />
                Book Appointment
              </button>
            </div>
            <div className="home-reference-layout">
              <div className="home-reference-left">
                <div className="home-card profile-card">
                  <div className="profile-card-main">
                    <div className="profile-avatar">{patientInitial}</div>
                    
                    <div className="profile-copy">
                      <strong>{user?.name || "Patient Name"}</strong>
                      <p>Patient ID: #{String(user?.id || "TM-8829-01").slice(0, 12)}</p>
                    </div>
                  </div>
                  <div className="profile-subcard">
                    <div className="subcard-qr">
                      {qrData ? (
                        <img src={qrData} alt="Patient QR Code" className="qr-image-ui" />
                      ) : (
                        <button className="ghost-link-btn" onClick={() => generateQR(user.id)}>
                          Generate QR
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="home-card wallet-hero-card">
                  <div className="home-card-title">
                    <Wallet size={16} strokeWidth={2} />
                    <span>Available funds</span>
                  </div>
                  <h3>₹{Number(walletBalance).toFixed(2)}</h3>
                  <button className="ghost-link-btn wallet-link-btn" onClick={() => setActiveTab("wallet")}>
                    Go to Wallet
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
                <div className="home-card assistant-panel-card">
                    <div className="assistant-panel-header">
                      <div className="assistant-title">
                        <span className="assistant-status-dot" />
                        <div className="home-card-title">
                          <span>Health Assistant</span>
                        </div>
                      </div>
                    </div>
                    <div className="assistant-message-card">
                      <p>“{healthSummaryMessage} Would you like to log your symptoms?”</p>
                    </div>
                    <div className="assistant-panel-actions">
                      <button className="action-btn assistant-action-btn" onClick={() => setHealthChatOpen(true)}>
                        Open Health Chat
                      </button>
                      
                    </div>
                    
                  </div>

              </div>
              

              <div className="home-reference-right">
                <div className="home-stats-row">
                  <div className="home-card mini-card">
                    <div className="home-card-title">
                      <CalendarClock size={16} strokeWidth={2} />
                      <span>Scheduled care</span>
                    </div>
                    <h3>{bookedAppointments.length}</h3>
                  </div>
                  <div className="home-card mini-card">
                    <div className="home-card-title">
                      <Pill size={16} strokeWidth={2} />
                      <span>Prescriptions</span>
                    </div>
                    <h3>{medicines.length}</h3>
                  </div>
                  <div className="home-card mini-card">
                    <div className="home-card-title">
                      <Bell size={16} strokeWidth={2} />
                      <span>Unread alerts</span>
                    </div>
                    <h3>{unreadAlertsCount}</h3>
                  </div>
                  <div className="home-card mini-card score-stat-card">
                    <div className="home-card-title">
                      <Activity size={16} strokeWidth={2} />
                      <span>Health score</span>
                    </div>
                    <h3>{latestMetrics ? `${healthScore}%` : "--"}</h3>
                  </div>
                </div>

                <div className="home-card reminders-spotlight-card">
                  <div className="reminders-spotlight-header">
                    <div className="home-card-title">
                      <Bell size={16} strokeWidth={2} />
                      <span>Critical reminders</span>
                    </div>
                    <span className="reminder-updated-label">
                      {nextReminder ? "Updated just now" : `${unreadAlertsCount} alerts`}
                    </span>
                  </div>
                  {nextReminder ? (
                    <div className="reminder-spotlight-item">
                      <div className="reminder-pill-icon">
                        <Pill size={16} strokeWidth={2} />
                      </div>
                      <div className="reminder-spotlight-copy">
                        <strong>{nextReminder.medicine}</strong>
                        <span>{nextReminder.dosage || "Scheduled medication"}</span>
                      </div>
                      <div className="reminder-spotlight-meta">
                        <strong>{nextReminderTime}</strong>
                        <span>{isReminderTakenToday ? "Taken" : "Pending"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-panel compact-empty">
                      <h4>No critical reminders</h4>
                      <p>Your upcoming reminders and safety alerts appear here.</p>
                    </div>
                  )}
                </div>

                <div className="home-insight-row">
                  <div className="home-card activity-card">
                    <div className="activity-title-row">
                      <p className="activity-label">Daily Activity Goal</p>
                    </div>
                    <div className="activity-content">
                      <div
                        className="activity-ring"
                        style={{
                          background: `conic-gradient(#0b7a72 ${Math.max(
                            healthScore,
                            4,
                          )}%, #dfe9ff 0)`,
                        }}
                      >
                        <div className="activity-ring-inner">{healthScore}%</div>
                      </div>
                      <div className="activity-copy">
                        <h2>{latestMetrics?.steps || "8,420"}</h2>
                        <span>Steps taken today</span>
                        <strong>+12% vs Yesterday</strong>
                      </div>
                    </div>
                  </div>

                  <div className="home-card appointment-highlight-card appointment-summary-card">
                    <div className="appointment-card-heading">
                      <div className="home-card-title">Next Appointment</div>
                      <CalendarDays size={18} strokeWidth={2} />
                    </div>
                    {nextAppointment ? (
                      <>
                        <div className="appointment-person">
                          <img
                            src={assets.male_avatar}
                            alt="Doctor avatar"
                            className="appointment-person-avatar"
                          />
                          <div className="appointment-person-copy">
                            <h3>{nextAppointment.doctor_name || "Doctor Assigned"}</h3>
                            <p>Senior Cardiologist</p>
                          </div>
                        </div>
                        <div className="appointment-summary-meta">
                          <div>
                            <span>Date</span>
                            <strong>
                              {new Date(nextAppointment.appointment_date).toLocaleDateString("en-GB")}
                            </strong>
                          </div>
                          <div>
                            <span>Time</span>
                            <strong>{nextAppointment.slot_time || "--"}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="empty-panel compact-empty">
                        <h4>No upcoming appointment</h4>
                        <p>Book a consultation to see your next visit here.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="home-bottom-row">
                  <div className="quick-action-grid">
                    <button className="home-card quick-action-card" onClick={() => navigate("/upload-prescription")}>
                      <span className="quick-action-icon mint-icon">
                        <FileText size={22} strokeWidth={2} />
                      </span>
                      <strong>Upload Prescription</strong>
                    </button>
                    <button className="home-card quick-action-card" onClick={() => navigate("/form")}>
                      <span className="quick-action-icon teal-icon">
                        <Plus size={22} strokeWidth={2} />
                      </span>
                      <strong>Add New Data</strong>
                    </button>
                    <button className="home-card quick-action-card" onClick={() => navigate("/new/dashboard")}>
                      <span className="quick-action-icon rose-icon">
                        <FolderHeart size={22} strokeWidth={2} />
                      </span>
                      <strong>View History</strong>
                    </button>
                    <button className="home-card quick-action-card muted-card" type="button">
                      <span className="quick-action-icon blue-icon">
                        <LayoutGrid size={22} strokeWidth={2} />
                      </span>
                      <strong>Customize Grid</strong>
                    </button>
                  </div>

                  
                </div>

              </div>

              <div className="metrics-panel embedded-metrics-panel">
                <HealthMetrics patientId={user?.id} />
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="tab-content appointments-tab">
            <div className="section-intro">
              <div>
                <h2>Book or manage your appointments</h2>
                <p>Refining your health journey with clinical precision and ease.</p>
              </div>
            </div>

            <div className="appointments-reference-layout">
              <div className="section appointments-booking-shell">
                <div className="doctor-selection appointment-doctor-selection">
                  <div className="appointment-select-header">
                    <label htmlFor="doctor-select">Select Specialist</label>
                    <p>Choose your doctor to unlock the calendar and available consultation slots.</p>
                  </div>
                  {doctors.length === 0 ? (
                    <div className="selection-state">
                      Loading doctors. If this persists, please refresh the page.
                    </div>
                  ) : (
                    <div className="appointment-select-shell">
                      <select
                        id="doctor-select"
                        value={selectedDoctorId || ""}
                        onChange={(e) =>
                          setSelectedDoctorId(
                            e.target.value ? e.target.value : null,
                          )
                        }
                      >
                        <option value="">-- Select a Doctor --</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            Dr. {doctor.name || `ID: ${doctor.id}`}{" "}
                            {doctor.specialty ? `(${doctor.specialty})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

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
                  <div className="selection-placeholder">
                    Please select a doctor above to view available appointment slots.
                  </div>
                )}
              </div>

              <div className="appointments-reference-sidebar">
                <div className="section appointment-rail-card">
                  <h3>Clinic Appointments</h3>
                  <div className="appointment-rail-list">
                    {appointments.length === 0 ? (
                      <div className="empty-panel compact-empty">
                        <h4>No appointments scheduled</h4>
                        <p>Select a doctor and book your consultation.</p>
                      </div>
                    ) : (
                      appointments.slice(0, 3).map((apt, index) => {
                        const statusLabel =
                          apt.status === "booked"
                            ? "Upcoming"
                            : apt.status === "completed" || apt.status === "visited"
                              ? "Completed"
                              : apt.status === "cancelled"
                                ? "Cancelled"
                                : apt.status;

                        return (
                          <div
                            key={apt.id}
                            className={`appointment-rail-item ${index === 0 ? "highlighted" : ""}`}
                          >
                            <div className="appointment-rail-row">
                              <img
                                src={
                                  index === 1
                                    ? assets.male_avatar
                                    : assets.female_avatar
                                }
                                alt="Doctor avatar"
                                className="appointment-rail-avatar"
                              />
                              <div className="appointment-rail-copy">
                                <strong>{apt.doctor_name || `Dr. ${apt.doctor_id}`}</strong>
                                <span>
                                  {new Date(apt.appointment_date).toLocaleDateString("en-GB", {
                                    month: "short",
                                    day: "2-digit",
                                  })}
                                  {apt.slot_time ? `, ${apt.slot_time}` : ""}
                                </span>
                              </div>
                              <span className={`appointment-badge ${apt.status}`}>
                                {statusLabel}
                              </span>
                            </div>

                            {apt.status === "booked" ? (
                              <div className="appointment-rail-actions">
                                <button
                                  className="appointment-rail-action-btn"
                                  onClick={() => handleRescheduleAppointment(apt.id)}
                                >
                                  Reschedule
                                </button>
                                <button
                                  className="appointment-rail-close-btn"
                                  onClick={() => handleCancelAppointment(apt.id)}
                                  aria-label="Cancel appointment"
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    className="appointment-history-btn"
                    onClick={() => navigate("/new/dashboard")}
                  >
                    View Appointment History
                  </button>
                </div>

                <div className="appointment-pulse-card">
                  <span className="section-kicker">Health pulse</span>
                  <div className="appointment-pulse-value">
                    <strong>{latestMetrics?.heartRate || 72}</strong>
                    <span>BPM</span>
                  </div>
                  <div className="appointment-pulse-chart">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span className="active" />
                    <span />
                  </div>
                  <p>Resting heart rate is stable. Great progress.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRESCRIPTIONS TAB */}
        {activeTab === "prescriptions" && (
          <div className="tab-content prescriptions-tab">
            <div className="section-intro">
              <div>
                <h2>Your Prescriptions</h2>
                <p>Manage and track your active medications and history with clinical precision.</p>
              </div>
              <button
                className="prescription-upload-cta"
                onClick={() => navigate("/upload-prescription")}
              >
                <FileText size={18} strokeWidth={2} />
                Upload New Prescription
              </button>
            </div>

            <div className="prescriptions-reference-layout">
              <div className="prescriptions-main-column">
                <div className="prescriptions-block-header">
                  <div className="prescriptions-block-title">
                    <span className="prescriptions-accent-line" />
                    <h3>Active Medications</h3>
                  </div>
                  <span className="prescriptions-count-label">{prescriptionsFoundLabel}</span>
                </div>

                {activeMedicationCards.length > 0 ? (
                  <div className="active-medications-grid">
                    {activeMedicationCards.map((med, idx) => (
                      <div key={`${med.medicine_name}-${idx}`} className="active-medication-card">
                        <div className="active-medication-head">
                          <h4>{med.medicine_name}</h4>
                          <Pill size={20} strokeWidth={2} />
                        </div>
                        <span className="active-medication-pill">Active</span>
                        <div className="active-medication-meta">
                          <div>
                            <span>Dosage</span>
                            <strong>{med.dosage || "—"}</strong>
                          </div>
                          <div>
                            <span>Frequency</span>
                            <strong>{med.frequency || "—"}</strong>
                          </div>
                          <div>
                            <span>Duration</span>
                            <strong>{med.duration || "—"}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-panel">
                    <h4>No active medications</h4>
                    <p>Upload a prescription to populate your active medicines.</p>
                  </div>
                )}

                <div className="prescriptions-table-header">
                  <div className="prescriptions-block-title">
                    <span className="prescriptions-accent-line" />
                    <div>
                      <h3>Extracted Medicines</h3>
                      <p>Review extracted medicines and compare salt alternatives quickly.</p>
                    </div>
                  </div>
                </div>

                {medicines.length === 0 ? (
                  <div className="empty-panel">
                    <h4>No medicines found</h4>
                    <p>Upload a prescription to populate this list.</p>
                  </div>
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
                            <td className="prescription-name-cell">{med.medicine_name}</td>
                            <td>{med.dosage || "—"}</td>
                            <td>{med.frequency || "—"}</td>
                            <td>{med.duration || "—"}</td>
                            <td className="table-actions-cell prescription-actions-cell">
                              <button
                                className="btn-reschedule prescription-compare-btn"
                                onClick={() =>
                                  handleCompareWithSalt(med.medicine_name)
                                }
                              >
                                Compare with Salt
                              </button>

                              <button
                                className="btn-cancel prescription-delete-btn"
                                disabled={!med.id}
                                onClick={() => handleDeleteMedicine(med.id)}
                              >
                                <Trash2 size={14} strokeWidth={2} />
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

              <div className="prescriptions-side-column">
                <div className="prescription-side-card interaction-checker-card">
                  <div className="prescription-side-title">
                    <AlertTriangle size={18} strokeWidth={2} />
                    <h3>Medicine Interaction Checker</h3>
                  </div>
                  <div className="interaction-checker-panel">
                    <div className="interaction-checker-status">
                      <span>Safety Scan</span>
                      <strong>
                        {medicines.length > 1 ? "Moderate Risk" : "No Conflict"}
                      </strong>
                    </div>
                    <div className="interaction-checker-drugs">
                      <div>
                        <span>Primary</span>
                        <strong>{medicines[0]?.medicine_name || "Not enough medicines"}</strong>
                      </div>
                      <div>
                        <span>Compared With</span>
                        <strong>{medicines[1]?.medicine_name || "Add another medicine"}</strong>
                      </div>
                    </div>
                    <p>
                      {medicines.length > 1
                        ? "Potential interaction detected. Review dosage timing and clinician guidance before continuing."
                        : "Add more medicines to run a broader interaction screening across your current list."}
                    </p>
                  </div>
                  <button
                    className="action-btn prescription-verify-btn"
                    onClick={() => setHealthChatOpen(true)}
                  >
                    Check Interactions
                  </button>
                  <p className="prescription-side-note">
                    AI cross-checks active medicines for timing conflicts, duplication risk, and interaction severity.
                  </p>
                </div>

                <div className="prescription-side-card pharmacy-sync-card">
                  <div className="prescription-side-title">
                    <RefreshCcw size={18} strokeWidth={2} />
                    <h3>Pharmacy Sync</h3>
                  </div>
                  <p>No linked pharmacy connection found.</p>
                  <div className="pharmacy-sync-meta">
                    <div>
                      <span>Last Updated</span>
                      <strong>Unavailable</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>Not linked</strong>
                    </div>
                  </div>
                </div>

                <div className="prescription-side-card did-you-know-card">
                  <div className="prescription-side-title">
                    <Bell size={18} strokeWidth={2} />
                    <h3>Did you know?</h3>
                  </div>
                  <p>
                    Keeping your prescription list updated allows our system to automatically
                    check for drug-drug interactions in real time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECORDS TAB */}
        {activeTab === "records" && (
          <div className="tab-content records-tab">
            <div className="section-intro">
              <div>
                <h2>Patient Performance Hub</h2>
                <p>Last updated: {latestRecordDateLabel}</p>
              </div>
              <button type="button" className="action-btn">
                <Download size={16} strokeWidth={2} />
                Download Report
              </button>
            </div>

            <div className="records-reference-layout">
              <div className="records-main-column">
                <div className="records-top-grid">
                  <div className="records-summary-column">
                    <div className="records-summary-card">
                      <div className="records-summary-head">
                        <span className="records-summary-icon">
                          <FolderHeart size={18} strokeWidth={2} />
                        </span>
                        <span className="records-live-pill">Live Update</span>
                      </div>
                      <h3>Diagnostic Summary</h3>
                      <div className="records-summary-block">
                        <span>Latest Record</span>
                        {latestRecord ? (
                          <div className="records-symptom-pill">
                            <span className="records-symptom-dot" />
                            <strong>{latestMetricDateLabel}</strong>
                            <small>{Object.keys(latestMetrics || {}).length} metrics</small>
                          </div>
                        ) : (
                          <div className="records-symptom-pill">
                            <span className="records-symptom-dot" />
                            <strong>No structured data</strong>
                            <small>Unavailable</small>
                          </div>
                        )}
                      </div>
                      <div className="records-prediction-box">
                        <span>Clinical Summary</span>
                        <strong>
                          {latestRecord
                            ? "Recent health metrics are available for review."
                            : "No diagnostic summary is available yet."}
                        </strong>
                      </div>
                    </div>

                    <div className="records-history-card">
                      <div className="records-history-head">
                        <h4>History</h4>
                        <button type="button" onClick={() => setActiveTab("health")}>View All</button>
                      </div>
                      <div className="records-history-list">
                        {recordHistoryItems.map((item) => (
                          <div key={`${item.title}-${item.date}`} className="records-history-item">
                            <span className={`records-history-icon ${item.tone}`}>
                              {item.tone === "good" ? (
                                <CheckCircle2 size={16} strokeWidth={2.2} />
                              ) : (
                                <AlertTriangle size={16} strokeWidth={2.2} />
                              )}
                            </span>
                            <div>
                              <strong>{item.title}</strong>
                              <span>{item.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="records-metrics-grid">
                    {recordCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <div key={card.label} className="records-metric-card">
                          <div className="records-metric-head">
                            <span className="records-metric-icon">
                              <Icon size={20} strokeWidth={2} />
                            </span>
                            <span className={`records-metric-trend ${card.trend}`}>
                              {card.trend === "up" ? "↑" : card.trend === "down" ? "↓" : "–"} {card.delta}
                            </span>
                          </div>
                          <span className="records-metric-label">{card.label}</span>
                          <div className="records-metric-value">
                            <strong>{card.value}</strong>
                            <span>{card.unit}</span>
                          </div>
                          <div className="records-metric-footer">
                            <span>{card.noteLeft}</span>
                            <strong>{card.noteRight}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="records-trends-card">
                  <div className="records-trends-head">
                    <div>
                      <h3>7-Day Metric Trends</h3>
                      <p>Activity levels vs. clinical baseline</p>
                    </div>
                    <div className="records-trends-legend">
                      <span><i className="current" />Current</span>
                      <span><i className="baseline" />Baseline</span>
                    </div>
                  </div>
                  {recordTrendBars.length > 0 ? (
                    <div className="records-trends-chart">
                      {recordTrendBars.map((height, index) => (
                        <div key={index} className="records-chart-col">
                          <div className="records-chart-bars">
                            <span className="baseline-bar" style={{ height: `${Math.max(height + 12, 28)}%` }} />
                            <span className="current-bar" style={{ height: `${height}%` }} />
                          </div>
                          <small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-panel compact-empty">
                      <h4>No trend data available</h4>
                      <p>Metric trends will appear once multiple health records are synced.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="records-side-column">
                <div className="records-side-card records-insights-card">
                  <div className="records-side-title">
                    <Bell size={18} strokeWidth={2} />
                    <h3>AI Insights</h3>
                  </div>
                  <p>{healthSummaryMessage}</p>
                  <div className="records-observation-card">
                    <span>Observation</span>
                    <strong>
                      {latestMetrics?.heartRate != null
                        ? `Latest heart rate recorded at ${latestMetrics.heartRate} BPM.`
                        : "No additional observation is available yet."}
                    </strong>
                  </div>
                </div>

                <div className="records-side-card records-upcoming-card">
                  <span className="records-side-kicker">Upcoming</span>
                  <div className="records-upcoming-row">
                    <span className="records-upcoming-icon">
                      <Footprints size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <strong>{nextAppointment ? "Upcoming Appointment" : "No upcoming milestone"}</strong>
                      <span>
                        {nextAppointment
                          ? new Date(nextAppointment.appointment_date).toLocaleDateString("en-GB")
                          : "Book a visit to see upcoming care targets."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="records-side-card records-clinic-status-card">
                  <span className="records-side-kicker">Clinic Status</span>
                  <h3>{nextAppointment?.doctor_name || "Care team status"}</h3>
                  <p>{nextAppointment ? "Next visit booked" : "No active clinic wait data"}</p>
                </div>
              </div>
            </div>
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
            <div className="section-intro">
              <div>
                <span className="section-kicker">Queue Management</span>
                <h2>Status Tracker</h2>
                <p>Track your live position, estimated wait, and visit readiness in one place.</p>
              </div>
            </div>
            {appointments.some((a) => a.status === "booked") ? (
              <PatientQueuePosition
                appointmentId={
                  appointments.find((a) => a.status === "booked")?.id
                }
                patientId={user?.id}
              />
            ) : (
              <div className="empty-panel">
                <h4>No active appointments in queue</h4>
                <p>Your queue details appear here once a booked visit is active.</p>
              </div>
            )}
          </div>
        )}

        {/* HEALTH METRICS TAB - Google Fit Integration */}
        {activeTab === "health" && (
          <div className="tab-content health-metrics-tab">
            <div className="section-intro">
              <div>
                <h2>Health metrics and Google Fit</h2>
                <p>Connect wearable data and monitor your latest health trends.</p>
              </div>
            </div>
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
            <div className="section-intro">
              <div>
                <h2>Notifications</h2>
                <p>Stay updated on reminders, health prompts, and care events.</p>
              </div>
            </div>
            <NotificationCenter userId={user?.id} />
          </div>
        )}

        {/* RECORDINGS TAB */}
        {activeTab === "recordings" && (
          <div className="tab-content recordings-tab">
            <div className="section-intro">
              <div>
                <h2>Your voice notes</h2>
                <p>Listen to audio instructions and follow-ups from your doctor.</p>
              </div>
              <button
                className="recordings-refresh-btn"
                onClick={() => fetchRecordings(user?.id)}
              >
                <RefreshCcw size={16} strokeWidth={2} />
                Refresh
              </button>
            </div>
            <div className="recordings-header">
              <p>Latest voice notes from your doctor.</p>
            </div>
            {recordings.length === 0 ? (
              <div className="empty-panel">
                <h4>No recordings yet</h4>
                <p>Your doctor’s voice notes will appear here after consultations.</p>
              </div>
            ) : (
              <>
                <div className="recordings-voice-grid">
                  {recordings.map((r, index) => {
                    const recordingDate = r.appointment_date
                      ? new Date(r.appointment_date).toLocaleDateString("en-GB")
                      : new Date(r.created_at).toLocaleDateString("en-GB");

                    return (
                      <div key={r.id} className="recording-voice-card">
                        <div className="recording-voice-head">
                          <div className="recording-voice-identity">
                            <span className="recording-voice-icon">
                              {index % 2 === 0 ? (
                                <Mic size={18} strokeWidth={2} />
                              ) : (
                                <Stethoscope size={18} strokeWidth={2} />
                              )}
                            </span>
                            <div>
                              <strong>{r.doctor_name || "Doctor"}</strong>
                              <span>{r.slot_time ? `Recorded at ${String(r.slot_time).slice(0, 5)}` : "Voice note"}</span>
                            </div>
                          </div>
                          <div className="recording-voice-meta-top">
                            <small>{recordingDate}</small>
                          </div>
                        </div>

                        <div className="recording-wave-card">
                          <button type="button" className="recording-play-pill" aria-label="Play voice note">
                            <Play size={18} strokeWidth={2.2} fill="currentColor" />
                          </button>
                          <div className="recording-waveform" aria-hidden="true">
                            {Array.from({ length: 24 }).map((_, waveIndex) => (
                              <span
                                key={waveIndex}
                                style={{
                                  height: `${18 + ((waveIndex * 13 + index * 9) % 42)}px`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="recording-wave-times">
                            <span>0:00</span>
                            <span>
                              {r.duration && Number(r.duration) > 0
                                ? `${Math.max(1, Math.round(Number(r.duration) / 60))} MIN`
                                : "Audio note"}
                            </span>
                          </div>
                        </div>

                        <audio
                          controls
                          src={r.file_url}
                          className="recording-audio"
                        />
                        <div className="recording-transcript-actions">
                          <button
                            type="button"
                            className="recording-transcribe-btn"
                            onClick={() => handleTranscribeRecording(r.id)}
                            disabled={Boolean(transcribingIds[r.id])}
                          >
                            {transcribingIds[r.id] ? "Transcribing..." : "Speech to Text"}
                          </button>
                        </div>
                        {recordingTranscripts[r.id] ? (
                          <div className="recording-transcript-box">
                            <span>Transcript</span>
                            <p>{recordingTranscripts[r.id]}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="recordings-assistance-card">
                  <span className="section-kicker">Medical Assistance</span>
                  <div className="recordings-assistance-layout">
                    <div>
                      <h3>Need a written transcription of these voice notes?</h3>
                      <p>
                        Our AI-powered clinical assistant can provide precise text transcriptions
                        of your doctor&apos;s instructions for easier reference during your recovery.
                      </p>
                      <button
                        type="button"
                        className="recordings-transcription-btn"
                        onClick={() => setHealthChatOpen(true)}
                      >
                        Request Transcriptions
                      </button>
                    </div>
                    <div className="recordings-assistance-art">
                      <MessageSquareText size={140} strokeWidth={1.3} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === "wallet" && (
          <div className="tab-content wallet-tab">
            <div className="section-intro">
              <div>
                <span className="section-kicker">Health Wallet</span>
                <h2>Wallet Overview</h2>
                <p>Track your balance, payment readiness, and care spending in one place.</p>
              </div>
            </div>

            <div className="wallet-reference-layout">
              <div className="wallet-main-column">
                <div className="wallet-balance-card">
                  <div className="wallet-balance-head">
                    <div>
                      <span className="wallet-balance-kicker">Available Balance</span>
                      <h3>₹{Number(walletBalance).toFixed(2)}</h3>
                    </div>
                    <span className="wallet-ready-pill">
                      {Number(walletBalance) > 0 ? "Available" : "No funds added"}
                    </span>
                  </div>
                  <p>Use your health wallet balance for appointments and verified care services when available.</p>
                  <div className="wallet-balance-actions">
                    <button type="button" className="action-btn" onClick={() => setHealthChatOpen(true)}>
                      Billing Support
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setActiveTab("home")}>
                      Back to Dashboard
                    </button>
                  </div>
                </div>

                <div className="wallet-summary-grid">
                  <div className="wallet-summary-card">
                    <span>Current Balance</span>
                    <strong>₹{Number(walletBalance).toFixed(2)}</strong>
                    <small>Live wallet value from your account</small>
                  </div>
                  <div className="wallet-summary-card">
                    <span>Recent Spending</span>
                    <strong>Unavailable</strong>
                    <small>No transaction feed is linked yet</small>
                  </div>
                  <div className="wallet-summary-card">
                    <span>Upcoming Hold</span>
                    <strong>Unavailable</strong>
                    <small>No reserved payment is currently shown</small>
                  </div>
                </div>

                <div className="wallet-transactions-card">
                  <div className="wallet-section-head">
                    <h3>Recent Activity</h3>
                    <span>Linked activity feed</span>
                  </div>
                  <div className="wallet-transactions-list">
                    <div className="wallet-transaction-row">
                      <div>
                        <strong>No wallet activity available</strong>
                        <span>Transaction history will appear here once a billing feed is connected.</span>
                      </div>
                      <b className="debit">Unavailable</b>
                    </div>
                  </div>
                </div>
              </div>

              <div className="wallet-side-column">
                <div className="wallet-side-card wallet-security-card">
                  <div className="wallet-side-title">
                    <ShieldCheck size={18} strokeWidth={2} />
                    <h3>Protected Wallet</h3>
                  </div>
                  <p>Wallet access is protected. Additional billing details appear only when connected to your account.</p>
                </div>

                <div className="wallet-side-card wallet-upcoming-card">
                  <div className="wallet-side-title">
                    <CalendarDays size={18} strokeWidth={2} />
                    <h3>Upcoming Billing</h3>
                  </div>
                  <strong>Unavailable</strong>
                  <p>No scheduled charge is currently attached to your wallet.</p>
                </div>

                <div className="wallet-side-card wallet-support-card">
                  <div className="wallet-side-title">
                    <MessageSquareText size={18} strokeWidth={2} />
                    <h3>Need billing help?</h3>
                  </div>
                  <p>Our care support team can help with refunds, invoice clarifications, and wallet issues.</p>
                  <button type="button" className="wallet-support-btn" onClick={() => setHealthChatOpen(true)}>
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
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
