import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Landmark,
  Mic,
  MicOff,
  QrCode,
  RefreshCcw,
  Search,
  ShieldPlus,
  Stethoscope,
  UserRound,
  Users,
  Wallet,
  Megaphone,
  Menu,
  CreditCard,
  FileText,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../context/AuthContext";
import { appointmentAPI, analyticsAPI, queueAPI } from "../../api/techmedixAPI";
import { subscriptionAPI } from "../../api/techmedixAPI";
import { initQueueSocket } from "../../api/socketService";
import DoctorScheduleManager from "../../components/DoctorScheduleManager/DoctorScheduleManager";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import DoctorPromotions from "../../components/DoctorPromotions/DoctorPromotions";
import { doctorApi, paymentApi, hospitalApi } from "../../api";
import { formatTime12Hour } from "../../utils/dateTime";
import "./DoctorDashboardNew.css";
import DigitalPrescription from "../../components/Prescription/DigitalPrescription";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "queue", label: "Queue", icon: Stethoscope },
  { id: "revenue", label: "Revenue", icon: Landmark },
  { id: "ca_billing", label: "CA Tax & Invoices", icon: FileText },
  { id: "patients", label: "Patient Workspace", icon: UserRound },
  { id: "staff", label: "Staff Hub", icon: Users },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "promotions", label: "Promotions", icon: Megaphone },
  { id: "subscription", label: "Subscription & Hospital Link", icon: CreditCard },
  { id: "profile", label: "Profile", icon: Wallet },
];

const qrRefId = "doctor-dashboard-qr-reader";
const getTodayIso = () => new Date().toISOString().split("T")[0];
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const readErrorMessage = (error, fallback) =>
  error?.response?.data?.error || error?.message || fallback;

function EmptyState({ title, text }) {
  return (
    <div className="doctor-empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, accent = "blue" }) {
  return (
    <article className={`doctor-metric-card accent-${accent}`}>
      <div className="doctor-metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

export default function DoctorDashboardNew() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [earnings, setEarnings] = useState({});
  const [revenueDetails, setRevenueDetails] = useState({
    daily_revenue: [],
    method_breakdown: [],
    recent_payments: [],
    current_month: 0,
    previous_month: 0,
  });
  const [consultationFee, setConsultationFee] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [busyMap, setBusyMap] = useState({});

  // Subscription gating
  const [subStatus, setSubStatus] = useState(null); // null = loading, object = status
  const [subChecked, setSubChecked] = useState(false);
  const [detailedSub, setDetailedSub] = useState(null);
  const [detailedSubLoading, setDetailedSubLoading] = useState(false);

  // Doctor self-subscription (plans + payment modal)
  const [doctorPlans, setDoctorPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [subPayModal, setSubPayModal] = useState(null); // selected plan object | null
  const [subPayPhone, setSubPayPhone] = useState("");
  const [subPayLoading, setSubPayLoading] = useState(false);

  // CA Invoices states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceFilterMethod, setInvoiceFilterMethod] = useState("all");
  const [subPayError, setSubPayError] = useState("");

  const [hospitalRequests, setHospitalRequests] = useState([]);

  const [uniqueCode, setUniqueCode] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [patientHistoryPrescriptions, setPatientHistoryPrescriptions] = useState([]);
  const [prescriptionNumber, setPrescriptionNumber] = useState(`RX-${Math.floor(1000 + Math.random() * 9000)}`);
  const [diagnosis, setDiagnosis] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [patientRecordings, setPatientRecordings] = useState([]);
  const [patientReports, setPatientReports] = useState([]);
  const [patientShareSections, setPatientShareSections] = useState([]);
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineDosage, setNewMedicineDosage] = useState("");
  const [newMedicineFrequency, setNewMedicineFrequency] = useState("");
  const [newMedicineDuration, setNewMedicineDuration] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const [staffMembers, setStaffMembers] = useState([]);
  const [staffRequests, setStaffRequests] = useState([]);
  const [staffPasswords, setStaffPasswords] = useState({});
  const [soloMode, setSoloMode] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "assistant",
    department: "",
    phone: "",
  });

  const doctorDisplayName = (user?.name || "Doctor").replace(/^dr\.?\s+/i, "").trim();
  const patientProfile = patientData?.patient || patientData || null;

  useEffect(() => {
    if (!statusMessage && !error) return undefined;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
      setError("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage, error]);

  const queueStats = useMemo(() => {
    const waiting = queue.filter((item) =>
      ["booked", "arrived", "waiting"].includes(String(item.status || "").toLowerCase()),
    ).length;
    const active = queue.filter((item) =>
      ["in_progress", "in-progress"].includes(String(item.status || "").toLowerCase()),
    ).length;
    const completed = queue.filter((item) =>
      ["completed", "visited"].includes(String(item.status || "").toLowerCase()),
    ).length;

    return { total: queue.length, waiting, active, completed };
  }, [queue]);

  const todaySchedule = useMemo(
    () =>
      appointments
        .slice()
        .sort((a, b) => String(a.slot_time || "").localeCompare(String(b.slot_time || ""))),
    [appointments],
  );

  const monthGrowth = useMemo(() => {
    const currentMonth = Number(revenueDetails.current_month || 0);
    const previousMonth = Number(revenueDetails.previous_month || 0);
    if (previousMonth === 0) {
      return currentMonth > 0 ? 100 : 0;
    }
    return Math.round(((currentMonth - previousMonth) / previousMonth) * 100);
  }, [revenueDetails.current_month, revenueDetails.previous_month]);

  useEffect(() => {
    if (!user?.id) return;
    loadDoctorData(true);
    loadStaffData();
    fetchProfile();
    checkSubscription();
    loadHospitalRequests();
  }, [user?.id, selectedDate]);

  async function checkSubscription() {
    if (!user?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) return;
    try {
      const res = await subscriptionAPI.getDoctorStatus(user.id);
      setSubStatus(res.data?.data || { valid: true, status: "trial" });
    } catch (err) {
      console.warn("Subscription check failed:", err.message);
      // On error, allow access (don't lock out due to API failure)
      setSubStatus({ valid: true, status: "unknown" });
    } finally {
      setSubChecked(true);
    }
  }

  useEffect(() => {
    if (activeView === "subscription" && user?.id) {
      loadDetailedSubscription();
      loadDoctorPlans();
      loadHospitalRequests();
    }
  }, [activeView, user?.id]);

  // Inject Cashfree SDK once
  useEffect(() => {
    if (!document.getElementById("cashfree-sdk")) {
      const s = document.createElement("script");
      s.id = "cashfree-sdk";
      s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  async function loadDetailedSubscription() {
    try {
      setDetailedSubLoading(true);
      const res = await subscriptionAPI.getDoctorSubscription(user.id);
      setDetailedSub(res.data?.data || null);
    } catch (err) {
      console.error("Failed to load detailed subscription:", err);
    } finally {
      setDetailedSubLoading(false);
    }
  }

  async function loadDoctorPlans() {
    try {
      setPlansLoading(true);
      const res = await subscriptionAPI.getPlans();
      const all = res.data?.data || [];
      // Show only individual / doctor type plans (not hospital)
      const doctorOnly = all.filter(
        (p) => !p.plan_type || p.plan_type === "individual" || p.plan_type === "doctor"
      );
      setDoctorPlans(doctorOnly);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setPlansLoading(false);
    }
  }

  async function loadHospitalRequests() {
    if (!user?.id) return;
    try {
      const res = await hospitalApi.getPendingLinkRequests();
      setHospitalRequests(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load hospital requests:", err);
    }
  }

  async function handleResolveHospitalRequest(requestId, responseStatus) {
    await withBusy(`hosp-request-${requestId}`, async () => {
      try {
        await hospitalApi.respondToLinkRequest(requestId, responseStatus);
        setStatusMessage(`Invite from hospital successfully ${responseStatus}.`);
        await loadHospitalRequests();
        await checkSubscription();
        await loadDetailedSubscription();
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Failed to respond to request.");
      }
    });
  }

  async function handleDoctorSubscribePay() {
    if (!subPayModal) return;
    setSubPayLoading(true);
    setSubPayError("");
    try {
      // Step 1: Create Cashfree order
      const initRes = await subscriptionAPI.initiatePayment(subPayModal.id, subPayPhone);
      const { payment_session_id, cashfree_order_id, cashfree_mode } = initRes.data;
      if (!payment_session_id) throw new Error("Failed to create payment session.");

      // Step 2: Launch Cashfree checkout modal
      const cfMode = cashfree_mode === "production" ? "production" : "sandbox";
      const cashfree = window.Cashfree({ mode: cfMode });
      const result = await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: "_modal",
      });
      if (result?.error) throw new Error(result.error.message || "Payment was not completed.");

      // Step 3: Verify + activate
      await subscriptionAPI.verifyPayment(cashfree_order_id, subPayModal.id);

      setStatusMessage(`Subscribed to ${subPayModal.name}! Your subscription is now active.`);
      setSubPayModal(null);
      await checkSubscription();
      await loadDetailedSubscription();
    } catch (err) {
      setSubPayError(err?.response?.data?.error || err.message || "Payment failed.");
    } finally {
      setSubPayLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return undefined;

    const socket = initQueueSocket();
    const handleQueueUpdate = (payload) => {
      if (payload?.doctor_id && String(payload.doctor_id).toLowerCase() !== String(user.id).toLowerCase()) {
        return;
      }

      loadDoctorData();
    };
    const handleStaffNotifyDoctor = (payload) => {
      if (payload?.doctor_id && String(payload.doctor_id).toLowerCase() !== String(user.id).toLowerCase()) {
        return;
      }

      const msg = payload?.message || `${payload?.staff_name || "Staff"} marked a patient ready.`;
      setStatusMessage(msg);
      // window.alert(`🔔 Notification from Reception:\n\n${msg}`);
      loadDoctorData();
    };

    const joinRoom = () => {
      socket.emit("join-doctor-room", user.id);
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);
    socket.on("queue-update", handleQueueUpdate);
    socket.on("staff-notify-doctor", handleStaffNotifyDoctor);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("queue-update", handleQueueUpdate);
      socket.off("staff-notify-doctor", handleStaffNotifyDoctor);
    };
  }, [user?.id, selectedDate]);

  useEffect(() => {
    let qrScanner;

    async function startScanner() {
      try {
        qrScanner = new Html5Qrcode(qrRefId);
        await qrScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          async (decodedText) => {
            setUniqueCode(decodedText);
            setScannerVisible(false);
            try {
              await qrScanner.stop();
            } catch {}
            await searchPatient(decodedText);
          },
        );
      } catch (scannerError) {
        setError(readErrorMessage(scannerError, "Unable to start QR scanner"));
        setScannerVisible(false);
      }
    }

    if (scannerVisible) {
      startScanner();
    }

    return () => {
      if (qrScanner) {
        try {
          qrScanner.stop();
        } catch {}
      }
    };
  }, [scannerVisible]);

  async function fetchProfile() {
    setProfileLoading(true);
    try {
      const response = await doctorApi.getProfile();
      const profile = response.data?.data;
      if (profile) {
        setConsultationFee(Number(profile.consultation_fee || 0));
      }
    } catch (profileError) {
      setError(readErrorMessage(profileError, "Failed to load doctor profile"));
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadDoctorData(initialLoad = false) {
    if (!user?.id) return;

    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    setError("");

    try {
      const [queueRes, appointmentsRes, analyticsRes, earningsRes, revenueRes] =
        await Promise.allSettled([
          queueAPI.getForDoctor(user.id, selectedDate),
          appointmentAPI.getByDoctor(user.id, selectedDate),
          analyticsAPI.getDoctorStats(user.id),
          paymentApi.getDoctorSummary(user.id),
          paymentApi.getDoctorRevenueDetails(user.id),
        ]);

      const nextAppointments =
        appointmentsRes.status === "fulfilled"
          ? appointmentsRes.value.data?.data || []
          : [];

      let nextQueue =
        queueRes.status === "fulfilled"
          ? queueRes.value.data?.data?.queue || []
          : [];

      if (nextQueue.length === 0 && nextAppointments.length > 0) {
        nextQueue = nextAppointments.map((appointment, index) => ({
          appointment_id: appointment.id,
          patient_name: appointment.patient_name,
          token_number: appointment.token_number || index + 1,
          position_in_queue: index + 1,
          status: appointment.status || "booked",
          slot_time: appointment.slot_time || null,
        }));
      }

      setAppointments(nextAppointments);
      setQueue(nextQueue);
      setAnalytics(
        analyticsRes.status === "fulfilled" ? analyticsRes.value.data?.data || {} : {},
      );
      setEarnings(earningsRes.status === "fulfilled" ? earningsRes.value.data || {} : {});
      setRevenueDetails(
        revenueRes.status === "fulfilled"
          ? revenueRes.value.data || {
              daily_revenue: [],
              method_breakdown: [],
              recent_payments: [],
              current_month: 0,
              previous_month: 0,
            }
          : {
              daily_revenue: [],
              method_breakdown: [],
              recent_payments: [],
              current_month: 0,
              previous_month: 0,
            },
      );

      const firstFailure = [
        queueRes,
        appointmentsRes,
        analyticsRes,
        earningsRes,
        revenueRes,
      ].find((result) => result.status === "rejected");

      if (firstFailure) {
        setError(
          readErrorMessage(firstFailure.reason, "Some dashboard panels could not be loaded"),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadStaffData() {
    try {
      const [staffRes, requestRes] = await Promise.allSettled([
        doctorApi.getMyStaff(),
        doctorApi.getStaffRequests(),
      ]);

      setStaffMembers(
        staffRes.status === "fulfilled" ? staffRes.value.data?.data || [] : [],
      );
      setStaffRequests(
        requestRes.status === "fulfilled" ? requestRes.value.data?.data || [] : [],
      );
    } catch (staffError) {
      setError(readErrorMessage(staffError, "Failed to load staff hub"));
    }
  }

  async function loadPatientPrescriptions(patientId) {
    try {
      const response = await fetch(`/api/v2/prescriptions/patient/${patientId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch prescriptions");
      }

      const payload = await response.json();
      const prescriptions = payload.data || payload || [];

      const medicines = Array.isArray(prescriptions)
        ? prescriptions.flatMap((entry) => {
            if (entry.medicines && Array.isArray(entry.medicines)) {
              return entry.medicines.map(m => ({
                ...m,
                doctor_id: m.doctor_id || entry.doctor_id,
                doctor_name: m.doctor_name || entry.doctor_name,
                created_at: m.created_at || entry.created_at
              }));
            }
            if (entry.medicine_name || entry.name) {
              return [{
                ...entry,
                medicine_name: entry.medicine_name || entry.name,
                doctor_id: entry.doctor_id,
                doctor_name: entry.doctor_name
              }];
            }
            return [];
          })
        : [];

      setPatientHistoryPrescriptions(medicines);
      
      // Filter active items prescribed by current doctor
      const currentDoctorMeds = medicines.filter(m => {
        const isMyId = m.doctor_id && String(m.doctor_id) === String(user?.id);
        const nameMatch = m.doctor_name && String(user?.name) && 
                         String(m.doctor_name).toLowerCase().includes(String(user?.name).toLowerCase());
        const belongsToMe = isMyId || nameMatch;
        return belongsToMe && !m.is_deleted;
      });
      setPatientPrescriptions(currentDoctorMeds);

      await loadPatientRecordings(patientId);
    } catch (prescriptionError) {
      setError(readErrorMessage(prescriptionError, "Failed to load patient treatment data"));
    }
  }

  async function loadPatientRecordings(patientId) {
    try {
      const recordingsResponse = await fetch(`/api/recordings/patient/${patientId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      const recordingsPayload = await recordingsResponse.json();
      setPatientRecordings(
        recordingsResponse.ok && Array.isArray(recordingsPayload) ? recordingsPayload : [],
      );
    } catch {
      setPatientRecordings([]);
    }
  }

  async function handleConsentRecording(recordingId, consent) {
    try {
      const response = await fetch(`/api/recordings/${recordingId}/consent`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ consent }),
      });
      if (response.ok) {
        if (patientData?.patient?.id) {
          await loadPatientRecordings(patientData.patient.id);
        }
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to update recording consent");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadPatientReports(patientId, appointmentId = null) {
    try {
      const apptQuery = appointmentId ? `?appointmentId=${appointmentId}` : "";
      const [reportsResponse, walletResponse] = await Promise.allSettled([
        fetch(`/api/doctor/patients/${patientId}/reports${apptQuery}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          credentials: "include",
        }),
        fetch(`/api/doctor/patients/${patientId}/wallet-documents${apptQuery}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          credentials: "include",
        }),
      ]);

      const reportsPayload =
        reportsResponse.status === "fulfilled" ? await reportsResponse.value.json() : null;
      const walletPayload =
        walletResponse.status === "fulfilled" ? await walletResponse.value.json() : null;

      // If the backend says share_all_files=false and provides shared_file_ids,
      // the wallet-documents endpoint already pre-filters. For reports, we pass through all.
      const reports =
        reportsResponse.status === "fulfilled" && reportsResponse.value.ok
          ? (reportsPayload?.data || []).map((report) => ({
              id: `report-${report.id}`,
              file_name: report.file_name,
              file_url: report.secure_url || report.file_path,
              source: "report",
              created_at: report.created_at,
            }))
          : [];

      const walletDocs =
        walletResponse.status === "fulfilled" && walletResponse.value.ok
          ? (walletPayload?.data || [])
              .filter((doc) => String(doc.patient_id || patientId) === String(patientId))
              .map((doc) => ({
                id: `wallet-${doc.id}`,
                file_name: doc.file_name,
                file_url: doc.file_url,
                source: "health_wallet",
                created_at: doc.created_at,
              }))
          : [];

      setPatientReports(
        [...reports, ...walletDocs].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        ),
      );
    } catch {
      setPatientReports([]);
    }
  }

  async function searchPatient(code = uniqueCode) {
    if (!code) return;

    try {
      setError("");
      const response = await doctorApi.getPatientData(code);
      const payload = response.data;
      const patient = payload?.patient || payload;
      setPatientData(payload);
      setPatientShareSections(payload?.allowed_sections || []);
      setActiveView("patients");
      if (patient?.id) {
        await Promise.all([
          loadPatientPrescriptions(patient.id),
          loadPatientReports(patient.id),
          loadPatientRecordings(patient.id),
        ]);
      }
    } catch (searchError) {
      setError(readErrorMessage(searchError, "Patient not found"));
    }
  }

  async function withBusy(key, action) {
    setBusyMap((current) => ({ ...current, [key]: true }));
    setStatusMessage("");
    try {
      await action();
    } catch (busyError) {
      setError(readErrorMessage(busyError, "Action failed"));
    } finally {
      setBusyMap((current) => ({ ...current, [key]: false }));
    }
  }

  async function openQueuedPatient(appointmentId) {
    await withBusy(`open-patient-${appointmentId}`, async () => {
      const response = await doctorApi.getSharedAppointmentContext(appointmentId);
      const payload = response.data || {};
      const patient = payload.patient;
      setPatientData({
        patient: payload.patient,
        ehrHistory: payload.ehrHistory || [],
        appointment: payload.appointment || null,
      });
      setPatientShareSections(payload.allowed_sections || []);
      setActiveView("patients");
      if (patient?.id) {
        await Promise.all([
          loadPatientPrescriptions(patient.id),
          loadPatientReports(patient.id, appointmentId),
          loadPatientRecordings(patient.id),
        ]);
      }
      if (!payload.appointment?.share_history) {
        setStatusMessage("This patient did not share health history for this appointment.");
      }
    });
  }

  async function handleSaveConsultationFee() {
    await withBusy("save-fee", async () => {
      await doctorApi.updateProfile({
        consultation_fee: Number(consultationFee),
      });
      setStatusMessage("Consultation fee updated.");
    });
  }

  async function handleStartConsultation(appointmentId) {
    await withBusy(`start-${appointmentId}`, async () => {
      await queueAPI.markArrived(appointmentId);
      await queueAPI.startConsultation(appointmentId);
      setStatusMessage("Consultation started.");
      await loadDoctorData();
    });
  }

  async function handleCompleteConsultation(appointmentId) {
    await withBusy(`complete-${appointmentId}`, async () => {
      await queueAPI.completeConsultation(appointmentId);
      setQueue((current) =>
        current.filter((entry) => entry.appointment_id !== appointmentId),
      );
      setAppointments((current) =>
        current.map((entry) =>
          entry.id === appointmentId ? { ...entry, status: "completed" } : entry,
        ),
      );
      setStatusMessage("Consultation completed.");
    });
  }

  async function handleMarkCashPaid(paymentId) {
    await withBusy(`cash-${paymentId}`, async () => {
      await paymentApi.markCashPaid({ payment_id: paymentId });
      setStatusMessage("Cash payment marked received.");
      await loadDoctorData();
    });
  }

  async function handleSoloOpenPatient(appointment) {
    if (appointment?.id) {
      await openQueuedPatient(appointment.id);
    }
  }

  async function handleCreateStaff(event) {
    event.preventDefault();
    await withBusy("create-staff", async () => {
      const submittedPassword = staffForm.password;
      const response = await doctorApi.createStaff(staffForm);
      const createdStaffId = response.data?.data?.id;
      if (createdStaffId && submittedPassword) {
        setStaffPasswords((current) => ({
          ...current,
          [createdStaffId]: submittedPassword,
        }));
      }
      setStaffForm({
        name: "",
        email: "",
        username: "",
        password: "",
        role: "assistant",
        department: "",
        phone: "",
      });
      setStatusMessage("Staff account created.");
      await loadStaffData();
    });
  }

  async function handleResolveStaffRequest(requestId, status) {
    await withBusy(`request-${requestId}-${status}`, async () => {
      await doctorApi.resolveStaffRequest(requestId, status);
      setStatusMessage(`Staff request ${status}.`);
      await loadStaffData();
    });
  }

  async function handleRemoveStaff(staffId) {
    await withBusy(`remove-staff-${staffId}`, async () => {
      await doctorApi.removeStaff(staffId);
      setStatusMessage("Staff access removed.");
      await loadStaffData();
    });
  }

  async function handleResetStaffPassword(staffId) {
    await withBusy(`reset-password-${staffId}`, async () => {
      const response = await doctorApi.resetStaffPassword(staffId);
      const nextPassword = response.data?.data?.temporary_password || "";
      if (nextPassword) {
        setStaffPasswords((current) => ({ ...current, [staffId]: nextPassword }));
        setStatusMessage(`Temporary password reset for staff member ${staffId}.`);
      }
    });
  }

  async function startRecording() {
    try {
      setError("");
      setIsRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
    } catch (recordingError) {
      setIsRecording(false);
      setError(readErrorMessage(recordingError, "Microphone access denied"));
    }
  }

  function stopRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }

  async function uploadRecording() {
    if (!audioBlob || !patientProfile?.id) {
      setError("Select a patient and record audio first");
      return;
    }

    await withBusy("upload-recording", async () => {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("patient_id", patientProfile.id);

      const liveAppointment = appointments.find(
        (entry) =>
          entry.patient_name === patientProfile.name &&
          ["booked", "arrived", "in_progress"].includes(entry.status),
      );

      if (liveAppointment?.id) {
        formData.append("appointment_id", liveAppointment.id);
      }

      await doctorApi.uploadRecording(formData);
      setAudioBlob(null);
      setAudioURL("");
      setStatusMessage("Voice prescription uploaded.");
      await loadPatientPrescriptions(patientProfile.id);
    });
  }

  async function handleAddMedicine() {
    if (!newMedicineName || !patientProfile?.id) {
      setError("Select a patient and enter a medicine name");
      return;
    }

    // Optimistic UI updates
    const optimisticMed = {
      id: `temp-${Date.now()}`,
      medicine_name: newMedicineName,
      dosage: newMedicineDosage,
      frequency: newMedicineFrequency,
      duration: newMedicineDuration,
      doctor_id: user?.id,
      doctor_name: user?.name,
      is_optimistic: true
    };
    setPatientPrescriptions(prev => [...prev, optimisticMed]);

    await withBusy("add-medicine", async () => {
      try {
        const response = await fetch("/api/prescriptions/manual", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            patient_id: patientProfile.id,
            medicine_name: newMedicineName,
            dosage: newMedicineDosage,
            frequency: newMedicineFrequency,
            duration: newMedicineDuration,
            doctor_id: user?.id,
            doctor_name: user?.name
          }),
        });

        if (!response.ok) throw new Error("Failed to add medicine");

        setNewMedicineName("");
        setNewMedicineDosage("");
        setNewMedicineFrequency("");
        setNewMedicineDuration("");
        setStatusMessage("Medicine added successfully.");
        await loadPatientPrescriptions(patientProfile.id);
      } catch (err) {
        setPatientPrescriptions(prev => prev.filter(m => m.id !== optimisticMed.id));
        setError(err.message);
      }
    });
  }

  async function handleCopyMedicineToPad(med) {
    if (!med.medicine_name || !patientProfile?.id) return;

    const optimisticMed = {
      id: `temp-${Date.now()}`,
      medicine_name: med.medicine_name,
      dosage: med.dosage || "",
      frequency: med.frequency || "",
      duration: med.duration || "",
      doctor_id: user?.id,
      doctor_name: user?.name,
      is_optimistic: true
    };
    setPatientPrescriptions(prev => [...prev, optimisticMed]);

    await withBusy("add-medicine", async () => {
      try {
        const response = await fetch("/api/prescriptions/manual", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            patient_id: patientProfile.id,
            medicine_name: med.medicine_name,
            dosage: med.dosage || "",
            frequency: med.frequency || "",
            duration: med.duration || "",
            doctor_id: user?.id,
            doctor_name: user?.name
          }),
        });

        if (!response.ok) throw new Error("Failed to add medicine");

        setStatusMessage("Medicine added to your prescription pad.");
        await loadPatientPrescriptions(patientProfile.id);
      } catch (err) {
        setPatientPrescriptions(prev => prev.filter(m => m.id !== optimisticMed.id));
        setError(err.message);
      }
    });
  }

  async function handleFinalizePrescription() {
    if (!patientProfile?.id || patientPrescriptions.length === 0) {
      setError("Please add at least one medicine before finalizing.");
      return;
    }

    await withBusy("finalize-rx", async () => {
      setStatusMessage(`Prescription finalized and sent to ${patientProfile.name}.`);
      setPrescriptionNumber(`RX-${Math.floor(1000 + Math.random() * 9000)}`);
    });
  }

  async function updatePrescriptionMedicine(medicine) {
    const medicineId =
      medicine.id ||
      medicine.medicine_id ||
      medicine.prescription_medicine_id ||
      medicine.pm_id ||
      medicine._id;

    if (!medicineId) {
      setError("Medicine ID missing for this prescription entry");
      return;
    }

    const name = window.prompt("Enter new medicine name", medicine.medicine_name || "");
    if (name === null) return;
    const dosage = window.prompt("Enter new dosage", medicine.dosage || "");
    if (dosage === null) return;
    const frequency = window.prompt("Enter new frequency", medicine.frequency || "");
    if (frequency === null) return;
    const duration = window.prompt("Enter new duration", medicine.duration || "");
    if (duration === null) return;

    await withBusy(`edit-medicine-${medicineId}`, async () => {
      const response = await fetch(`/api/v2/prescriptions/medicine/${medicineId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ medicine_name: name, dosage, frequency, duration }),
      });

      if (!response.ok) {
        throw new Error("Failed to update medicine");
      }

      setStatusMessage("Prescription updated.");
      await loadPatientPrescriptions(patientProfile.id);
    });
  }

  async function stopPrescriptionMedicine(medicine) {
    const medicineId =
      medicine.medicine_id ||
      medicine.id ||
      medicine.prescription_medicine_id ||
      medicine.pm_id ||
      medicine._id;

    if (!medicineId) {
      setError("Medicine ID missing for this prescription entry");
      return;
    }

    await withBusy(`delete-medicine-${medicineId}`, async () => {
      const response = await fetch(`/api/v2/prescriptions/medicine/${medicineId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to stop medicine");
      }

      setStatusMessage("Medicine removed from active prescription.");
      await loadPatientPrescriptions(patientProfile.id);
    });
  }

  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div className="doctor-dashboard-shell doctor-dashboard-loading">
          <div className="doctor-loading-panel">
            <span className="doctor-loading-spinner" />
            <p>Building your clinical workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  // Subscription wall — block access if subscription expired
  if (subChecked && subStatus && !subStatus.valid) {
    return (
      <div className="doctor-dashboard">
        <div className="doctor-sub-wall">
          <div className="doctor-sub-wall-card">
            <div className="sub-wall-icon">🔒</div>
            <h2>Subscription Required</h2>
            <p className="sub-wall-message">{subStatus.message}</p>
            <div className="sub-wall-details">
              {subStatus.trial_end_date && (
                <p>Trial ended: <strong>{new Date(subStatus.trial_end_date).toLocaleDateString()}</strong></p>
              )}
              {subStatus.paid_end_date && (
                <p>Subscription ended: <strong>{new Date(subStatus.paid_end_date).toLocaleDateString()}</strong></p>
              )}
            </div>
            <p className="sub-wall-contact">
              Please contact the TechMedix admin to activate or renew your subscription.
            </p>
            <a href="mailto:techmedixcare@gmail.com" className="sub-wall-btn">Contact Admin</a>
          </div>
        </div>
      </div>
    );
  }

  const handleExportCSV = (payments) => {
    const headers = ["Invoice ID", "Date", "Patient Name", "Payment Method", "Base Amount (INR)", "GST (18%)", "Total Amount (INR)", "Status"];
    const rows = payments.map(payment => {
      const invId = `INV-${payment.id.substring(0, 8).toUpperCase()}`;
      const date = new Date(payment.created_at).toLocaleDateString();
      const patientName = payment.patient_name || "Patient";
      const method = payment.payment_method;
      const baseAmt = (payment.amount - payment.amount * 0.18).toFixed(2);
      const gst = (payment.amount * 0.18).toFixed(2);
      const total = payment.amount.toFixed(2);
      const status = "Paid";
      return [invId, date, patientName, method, baseAmt, gst, total, status];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CA_Ledger_Dr_${(user?.name || "Doctor").replace(/\s+/g, "_")}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="doctor-dashboard">
      <div className="doctor-dashboard-shell">
        <header className="doctor-command-bar">
          <div className="doctor-command-copy">
            <span className="doctor-kicker">Doctor Command Center</span>
            <h1>Dr. {doctorDisplayName}</h1>
            <p>
              Review your practice performance, run consultations, manage staff,
              and work patient cases from a cleaner doctor workspace.
            </p>
            {subStatus?.status === "trial" && subStatus?.days_left != null && (
              <span className="doctor-trial-badge">
                🟢 Free Trial — {subStatus.days_left} days remaining
              </span>
            )}
          </div>

          <div className="doctor-command-actions">
            <div className="doctor-date-filter">
              <label htmlFor="doctor-dashboard-date">Day</label>
              <input
                id="doctor-dashboard-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>

            <div className="doctor-fee-editor">
              <label htmlFor="doctor-fee">Consultation Fee</label>
              <div className="doctor-fee-input-wrap">
                <span>₹</span>
                <input
                  id="doctor-fee"
                  type="number"
                  min="0"
                  value={consultationFee}
                  onChange={(event) => setConsultationFee(Number(event.target.value || 0))}
                  disabled={profileLoading}
                />
                <button
                  type="button"
                  onClick={handleSaveConsultationFee}
                  disabled={busyMap["save-fee"] || profileLoading}
                >
                  Save
                </button>
              </div>
            </div>

            <button
              type="button"
              className="doctor-secondary-button"
              onClick={() => loadDoctorData()}
              disabled={refreshing}
            >
              <RefreshCcw size={16} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        {(statusMessage || error) && (
          <div className={`doctor-banner ${error ? "is-error" : "is-success"}`}>
            <span>{error || statusMessage}</span>
            <button
              type="button"
              className="doctor-banner-close"
              onClick={() => {
                setStatusMessage("");
                setError("");
              }}
            >
              Close
            </button>
          </div>
        )}

        <div className="doctor-workspace">
          <div
            className="doctor-sidebar-container"
            onMouseEnter={() => setIsSidebarOpen(true)}
            onMouseLeave={() => setIsSidebarOpen(false)}
          >
            <button
              type="button"
              className="doctor-hamburger-btn"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>

            <aside className={`doctor-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
              <div className="doctor-sidebar-card">
                <span className="doctor-sidebar-label">Navigation</span>
                <div className="doctor-sidebar-nav">
                  {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={activeView === id ? "active" : ""}
                      onClick={() => {
                        setActiveView(id);
                        setIsSidebarOpen(false);
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="doctor-sidebar-card">
                <span className="doctor-sidebar-label">Today at a glance</span>
                <div className="doctor-mini-stats">
                  <div>
                    <strong>{appointments.length}</strong>
                    <span>Appointments</span>
                  </div>
                  <div>
                    <strong>{queueStats.waiting}</strong>
                    <span>Waiting</span>
                  </div>
                  <div>
                    <strong>{formatMoney(earnings.today_earnings)}</strong>
                    <span>Today’s revenue</span>
                  </div>
                </div>
              </div>

              {/* <div className="doctor-sidebar-card">
                <span className="doctor-sidebar-label">Patient Search</span>
                <form
                  className="doctor-quick-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    searchPatient();
                  }}
                >
                  <input
                    type="text"
                    value={uniqueCode}
                    onChange={(event) => setUniqueCode(event.target.value)}
                    placeholder="Patient code"
                  />
                  <button type="submit">
                    <Search size={16} />
                  </button>
                </form>
                <button
                  type="button"
                  className="doctor-secondary-button doctor-secondary-button--full"
                  onClick={() => setScannerVisible((current) => !current)}
                >
                  <QrCode size={16} />
                  {scannerVisible ? "Close Scanner" : "Scan QR"}
                </button>
              </div> */}
            </aside>
          </div>

          <main className="doctor-main">
            {activeView === "overview" && (
              <>
                <section className="doctor-metrics-grid">
                  <MetricCard
                    icon={CalendarDays}
                    label="Appointments"
                    value={appointments.length}
                    detail={`For ${selectedDate}`}
                    accent="blue"
                  />
                  <MetricCard
                    icon={Clock3}
                    label="Waiting Patients"
                    value={queueStats.waiting}
                    detail={`${queueStats.active} in progress now`}
                    accent="teal"
                  />
                  <MetricCard
                    icon={Wallet}
                    label="Today’s Revenue"
                    value={formatMoney(earnings.today_earnings)}
                    detail={`${earnings.total_paid_appointments || 0} paid visits`}
                    accent="amber"
                  />
                  <MetricCard
                    icon={Activity}
                    label="Completion Rate"
                    value={`${analytics.completion_rate || 0}%`}
                    detail={`Avg consult ${analytics.avg_consultation_time || 0} min`}
                    accent="rose"
                  />
                </section>

                <section className="doctor-layout">
                  <article className="doctor-panel">
                    <div className="doctor-panel-heading">
                      <div>
                        <span>Practice Snapshot</span>
                        <h2>Operational summary</h2>
                      </div>
                    </div>
                    <div className="doctor-summary-grid">
                      <div className="doctor-summary-card">
                        <strong>{queueStats.completed}</strong>
                        <span>Completed today</span>
                      </div>
                      <div className="doctor-summary-card">
                        <strong>{analytics.patients_today || 0}</strong>
                        <span>Patients handled</span>
                      </div>
                      <div className="doctor-summary-card">
                        <strong>{formatMoney(earnings.monthly_earnings)}</strong>
                        <span>This month</span>
                      </div>
                      <div className="doctor-summary-card">
                        <strong>{`${analytics.no_show_rate || 0}%`}</strong>
                        <span>No-show rate</span>
                      </div>
                    </div>
                  </article>

                  {/* <article className="doctor-panel">
                    <div className="doctor-panel-heading">
                      <div>
                        <span>Quick Focus</span>
                        <h2>Where to go next</h2>
                      </div>
                    </div>
                    <div className="doctor-priority-list">
                      <button
                        type="button"
                        className="doctor-priority-card"
                        onClick={() => setActiveView("queue")}
                      >
                        <strong>Open Queue</strong>
                        <p>Manage waiting patients and start consultations.</p>
                      </button>
                      <button
                        type="button"
                        className="doctor-priority-card"
                        onClick={() => setActiveView("revenue")}
                      >
                        <strong>Review Revenue</strong>
                        <p>Inspect payment trend, methods, and recent collections.</p>
                      </button>
                      <button
                        type="button"
                        className="doctor-priority-card"
                        onClick={() => setActiveView("schedule")}
                      >
                        <strong>Update Schedule</strong>
                        <p>Adjust weekly availability and slot duration.</p>
                      </button>
                    </div>
                  </article> */}
                </section>
              </>
            )}

            {activeView === "queue" && (
              <section className="doctor-layout-grid">
                <article className="doctor-panel doctor-panel--queue">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Live Queue</span>
                      <h2>Patient flow for {selectedDate}</h2>
                    </div>
                    <div className="doctor-chip-row">
                      <span className="doctor-chip">{queueStats.waiting} waiting</span>
                      <span className="doctor-chip">{queueStats.active} active</span>
                    </div>
                  </div>

                  {queue.length === 0 ? (
                    <EmptyState
                      title="No queue yet"
                      text="Queue entries will appear here as appointments arrive."
                    />
                  ) : (
                    <div className="doctor-queue-list">
                      {queue.map((entry) => (
                        <div key={entry.appointment_id} className="doctor-queue-item">
                          <div className="doctor-token-badge">
                            #{entry.token_number || entry.position_in_queue || "-"}
                          </div>
                          <div className="doctor-queue-copy">
                            <button
                              type="button"
                              className="doctor-link-button"
                              onClick={() => openQueuedPatient(entry.appointment_id)}
                              disabled={busyMap[`open-patient-${entry.appointment_id}`]}
                            >
                              {entry.patient_name}
                            </button>
                            <p>
                              Position {entry.position_in_queue || "-"} •{" "}
                              {String(entry.status || "booked").replace("_", " ")}
                            </p>
                          </div>
                          <div className="doctor-queue-actions">
                            {["booked", "arrived"].includes(entry.status) && (
                              <button
                                type="button"
                                className="doctor-primary-button"
                                onClick={() => handleStartConsultation(entry.appointment_id)}
                                disabled={busyMap[`start-${entry.appointment_id}`]}
                              >
                                Start
                              </button>
                            )}
                            {["in_progress", "arrived"].includes(entry.status) && (
                              <button
                                type="button"
                                className="doctor-secondary-button"
                                onClick={() => handleCompleteConsultation(entry.appointment_id)}
                                disabled={busyMap[`complete-${entry.appointment_id}`]}
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Appointments</span>
                      <h2>Day board</h2>
                    </div>
                  </div>

                  {todaySchedule.length === 0 ? (
                    <EmptyState
                      title="No appointments scheduled"
                      text="Your confirmed appointments will appear here."
                    />
                  ) : (
                    <div className="doctor-appointments-list">
                      {todaySchedule.map((appointment) => (
                        <div key={appointment.id} className="doctor-appointment-card">
                          <div className="doctor-appointment-meta">
                            <strong>{appointment.patient_name}</strong>
                            <span>{formatTime12Hour(appointment.slot_time, "Time pending")}</span>
                          </div>
                          <p>
                            Status:{" "}
                            <span className="doctor-inline-pill">{appointment.status}</span>
                          </p>
                          <p>
                            Payment: {appointment.payment_status || "N/A"} /{" "}
                            {appointment.payment_method || "-"}
                          </p>
                          <div className="doctor-inline-actions">
                            {appointment.payment_method === "cash" &&
                              appointment.payment_status === "due" &&
                              appointment.payment_id && (
                                <button
                                  type="button"
                                  className="doctor-link-button"
                                  onClick={() => handleMarkCashPaid(appointment.payment_id)}
                                  disabled={busyMap[`cash-${appointment.payment_id}`]}
                                >
                                  Mark paid
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            )}

            {activeView === "revenue" && (
              <>
                <section className="doctor-metrics-grid">
                  <MetricCard
                    icon={Wallet}
                    label="Total Revenue"
                    value={formatMoney(revenueDetails.total_earnings)}
                    detail="Collected from paid appointments"
                    accent="amber"
                  />
                  <MetricCard
                    icon={Landmark}
                    label="This Month"
                    value={formatMoney(revenueDetails.current_month)}
                    detail={`${monthGrowth >= 0 ? "+" : ""}${monthGrowth}% vs last month`}
                    accent="blue"
                  />
                  <MetricCard
                    icon={Activity}
                    label="Online Payments"
                    value={formatMoney(revenueDetails.online_earnings)}
                    detail="Digital collections"
                    accent="teal"
                  />
                  <MetricCard
                    icon={Clock3}
                    label="Cash Payments"
                    value={formatMoney(revenueDetails.cash_earnings)}
                    detail="Counter collections"
                    accent="rose"
                  />
                </section>

                <section className="doctor-layout-grid">
                  <article className="doctor-panel">
                    <div className="doctor-panel-heading">
                      <div>
                        <span>Daily Trend</span>
                        <h2>Last 14 days</h2>
                      </div>
                    </div>
                    {revenueDetails.daily_revenue?.length ? (
                      <div className="doctor-trend-list">
                        {revenueDetails.daily_revenue.map((entry) => (
                          <div key={String(entry.day)} className="doctor-trend-row">
                            <div>
                              <strong>
                                {new Date(entry.day).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </strong>
                              <span>{entry.payment_count} payments</span>
                            </div>
                            <b>{formatMoney(entry.revenue)}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No revenue trend yet"
                        text="Paid payments will populate this trend."
                      />
                    )}
                  </article>

                  <article className="doctor-panel">
                    <div className="doctor-panel-heading">
                      <div>
                        <span>Method Split</span>
                        <h2>Collection channels</h2>
                      </div>
                    </div>
                    {revenueDetails.method_breakdown?.length ? (
                      <div className="doctor-trend-list">
                        {revenueDetails.method_breakdown.map((entry) => (
                          <div key={entry.payment_method} className="doctor-trend-row">
                            <div>
                              <strong>{entry.payment_method}</strong>
                              <span>{entry.payment_count} payments</span>
                            </div>
                            <b>{formatMoney(entry.revenue)}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No breakdown available"
                        text="Payment methods will appear here after collections start."
                      />
                    )}
                  </article>
                </section>

                <section className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Recent Payments</span>
                      <h2>Latest paid appointments</h2>
                    </div>
                  </div>
                  {revenueDetails.recent_payments?.length ? (
                    <div className="doctor-table-wrap">
                      <table className="doctor-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Date</th>
                            <th>Slot</th>
                            <th>Method</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueDetails.recent_payments.map((payment) => (
                            <tr key={payment.id}>
                              <td>{payment.patient_name || "Unknown patient"}</td>
                              <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                              <td>{payment.slot_time || "-"}</td>
                              <td>{payment.payment_method}</td>
                              <td>{formatMoney(payment.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="No recent payments"
                      text="Paid appointments will be listed here once revenue starts flowing."
                    />
                  )}
                </section>
              </>
            )}

            {activeView === "ca_billing" && (
              <>
                {/* CA Summary Cards */}
                <section className="doctor-metrics-grid">
                  <MetricCard
                    icon={Wallet}
                    label="Gross Taxable Revenue"
                    value={formatMoney(revenueDetails.total_earnings)}
                    detail="Aggregated paid consultations"
                    accent="amber"
                  />
                  <MetricCard
                    icon={ShieldPlus}
                    label="Estimated GST/Tax (18%)"
                    value={formatMoney(revenueDetails.total_earnings * 0.18)}
                    detail="Simulated standard service levy"
                    accent="blue"
                  />
                  <MetricCard
                    icon={Landmark}
                    label="Net Doctor Earnings"
                    value={formatMoney(revenueDetails.total_earnings - revenueDetails.total_earnings * 0.18)}
                    detail="Revenue minus tax estimate"
                    accent="teal"
                  />
                  <MetricCard
                    icon={FileText}
                    label="Total Invoices"
                    value={revenueDetails.recent_payments?.length || 0}
                    detail="Generated printable ledgers"
                    accent="rose"
                  />
                </section>

                <article className="doctor-panel">
                  <div className="doctor-panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span>Tax & Accounting Ledger</span>
                      <h2>Chartered Accountant Payouts & Invoices</h2>
                    </div>
                    <button
                      className="doctor-btn primary"
                      style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                      onClick={() => handleExportCSV(revenueDetails.recent_payments || [])}
                      disabled={!revenueDetails.recent_payments?.length}
                    >
                      Export CA Ledger (CSV)
                    </button>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="invoice-filters" style={{ display: "flex", gap: "16px", margin: "16px 0", alignItems: "center" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", backgroundColor: "var(--color-bg-dark)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "4px 12px" }}>
                      <Search size={16} style={{ color: "var(--color-text-muted)", marginRight: "8px" }} />
                      <input
                        type="text"
                        placeholder="Search patient name..."
                        value={invoiceSearchQuery}
                        onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                        style={{ border: "none", background: "transparent", color: "var(--color-text)", outline: "none", width: "100%", padding: "8px 0" }}
                      />
                    </div>
                    <select
                      value={invoiceFilterMethod}
                      onChange={(e) => setInvoiceFilterMethod(e.target.value)}
                      style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-dark)", color: "var(--color-text)", outline: "none" }}
                    >
                      <option value="all">All Methods</option>
                      <option value="online">Online Payments</option>
                      <option value="cash">Cash Payments</option>
                      <option value="wallet">Wallet Payments</option>
                    </select>
                  </div>

                  {/* Ledger Table */}
                  {(() => {
                    const filtered = (revenueDetails.recent_payments || []).filter(item => {
                      const matchesSearch = (item.patient_name || "").toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                      const matchesMethod = invoiceFilterMethod === "all" || String(item.payment_method).toLowerCase() === invoiceFilterMethod.toLowerCase();
                      return matchesSearch && matchesMethod;
                    });

                    return filtered.length ? (
                      <div className="doctor-table-wrap">
                        <table className="doctor-table">
                          <thead>
                            <tr>
                              <th>Invoice ID</th>
                              <th>Date</th>
                              <th>Patient</th>
                              <th>Base Amount</th>
                              <th>GST (18%)</th>
                              <th>Total Paid</th>
                              <th>Method</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((payment) => (
                              <tr key={payment.id}>
                                <td style={{ fontWeight: "700" }}>INV-{payment.id.substring(0, 8).toUpperCase()}</td>
                                <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                                <td>{payment.patient_name || "Unknown patient"}</td>
                                <td>{formatMoney(payment.amount - payment.amount * 0.18)}</td>
                                <td>{formatMoney(payment.amount * 0.18)}</td>
                                <td style={{ fontWeight: "700", color: "var(--color-primary)" }}>{formatMoney(payment.amount)}</td>
                                <td><span style={{ textTransform: "capitalize" }}>{payment.payment_method}</span></td>
                                <td style={{ textAlign: "right" }}>
                                  <button
                                    className="doctor-btn secondary compact"
                                    style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                    onClick={() => setSelectedInvoice(payment)}
                                  >
                                    View Invoice
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        title="No invoices matched"
                        text="Try adjusting your filter or search query."
                      />
                    );
                  })()}
                </article>
              </>
            )}

            {activeView === "patients" && (
              <section className="doctor-patient-workspace">
                <article className="doctor-panel doctor-panel--search">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Patient Intake</span>
                      <h2>Search or scan a patient</h2>
                    </div>
                  </div>

                  <div className="doctor-patient-search-grid">
                    <form
                      className="doctor-patient-search-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        searchPatient();
                      }}
                    >
                      <input
                        type="text"
                        value={uniqueCode}
                        onChange={(event) => setUniqueCode(event.target.value)}
                        placeholder="Enter patient unique code"
                        required
                      />
                      <button type="submit" className="doctor-primary-button">
                        <Search size={16} />
                        Search
                      </button>
                    </form>

                    <button
                      type="button"
                      className="doctor-secondary-button"
                      onClick={() => setScannerVisible((current) => !current)}
                    >
                      <QrCode size={16} />
                      {scannerVisible ? "Close Scanner" : "Open QR Scanner"}
                    </button>
                    <button
                      type="button"
                      className="doctor-secondary-button"
                      onClick={() => setActiveView("queue")}
                    >
                      Go to Queue
                    </button>
                  </div>

                  {scannerVisible && (
                    <div className="doctor-scanner-shell">
                      <div id={qrRefId} />
                    </div>
                  )}
                </article>

                {!patientProfile ? (
                  <article className="doctor-panel">
                    <EmptyState
                      title="No patient selected"
                      text="Use a patient code or QR scan to open the case workspace."
                    />
                  </article>
                ) : (
                  <div className="patient-workspace-container">
                    <div className="patient-builder-column">
                      
                      {/* Patient Profile */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <span>Patient Profile</span>
                            <h2>{patientProfile.name}</h2>
                          </div>
                          <div className="doctor-chip-row">
                            <span className="doctor-chip">{patientProfile.age || "N/A"} yrs</span>
                            <span className="doctor-chip">{patientProfile.gender || "Unknown"}</span>
                          </div>
                        </div>

                        <div className="doctor-detail-grid">
                          <div>
                            <span>Email</span>
                            <strong>{patientProfile.email || "Not available"}</strong>
                          </div>
                          <div>
                            <span>Phone</span>
                            <strong>{patientProfile.phone || "Not available"}</strong>
                          </div>
                          <div>
                            <span>Unique Code</span>
                            <strong>
                              {patientProfile.uniqueCode ||
                                patientProfile.unique_code ||
                                uniqueCode}
                            </strong>
                          </div>
                        </div>

                        {patientData?.appointment?.share_history === false ? (
                          <div className="doctor-history-card">
                            <strong>Sharing disabled</strong>
                            <p>The patient did not share health history for this appointment.</p>
                          </div>
                        ) : null}

                        {patientShareSections.length > 0 ? (
                          <div className="doctor-history-list">
                            <h3>Shared with doctor</h3>
                            <div className="doctor-chip-row">
                              {patientShareSections.map((section) => (
                                <span key={section} className="doctor-chip">
                                  {section}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {patientShareSections.includes("ehr") &&
                        patientData?.ehrHistory?.length > 0 && (
                          <div className="doctor-history-list">
                            <h3>Medical record snapshots</h3>
                            {patientData.ehrHistory.slice(0, 4).map((record, index) => (
                              <div key={`${record.timestamp || index}`} className="doctor-history-card">
                                <strong>
                                  {new Date(record.timestamp).toLocaleDateString()}
                                </strong>
                                <p>
                                  Predicted disease: {record.predictedDisease || "Not available"}
                                </p>
                                <p>{record.aiInsights || "No AI insight stored for this record."}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {patientShareSections.includes("metrics") &&
                        (patientData?.latestMetrics?.length > 0 || patientProfile?.latestMetrics?.length > 0) && (
                          <div className="doctor-history-list" style={{ marginTop: "16px" }}>
                            <h3>Shared Health Metrics (Vitals)</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "8px" }}>
                              {(patientData?.latestMetrics || patientProfile?.latestMetrics || []).map((m) => (
                                <div key={m.metric_type} className="doctor-history-card" style={{ margin: 0, padding: "10px", background: "rgba(14, 116, 144, 0.04)" }}>
                                  <strong style={{ fontSize: "0.75rem", textTransform: "capitalize", color: "var(--doctor-muted)" }}>
                                    {m.metric_type.replace("_", " ")}
                                  </strong>
                                  <div style={{ fontSize: "1.15rem", fontWeight: "700", margin: "4px 0" }}>
                                    {Number(m.value).toFixed(1)} <span style={{ fontSize: "0.75rem", fontWeight: "normal" }}>{m.unit}</span>
                                  </div>
                                  <small style={{ fontSize: "0.65rem", color: "var(--doctor-muted)" }}>
                                    {new Date(m.recorded_at).toLocaleDateString()}
                                  </small>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>

                      {/* Medicine Builder Form */}
                      <article className="doctor-panel medicine-builder-panel">
                        <div className="doctor-panel-heading">
                          <div className="builder-header">
                            <span className="builder-label">Prescription Builder</span>
                            <h2>Add and adjust treatment</h2>
                          </div>
                        </div>

                        {!patientData?.appointment?.share_history ? (
                          <EmptyState
                            title="Patient history not shared"
                            text="Queue access opened the patient profile only. Historical records stay hidden for this appointment."
                          />
                        ) : null}

                        <div className="medicine-input-form">
                           <div className="input-group">
                              <label>Medicine Name</label>
                              <input
                                placeholder="e.g. Dolo 650"
                                value={newMedicineName}
                                onChange={(e) => setNewMedicineName(e.target.value)}
                              />
                           </div>
                           <div className="form-row-multi">
                              <div className="input-group">
                                <label>Dosage</label>
                                <input
                                  placeholder="650mg"
                                  value={newMedicineDosage}
                                  onChange={(e) => setNewMedicineDosage(e.target.value)}
                                />
                              </div>
                              <div className="input-group">
                                <label>Frequency</label>
                                <input
                                  placeholder="1-0-1"
                                  value={newMedicineFrequency}
                                  onChange={(e) => setNewMedicineFrequency(e.target.value)}
                                />
                              </div>
                              <div className="input-group">
                                <label>Duration</label>
                                <input
                                  placeholder="5 Days"
                                  value={newMedicineDuration}
                                  onChange={(e) => setNewMedicineDuration(e.target.value)}
                                />
                              </div>
                           </div>
                           <button 
                              type="button"
                              className="add-medicine-btn"
                              onClick={handleAddMedicine}
                              disabled={busyMap["add-medicine"]}
                           >
                              Add Medicine
                           </button>
                        </div>
                      </article>

                      {/* Active Prescription Pad */}
                      <article className="doctor-panel active-pad-panel">
                        <div className="doctor-panel-heading">
                           <h2>Active Prescription Pad</h2>
                           <span className="count-pill">{patientPrescriptions.length} items</span>
                        </div>
                        
                        <div className="medicines-table-container">
                          {patientPrescriptions.length === 0 ? (
                            <p>No active medicines in pad. Start by adding medicines above.</p>
                          ) : (
                            <table className="doctor-table medicines-table">
                               <thead>
                                  <tr>
                                     <th>Medicine</th>
                                     <th>Dosage</th>
                                     <th>Freq</th>
                                     <th>Dur</th>
                                     <th>Actions</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {patientPrescriptions.map((med, idx) => (
                                    <tr key={med.id || idx}>
                                       <td>
                                          <strong>{med.medicine_name}</strong>
                                          {med.salt_name && <small style={{ display: 'block', color: 'var(--doctor-muted)', fontSize: '0.75rem' }}>{med.salt_name}</small>}
                                       </td>
                                       <td>{med.dosage || "—"}</td>
                                       <td>{med.frequency || "—"}</td>
                                       <td>{med.duration || "—"}</td>
                                       <td className="actions-cell">
                                          <button 
                                            type="button"
                                            onClick={() =>
                                              window.location.assign(
                                                `/search?medicine=${encodeURIComponent(med.medicine_name)}`,
                                              )
                                            }
                                          >
                                            Compare
                                          </button>
                                          <button type="button" onClick={() => updatePrescriptionMedicine(med)}>Edit</button>
                                          <button type="button" className="del-btn" onClick={() => stopPrescriptionMedicine(med)}>Stop</button>
                                       </td>
                                    </tr>
                                  ))}
                               </tbody>
                            </table>
                          )}
                        </div>
                      </article>

                      {/* All Doctors History List */}
                      <article className="doctor-panel medicines-list-panel">
                        <div className="doctor-panel-heading">
                           <h2>Previous Prescription Pad</h2>
                           <span className="count-pill">{patientHistoryPrescriptions.length} items</span>
                        </div>
                        
                        <div className="medicines-table-container">
                          {patientHistoryPrescriptions.length === 0 ? (
                            <p>No medicine history records available.</p>
                          ) : (
                            <table className="doctor-table medicines-table">
                               <thead>
                                  <tr>
                                     <th>Medicine</th>
                                     <th>Prescribed By</th>
                                     <th>Details</th>
                                     <th>Status</th>
                                     <th>Actions</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {patientHistoryPrescriptions.map((med, idx) => {
                                    const prescBy = med.doctor_name || "Unknown Doctor";
                                    const isCurrentActive = patientPrescriptions.some(
                                      pm => pm.medicine_name?.toLowerCase() === med.medicine_name?.toLowerCase()
                                    );
                                    return (
                                      <tr key={med.id || idx} style={{ opacity: med.is_deleted ? 0.6 : 1 }}>
                                         <td><strong>{med.medicine_name}</strong></td>
                                         <td>{prescBy}</td>
                                         <td>{med.dosage} • {med.frequency} • {med.duration}</td>
                                         <td>{med.is_deleted ? "Stopped" : "Active"}</td>
                                         <td className="actions-cell">
                                            {!isCurrentActive && (
                                              <button type="button" onClick={() => handleCopyMedicineToPad(med)}>Add to Pad</button>
                                            )}
                                         </td>
                                      </tr>
                                    );
                                  })}
                               </tbody>
                            </table>
                          )}
                        </div>
                      </article>

                      {/* Diagnosis & Instructions */}
                      <div className="builder-extra-fields">
                        <article className="doctor-panel">
                           <div className="doctor-panel-heading">
                              <h2>Diagnosis Section</h2>
                           </div>
                           <textarea 
                              placeholder="Enter diagnosis findings..."
                              value={diagnosis}
                              onChange={(e) => setDiagnosis(e.target.value)}
                              className="builder-textarea"
                           />
                        </article>
                        <article className="doctor-panel">
                           <div className="doctor-panel-heading">
                              <h2>Additional Instructions</h2>
                           </div>
                           <textarea 
                              placeholder="Notes for the patient..."
                              value={additionalNotes}
                              onChange={(e) => setAdditionalNotes(e.target.value)}
                              className="builder-textarea"
                           />
                        </article>
                      </div>

                      <button 
                          type="button"
                          className="finalize-btn"
                          onClick={handleFinalizePrescription}
                          disabled={busyMap["finalize-rx"]}
                      >
                          Finalize & Send to Patient
                      </button>

                      {/* Voice prescription / recordings */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <h3>Voice Prescription</h3>
                            <p>Capture a quick note and attach it to the patient case.</p>
                          </div>
                        </div>
                        <div className="doctor-recording-panel">
                          <div className="doctor-inline-actions">
                            {!isRecording ? (
                              <button
                                type="button"
                                className="doctor-secondary-button"
                                onClick={startRecording}
                              >
                                <Mic size={16} />
                                Start Recording
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="doctor-danger-button"
                                onClick={stopRecording}
                              >
                                <MicOff size={16} />
                                Stop
                              </button>
                            )}
                            <button
                              type="button"
                              className="doctor-primary-button"
                              onClick={uploadRecording}
                              disabled={!audioURL || busyMap["upload-recording"]}
                            >
                              Upload Note
                            </button>
                          </div>
                          {audioURL && <audio controls src={audioURL} className="doctor-audio-player" />}
                        </div>
                      </article>

                      {/* Patient Voice Notes History */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <span>Patient Voice Notes</span>
                            <h2>Recent recordings</h2>
                          </div>
                        </div>

                        {!patientShareSections.includes("recordings") ? (
                          <EmptyState
                            title="Recordings not shared"
                            text="The patient did not share recordings for this appointment."
                          />
                        ) : patientRecordings.length === 0 ? (
                          <EmptyState
                            title="No recordings yet"
                            text="Uploaded voice notes and prescription recordings will appear here."
                          />
                        ) : (
                          <div className="doctor-recordings-list">
                            {patientRecordings.slice(0, 5).map((recording) => (
                              <div key={recording.id} className="doctor-recording-card">
                                <div className="doctor-recording-meta">
                                  <strong>
                                    {recording.appointment_date
                                      ? new Date(recording.appointment_date).toLocaleDateString()
                                      : new Date(recording.created_at).toLocaleDateString()}
                                  </strong>
                                  <span>Recorded case note</span>
                                </div>
                                <audio controls src={recording.file_url} />
                                <div className="recording-consent-footer" style={{ marginTop: "12px", borderTop: "1px solid var(--doctor-line)", paddingTop: "12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.8rem" }}>
                                      <span style={{ marginRight: "10px" }}>Patient Share: <strong style={{ color: recording.patient_consent === "rejected" ? "#a8443b" : "#0d8d76" }}>{recording.patient_consent === "rejected" ? "Rejected" : "Approved"}</strong></span>
                                      <span>Doctor Share: <strong style={{ color: recording.doctor_consent === "rejected" ? "#a8443b" : "#0d8d76" }}>{recording.doctor_consent === "rejected" ? "Rejected" : "Approved"}</strong></span>
                                    </div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      {recording.doctor_consent === "rejected" ? (
                                        <button
                                          type="button"
                                          className="doctor-primary-button"
                                          style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px", boxShadow: "none" }}
                                          onClick={() => handleConsentRecording(recording.id, "approved")}
                                        >
                                          Approve Sharing
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="doctor-secondary-button"
                                          style={{ padding: "6px 12px", fontSize: "0.75rem", borderColor: "#a8443b", color: "#a8443b", borderRadius: "8px" }}
                                          onClick={() => handleConsentRecording(recording.id, "rejected")}
                                        >
                                          Reject Sharing
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>

                      {/* Shared files / Reports */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <span>Reports and Uploads</span>
                            <h2>Shared files</h2>
                          </div>
                        </div>

                        {!patientShareSections.includes("reports") ? (
                          <EmptyState
                            title="Reports not shared"
                            text="The patient did not share reports, scans, or wallet uploads for this appointment."
                          />
                        ) : patientReports.length === 0 ? (
                          <EmptyState
                            title="No shared files yet"
                            text="Shared PDFs, scans, and uploads will appear here."
                          />
                        ) : (
                          <div className="doctor-recordings-list">
                            {patientReports.slice(0, 8).map((report) => (
                              <div key={report.id} className="doctor-recording-card">
                                <div className="doctor-recording-meta">
                                  <strong>{report.file_name}</strong>
                                   <a
                                  href={report.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="doctor-link-button"
                                >
                                  Open file
                                </a>
                                </div>
                               
                              </div>
                            ))}
                          </div>
                        )}
                      </article>

                    </div>

                    {/* Sticky Live Preview Column */}
                    <div className="patient-preview-column">
                        <DigitalPrescription 
                           doctor={{ 
                             name: user?.name, 
                             specialty: user?.specialty || "Practitioner",
                             email: user?.email,
                             phone: user?.phone,
                             reg_no: user?.reg_no
                           }}
                           patient={patientProfile}
                           medicines={patientPrescriptions}
                           diagnosis={diagnosis}
                           notes={additionalNotes}
                           rxNumber={prescriptionNumber}
                        />
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeView === "staff" && (
              <section className="doctor-layout-grid">
                <article className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Working Mode</span>
                      <h2>Staff support preference</h2>
                    </div>
                  </div>

                  <div className="doctor-inline-actions">
                    <button
                      type="button"
                      className={soloMode ? "doctor-secondary-button" : "doctor-primary-button"}
                      onClick={() => setSoloMode(false)}
                    >
                      I Have Staff
                    </button>
                    <button
                      type="button"
                      className={soloMode ? "doctor-primary-button" : "doctor-secondary-button"}
                      onClick={() => setSoloMode(true)}
                    >
                      I Manage Alone
                    </button>
                  </div>

                  <p className="doctor-helper-text">
                    {soloMode
                      ? "Solo mode shows front-desk style controls here so you can manage without staff."
                      : "Staff mode keeps the focus on creating and managing your support team."}
                  </p>
                </article>

                {soloMode ? (
                  <article className="doctor-panel">
                    <div className="doctor-panel-heading">
                      <div>
                        <span>Solo Desk</span>
                        <h2>Front-desk controls for today</h2>
                      </div>
                    </div>

                    {todaySchedule.length === 0 ? (
                      <EmptyState
                        title="No appointments scheduled"
                        text="Today's appointments will appear here for solo handling."
                      />
                    ) : (
                      <div className="doctor-appointments-list">
                        {todaySchedule.map((appointment) => (
                          <div key={appointment.id} className="doctor-appointment-card">
                            <div className="doctor-appointment-meta">
                              <strong>{appointment.patient_name}</strong>
                              <span>{formatTime12Hour(appointment.slot_time, "Time pending")}</span>
                            </div>
                            <p>
                              Status:{" "}
                              <span className="doctor-inline-pill">{appointment.status}</span>
                            </p>
                            <p>
                              Payment: {appointment.payment_status || "N/A"} /{" "}
                              {appointment.payment_method || "-"}
                            </p>
                            <div className="doctor-inline-actions">
                              <button
                                type="button"
                                className="doctor-link-button"
                                onClick={() => handleSoloOpenPatient(appointment)}
                                disabled={busyMap[`open-patient-${appointment.id}`]}
                              >
                                Open Patient
                              </button>
                              {appointment.payment_method === "cash" &&
                                appointment.payment_status === "due" &&
                                appointment.payment_id && (
                                  <button
                                    type="button"
                                    className="doctor-link-button"
                                    onClick={() => handleMarkCashPaid(appointment.payment_id)}
                                    disabled={busyMap[`cash-${appointment.payment_id}`]}
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              {["booked", "arrived"].includes(appointment.status) && (
                                <button
                                  type="button"
                                  className="doctor-link-button"
                                  onClick={() => handleStartConsultation(appointment.id)}
                                  disabled={busyMap[`start-${appointment.id}`]}
                                >
                                  Start
                                </button>
                              )}
                              {["in_progress", "arrived"].includes(appointment.status) && (
                                <button
                                  type="button"
                                  className="doctor-link-button"
                                  onClick={() => handleCompleteConsultation(appointment.id)}
                                  disabled={busyMap[`complete-${appointment.id}`]}
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ) : null}

                <article className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Staff Builder</span>
                      <h2>Create a new staff account</h2>
                    </div>
                  </div>

                  <form className="doctor-form-grid doctor-form-grid--staff" onSubmit={handleCreateStaff}>
                    <input
                      placeholder="Full name"
                      value={staffForm.name}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={staffForm.email}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, email: event.target.value }))
                      }
                      required
                    />
                    <input
                      placeholder="Username"
                      value={staffForm.username}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={staffForm.password}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, password: event.target.value }))
                      }
                      required
                    />
                    <input
                      placeholder="Assignment role"
                      value={staffForm.role}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, role: event.target.value }))
                      }
                    />
                    <input
                      placeholder="Department"
                      value={staffForm.department}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, department: event.target.value }))
                      }
                    />
                    <input
                      placeholder="Phone"
                      value={staffForm.phone}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                    <button
                      type="submit"
                      className="doctor-primary-button doctor-primary-button--full"
                      disabled={busyMap["create-staff"]}
                    >
                      <Users size={16} />
                      Create Staff Member
                    </button>
                  </form>
                </article>

                <article className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Assigned Team</span>
                      <h2>Current staff members</h2>
                    </div>
                  </div>

                  {staffMembers.length === 0 ? (
                    <EmptyState
                      title="No staff assigned"
                      text="Create or approve a staff member to build your support team."
                    />
                  ) : (
                    <div className="doctor-staff-list">
                      {staffMembers.map((member) => (
                        <div key={member.id} className="doctor-staff-card">
                          <div>
                            <strong>{member.name}</strong>
                            <p>{member.email}</p>
                            <span>
                              {member.assignment_role || "assistant"} •{" "}
                              {member.department || "General"}
                            </span>
                            {staffPasswords[member.id] ? (
                              <p>Temporary password: {staffPasswords[member.id]}</p>
                            ) : null}
                          </div>
                          <div className="doctor-inline-actions">
                            <button
                              type="button"
                              className="doctor-link-button"
                              onClick={() => handleResetStaffPassword(member.id)}
                              disabled={busyMap[`reset-password-${member.id}`]}
                            >
                              Reset Password
                            </button>
                            <button
                              type="button"
                              className="doctor-link-button danger"
                              onClick={() => handleRemoveStaff(member.id)}
                              disabled={busyMap[`remove-staff-${member.id}`]}
                            >
                              Remove Access
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="doctor-panel">
                  <div className="doctor-panel-heading">
                    <div>
                      <span>Pending Requests</span>
                      <h2>Staff approvals</h2>
                    </div>
                  </div>

                  {staffRequests.length === 0 ? (
                    <EmptyState
                      title="No pending requests"
                      text="Incoming access requests from staff will show up here."
                    />
                  ) : (
                    <div className="doctor-staff-list">
                      {staffRequests.map((request) => (
                        <div key={request.id} className="doctor-staff-card">
                          <div>
                            <strong>{request.staff_name}</strong>
                            <p>{request.staff_email}</p>
                            <span>{request.department || "General"}</span>
                          </div>
                          <div className="doctor-inline-actions">
                            <button
                              type="button"
                              className="doctor-primary-button"
                              onClick={() => handleResolveStaffRequest(request.id, "approved")}
                              disabled={busyMap[`request-${request.id}-approved`]}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="doctor-secondary-button"
                              onClick={() => handleResolveStaffRequest(request.id, "rejected")}
                              disabled={busyMap[`request-${request.id}-rejected`]}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            )}

            {activeView === "schedule" && (
              <section className="doctor-panel doctor-panel--schedule">
                <div className="doctor-panel-heading">
                  <div>
                    <span>Availability Studio</span>
                    <h2>Shape your weekly consultation rhythm</h2>
                  </div>
                </div>
                <DoctorScheduleManager doctorId={user?.id} />
              </section>
            )}

            {activeView === "promotions" && (
              <section className="doctor-panel doctor-panel--promotions">
                <DoctorPromotions doctorId={user?.id} />
              </section>
            )}

            {activeView === "profile" && (
              <section className="doctor-panel doctor-panel--schedule">
                <ProfileManager title="Doctor Profile" roleOverride="doctor" />
              </section>
            )}

            {activeView === "subscription" && (
              <section className="doctor-panel doctor-subscription-view">
                <div className="doctor-panel-heading">
                  <div>
                    <span>Subscription Details</span>
                    <h2>Practice Coverage & Billing</h2>
                  </div>
                </div>

                {detailedSubLoading ? (
                  <div className="doctor-loading-panel">
                    <span className="doctor-loading-spinner" />
                    <p>Fetching subscription details...</p>
                  </div>
                ) : (
                  <div className="doctor-sub-details-grid">
                    {/* Hospital Covered Banner */}
                    {subStatus?.status === "hospital_covered" && (
                      <div className="sub-status-card hospital-covered">
                        <div className="card-icon">🏢</div>
                        <div className="card-content">
                          <h3>Hospital Corporate Coverage</h3>
                          <p>Your practice access is covered under <strong>{subStatus.hospital_name}</strong>'s subscription package.</p>
                          <small>All billing and slot allocation is managed by your hospital administration.</small>
                        </div>
                      </div>
                    )}

                    {/* Pending Hospital link requests */}
                    {hospitalRequests.length > 0 && (
                      <div className="sub-info-card hospital-invites-card">
                        <h3>Hospital Coverage Invites</h3>
                        <p className="sub-info-row-desc" style={{ fontSize: "0.82rem", color: "var(--doctor-muted)", marginBottom: "14px" }}>
                          Invited hospitals offer to include your practice under their subscription plan.
                        </p>
                        <div className="invite-items-list" style={{ display: "grid", gap: "10px" }}>
                          {hospitalRequests.map((req) => (
                            <div key={req.id} className="invite-item" style={{ background: "#f4f8f6", padding: "12px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <strong style={{ display: "block", fontSize: "0.9rem" }}>{req.hospital_name}</strong>
                                <span style={{ fontSize: "0.78rem", color: "var(--doctor-muted)" }}>{req.hospital_email}</span>
                              </div>
                              <div className="invite-actions" style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="sub-plan-card__btn"
                                  style={{ padding: "6px 12px", fontSize: "0.78rem", background: "linear-gradient(135deg, #0d8d76, #0b6152)" }}
                                  onClick={() => handleResolveHospitalRequest(req.id, "accepted")}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="sub-plan-card__btn"
                                  style={{ padding: "6px 12px", fontSize: "0.78rem", background: "none", border: "1.5px solid #c83f5f", color: "#c83f5f", boxShadow: "none" }}
                                  onClick={() => handleResolveHospitalRequest(req.id, "rejected")}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard details card */}
                    <div className="sub-info-card">
                      <h3>Active Coverage</h3>
                      <div className="sub-info-rows">
                        <div className="sub-info-row">
                          <span>Current Status</span>
                          <strong className={`status-badge-val ${subStatus?.status}`}>
                            {subStatus?.status === "trial" ? "Free Trial" :
                             subStatus?.status === "active" ? "Active Paid" :
                             subStatus?.status === "hospital_covered" ? "Hospital Covered" : "Expired"}
                          </strong>
                        </div>
                        
                        {subStatus?.status === "trial" && (
                          <>
                            <div className="sub-info-row">
                              <span>Trial Ends On</span>
                              <strong>{subStatus?.trial_end_date ? new Date(subStatus.trial_end_date).toLocaleDateString() : "N/A"}</strong>
                            </div>
                            <div className="sub-info-row">
                              <span>Remaining Time</span>
                              <strong>{subStatus?.days_left} Days</strong>
                            </div>
                          </>
                        )}

                        {(subStatus?.status === "active" || subStatus?.status === "hospital_covered") && subStatus?.paid_end_date && (
                          <div className="sub-info-row">
                            <span>Coverage Until</span>
                            <strong>{new Date(subStatus.paid_end_date).toLocaleDateString()}</strong>
                          </div>
                        )}

                        {detailedSub?.plan_name && (
                          <div className="sub-info-row">
                            <span>Assigned Plan</span>
                            <strong>{detailedSub.plan_name}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment details if they paid individually */}
                    {subStatus?.status === "active" && detailedSub && (
                      <div className="sub-info-card">
                        <h3>Billing & Payment Information</h3>
                        <div className="sub-info-rows">
                          <div className="sub-info-row">
                            <span>Amount Paid</span>
                            <strong>₹{Number(detailedSub.amount_paid || 0).toLocaleString("en-IN")}</strong>
                          </div>
                          {detailedSub.payment_notes && (
                            <div className="sub-info-row">
                              <span>Payment Reference</span>
                              <strong>{detailedSub.payment_notes}</strong>
                            </div>
                          )}
                          <div className="sub-info-row">
                            <span>Last Renewed At</span>
                            <strong>{detailedSub.updated_at ? new Date(detailedSub.updated_at).toLocaleDateString() : "N/A"}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* ── Available Plans ──────────────────────────────── */}
                    {subStatus?.status !== "hospital_covered" && (
                      <div className="sub-plans-section">
                        <div className="sub-plans-header">
                          <h3>Available Plans</h3>
                          <p>Upgrade your practice coverage by subscribing to a plan below.</p>
                        </div>

                        {plansLoading ? (
                          <div className="doctor-loading-panel">
                            <span className="doctor-loading-spinner" />
                            <p>Loading plans...</p>
                          </div>
                        ) : doctorPlans.length === 0 ? (
                          <EmptyState
                            title="No plans available"
                            text="Contact TechMedix admin to configure subscription plans."
                          />
                        ) : (
                          <div className="sub-plans-grid">
                            {doctorPlans.map((plan) => {
                              const isCurrent =
                                detailedSub?.plan_id === plan.id &&
                                (subStatus?.status === "active");
                              return (
                                <div
                                  key={plan.id}
                                  className={`sub-plan-card ${
                                    isCurrent ? "sub-plan-card--active" : ""
                                  }`}
                                >
                                  <div className="sub-plan-card__head">
                                    <h4>{plan.name}</h4>
                                    <span className="sub-plan-price">
                                      ₹{Number(plan.price).toLocaleString("en-IN")}
                                      <small>/mo</small>
                                    </span>
                                  </div>
                                  <div className="sub-plan-card__meta">
                                    <span>⏱ {plan.duration_days} days</span>
                                  </div>
                                  {Array.isArray(plan.features) &&
                                    plan.features.length > 0 && (
                                      <ul className="sub-plan-card__features">
                                        {plan.features.map((f, i) => (
                                          <li key={i}>✓ {f}</li>
                                        ))}
                                      </ul>
                                    )}
                                  <button
                                    className={`sub-plan-card__btn ${
                                      isCurrent ? "sub-plan-card__btn--active" : ""
                                    }`}
                                    disabled={isCurrent}
                                    onClick={() => {
                                      setSubPayModal(plan);
                                      setSubPayPhone("");
                                      setSubPayError("");
                                    }}
                                  >
                                    {isCurrent ? "✓ Current Plan" : "Subscribe Now"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      {/* ── Doctor Subscription Payment Modal ─────────── */}
      {subPayModal && (
        <div
          className="hosp-pay-overlay"
          onClick={() => !subPayLoading && setSubPayModal(null)}
        >
          <div
            className="hosp-pay-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="hosp-pay-close"
              onClick={() => !subPayLoading && setSubPayModal(null)}
              disabled={subPayLoading}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="hosp-pay-header">
              <div className="hosp-pay-icon">💳</div>
              <h2>Activate Practice Plan</h2>
              <p>Secured payment via Cashfree</p>
            </div>

            {/* Plan summary */}
            <div className="hosp-pay-plan-card">
              <div className="hosp-pay-plan-name">
                <span>⚡ {subPayModal.name}</span>
              </div>
              <div className="hosp-pay-plan-details">
                <div className="hosp-pay-detail">
                  <span>Duration</span>
                  <strong>{subPayModal.duration_days} Days</strong>
                </div>
                <div className="hosp-pay-detail">
                  <span>Amount</span>
                  <strong className="hosp-pay-amount">
                    ₹{Number(subPayModal.price).toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>
              {Array.isArray(subPayModal.features) && subPayModal.features.length > 0 && (
                <ul className="hosp-pay-features">
                  {subPayModal.features.map((f, i) => (
                    <li key={i}>✓ {f}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Phone */}
            <div className="hosp-pay-field">
              <label htmlFor="doc-sub-phone">Phone for Payment OTP</label>
              <div className="hosp-pay-input-wrap">
                <span style={{ fontSize: "0.9rem" }}>📞</span>
                <input
                  id="doc-sub-phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={subPayPhone}
                  maxLength={10}
                  onChange={(e) => setSubPayPhone(e.target.value)}
                  disabled={subPayLoading}
                />
              </div>
              <p className="hosp-pay-field-hint">Leave blank to use your registered number.</p>
            </div>

            {subPayError && (
              <div className="hosp-pay-error">⚠ {subPayError}</div>
            )}

            <button
              className="hosp-pay-cta"
              onClick={handleDoctorSubscribePay}
              disabled={subPayLoading}
            >
              {subPayLoading
                ? "Processing..."
                : `Pay ₹${Number(subPayModal.price).toLocaleString("en-IN")} via Cashfree`}
            </button>
            <p className="hosp-pay-secure">🔒 Secured by Cashfree. No card data stored.</p>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="invoice-modal-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }} onClick={() => setSelectedInvoice(null)}>
          <div className="invoice-modal-content" style={{
            backgroundColor: "#1e293b",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            padding: "24px",
            width: "100%",
            maxWidth: "600px",
            color: "var(--color-text)",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
          }} onClick={(e) => e.stopPropagation()}>
            <div className="invoice-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800" }}>Digital Tax Invoice</h2>
              <button style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: "1.5rem", cursor: "pointer" }} onClick={() => setSelectedInvoice(null)}>&times;</button>
            </div>
            
            <div id="printable-invoice" style={{
              backgroundColor: "#ffffff",
              color: "#1e293b",
              padding: "24px",
              borderRadius: "8px",
              fontFamily: "Inter, sans-serif",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#4f72f0", fontSize: "1.2rem", fontWeight: "800" }}>TechMedix Clinical Sanctuary</h3>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}>124, Healthcare Boulevard, Medical District</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}><strong>Doctor Reg No:</strong> {user?.reg_no || "TM-DOC-2024-001"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem", fontWeight: "800" }}>INVOICE</h3>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}><strong>Invoice ID:</strong> INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}><strong>Date:</strong> {new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#16a34a", fontWeight: "700" }}>STATUS: PAID</p>
                </div>
              </div>

              <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "16px 0" }} />

              <div style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                <strong style={{ color: "#475569" }}>Billed To:</strong>
                <p style={{ margin: "4px 0 0 0", fontWeight: "600" }}>{selectedInvoice.patient_name || "Patient"}</p>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginTop: "10px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                    <th style={{ padding: "8px 0", color: "#475569" }}>Description</th>
                    <th style={{ padding: "8px 0", textAlign: "right", color: "#475569" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px 0" }}>Medical Consultation (Dr. {user?.name})</td>
                    <td style={{ padding: "12px 0", textAlign: "right" }}>{formatMoney(selectedInvoice.amount - selectedInvoice.amount * 0.18)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px 0" }}>GST Charges (18%)</td>
                    <td style={{ padding: "12px 0", textAlign: "right" }}>{formatMoney(selectedInvoice.amount * 0.18)}</td>
                  </tr>
                  <tr style={{ fontSize: "1rem" }}>
                    <td style={{ padding: "16px 0 8px 0", fontWeight: "800" }}>Total Paid (INR)</td>
                    <td style={{ padding: "16px 0 8px 0", textAlign: "right", fontWeight: "800", color: "#4f72f0" }}>{formatMoney(selectedInvoice.amount)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: "30px", fontSize: "0.78rem", color: "#64748b", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <p style={{ margin: 0 }}>Thank you for choosing TechMedix. This is a computer-generated tax invoice and requires no signature.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
              <button
                className="doctor-btn secondary"
                onClick={() => setSelectedInvoice(null)}
                style={{ padding: "10px 20px" }}
              >
                Close
              </button>
              <button
                className="doctor-btn primary"
                onClick={() => {
                  const printContent = document.getElementById("printable-invoice").innerHTML;
                  const originalContent = document.body.innerHTML;
                  document.body.innerHTML = `
                    <div style="padding: 40px; background: white; color: black; min-height: 100vh;">
                      ${printContent}
                    </div>
                  `;
                  window.print();
                  document.body.innerHTML = originalContent;
                  window.location.reload();
                }}
                style={{ padding: "10px 20px" }}
              >
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
