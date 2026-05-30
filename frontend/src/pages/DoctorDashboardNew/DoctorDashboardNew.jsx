import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Edit,
  Trash2,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import DigitalPrescription from "../../components/Prescription/DigitalPrescription";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../context/AuthContext";
import { appointmentAPI, analyticsAPI, queueAPI } from "../../api/techmedixAPI";
import { initQueueSocket } from "../../api/socketService";
import DoctorScheduleManager from "../../components/DoctorScheduleManager/DoctorScheduleManager";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import DoctorPromotions from "../../components/DoctorPromotions/DoctorPromotions";
import { doctorApi, paymentApi } from "../../api";
import { formatTime12Hour } from "../../utils/dateTime";
import "./DoctorDashboardNew.css";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "queue", label: "Queue", icon: Stethoscope },
  { id: "revenue", label: "Revenue", icon: Landmark },
  { id: "patients", label: "Patient Workspace", icon: UserRound },
  { id: "staff", label: "Staff Hub", icon: Users },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "promotions", label: "Promotions", icon: Megaphone },
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

  const [uniqueCode, setUniqueCode] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [patientHistoryPrescriptions, setPatientHistoryPrescriptions] = useState([]);
  const [patientRecordings, setPatientRecordings] = useState([]);
  const [patientReports, setPatientReports] = useState([]);
  const [patientShareSections, setPatientShareSections] = useState([]);
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineDosage, setNewMedicineDosage] = useState("");
  const [newMedicineFrequency, setNewMedicineFrequency] = useState("");
  const [newMedicineDuration, setNewMedicineDuration] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [voiceNoteUploading, setVoiceNoteUploading] = useState(false);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [prescriptionNumber, setPrescriptionNumber] = useState(`RX-${Math.floor(1000 + Math.random() * 9000)}`);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl);
      }

      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [recordingPreviewUrl]);

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

  const activeAppointment = patientData?.appointment || null;
  const recordingConsentGranted = Boolean(
    activeAppointment?.recording_consent_patient,
  );

  const findPatientAppointment = (patientId) => {
    if (!patientId) return null;

    const relevantStatuses = ["booked", "arrived", "in_progress", "visited"];

    return appointments
      .filter(
        (appointment) =>
          String(appointment.patient_id) === String(patientId) &&
          relevantStatuses.includes(String(appointment.status || "").toLowerCase()),
      )
      .sort((left, right) => {
        const leftDate = new Date(
          `${left.appointment_date || ""}T${left.slot_time || "00:00"}`,
        ).getTime();
        const rightDate = new Date(
          `${right.appointment_date || ""}T${right.slot_time || "00:00"}`,
        ).getTime();
        return rightDate - leftDate;
      })[0] || null;
  };

  useEffect(() => {
    if (!user?.id) return;
    loadDoctorData(true);
    loadStaffData();
    fetchProfile();
  }, [user?.id, selectedDate]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const socket = initQueueSocket();
    const handleQueueUpdate = (payload) => {
      if (payload?.doctor_id && String(payload.doctor_id) !== String(user.id)) {
        return;
      }

      loadDoctorData();
    };
    const handleStaffNotifyDoctor = (payload) => {
      if (payload?.doctor_id && String(payload.doctor_id) !== String(user.id)) {
        return;
      }

      setStatusMessage(
        payload?.message || `${payload?.staff_name || "Staff"} marked a patient ready.`,
      );
      loadDoctorData();
    };

    socket.emit("join-doctor-room", user.id);
    socket.on("queue-update", handleQueueUpdate);
    socket.on("staff-notify-doctor", handleStaffNotifyDoctor);

    return () => {
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
            // If the entry itself looks like a medicine record
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
      
      // Filter for active builder: only show medicines from the current session/doctor
      const currentDoctorMeds = medicines.filter(m => {
        const isMyId = m.doctor_id && String(m.doctor_id) === String(user?.id);
        const nameMatch = m.doctor_name && String(user?.name) && 
                         String(m.doctor_name).toLowerCase().includes(String(user?.name).toLowerCase());
        // If it's your ID or your Name, OR it has NO ID (meaning it was likely just added manually in this session)
        return isMyId || nameMatch || !m.doctor_id;
      });
      setPatientPrescriptions(currentDoctorMeds);

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
    } catch (prescriptionError) {
      setError(readErrorMessage(prescriptionError, "Failed to load patient treatment data"));
    }
  }

  async function loadPatientReports(patientId) {
    try {
      const [reportsResponse, walletResponse] = await Promise.allSettled([
        fetch(`/api/staff/patients/${patientId}/reports`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          credentials: "include",
        }),
        fetch(`/api/health-wallet/documents`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          credentials: "include",
        }),
      ]);

      const reportsPayload =
        reportsResponse.status === "fulfilled" ? await reportsResponse.value.json() : null;
      const walletPayload =
        walletResponse.status === "fulfilled" ? await walletResponse.value.json() : null;

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
    if (!code || busyMap["search-patient"]) return;

    await withBusy("search-patient", async () => {
      try {
        resetVoiceRecordingState();
        setError("");
        const response = await doctorApi.getPatientData(code);
        const payload = response.data;
        const patient = payload?.patient || payload;
        const matchedAppointment = findPatientAppointment(patient?.id);

        if (matchedAppointment?.id) {
          await openQueuedPatient(matchedAppointment.id);
          return;
        }

        setPatientData({
          ...payload,
          appointment: null,
        });
        setPatientShareSections(["ehr", "prescriptions", "recordings", "reports"]);
        setActiveView("patients");
        if (patient?.id) {
          await Promise.all([
            loadPatientPrescriptions(patient.id),
            loadPatientReports(patient.id),
          ]);
          setStatusMessage(
            "Patient profile loaded. Voice-note recording will appear once a matching appointment is opened.",
          );
        }
      } catch (searchError) {
        setError(readErrorMessage(searchError, "Patient not found"));
      }
    });
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
      resetVoiceRecordingState();
      const response = await doctorApi.getSharedAppointmentContext(appointmentId);
      const payload = response.data || {};
      setPatientData({
        patient: payload.patient,
        ehrHistory: payload.ehrHistory || [],
        appointment: payload.appointment || null,
      });
      setPatientShareSections(payload.allowed_sections || []);
      setPatientHistoryPrescriptions(payload.prescriptions || []);
      setPatientPrescriptions([]); // Builder starts fresh for each doctor session
      setPatientRecordings(payload.recordings || []);
      setPatientReports(payload.reports || []);
      setActiveView("patients");
      if (!payload.appointment?.share_history) {
        setStatusMessage("This patient did not share health history for this appointment.");
      }
    });
  }

  function resetVoiceRecordingState() {
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl);
    }
    recordingChunksRef.current = [];
    setRecordingPreviewUrl("");
    setIsRecording(false);
    setVoiceNoteUploading(false);
  }

  async function uploadVoiceNoteBlob(blob) {
    if (!patientProfile?.id || !activeAppointment?.id) {
      throw new Error("Open the patient from an appointment to upload a voice note.");
    }

    const formData = new FormData();
    formData.append(
      "audio",
      new File([blob], `voice-note-${activeAppointment.id}-${Date.now()}.webm`, {
        type: blob.type || "audio/webm",
      }),
    );
    formData.append("appointment_id", activeAppointment.id);
    formData.append("patient_id", patientProfile.id);

    setVoiceNoteUploading(true);
    const response = await doctorApi.uploadRecording(formData);
    const savedRecording = response.data?.recording;
    if (savedRecording) {
      setPatientRecordings((current) => [savedRecording, ...current]);
    }
    setStatusMessage("Voice note saved and shared with the patient.");
  }

  async function handleStartVoiceRecording() {
    if (!patientProfile?.id || !activeAppointment?.id) {
      setError("Open a booked appointment before recording a voice note.");
      return;
    }

    if (!recordingConsentGranted) {
      setError("This patient did not consent to voice-note recording.");
      return;
    }

    try {
      setError("");
      setStatusMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(recordingChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          if (recordingPreviewUrl) {
            URL.revokeObjectURL(recordingPreviewUrl);
          }
          setRecordingPreviewUrl(URL.createObjectURL(blob));
          await uploadVoiceNoteBlob(blob);
        } catch (recordingError) {
          setError(readErrorMessage(recordingError, "Failed to save voice note"));
        } finally {
          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach((track) => track.stop());
            recordingStreamRef.current = null;
          }
          mediaRecorderRef.current = null;
          recordingChunksRef.current = [];
          setIsRecording(false);
          setVoiceNoteUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage("Recording started. Stop when the voice note is complete.");
    } catch (recordingError) {
      setError(readErrorMessage(recordingError, "Microphone access was not granted"));
      setIsRecording(false);
    }
  }

  function handleStopVoiceRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
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


  async function handleAddMedicine() {
    if (!newMedicineName || !patientProfile?.id) {
      setError("Select a patient and enter a medicine name");
      return;
    }

    // Optimistic Update: Add to UI immediately for "Zero Latency" feel
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
            doctor_name: user?.name,
            doctor_specialty: user?.specialty || user?.category
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to add medicine to backend");
        }

        setNewMedicineName("");
        setNewMedicineDosage("");
        setNewMedicineFrequency("");
        setNewMedicineDuration("");
        setStatusMessage("Medicine added successfully.");
        await loadPatientPrescriptions(patientProfile.id);
      } catch (err) {
        // Rollback optimistic update if it failed
        setPatientPrescriptions(prev => prev.filter(m => m.id !== optimisticMed.id));
        setError(err.message);
        throw err;
      }
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
        body: JSON.stringify({ dosage, frequency, duration }),
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
          <aside className="doctor-sidebar">
            <div className="doctor-sidebar-card">
              <span className="doctor-sidebar-label">Navigation</span>
              <div className="doctor-sidebar-nav">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={activeView === id ? "active" : ""}
                    onClick={() => setActiveView(id)}
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

                <section className="doctor-layout-grid">
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
                      <button type="submit" className="doctor-primary-button" disabled={busyMap["search-patient"]}>
                        <Search size={16} />
                        {busyMap["search-patient"] ? "Searching..." : "Search"}
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
                      {/* Patient Profile Card */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <span>Patient Profile</span>
                            <h2>{patientProfile.name}</h2>
                          </div>
                          <div className="doctor-chip-row">
                            <span className="doctor-chip">{patientProfile.age || "N/A"} yrs • {patientProfile.gender || "Unknown"}</span>
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
                            <strong>{patientProfile.uniqueCode || patientProfile.unique_code || uniqueCode}</strong>
                          </div>
                        </div>
                      </article>

                      {/* Medicine Builder Section */}
                      <article className="doctor-panel medicine-builder-panel">
                        <div className="doctor-panel-heading">
                          <div className="builder-header">
                            <span className="builder-label">Prescription Builder</span>
                            <h2>Add and adjust treatment</h2>
                          </div>
                        </div>

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
                              className="add-medicine-btn"
                              onClick={handleAddMedicine}
                              disabled={busyMap["add-medicine"]}
                           >
                              <PlusCircle size={18} />
                              Add Medicine
                           </button>
                        </div>
                      </article>

                      {/* Added Medicines Table */}
                      <article className="doctor-panel medicines-list-panel">
                        <div className="doctor-panel-heading">
                           <h2>Added Medicines List</h2>
                           <span className="count-pill">{patientPrescriptions.length} items</span>
                        </div>
                        
                        <div className="medicines-table-container">
                          {patientPrescriptions.length === 0 ? (
                            <EmptyState
                               title="No medicines added"
                               text="Start by adding medicines using the form above."
                            />
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
                                       <td><strong>{med.medicine_name}</strong></td>
                                       <td>{med.dosage}</td>
                                       <td>{med.frequency}</td>
                                       <td>{med.duration}</td>
                                       <td className="actions-cell">
                                          <button onClick={() => updatePrescriptionMedicine(med)}><Edit size={14} /></button>
                                          <button className="del-btn" onClick={() => stopPrescriptionMedicine(med)}><Trash2 size={14} /></button>
                                       </td>
                                    </tr>
                                  ))}
                               </tbody>
                            </table>
                          )}
                        </div>
                      </article>

                      {/* Diagnosis & Notes */}
                      <div className="builder-extra-fields">
                        <article className="doctor-panel">
                           <div className="doctor-panel-heading">
                              <h2>Diagnosis Section</h2>
                           </div>
                           <textarea 
                              placeholder="Enter diagnosis or clinical findings..."
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

                      {/* Reports/Files */}
                      <article className="doctor-panel">
                        <div className="doctor-panel-heading">
                          <h2>Shared Clinical Files</h2>
                        </div>
                        <div className="files-grid-simple">
                           {patientReports.slice(0, 4).map(report => (
                             <div key={report.id} className="file-item-minimal">
                                <span>{report.file_name}</span>
                                <a href={report.file_url} target="_blank" rel="noreferrer">View</a>
                             </div>
                           ))}
                           {patientReports.length === 0 && <p className="no-files">No files shared.</p>}
                        </div>
                      </article>

                      <article className="doctor-panel doctor-recording-panel">
                        <div className="doctor-panel-heading">
                          <div>
                            <span>Consultation Voice Notes</span>
                            <h2>Doctor recording</h2>
                          </div>
                        </div>

                        {!activeAppointment ? (
                          <p className="doctor-helper-text">
                            Open the patient from a booked appointment to check recording consent and save a voice note.
                          </p>
                        ) : recordingConsentGranted ? (
                          <>
                            <p className="doctor-helper-text">
                              Patient consent is available for this appointment. You can record a consultation voice note and it will still appear in the patient recording section.
                            </p>
                            <div className="doctor-inline-actions">
                              <button
                                type="button"
                                className="doctor-primary-button"
                                onClick={isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
                                disabled={voiceNoteUploading}
                              >
                                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                                {isRecording
                                  ? "Stop Recording"
                                  : voiceNoteUploading
                                    ? "Uploading..."
                                    : "Record Voice Note"}
                              </button>
                            </div>
                            {recordingPreviewUrl ? (
                              <audio
                                className="doctor-recording-preview"
                                controls
                                src={recordingPreviewUrl}
                              />
                            ) : null}
                          </>
                        ) : (
                          <p className="doctor-helper-text doctor-recording-blocked">
                            This patient did not allow voice-note recording for this appointment, so recording is disabled.
                          </p>
                        )}

                        {patientRecordings.length > 0 ? (
                          <div className="doctor-recordings-list">
                            {patientRecordings.slice(0, 3).map((recording) => (
                              <div key={recording.id} className="doctor-recording-card">
                                <div className="doctor-recording-meta">
                                  <strong>{recording.doctor_name || "Voice note"}</strong>
                                  <span>
                                    {recording.created_at
                                      ? new Date(recording.created_at).toLocaleString()
                                      : "Recently saved"}
                                  </span>
                                </div>
                                <audio
                                  controls
                                  src={recording.file_url || recording.audio_url}
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="builder-final-actions" style={{ marginTop: '20px' }}>
                           <button 
                              className="doctor-primary-button doctor-primary-button--full finalize-btn"
                              onClick={handleFinalizePrescription}
                              disabled={busyMap["finalize-rx"]}
                              style={{ 
                                background: '#183126', 
                                border: 'none', 
                                padding: '16px',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px rgba(24, 49, 38, 0.2)'
                              }}
                           >
                              <CheckCircle2 size={20} />
                              Finalize & Send to Patient
                           </button>
                        </div>
                      </article>
                    </div>

                    {/* Sticky Preview Column */}
                    <div className="patient-preview-column">
                        <DigitalPrescription 
                           doctor={{ 
                             name: `Dr. ${doctorDisplayName}`, 
                             specialty: user?.specialty || user?.category || "Senior Practitioner" 
                           }}
                           patient={patientProfile}
                          medicines={Array.from(new Map(patientPrescriptions.map(m => [m.medicine_name?.toLowerCase(), m])).values())}
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
          </main>
        </div>
      </div>
    </div>
  );
}
