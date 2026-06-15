import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  appointmentAPI,
  prescriptionAPI,
  // timelineAPI,
  notificationAPI,
  // queueAPI,
  supportAPI,
  reviewAPI,
} from "../../api/techmedixAPI";
import { patientDataApi, healthWalletApi, authApi } from "../../api";
import DigitalPrescription from "../../components/Prescription/DigitalPrescription";
import AppointmentBooking from "../../components/AppointmentBooking/AppointmentBooking";
import PatientQueuePosition from "../../components/PatientQueuePosition/PatientQueuePosition";
import MedicalTimeline from "../../components/MedicalTimeline/MedicalTimeline";
import NotificationCenter from "../../components/NotificationCenter/NotificationCenter";
import HealthMetrics from "../../components/HealthMetrics/HealthMetrics";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import "./PatientDashboard.css";
import HealthChat from "../../components/HealthChat/HealthChat";
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";
import { assets } from "../../assets/assets";
import { toBackendUrl } from "../../utils/apiBase";
import { formatTime12Hour } from "../../utils/dateTime";
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
  Sun,
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
  X,
  ArrowRightLeft,
} from "lucide-react";

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const getQuickActionPrefsKey = (patientId) => `patient-dashboard-quick-actions-${patientId}`;
const DEFAULT_QUICK_ACTION_IDS = ["upload-prescription", "add-data", "view-history"];

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

const readQuickActionPrefs = (patientId) => {
  if (!patientId) return DEFAULT_QUICK_ACTION_IDS;

  try {
    const raw = localStorage.getItem(getQuickActionPrefsKey(patientId));
    if (!raw) return DEFAULT_QUICK_ACTION_IDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_QUICK_ACTION_IDS;
  } catch (error) {
    console.error("Failed to read dashboard quick action preferences:", error);
    return DEFAULT_QUICK_ACTION_IDS;
  }
};

const writeQuickActionPrefs = (patientId, quickActionIds) => {
  if (!patientId) return;

  try {
    localStorage.setItem(
      getQuickActionPrefsKey(patientId),
      JSON.stringify(quickActionIds),
    );
  } catch (error) {
    console.error("Failed to write dashboard quick action preferences:", error);
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

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs),
    ),
  ]);

const fetchJsonWithTimeout = async (url, options, timeoutMs, label) => {
  const response = await withTimeout(fetch(url, options), timeoutMs, label);
  const data = await response.json().catch(() => null);
  return { response, data };
};

const getHealthMetricTimestamp = (metric) =>
  metric?.recorded_at || metric?.recordedAt || metric?.created_at || metric?.createdAt || null;

const normalizeHealthMetricsByType = (metrics) => {
  if (!Array.isArray(metrics)) return {};

  const latestByType = metrics.reduce((acc, metric) => {
    const metricType = metric?.metric_type || metric?.metricType;
    if (!metricType) return acc;

    const currentTimestamp = new Date(getHealthMetricTimestamp(metric) || 0).getTime();
    const prevTimestamp = new Date(getHealthMetricTimestamp(acc[metricType]) || 0).getTime();

    if (!acc[metricType] || currentTimestamp >= prevTimestamp) {
      acc[metricType] = metric;
    }

    return acc;
  }, {});

  return {
    steps: toFiniteNumber(latestByType.steps?.value),
    heartRate: toFiniteNumber(latestByType.heart_rate?.value),
    sleep: toFiniteNumber(latestByType.sleep_duration?.value),
    calories_burned: toFiniteNumber(
      latestByType.calories_burned?.value ?? latestByType.calories?.value,
    ),
    metricTimestamps: {
      steps: getHealthMetricTimestamp(latestByType.steps),
      heartRate: getHealthMetricTimestamp(latestByType.heart_rate),
      sleep: getHealthMetricTimestamp(latestByType.sleep_duration),
      calories_burned: getHealthMetricTimestamp(
        latestByType.calories_burned || latestByType.calories,
      ),
    },
  };
};

const normalizeDoctorsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.doctors)) return payload.doctors;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const getMedicineDisplayName = (medicine) =>
  medicine?.medicine_name ||
  medicine?.name ||
  medicine?.medicine ||
  medicine?.drug_name ||
  "";

const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
};

const renderPrescriptionToBlob = async (doctor, patient, medicines, diagnosis, notes, rxNumber) => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1130;
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top header green band
  ctx.fillStyle = "#0f6b57";
  ctx.fillRect(0, 0, canvas.width, 15);

  // Clinic Logo Box
  ctx.fillStyle = "#0f6b57";
  ctx.fillRect(40, 40, 60, 60);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TM", 70, 70);

  // Clinic Info
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("TechMedix Clinical Sanctuary", 120, 65);
  ctx.fillStyle = "#64748b";
  ctx.font = "14px sans-serif";
  ctx.fillText("124, Healthcare Boulevard, Medical District", 120, 88);

  // Divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 115);
  ctx.lineTo(760, 115);
  ctx.stroke();

  // Doctor Details
  const doctorName = doctor?.name || "Specialist Consultant";
  const doctorSpecialty = doctor?.specialty || "Medical Consultant";
  const isDoc = doctorName && !doctorName.toLowerCase().includes("upload");
  const clinicContact = isDoc && (doctor?.phone || doctor?.email)
    ? [doctor.phone, doctor.email].filter(Boolean).join(" | ")
    : "+91 98765-43210 | support@techmedix.com";

  ctx.fillStyle = "#0f6b57";
  ctx.font = "bold 16px sans-serif";
  const docDisplayName = isDoc ? (doctorName.startsWith("Dr.") ? doctorName : `Dr. ${doctorName}`) : doctorName;
  ctx.fillText(docDisplayName, 40, 145);
  
  ctx.fillStyle = "#475569";
  ctx.font = "14px sans-serif";
  ctx.fillText(doctorSpecialty, 40, 168);

  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  ctx.font = "12px sans-serif";
  ctx.fillText(clinicContact, 760, 145);
  if (isDoc) {
    ctx.fillText(`Reg No: ${doctor?.reg_no || "TM-DOC-2024-001"}`, 760, 168);
  }

  // Patient Info Strip Box
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(40, 190, 720, 65);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(40, 190, 720, 65);

  ctx.textAlign = "left";
  ctx.fillStyle = "#475569";
  ctx.font = "12px sans-serif";
  ctx.fillText("Patient Name:", 60, 215);
  ctx.fillText("Patient ID:", 60, 240);
  ctx.fillText("Date:", 420, 215);
  ctx.fillText("Rx No:", 420, 240);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(patient?.name || "Walk-in Patient", 150, 215);
  ctx.fillText(patient?.id ? `#${String(patient.id).slice(0, 8)}` : "—", 150, 240);
  ctx.fillText(new Date().toLocaleDateString(), 470, 215);
  ctx.fillText(rxNumber || "RX-TEMP", 470, 240);

  // Rx Symbol
  ctx.fillStyle = "#0f6b57";
  ctx.font = "italic bold 36px Georgia, serif";
  ctx.fillText("Rx", 40, 300);

  let currentY = 320;

  // Diagnosis Findings
  if (diagnosis) {
    ctx.fillStyle = "#0f6b57";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Diagnosis / Clinical Findings", 40, currentY);
    currentY += 20;

    ctx.fillStyle = "#334155";
    ctx.font = "13px sans-serif";
    currentY = drawWrappedText(ctx, diagnosis, 40, currentY, 720, 18);
    currentY += 15;
  }

  // Medicines Table
  ctx.fillStyle = "#0f6b57";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("Prescribed Medications", 40, currentY);
  currentY += 15;

  // Table Header
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(40, currentY, 720, 25);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(40, currentY, 720, 25);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("#", 50, currentY + 17);
  ctx.fillText("Medicine Name", 80, currentY + 17);
  ctx.fillText("Dosage", 380, currentY + 17);
  ctx.fillText("Frequency", 500, currentY + 17);
  ctx.fillText("Duration", 640, currentY + 17);

  currentY += 25;

  // Render Medicine list
  const activeMeds = medicines.filter(m => !m.is_deleted);
  const stoppedMeds = medicines.filter(m => m.is_deleted);
  const orderedMeds = [...activeMeds, ...stoppedMeds];

  ctx.font = "12px sans-serif";
  orderedMeds.forEach((med, idx) => {
    if (med.is_deleted) {
      ctx.fillStyle = "#fff1f2";
      ctx.fillRect(40, currentY, 720, 25);
    }
    
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(40, currentY + 25);
    ctx.lineTo(760, currentY + 25);
    ctx.stroke();

    ctx.fillStyle = med.is_deleted ? "#991b1b" : "#1e293b";
    ctx.fillText(String(idx + 1), 50, currentY + 17);
    
    ctx.font = "bold 12px sans-serif";
    const nameStr = med.is_deleted ? `${med.medicine_name} (Stopped)` : med.medicine_name;
    ctx.fillText(nameStr, 80, currentY + 17);
    ctx.font = "12px sans-serif";

    ctx.fillText(med.dosage || "—", 380, currentY + 17);
    ctx.fillText(med.frequency || "—", 500, currentY + 17);
    ctx.fillText(med.duration || "—", 640, currentY + 17);

    currentY += 25;
  });

  if (orderedMeds.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("No medications prescribed.", 50, currentY + 17);
    currentY += 25;
  }

  currentY += 20;

  // Additional Instructions
  if (notes) {
    ctx.fillStyle = "#0f6b57";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Additional Instructions / Advice", 40, currentY);
    currentY += 20;

    ctx.fillStyle = "#334155";
    ctx.font = "13px sans-serif";
    currentY = drawWrappedText(ctx, notes, 40, currentY, 720, 18);
  }

  // Footer Setup
  const footerY = 980;

  // Footer Divider line
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, footerY);
  ctx.lineTo(760, footerY);
  ctx.stroke();

  // QR Code
  const qrDataText = `TechMedix Verification\nPatient: ${patient?.name || "N/A"}\nPatient ID: ${patient?.id || "N/A"}\nRx No: ${rxNumber || "RX-TEMP"}\nDoctor: ${doctorName}`;
  const qrImg = new Image();
  qrImg.crossOrigin = "anonymous";
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrDataText)}`;
  
  await new Promise((resolve) => {
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 40, footerY + 15, 80, 80);
      resolve();
    };
    qrImg.onerror = () => {
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(40, footerY + 15, 80, 80);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px sans-serif";
      ctx.fillText("QR Code", 55, footerY + 55);
      resolve();
    };
  });

  ctx.fillStyle = "#64748b";
  ctx.font = "10px sans-serif";
  ctx.fillText("Scan to Verify", 40, footerY + 110);

  // Digital Signature
  if (isDoc) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(540, footerY + 70);
    ctx.lineTo(760, footerY + 70);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("Digital Signature", 650, footerY + 85);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(docDisplayName, 650, footerY + 60);
  } else {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(540, footerY + 70);
    ctx.lineTo(760, footerY + 70);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("Uploaded Prescription Record", 650, footerY + 85);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(patient?.name || "Patient Verified", 650, footerY + 60);
  }

  // Footer Tagline & info
  ctx.textAlign = "center";
  ctx.fillStyle = "#64748b";
  ctx.font = "10px sans-serif";
  ctx.fillText("This is a digitally generated prescription. It does not require a physical stamp for validation.", 400, footerY + 115);
  ctx.fillStyle = "#0f6b57";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText("TechMedix - Precision in Every Care", 400, footerY + 130);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas blob conversion failed"));
    }, "image/png");
  });
};
/**
 * PATIENT DASHBOARD
 * Central hub for patient - shows appointments, queue, prescriptions, timeline, notifications
 */
export default function PatientDashboard() {
  const { user, login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
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
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState(null);
  const [healthChatOpen, setHealthChatOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportCategory, setSupportCategory] = useState("wallet");
  const [supportDescription, setSupportDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [selectedDoctorReviews, setSelectedDoctorReviews] = useState([]);
  const [selectedDoctorRating, setSelectedDoctorRating] = useState("0.0");
  const [selectedDoctorReviewCount, setSelectedDoctorReviewCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recordingTranscripts, setRecordingTranscripts] = useState({});
  const [transcribingIds, setTranscribingIds] = useState({});
  const [metricsRefresh, setMetricsRefresh] = useState(0);
  const [ehrHistory, setEhrHistory] = useState([]);
  const [healthMetricsHistory, setHealthMetricsHistory] = useState([]);
  const [medicineReminders, setMedicineReminders] = useState([]);
  const [interactionCheckLoading, setInteractionCheckLoading] = useState(false);
  const [interactionCheckResult, setInteractionCheckResult] = useState(null);
  const [interactionCheckNonce, setInteractionCheckNonce] = useState(0);
  const [showCustomizeGridModal, setShowCustomizeGridModal] = useState(false);
  const [savedQuickActionIds, setSavedQuickActionIds] = useState(DEFAULT_QUICK_ACTION_IDS);
  const [draftQuickActionIds, setDraftQuickActionIds] = useState(DEFAULT_QUICK_ACTION_IDS);
  
  // Digital Prescription Pad states
  const [showDownloadPadModal, setShowDownloadPadModal] = useState(false);
  const [selectedPad, setSelectedPad] = useState(null);
  const [viewingDigitalRx, setViewingDigitalRx] = useState(false);
  const [isWalletSaving, setIsWalletSaving] = useState(false);
  const [isDownloadingRx, setIsDownloadingRx] = useState(false);

  // Wallet transfer/withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpiId, setWithdrawUpiId] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Grouped prescriptions by doctor
  const groupedPrescriptionPads = React.useMemo(() => {
    if (!Array.isArray(prescriptions)) return [];
    
    const groups = {};
    prescriptions.forEach((item) => {
      const docId = item.doctor_id || "user-upload";
      if (!groups[docId]) {
        groups[docId] = {
          doctor: {
            id: item.doctor_id || null,
            name: item.doctor_name || "User Upload",
            specialty: item.doctor_specialty || "Prescription Uploads",
            email: item.doctor_email || "",
            phone: item.doctor_phone || "",
            reg_no: item.doctor_reg_no || "",
          },
          medicines: [],
          latestDate: null,
        };
      }
      groups[docId].medicines.push(item);
      
      const itemDate = new Date(item.created_at || item.recorded_at || Date.now());
      if (!groups[docId].latestDate || itemDate > groups[docId].latestDate) {
        groups[docId].latestDate = itemDate;
      }
    });

    return Object.values(groups).sort((a, b) => b.latestDate - a.latestDate);
  }, [prescriptions]);

  // Handle Save to Health Wallet
  const handleSaveToWallet = async () => {
    if (!selectedPad) return;
    
    setIsWalletSaving(true);
    try {
      const rxNo = `RX-${Math.floor(1000 + Math.random() * 9000)}`;
      const doc = selectedPad.doctor;
      
      const firstMedWithInstructions = selectedPad.medicines.find(m => m.instructions);
      const notes = firstMedWithInstructions ? firstMedWithInstructions.instructions : "";
      
      const blob = await renderPrescriptionToBlob(
        doc,
        { id: user.id, name: user.name },
        selectedPad.medicines,
        "", 
        notes, 
        rxNo
      );
      
      const formData = new FormData();
      formData.append(
        "documents",
        blob,
        `prescription-${(doc.name || "doctor").toLowerCase().replace(/\s+/g, "_")}-${Date.now()}.png`
      );
      
      const response = await healthWalletApi.uploadDocuments(formData);
      if (response.data?.success) {
        alert("Prescription saved to your Health Wallet successfully!");
      } else {
        throw new Error(response.data?.error || "Failed to upload");
      }
    } catch (err) {
      console.error("Save to Wallet error:", err);
      alert(`Failed to save prescription to Health Wallet: ${err.message}`);
    } finally {
      setIsWalletSaving(false);
    }
  };

  // Handle direct file download
  const handleDownloadPrescription = async () => {
    if (!selectedPad) return;
    
    setIsDownloadingRx(true);
    try {
      const rxNo = `RX-${Math.floor(1000 + Math.random() * 9000)}`;
      const doc = selectedPad.doctor;
      
      const firstMedWithInstructions = selectedPad.medicines.find(m => m.instructions);
      const notes = firstMedWithInstructions ? firstMedWithInstructions.instructions : "";
      
      const blob = await renderPrescriptionToBlob(
        doc,
        { id: user.id, name: user.name },
        selectedPad.medicines,
        "", 
        notes, 
        rxNo
      );
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prescription-${(doc.name || "doctor").toLowerCase().replace(/\s+/g, "_")}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download prescription error:", err);
      alert(`Failed to download prescription: ${err.message}`);
    } finally {
      setIsDownloadingRx(false);
    }
  };

  const refreshNotifications = async (patientId) => {
    if (!patientId) return [];

    try {
      const notifRes = await notificationAPI.getByUser(patientId);
      const nextNotifications = notifRes?.data?.data || [];
      setNotifications(nextNotifications);
      writeDashboardCache(patientId, {
        appointments,
        prescriptions,
        medicines,
        notifications: nextNotifications,
        walletBalance,
        recordings,
        ehrHistory,
        healthMetricsHistory,
        doctors,
        qrData,
      });
      return nextNotifications;
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
      return [];
    }
  };

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
      const res = await fetch(toBackendUrl(`/api/recordings/${rec.id}/download`), {
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
        const recRes = await fetch(toBackendUrl(`/api/recordings/patient/${pid}`), {
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

      const response = await fetch(
        toBackendUrl(`/api/recordings/${recordingId}/transcribe`),
        {
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
    if (!user?.id) return undefined;

    const cache = readDashboardCache(user.id)?.data;

    if (cache) {
      setAppointments(cache.appointments || []);
      setPrescriptions(cache.prescriptions || []);
      setMedicines(cache.medicines || []);
      setNotifications(cache.notifications || []);
      setWalletBalance(Number(cache.walletBalance || 0));
      setWalletTransactions(cache.walletTransactions || []);
      setSupportTickets(cache.supportTickets || []);
      setRecordings(cache.recordings || []);
      setEhrHistory(cache.ehrHistory || []);
      setHealthMetricsHistory(cache.healthMetricsHistory || []);
      setDoctors(cache.doctors || []);
      setQrData(cache.qrData || null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const quickActionPrefs = readQuickActionPrefs(user.id);
    setSavedQuickActionIds(quickActionPrefs);
    setDraftQuickActionIds(quickActionPrefs);

    const loaderTimeout = window.setTimeout(() => {
      setLoading(false);
    }, cache ? 250 : 1800);

    loadDashboardData({ showLoader: false });

    return () => {
      window.clearTimeout(loaderTimeout);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    if (!user?.uniqueCode) {
      authApi.getProfile()
        .then((res) => {
          const profileData = res.data?.data;
          if (profileData) {
            login({
              ...user,
              ...profileData,
              uniqueCode: profileData.uniqueCode || user?.uniqueCode || null,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch profile for dashboard uniqueCode:", err);
        });
    }
  }, [user?.id, user?.uniqueCode]);

  useEffect(() => {
    if (!selectedDoctorId) {
      setSelectedDoctorReviews([]);
      setSelectedDoctorRating("0.0");
      setSelectedDoctorReviewCount(0);
      return;
    }

    const fetchDocReviews = async () => {
      try {
        setReviewsLoading(true);
        const res = await reviewAPI.getDoctorReviews(selectedDoctorId);
        setSelectedDoctorReviews(res.data?.reviews || []);
        setSelectedDoctorRating(res.data?.average || "0.0");
        setSelectedDoctorReviewCount(res.data?.count || 0);
      } catch (err) {
        console.error("Failed to load doctor reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchDocReviews();
  }, [selectedDoctorId]);

  useEffect(() => {
    const requestedTab = location.state?.initialTab;
    if (requestedTab) {
      setActiveTab(requestedTab);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  useEffect(() => {
    const medicineNames = medicines
      .map(getMedicineDisplayName)
      .map((name) => String(name).trim())
      .filter(Boolean);

    if (medicineNames.length < 2) {
      setInteractionCheckResult(null);
      setInteractionCheckLoading(false);
      return;
    }

    let isActive = true;

    const runInteractionCheck = async () => {
      try {
        setInteractionCheckLoading(true);
        const response = await fetch(
          toBackendUrl("/api/safety/check-drug-interactions"),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ medicines: medicineNames }),
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to run interaction check");
        }
        if (isActive) {
          setInteractionCheckResult(payload);
        }
      } catch (error) {
        console.error("Failed to run interaction check:", error);
        if (isActive) {
          setInteractionCheckResult({
            has_interactions: false,
            interactions: [],
            error: error.message,
          });
        }
      } finally {
        if (isActive) {
          setInteractionCheckLoading(false);
        }
      }
    };

    runInteractionCheck();

    return () => {
      isActive = false;
    };
  }, [medicines, interactionCheckNonce]);

  const loadDashboardData = async ({ showLoader = true } = {}) => {
    if (!user?.id) return;
    try {
      if (showLoader) {
        setLoading(true);
      }
      const cachedData = readDashboardCache(user.id)?.data || {};
      const [apptRes, prescRes, notifRes] = await Promise.allSettled([
        withTimeout(appointmentAPI.getByPatient(user.id), 8000, "Appointments"),
        withTimeout(prescriptionAPI.getByPatient(user.id), 8000, "Prescriptions"),
        withTimeout(notificationAPI.getByUser(user.id), 8000, "Notifications"),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(apptRes.value.data.data || []);
      } else if (cachedData.appointments?.length) {
        setAppointments(cachedData.appointments);
      }
      if (prescRes.status === "fulfilled") {
        setPrescriptions(prescRes.value.data.data || []);
      } else if (cachedData.prescriptions?.length) {
        setPrescriptions(cachedData.prescriptions);
      }
      if (notifRes.status === "fulfilled") {
        setNotifications(notifRes.value.data.data || []);
      } else if (cachedData.notifications?.length) {
        setNotifications(cachedData.notifications);
      }

      writeDashboardCache(user.id, {
        appointments:
          apptRes.status === "fulfilled"
            ? apptRes.value.data.data || []
            : cachedData.appointments || [],
        prescriptions:
          prescRes.status === "fulfilled"
            ? prescRes.value.data.data || []
            : cachedData.prescriptions || [],
        medicines: cachedData.medicines || medicines,
        notifications:
          notifRes.status === "fulfilled"
            ? notifRes.value.data.data || []
            : cachedData.notifications || [],
        walletBalance: Number(cachedData.walletBalance || walletBalance || 0),
        walletTransactions: cachedData.walletTransactions || walletTransactions || [],
        supportTickets: cachedData.supportTickets || supportTickets || [],
        recordings: cachedData.recordings || recordings,
        ehrHistory: cachedData.ehrHistory || ehrHistory,
        healthMetricsHistory: cachedData.healthMetricsHistory || healthMetricsHistory,
        doctors: cachedData.doctors || doctors,
        qrData: cachedData.qrData || qrData,
      });

      if (showLoader) {
        setLoading(false);
      }

      let nextEhrHistory = ehrHistory.length
        ? ehrHistory
        : cachedData.ehrHistory || [];
      try {
        const ehrRes = await withTimeout(
          patientDataApi.getEHRHistory(user.id),
          8000,
          "EHR history",
        );
        nextEhrHistory = Array.isArray(ehrRes.data) ? ehrRes.data : [];
        setEhrHistory(nextEhrHistory);
      } catch (err) {
        console.error("Failed to load patient data for health status:", err);
        setEhrHistory(nextEhrHistory);
      }

      let nextHealthMetricsHistory = healthMetricsHistory.length
        ? healthMetricsHistory
        : cachedData.healthMetricsHistory || [];
      try {
        const { response: healthMetricsRes, data: healthMetricsData } = await fetchJsonWithTimeout(
          toBackendUrl("/api/health/metrics"),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            credentials: "include",
          },
          8000,
          "Health metrics",
        );
        if (healthMetricsRes.ok) {
          nextHealthMetricsHistory = Array.isArray(healthMetricsData)
            ? healthMetricsData
            : [];
          setHealthMetricsHistory(nextHealthMetricsHistory);
        } else {
          setHealthMetricsHistory(nextHealthMetricsHistory);
        }
      } catch (err) {
        console.error("Failed to load synced health metrics:", err);
        setHealthMetricsHistory(nextHealthMetricsHistory);
      }

      let nextMedicines = medicines.length ? medicines : cachedData.medicines || [];
      try {
        const { response: medRes, data: medData } = await fetchJsonWithTimeout(
          toBackendUrl(`/api/user/${user.id}/medicines`),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
          8000,
          "Medicines",
        );
        if (!medRes.ok) {
          throw new Error("Failed to load medicines");
        }
        nextMedicines = Array.isArray(medData) ? medData : [];
        setMedicines(nextMedicines);
      } catch (err) {
        console.error("Failed to load medicines:", err);
        setMedicines(nextMedicines);
      }

      // Load recordings for this patient
      let nextRecordings = recordings.length
        ? recordings
        : cachedData.recordings || [];
      try {
        const { response: recRes, data: recData } = await fetchJsonWithTimeout(
          toBackendUrl(`/api/recordings/patient/${user.id}`),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            credentials: "include",
          },
          8000,
          "Recordings",
        );
        if (recRes.ok) {
          nextRecordings = Array.isArray(recData) ? recData : [];
          setRecordings(nextRecordings);
        } else {
          setRecordings(nextRecordings);
        }
      } catch (err) {
        console.error("Failed to load recordings:", err);
        setRecordings(nextRecordings);
      }

      // Load wallet balance
      let nextWalletBalance = Number(walletBalance || cachedData.walletBalance || 0);
      try {
        const { response: wbRes, data: wbData } = await fetchJsonWithTimeout(
          toBackendUrl(`/api/payments/wallet/balance`),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          },
          8000,
          "Wallet balance",
        );
        if (wbRes.ok) {
          nextWalletBalance = Number(wbData.balance || 0);
          setWalletBalance(nextWalletBalance);
        } else {
          console.warn("Wallet balance error:", wbData?.error);
          setWalletBalance(nextWalletBalance);
        }
      } catch (err) {
        console.error("Failed to load wallet balance:", err);
        setWalletBalance(nextWalletBalance);
      }

      // Load wallet transactions
      let nextWalletTransactions = cachedData.walletTransactions || [];
      try {
        const { response: wtRes, data: wtData } = await fetchJsonWithTimeout(
          toBackendUrl(`/api/payments/wallet/transactions`),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          },
          8000,
          "Wallet transactions",
        );
        if (wtRes.ok) {
          nextWalletTransactions = Array.isArray(wtData.data) ? wtData.data : [];
          setWalletTransactions(nextWalletTransactions);
        } else {
          console.warn("Wallet transactions error:", wtData?.error);
          setWalletTransactions(nextWalletTransactions);
        }
      } catch (err) {
        console.error("Failed to load wallet transactions:", err);
        setWalletTransactions(nextWalletTransactions);
      }

      // Load support tickets
      let nextSupportTickets = cachedData.supportTickets || [];
      try {
        const response = await supportAPI.getTickets();
        nextSupportTickets = response.data?.tickets || response.data?.data || [];
        setSupportTickets(nextSupportTickets);
      } catch (err) {
        console.error("Failed to load support tickets:", err);
        setSupportTickets(nextSupportTickets);
      }

      let nextDoctors = doctors.length ? doctors : cachedData.doctors || [];
      try {
        setDoctorsLoading(true);
        setDoctorsError(null);
        const { response, data } = await fetchJsonWithTimeout(
          toBackendUrl("/api/admin/doctors"),
          {
            credentials: "include",
          },
          8000,
          "Doctors",
        );
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load doctors");
        }
        nextDoctors = normalizeDoctorsResponse(data);
        if (!nextDoctors.length) {
          console.warn("Doctors endpoint returned no usable rows:", data);
        }
        setDoctors(nextDoctors);
      } catch (err) {
        console.error("Failed to load doctors:", err);
        setDoctors(nextDoctors);
        setDoctorsError(err.message || "Failed to load doctors");
      } finally {
        setDoctorsLoading(false);
      }

      let nextQrData = qrData || cachedData.qrData || null;
      try {
        const qrRes = await withTimeout(
          patientDataApi.generatePatientQR(user.id),
          8000,
          "Patient QR",
        );
        nextQrData = qrRes.data?.qr || null;
        setQrData(nextQrData);
      } catch (err) {
        console.error("QR generation error:", err);
        setQrData(nextQrData);
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
        walletTransactions: nextWalletTransactions,
        supportTickets: nextSupportTickets,
        recordings: nextRecordings,
        ehrHistory: nextEhrHistory,
        healthMetricsHistory: nextHealthMetricsHistory,
        doctors: nextDoctors,
        qrData: nextQrData,
      });
    } catch (err) {
      setError("Failed to load dashboard data: " + err.message);
    } finally {
      if (showLoader && loading) {
        setLoading(false);
      }
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this appointment? The paid amount will be refunded directly to your health wallet."
    );
    if (!confirmCancel) return;

    try {
      await appointmentAPI.cancel(
        appointmentId,
        "Patient requested cancellation",
      );
      alert("Appointment cancelled successfully. Refreshing dashboard...");
      window.location.reload();
    } catch (err) {
      alert("Failed to cancel appointment: " + err.message);
    }
  };

  const handleDeleteMedicine = async (medicineId) => {
    try {
      await fetch(toBackendUrl(`/api/medicines/${medicineId}`), {
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
        walletTransactions,
        supportTickets,
        recordings,
        ehrHistory,
        healthMetricsHistory,
        doctors,
        qrData,
      });
    } catch (err) {
      console.error("Failed to delete medicine:", err);
      alert("Failed to delete medicine");
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportDescription.trim()) return;

    try {
      setSubmittingTicket(true);
      await supportAPI.createTicket({
        subject: supportSubject,
        category: supportCategory,
        description: supportDescription,
      });

      alert("Support ticket submitted successfully!");
      setShowSupportModal(false);
      setSupportSubject("");
      setSupportDescription("");

      loadDashboardData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(withdrawAmount);
    if (!withdrawAmount || amountNum <= 0) {
      alert("Please enter a valid amount to transfer.");
      return;
    }
    if (amountNum > Number(walletBalance)) {
      alert("Insufficient wallet balance.");
      return;
    }
    if (!withdrawUpiId.trim() || !withdrawUpiId.includes("@")) {
      alert("Please enter a valid UPI ID (e.g. username@bank).");
      return;
    }

    try {
      setIsWithdrawing(true);
      const { response, data } = await fetchJsonWithTimeout(
        toBackendUrl("/api/payments/wallet/withdraw"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountNum,
            upi_id: withdrawUpiId.trim(),
          }),
          credentials: "include",
        },
        8000,
        "Wallet withdrawal",
      );

      if (response.ok) {
        alert("Withdrawal request submitted successfully! Funds have been deducted and the request has been sent to the admin.");
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        setWithdrawUpiId("");
        loadDashboardData();
      } else {
        alert("Failed to submit withdrawal request: " + (data?.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error submitting request: " + err.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleDownloadReport = () => {
    const reportLines = [
      "TechMedix Patient Report",
      `Generated: ${new Date().toLocaleString("en-GB")}`,
      `Patient: ${user?.name || "Patient"}`,
      "",
      "Health Snapshot",
      `Health Score: ${hasAnyMetricData ? `${healthScore}%` : "Unavailable"}`,
      `Latest Metric Date: ${latestMetricDateLabel}`,
      `Heart Rate: ${latestMetrics?.heartRate ?? "Unavailable"}`,
      `Steps: ${latestMetrics?.steps ?? "Unavailable"}`,
      `Sleep: ${latestMetrics?.sleep ?? "Unavailable"}`,
      `Weight: ${latestMetrics?.weight ?? "Unavailable"}`,
      "",
      "Active Medicines",
      ...(medicines.length
        ? medicines.map(
            (medicine, index) =>
              `${index + 1}. ${getMedicineDisplayName(medicine)} | Dosage: ${medicine.dosage || "—"} | Frequency: ${medicine.frequency || "—"} | Duration: ${medicine.duration || "—"}`,
          )
        : ["No active medicines"]),
      "",
      "Appointments",
      ...(appointments.length
        ? appointments.map(
            (appointment, index) =>
              `${index + 1}. ${appointment.doctor_name || appointment.doctor_id} | ${appointment.appointment_date} ${appointment.slot_time || ""} | Status: ${appointment.status}`,
          )
        : ["No appointments"]),
      "",
      "Alerts",
      ...(notifications.length
        ? notifications.slice(0, 10).map(
            (notification, index) =>
              `${index + 1}. ${notification.title || "Alert"} | ${notification.message || "No message"} | ${notification.created_at || ""}`,
          )
        : ["No alerts"]),
    ];

    const blob = new Blob([reportLines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const reportUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = reportUrl;
    anchor.download = `techmedix-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(reportUrl);
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
        walletTransactions,
        supportTickets,
        recordings,
        ehrHistory,
        healthMetricsHistory,
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
      <div className="patient-dashboard patient-dashboard-loading-shell">
        <div className="patient-dashboard-loading-card">
          <div className="patient-dashboard-loading-spinner" />
          <h2>Loading your dashboard</h2>
          <p>Fetching appointments, prescriptions, reminders, and health data.</p>
        </div>
      </div>
    );

  const latestRecord =
    ehrHistory && ehrHistory.length
      ? ehrHistory
          .slice()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      : null;
  const latestLegacyMetrics = latestRecord?.ehr || null;
  const normalizedHealthMetrics = normalizeHealthMetricsByType(healthMetricsHistory);
  const {
    metricTimestamps = {},
    ...normalizedHealthMetricValues
  } = normalizedHealthMetrics || {};
  const latestMetrics = {
    ...(latestLegacyMetrics || {}),
    ...(normalizedHealthMetricValues || {}),
  };
  const latestHealthMetricTimestamp = Object.values(metricTimestamps)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const latestOverallMetricTimestamp =
    latestHealthMetricTimestamp &&
    (!latestRecord?.timestamp ||
      new Date(latestHealthMetricTimestamp) > new Date(latestRecord.timestamp))
      ? latestHealthMetricTimestamp
      : latestRecord?.timestamp || latestHealthMetricTimestamp;
  const visibleMetricCount = Object.values(latestMetrics || {}).filter((value) => {
    if (value == null || value === "") return false;
    if (typeof value === "object") {
      return Object.values(value).some((nestedValue) => nestedValue != null && nestedValue !== "");
    }
    return true;
  }).length;
  const hasAnyMetricData = visibleMetricCount > 0;
  const unreadAlertsCount = notifications.filter(
    (n) => n?.is_read === false || n?.isRead === false || n?.read === false,
  ).length;
  const unreadAlerts = notifications
    .filter((n) => n?.is_read === false || n?.isRead === false || n?.read === false)
    .slice()
    .sort(
      (a, b) =>
        new Date(b?.created_at || b?.createdAt || 0) -
        new Date(a?.created_at || a?.createdAt || 0),
    );
  const pendingMedicineReminders = medicineReminders.filter(
    (reminder) => !reminder?.completed?.includes(new Date().toDateString()),
  );
  const sortedPendingMedicineReminders = pendingMedicineReminders
    .slice()
    .sort((a, b) => toReminderDate(a) - toReminderDate(b));
  const reminderSpotlightItems = [
    ...sortedPendingMedicineReminders.map((reminder) => ({
      id: `medicine-${reminder.id || reminder.medicine}`,
      type: "medicine",
      reminderId: reminder.id,
      icon: Pill,
      title: reminder.medicine,
      subtitle: reminder.dosage || "Scheduled medication",
      metaPrimary: toReminderDate(reminder).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      metaSecondary: "Pending",
    })),
    ...unreadAlerts.map((alertItem) => ({
      id: `alert-${alertItem.id}`,
      type: "alert",
      icon: AlertTriangle,
      title: alertItem.title || "Safety alert",
      subtitle: alertItem.message || "You have a new update in TechMedix.",
      metaPrimary: new Date(
        alertItem.created_at || alertItem.createdAt || Date.now(),
      ).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      metaSecondary: "Unread",
      alertId: alertItem.id,
    })),
  ];
  const bookedAppointments = appointments.filter((a) => a.status === "booked");
  const activeQueueAppointment = appointments
    .filter((appointment) =>
      ["arrived", "in_progress", "in-progress"].includes(appointment.status),
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(`${a.appointment_date} ${a.slot_time || "00:00"}`) -
        new Date(`${b.appointment_date} ${b.slot_time || "00:00"}`),
    )[0] || null;
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
  const healthScore = hasAnyMetricData ? computeHealthScore(latestMetrics) : 0;
  const healthScoreColor =
    healthScore > 70 ? "#90c976" : healthScore > 40 ? "#f2b84b" : "#ef6b6b";
  const healthSummaryMessage = hasAnyMetricData
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
  const latestMetricDateLabel = latestOverallMetricTimestamp
    ? new Date(latestOverallMetricTimestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No recent metrics";
  const latestRecordDateLabel = latestOverallMetricTimestamp
    ? new Date(latestOverallMetricTimestamp).toLocaleString("en-GB", {
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
  const sortedEhrHistory = ehrHistory
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const stepHistory = healthMetricsHistory
    .filter((metric) => (metric?.metric_type || metric?.metricType) === "steps")
    .sort(
      (a, b) =>
        new Date(getHealthMetricTimestamp(b) || 0) -
        new Date(getHealthMetricTimestamp(a) || 0),
    )
    .map((metric) => ({
      timestamp: getHealthMetricTimestamp(metric),
      value: toFiniteNumber(metric?.value),
    }))
    .filter((metric) => Number.isFinite(metric.value) && metric.value >= 0);
  const legacyStepHistory = sortedEhrHistory.filter((record) => {
    const stepValue = Number(record?.ehr?.steps);
    return Number.isFinite(stepValue) && stepValue >= 0;
  });
  const effectiveStepHistory = stepHistory.length
    ? stepHistory
    : legacyStepHistory.map((record) => ({
        timestamp: record?.timestamp,
        value: toFiniteNumber(record?.ehr?.steps),
      }));
  const latestStepRecord = effectiveStepHistory[0] || null;
  const previousStepRecord = effectiveStepHistory[1] || null;
  const previousRecord = sortedEhrHistory[1] || null;
  const currentSteps = Number(latestStepRecord?.value);
  const previousSteps = Number(previousStepRecord?.value);
  const hasCurrentSteps = Number.isFinite(currentSteps) && currentSteps >= 0;
  const hasPreviousSteps = Number.isFinite(previousSteps) && previousSteps >= 0;
  const stepsDeltaPercent =
    hasCurrentSteps && hasPreviousSteps && previousSteps > 0
      ? Math.round(((currentSteps - previousSteps) / previousSteps) * 100)
      : null;
  const latestStepsDate = latestStepRecord?.timestamp
    ? new Date(latestStepRecord.timestamp)
    : null;
  const isLatestStepsToday = latestStepsDate
    ? latestStepsDate.toDateString() === new Date().toDateString()
    : false;
  const activityGoalProgress = hasCurrentSteps
    ? Math.min(Math.round((currentSteps / 10000) * 100), 100)
    : 0;
  const activityGoalLabel = hasCurrentSteps
    ? `${activityGoalProgress}%`
    : "--";
  const activityStepsLabel = hasCurrentSteps
    ? currentSteps.toLocaleString("en-IN")
    : "--";
  const activityMetricLabel = hasCurrentSteps
    ? isLatestStepsToday
      ? "Steps taken today"
      : "Daily steps"
    : "Steps taken today";
  const activityTrendLabel = hasCurrentSteps
    ? stepsDeltaPercent == null
      ? latestStepsDate?.toLocaleDateString("en-GB") || "Latest recorded steps"
      : `${stepsDeltaPercent > 0 ? "+" : ""}${stepsDeltaPercent}% vs previous record`
    : "No comparison yet";
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
    healthMetricsHistory.length > 0
      ? healthMetricsHistory
          .slice()
          .sort(
            (a, b) =>
              new Date(getHealthMetricTimestamp(b) || 0) -
              new Date(getHealthMetricTimestamp(a) || 0),
          )
          .slice(0, 2)
          .map((metric, index) => ({
            title: String(metric.metric_type || metric.metricType || "Metric")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (char) => char.toUpperCase()),
            date: new Date(getHealthMetricTimestamp(metric)).toLocaleDateString(
              "en-GB",
              {
                month: "short",
                day: "2-digit",
              },
            ),
            tone: index === 0 ? "good" : "alert",
          }))
      : ehrHistory.length > 0
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
  const primaryInteraction = interactionCheckResult?.interactions?.[0] || null;
  const interactionPrimaryMedicine =
    primaryInteraction?.medicine_a ||
    primaryInteraction?.medicineA ||
    medicines[0]?.medicine_name ||
    "Not enough medicines";
  const interactionComparedMedicine =
    primaryInteraction?.medicine_b ||
    primaryInteraction?.medicineB ||
    medicines[1]?.medicine_name ||
    "Add another medicine";
  const interactionSeverityLabel = interactionCheckLoading
    ? "Scanning..."
    : primaryInteraction?.severity
      ? `${primaryInteraction.severity} risk`
      : medicines.length > 1
        ? "No conflict"
        : "Awaiting list";
  const interactionDescription = interactionCheckLoading
    ? "Reviewing your active medicines for known drug-drug interactions."
    : primaryInteraction?.description ||
      interactionCheckResult?.error ||
      (medicines.length > 1
        ? "No known interaction detected across your current medicines."
        : "Add more medicines to run a broader interaction screening across your current list.");
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
      label: "Funds",
      icon: Wallet,
      action: () => setActiveTab("wallet"),
    },
    {
      id: "profile",
      label: "Profile",
      icon: Settings,
      action: () => setActiveTab("profile"),
    },
  ];
  const topNavItems = [
    { id: "home", label: "Home", action: () => setActiveTab("home") },
    { id: "appointments", label: "Appointments", action: () => setActiveTab("appointments") },
    { id: "records", label: "Records", action: () => setActiveTab("records") },
    { id: "profile", label: "Profile", action: () => setActiveTab("profile") },
    { id: "support", label: "Support", action: () => setHealthChatOpen(true) },
  ];
  const quickActionOptions = [
    {
      id: "book-appointment",
      label: "Book Appointment",
      iconClassName: "teal-icon",
      icon: CalendarDays,
      action: () => setActiveTab("appointments"),
    },
    {
      id: "upload-prescription",
      label: "Upload Prescription",
      iconClassName: "mint-icon",
      icon: FileText,
      action: () => navigate("/upload-prescription"),
    },
    {
      id: "add-data",
      label: "Add New Data",
      iconClassName: "teal-icon",
      icon: Plus,
      action: () => navigate("/form"),
    },
    {
      id: "view-history",
      label: "View History",
      iconClassName: "rose-icon",
      icon: FolderHeart,
      action: () => navigate("/new/dashboard"),
    },
    {
      id: "prescriptions",
      label: "My Prescriptions",
      iconClassName: "mint-icon",
      icon: Pill,
      action: () => setActiveTab("prescriptions"),
    },
    {
      id: "records",
      label: "Health Records",
      iconClassName: "blue-icon",
      icon: Activity,
      action: () => setActiveTab("records"),
    },
    {
      id: "recordings",
      label: "Voice Recordings",
      iconClassName: "rose-icon",
      icon: Mic,
      action: () => setActiveTab("recordings"),
    },
    {
      id: "wallet",
      label: "Health Wallet",
      iconClassName: "teal-icon",
      icon: Wallet,
      action: () => setActiveTab("wallet"),
    },
    {
      id: "search-medicine",
      label: "Search Medicine",
      iconClassName: "blue-icon",
      icon: Search,
      action: () => navigate("/search"),
    },
    {
      id: "appointment-history",
      label: "Appointment History",
      iconClassName: "mint-icon",
      icon: Stethoscope,
      action: () => navigate("/appointments/history"),
    },
  ];
  const visibleQuickActions = quickActionOptions.filter((item) =>
    savedQuickActionIds.includes(item.id),
  );

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

  const handleCompleteSpotlightItem = async (item) => {
    if (item.type === "medicine" && item.reminderId != null) {
      handleToggleReminderTaken(item.reminderId);
      return;
    }

    if (item.type === "alert" && item.alertId != null) {
      try {
        await notificationAPI.markAsRead(item.alertId);
      } catch (error) {
        console.error("Failed to mark spotlight alert as read:", error);
      }

      setNotifications((prev) => prev.filter((notification) => notification.id !== item.alertId));
    }
  };

  const handleToggleQuickActionSelection = (quickActionId) => {
    setDraftQuickActionIds((prev) => {
      if (prev.includes(quickActionId)) {
        return prev.filter((id) => id !== quickActionId);
      }

      return [...prev, quickActionId];
    });
  };

  const handleSaveQuickActions = () => {
    const nextQuickActionIds = draftQuickActionIds.length
      ? draftQuickActionIds
      : DEFAULT_QUICK_ACTION_IDS;
    setSavedQuickActionIds(nextQuickActionIds);
    writeQuickActionPrefs(user?.id, nextQuickActionIds);
    setShowCustomizeGridModal(false);
  };

  const recentSpending = walletTransactions
    .filter((tx) => tx.type === "debit")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return (
    <div className="patient-dashboard">
      {showCustomizeGridModal && (
        <div className="dashboard-modal-backdrop" onClick={() => setShowCustomizeGridModal(false)}>
          <div className="dashboard-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-modal-header">
              <div>
                <span className="section-kicker">Customize grid</span>
                <h3>Choose your quick actions</h3>
                <p>Save the home shortcuts you want to keep for future visits.</p>
              </div>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setShowCustomizeGridModal(false)}
              >
                ×
              </button>
            </div>
            <div className="dashboard-modal-options">
              {quickActionOptions.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = draftQuickActionIds.includes(option.id);

                return (
                  <label
                    key={option.id}
                    className={`dashboard-modal-option ${isSelected ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleQuickActionSelection(option.id)}
                    />
                    <span className={`quick-action-icon ${option.iconClassName}`}>
                      <OptionIcon size={20} strokeWidth={2} />
                    </span>
                    <strong>{option.label}</strong>
                  </label>
                );
              })}
            </div>
            <div className="dashboard-modal-actions">
              <button
                type="button"
                className="ghost-link-btn"
                onClick={() => setDraftQuickActionIds(DEFAULT_QUICK_ACTION_IDS)}
              >
                Reset
              </button>
              <button type="button" className="action-btn" onClick={handleSaveQuickActions}>
                Save for future
              </button>
            </div>
          </div>
        </div>
      )}
      {healthChatOpen && (
        <HealthChat
          open={healthChatOpen}
          onClose={() => setHealthChatOpen(false)}
        />
      )}
      <button
        type="button"
        className="patient-sidebar-toggle"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label={sidebarOpen ? "Close dashboard menu" : "Open dashboard menu"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <X size={18} strokeWidth={2.2} /> : <Menu size={18} strokeWidth={2.2} />}
        <span>Menu</span>
      </button>
      {sidebarOpen ? (
        <button
          type="button"
          className="patient-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close dashboard menu overlay"
        />
      ) : null}
      <div className="patient-layout">
        <aside className={`patient-sidebar ${sidebarOpen ? "open" : ""}`}>
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
                  onClick={() => {
                    item.action();
                    setSidebarOpen(false);
                  }}
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
                      <p>User ID: {user?.uniqueCode || "—"}</p>
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

                <div className="home-card quick-action-card-rx" onClick={() => setShowDownloadPadModal(true)}>
                  <div className="home-card-title">
                    <FileText size={16} strokeWidth={2} />
                    <span>Digital Prescription Pad</span>
                  </div>
                  <p>View, print, and save digital prescription pads from your doctors.</p>
                  <button className="ghost-link-btn rx-link-btn">
                    Open Selection Pad
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
                {/* <div className="home-card assistant-panel-card">
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
                    
                  </div> */}

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
                    <h3>{hasAnyMetricData ? `${healthScore}%` : "--"}</h3>
                  </div>
                </div>

                <div className="home-card reminders-spotlight-card">
                  <div className="reminders-spotlight-header">
                    <div className="home-card-title">
                      <Bell size={16} strokeWidth={2} />
                      <span>Critical reminders</span>
                    </div>
                    <span className="reminder-updated-label">
                      {reminderSpotlightItems.length > 0
                        ? `${reminderSpotlightItems.length} active`
                        : `${unreadAlertsCount} alerts`}
                    </span>
                  </div>
                  {reminderSpotlightItems.length > 0 ? (
                    <div className="reminders-spotlight-list">
                      {reminderSpotlightItems.map((item) => {
                        const ItemIcon = item.icon;

                        return (
                          <div key={item.id} className="reminder-spotlight-item">
                            <div
                              className={`reminder-pill-icon ${item.type === "alert" ? "alert" : ""}`}
                            >
                              <ItemIcon size={16} strokeWidth={2} />
                            </div>
                            <div className="reminder-spotlight-copy">
                              <strong>{item.title}</strong>
                              <span>{item.subtitle}</span>
                            </div>
                            <div className="reminder-spotlight-meta">
                              <strong>{item.metaPrimary}</strong>
                              <span>{item.metaSecondary}</span>
                            </div>
                            <button
                              type="button"
                              className="reminder-spotlight-action"
                              onClick={() => handleCompleteSpotlightItem(item)}
                            >
                              Mark as done
                            </button>
                          </div>
                        );
                      })}
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
                            activityGoalProgress,
                            hasCurrentSteps ? 4 : 0,
                          )}%, #dfe9ff 0)`,
                        }}
                      >
                        <div className="activity-ring-inner">{activityGoalLabel}</div>
                      </div>
                      <div className="activity-copy">
                        <h2>{activityStepsLabel}</h2>
                        <span>{activityMetricLabel}</span>
                        <strong>{activityTrendLabel}</strong>
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
                            <strong>{formatTime12Hour(nextAppointment.slot_time, "--")}</strong>
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
                    {visibleQuickActions.map((item) => {
                      const ItemIcon = item.icon;

                      return (
                        <button
                          key={item.id}
                          className="home-card quick-action-card"
                          onClick={item.action}
                        >
                          <span className={`quick-action-icon ${item.iconClassName}`}>
                            <ItemIcon size={22} strokeWidth={2} />
                          </span>
                          <strong>{item.label}</strong>
                        </button>
                      );
                    })}
                    <button
                      className="home-card quick-action-card muted-card"
                      type="button"
                      onClick={() => setShowCustomizeGridModal(true)}
                    >
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
                  {doctorsLoading ? (
                    <div className="selection-state">
                      Loading doctors. If this persists, please refresh the page.
                    </div>
                  ) : doctorsError ? (
                    <div className="selection-state">
                      {doctorsError}
                    </div>
                  ) : doctors.length === 0 ? (
                    <div className="selection-state">
                      No doctors available right now.
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
                  <>
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
                      consultationFee={
                        doctors.find(
                          (d) => String(d.id) === String(selectedDoctorId),
                        )?.consultation_fee
                      }
                    />

                    <div className="doctor-reviews-section" style={{ marginTop: '30px', borderTop: '1px solid #edf2f7', paddingTop: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#10203a' }}>Patient Reviews & Ratings</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffc107' }}>★ {selectedDoctorRating}</span>
                          <span style={{ fontSize: '0.9rem', color: '#6d7985' }}>({selectedDoctorReviewCount} reviews)</span>
                        </div>
                      </div>

                      {reviewsLoading ? (
                        <div style={{ color: '#6d7985', fontSize: '0.95rem' }}>Loading reviews...</div>
                      ) : selectedDoctorReviews.length === 0 ? (
                        <div style={{ color: '#6d7985', fontSize: '0.95rem', fontStyle: 'italic' }}>No reviews yet for this doctor. Be the first to leave a review after your visit!</div>
                      ) : (
                        <div className="reviews-scroll-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                          {selectedDoctorReviews.map((review) => (
                            <div key={review.id} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong style={{ color: '#10203a', fontSize: '0.95rem' }}>{review.patient_name || 'Verified Patient'}</strong>
                                <span style={{ color: '#ffc107', fontWeight: 'bold' }}>
                                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', lineHeight: '1.5' }}>{review.comment || 'No comment provided.'}</p>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>{new Date(review.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
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
                    onClick={() => navigate("/appointments/history")}
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
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  className="prescription-see-pad-cta"
                  onClick={() => setShowDownloadPadModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface)",
                    color: "var(--text)"
                  }}
                >
                  <FileText size={18} strokeWidth={2} className="teal-icon" />
                  See Prescription Pad
                </button>
                <button
                  className="prescription-upload-cta"
                  onClick={() => navigate("/upload-prescription")}
                >
                  <FileText size={18} strokeWidth={2} />
                  Upload New Prescription
                </button>
              </div>
            </div>

            <div className="prescriptions-reference-layout">
              <div className="prescriptions-main-column">
                {/* <div className="prescriptions-block-header">
                  <div className="prescriptions-block-title">
                    <span className="prescriptions-accent-line" />
                    <h3>Active Medications</h3>
                  </div>
                  <span className="prescriptions-count-label">{prescriptionsFoundLabel}</span>
                </div> */}

                {activeMedicationCards.length > 0 ? (
                  <div className="active-medications-grid">
                    {/* {activeMedicationCards.map((med, idx) => (
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
                    ))} */}
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
                        <strong>{interactionSeverityLabel}</strong>
                      </div>
                      <div className="interaction-checker-drugs">
                        <div>
                          <span>Primary</span>
                          <strong>{interactionPrimaryMedicine}</strong>
                        </div>
                        <div>
                          <span>Compared With</span>
                          <strong>{interactionComparedMedicine}</strong>
                        </div>
                      </div>
                      <p>
                        {interactionDescription}
                        {primaryInteraction?.recommendation
                          ? ` Recommendation: ${primaryInteraction.recommendation}`
                          : ""}
                        {!primaryInteraction?.recommendation &&
                        primaryInteraction?.mechanism
                          ? ` Mechanism: ${primaryInteraction.mechanism}`
                          : ""}
                        {interactionCheckResult?.interactions?.length > 1
                          ? ` ${interactionCheckResult.interactions.length} interactions found in total.`
                          : ""}
                        {!interactionCheckLoading &&
                        !primaryInteraction &&
                        medicines.length > 1
                          ? ""
                          : ""}
                      </p>
                      {interactionCheckResult?.error ? (
                        <p className="interaction-checker-meta">
                          Live interaction scan unavailable. Showing current list only.
                        </p>
                      ) : null}
                      {primaryInteraction?.source ? (
                        <p className="interaction-checker-meta">
                          Source: {primaryInteraction.source}
                        </p>
                      ) : null}
                      {primaryInteraction?.confidence != null ? (
                        <p className="interaction-checker-meta">
                          Confidence: {primaryInteraction.confidence}
                        </p>
                      ) : null}
                    </div>
                  <button
                    className="action-btn prescription-verify-btn"
                    onClick={() => setInteractionCheckNonce((value) => value + 1)}
                  >
                    {interactionCheckLoading ? "Checking..." : "Check Interactions"}
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
              <div className="section-intro-actions">
                <button type="button" className="action-btn" onClick={() => navigate("/form")}>
                  <Plus size={16} strokeWidth={2} />
                  Add New Data
                </button>
                <button type="button" className="action-btn" onClick={() => navigate("/health-wallet")}>
                  <FolderHeart size={16} strokeWidth={2} />
                  View All Files & Records 
                  
                </button>
                <button type="button" className="action-btn" onClick={handleDownloadReport}>
                  <Download size={16} strokeWidth={2} />
                  Download Report
                </button>
              </div>
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
                        {hasAnyMetricData ? (
                          <div className="records-symptom-pill">
                            <span className="records-symptom-dot" />
                            <strong>{latestMetricDateLabel}</strong>
                            <small>{visibleMetricCount} metrics</small>
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
                          {hasAnyMetricData
                            ? "Recent health metrics are available for review."
                            : "No diagnostic summary is available yet."}
                        </strong>
                      </div>
                    </div>

                    <div className="records-history-card">
                      <div className="records-history-head">
                        <h4>History</h4>
                        <button type="button" onClick={() => navigate("/new/dashboard")}>View All</button>
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
                  <p>{sortedEhrHistory[0]?.aiInsights || healthSummaryMessage}</p>
                  <div className="records-observation-card">
                    <span>Observation</span>
                    <strong>
                      {sortedEhrHistory[0]?.predictedDisease && sortedEhrHistory[0]?.predictedDisease !== "Agent prediction unavailable"
                        ? `Predicted health condition: ${sortedEhrHistory[0].predictedDisease}${sortedEhrHistory[0].confidence ? ` (Confidence: ${Math.round(Number(sortedEhrHistory[0].confidence) * 100)}%)` : ""}`
                        : latestMetrics?.heartRate != null
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
            {activeQueueAppointment || nextAppointment ? (
              <PatientQueuePosition
                appointmentId={(activeQueueAppointment || nextAppointment).id}
                patientId={user?.id}
                appointmentDate={(activeQueueAppointment || nextAppointment).appointment_date}
                slotTime={(activeQueueAppointment || nextAppointment).slot_time}
                appointmentStatus={(activeQueueAppointment || nextAppointment).status}
                doctorName={(activeQueueAppointment || nextAppointment).doctor_name}
                doctorId={(activeQueueAppointment || nextAppointment).doctor_id}
              />
            ) : (
              <div className="empty-panel">
                <h4>No active queue right now</h4>
                <p>Your queue details appear here after clinic check-in marks the appointment as arrived.</p>
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
                  {Number(walletBalance) > 0 && (
                    <button
                      type="button"
                      className="wallet-transfer-btn"
                      onClick={() => {
                        setWithdrawAmount(String(walletBalance));
                        setShowWithdrawModal(true);
                      }}
                      style={{
                        marginTop: '15px',
                        padding: '10px 18px',
                        background: '#0b7a72',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s',
                      }}
                    >
                      <ArrowRightLeft size={16} />
                      Transfer Funds to Bank Account
                    </button>
                  )}
                </div>

                <div className="wallet-summary-grid">
                  <div className="wallet-summary-card">
                    <span>Current Balance</span>
                    <strong>₹{Number(walletBalance).toFixed(2)}</strong>
                    <small>Live wallet value from your account</small>
                  </div>
                  <div className="wallet-summary-card">
                    <span>Recent Spending</span>
                    <strong>₹{recentSpending.toFixed(2)}</strong>
                    <small>Total amount spent using wallet</small>
                  </div>
                  <div className="wallet-summary-card">
                    <span>Upcoming Hold</span>
                    <strong>₹0.00</strong>
                    <small>No active holds on your wallet balance</small>
                  </div>
                </div>

                <div className="wallet-transactions-card">
                  <div className="wallet-section-head">
                    <h3>Recent Activity</h3>
                    <span>Linked activity feed</span>
                  </div>
                  <div className="wallet-transactions-list">
                    {walletTransactions.length > 0 ? (
                      walletTransactions.map((tx) => (
                        <div className="wallet-transaction-row" key={tx.id}>
                          <div>
                            <strong>{tx.note || tx.source || "Wallet Transaction"}</strong>
                            <span>{new Date(tx.created_at).toLocaleString()}</span>
                          </div>
                          <b className={tx.type === "credit" ? "credit" : "debit"}>
                            {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toFixed(2)}
                          </b>
                        </div>
                      ))
                    ) : (
                      <div className="wallet-transaction-row">
                        <div>
                          <strong>No wallet activity available</strong>
                          <span>Your transaction history will appear here once you make wallet transactions.</span>
                        </div>
                        <b className="debit">₹0.00</b>
                      </div>
                    )}
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
                  <strong>None Scheduled</strong>
                  <p>No scheduled charge is currently attached to your wallet.</p>
                </div>

                <div className="wallet-side-card wallet-support-card">
                  <div className="wallet-side-title">
                    <MessageSquareText size={18} strokeWidth={2} />
                    <h3>Need billing help?</h3>
                  </div>
                  <p>Our care support team can help with refunds, invoice clarifications, and wallet issues.</p>
                  <button type="button" className="wallet-support-btn" onClick={() => setShowSupportModal(true)}>
                    Contact Support
                  </button>
                </div>

                {supportTickets.length > 0 && (
                  <div className="wallet-side-card wallet-tickets-list-card">
                    <div className="wallet-side-title">
                      <ShieldCheck size={18} strokeWidth={2} />
                      <h3>My Support Tickets</h3>
                    </div>
                    <div className="side-tickets-list" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {supportTickets.map((ticket) => (
                        <div key={ticket.id} className="side-ticket-item" style={{ background: '#f5f7f9', padding: '10px 12px', borderRadius: '8px', borderLeft: ticket.status === 'open' ? '3px solid #ff9800' : '3px solid #0b7a72' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#10203a' }}>{ticket.category.toUpperCase()}</span>
                            <span className={`status-badge ${ticket.status}`} style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: ticket.status === 'open' ? '#fff3e0' : '#e0f2f1', color: ticket.status === 'open' ? '#ff9800' : '#0b7a72', fontWeight: 'bold' }}>{ticket.status}</span>
                          </div>
                          <strong style={{ display: 'block', fontSize: '0.9rem', color: '#10203a' }}>{ticket.subject}</strong>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#6d7985', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{ticket.description}</span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#6d7985', marginTop: '6px' }}>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showSupportModal && (
              <div className="dashboard-modal-backdrop" onClick={() => setShowSupportModal(false)}>
                <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="dashboard-modal-header">
                    <div>
                      <span className="section-kicker">Support Ticket</span>
                      <h3>Submit an Issue Ticket</h3>
                      <p>Describe your issue and the support team will get back to you shortly.</p>
                    </div>
                    <button type="button" className="close-modal-btn" onClick={() => setShowSupportModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                  </div>
                  <form onSubmit={handleSupportSubmit} className="dashboard-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Category</label>
                      <select
                        value={supportCategory}
                        onChange={(e) => setSupportCategory(e.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        required
                      >
                        <option value="wallet">Wallet Balance / Refunds</option>
                        <option value="billing">Billing & Invoices</option>
                        <option value="technical">Technical Issue</option>
                        <option value="general">General Inquiry</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Subject</label>
                      <input
                        type="text"
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        placeholder="E.g., Refund not received for cancelled slot"
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Description</label>
                      <textarea
                        value={supportDescription}
                        onChange={(e) => setSupportDescription(e.target.value)}
                        placeholder="Please provide full details of your issue..."
                        rows={4}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
                        required
                      />
                    </div>
                    <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowSupportModal(false)}
                        style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingTicket}
                        style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: '#0b7a72', color: '#fff', cursor: submittingTicket ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                      >
                        {submittingTicket ? "Submitting..." : "Submit Ticket"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {showWithdrawModal && (
              <div className="dashboard-modal-backdrop" onClick={() => setShowWithdrawModal(false)}>
                <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="dashboard-modal-header">
                    <div>
                      <span className="section-kicker">Transfer Funds</span>
                      <h3>Request Transfer to Account</h3>
                      <p>Send a payout request to the admin by specifying the transfer amount and your UPI details.</p>
                    </div>
                    <button type="button" className="close-modal-btn" onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                  </div>
                  <form onSubmit={handleWithdrawSubmit} className="dashboard-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Available Balance</label>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0b7a72', background: '#f0fdfa', padding: '10px', borderRadius: '6px', border: '1px solid #ccfbf1' }}>
                        ₹{Number(walletBalance).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Transfer Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={Number(walletBalance)}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={`Max: ₹${Number(walletBalance).toFixed(2)}`}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>UPI ID</label>
                      <input
                        type="text"
                        value={withdrawUpiId}
                        onChange={(e) => setWithdrawUpiId(e.target.value)}
                        placeholder="E.g., username@bank"
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        required
                      />
                    </div>
                    <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowWithdrawModal(false)}
                        style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isWithdrawing || Number(walletBalance) <= 0}
                        style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: '#0b7a72', color: '#fff', cursor: (isWithdrawing || Number(walletBalance) <= 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                      >
                        {isWithdrawing ? "Submitting..." : "Send Transfer Request"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="tab-content profile-tab">
            <div className="section-intro">
              <div>
                <span className="section-kicker">Profile</span>
                <h2>Manage Your Account</h2>
                <p>Edit your patient details, delete your account, or reset your QR code.</p>
              </div>
            </div>
            <ProfileManager
              title="Patient Profile"
              onQrReset={() => {
                setQrData(null);
                writeDashboardCache(user?.id, {
                  appointments,
                  prescriptions,
                  medicines,
                  notifications,
                  walletBalance,
                  recordings,
                  ehrHistory,
                  healthMetricsHistory,
                  doctors,
                  qrData: null,
                });
              }}
            />
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

      {/* clinician pad selection modal */}
      {showDownloadPadModal && (
        <div className="dashboard-modal-backdrop clinician-selection-modal-overlay no-print" onClick={() => setShowDownloadPadModal(false)}>
          <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h3>Select Clinician Pad</h3>
              <p>Choose a doctor whose digital prescription pad you want to view or download.</p>
              <button className="dashboard-modal-close" onClick={() => setShowDownloadPadModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="dashboard-modal-options selection-options-scroll">
              {groupedPrescriptionPads.map((pad) => {
                const doc = pad.doctor;
                const formattedDate = new Date(pad.latestDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                });
                
                const cleanName = doc.name.replace(/^Dr\.\s+/i, "");
                const nameParts = cleanName.split(" ").filter(Boolean);
                const initials = nameParts.map(part => part[0]).join("").slice(0, 2).toUpperCase() || "DR";

                return (
                  <div key={doc.id || "user-upload"} className="dashboard-modal-option rx-pad-option-card">
                    <div className="rx-pad-avatar">
                      <span>{initials}</span>
                    </div>
                    <div className="rx-pad-option-info" style={{ flexGrow: 1 }}>
                      <strong>{doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`}</strong>
                      <span className="rx-pad-specialty">{doc.specialty}</span>
                      <p className="rx-pad-meta-info">Latest prescription: {formattedDate} • {pad.medicines.length} medicines</p>
                    </div>
                    <button 
                      className="view-rx-pad-btn-premium" 
                      onClick={() => {
                        setSelectedPad(pad);
                        setShowDownloadPadModal(false);
                        setViewingDigitalRx(true);
                      }}
                    >
                      View Pad
                    </button>
                  </div>
                );
              })}
              
              {groupedPrescriptionPads.length === 0 && (
                <div className="empty-panel compact-empty">
                  <h4>No digital prescription pads found</h4>
                  <p>You don't have any prescriptions on file yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Fullscreen Clinical Workspace Overlay */}
      {viewingDigitalRx && selectedPad && (
        <div className="premium-clinical-workspace-overlay no-print">
          <div className="workspace-container">
            {/* Left Column: Interactive Health & Safety Summary */}
            <div className="workspace-sidebar">
              <div className="workspace-sidebar-header">
                <div className="workspace-back-btn" onClick={() => setViewingDigitalRx(false)}>
                  <ChevronRight className="back-arrow-icon" style={{ transform: "rotate(180deg)" }} />
                  <span>Back to Dashboard</span>
                </div>
                <h3>Prescription Workspace</h3>
              </div>

              {/* Doctor Profile Card */}
              <div className="premium-doc-card">
                <div className="premium-doc-avatar">
                  {selectedPad.doctor.name.replace(/^Dr\.\s+/i, "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "DR"}
                </div>
                <div className="premium-doc-details">
                  <h4>{selectedPad.doctor.name.startsWith("Dr.") ? selectedPad.doctor.name : `Dr. ${selectedPad.doctor.name}`}</h4>
                  <span className="doc-specialty-badge">{selectedPad.doctor.specialty}</span>
                  <div className="doc-meta-list">
                    <p><strong>Reg No:</strong> {selectedPad.doctor.reg_no || "TM-DOC-2024-001"}</p>
                    {selectedPad.doctor.email && <p><strong>Email:</strong> {selectedPad.doctor.email}</p>}
                    {selectedPad.doctor.phone && <p><strong>Phone:</strong> {selectedPad.doctor.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Safety Analysis */}
              <div className="safety-analysis-card">
                <h4>Clinical Integrity Scan</h4>
                <div className="safety-scan-row">
                  <div className="safety-metric">
                    <span className="metric-label">Safety Rating</span>
                    <strong className="metric-value green-text">Secure</strong>
                  </div>
                  <div className="safety-metric">
                    <span className="metric-label">Risk Category</span>
                    <strong className="metric-value green-text">Low Risk</strong>
                  </div>
                </div>
                <div className="safety-pill">
                  <ShieldCheck size={16} />
                  <span>Verified by TechMedix AI Safety Audit</span>
                </div>
              </div>

              {/* Visual Pill Intake Schedule */}
              <div className="pill-schedule-timeline">
                <h4>Daily Dosage Schedule</h4>
                <div className="schedule-list">
                  {selectedPad.medicines.filter(m => !m.is_deleted).map((med, index) => (
                    <div key={med.id || index} className="schedule-item">
                      <div className="schedule-item-icon">
                        <Pill size={16} />
                      </div>
                      <div className="schedule-item-content">
                        <strong>{med.medicine_name}</strong>
                        <p>{med.dosage || "1 pill"} • {med.frequency || "Once daily"} • {med.duration || "—"}</p>
                      </div>
                    </div>
                  ))}
                  {selectedPad.medicines.filter(m => !m.is_deleted).length === 0 && (
                    <p className="no-active-schedule">No active medications scheduled.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Virtual Prescription Paper Sheet */}
            <div className="workspace-main-preview">
              <div className="preview-container-wrapper">
                <DigitalPrescription
                  doctor={selectedPad.doctor}
                  patient={{ id: user.id, name: user.name }}
                  medicines={selectedPad.medicines}
                  diagnosis=""
                  notes={selectedPad.medicines.find(m => m.instructions)?.instructions || ""}
                  rxNumber={`RX-${Math.floor(1000 + Math.random() * 9000)}`}
                  isPatientView={true}
                  onSaveToWallet={handleSaveToWallet}
                  isSaving={isWalletSaving}
                  onDownload={handleDownloadPrescription}
                  isDownloading={isDownloadingRx}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
