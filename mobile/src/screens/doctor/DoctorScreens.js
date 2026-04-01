import React, { useEffect, useState, useRef } from "react";
import { BarCodeScanner } from "expo-barcode-scanner";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActionTile,
  AvatarBubble,
  DetailRow,
  GradientButton,
  Pill,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
  TopBar,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { api, toAbsoluteUrl } from "../../lib/api";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { Platform } from "react-native";

function formatCurrency(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeArray(payload, key = "data") {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
}

function getInitials(name = "") {
  return (
    String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "DR"
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

function LoadingCard({ label }) {
  return (
    <SurfaceCard tone="low" style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.smallText}>{label}</Text>
    </SurfaceCard>
  );
}

export function DoctorDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [summary, setSummary] = useState({});
  const [appointments, setAppointments] = useState([]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [dashboardRes, analyticsRes, summaryRes, appointmentsRes] =
        await Promise.allSettled([
          api.doctors.getDashboard(),
          api.doctors.getAnalytics(),
          api.payments.getDoctorSummary(user.id),
          api.appointments.getByDoctor(user.id, todayIso()),
        ]);

      setDashboard(
        dashboardRes.status === "fulfilled" ? dashboardRes.value || {} : {},
      );
      setAnalytics(
        analyticsRes.status === "fulfilled" ? analyticsRes.value || {} : {},
      );
      setSummary(
        summaryRes.status === "fulfilled" ? summaryRes.value || {} : {},
      );
      setAppointments(
        appointmentsRes.status === "fulfilled"
          ? normalizeArray(appointmentsRes.value)
          : [],
      );
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
    }, [user?.id]),
  );

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Doctor Workspace"
        avatar={getInitials(user?.name)}
        onBell={() => navigation.navigate("DoctorProfile")}
      />
      <SectionHeader
        title={`Welcome back, ${user?.name || "Doctor"}`}
        description="The mobile doctor workspace is now backed by the same doctor routes used by the web product."
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading doctor dashboard..." /> : null}

      <View style={styles.tileGrid}>
        <ActionTile
          label="Patient Lookup"
          icon="qrcode-scan"
          onPress={() => navigation.navigate("DoctorPatientLookup")}
        />
      </View>

      <View style={styles.statRow}>
        <Stat label="Total" value={appointments.length || 0} />

        <Stat
          label="Waiting"
          value={appointments.filter((a) => a.status === "waiting").length || 0}
        />

        <Stat
          label="Completed"
          value={
            appointments.filter((a) => a.status === "completed").length || 0
          }
        />
      </View>

      <SurfaceCard>
        <Text style={styles.blockTitle}>Clinic Snapshot</Text>
        <DetailRow
          icon="chart-line"
          label="Average Risk Score"
          value={String(dashboard.average_risk_score || 0)}
        />
        <DetailRow
          icon="cash-multiple"
          label="Revenue Today"
          value={formatCurrency(analytics.total_revenue_today || 0)}
        />
        <DetailRow
          icon="clock-outline"
          label="Avg Consultation"
          value={`${analytics.avg_consultation_time_minutes || 0} mins`}
        />
        <DetailRow
          icon="wallet-outline"
          label="Doctor Earnings"
          value={formatCurrency(summary.total_earnings || 0)}
        />
      </SurfaceCard>

      <SurfaceCard tone="low">
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Today’s Appointments</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Appointments")}>
            <Text style={styles.linkText}>Open list</Text>
          </TouchableOpacity>
        </View>
        {(appointments || []).slice(0, 4).map((appointment) => (
          <View key={appointment.id} style={styles.listRow}>
            <View style={styles.listIcon}>
              <AvatarBubble
                label={getInitials(appointment.patient_name)}
                size={32}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{appointment.patient_name}</Text>
              <Text style={styles.listMeta}>
                {formatDate(appointment.appointment_date)} •{" "}
                {appointment.slot_time}
              </Text>
            </View>
            <Pill label={appointment.status || "booked"} tone="info" />
          </View>
        ))}
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function QueueManagerScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");

  async function loadQueue() {
    setLoading(true);
    try {
      const response = await api.appointments.getByDoctor(user.id, todayIso());
      setQueue(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadQueue();
    }, [user?.id]),
  );

  async function runQueueAction(action, appointmentId) {
    try {
      if (action === "start") await api.queue.startConsultation(appointmentId);
      if (action === "complete")
        await api.queue.completeConsultation(appointmentId);
      if (action === "skip") await api.queue.skipPatient(appointmentId);
      await loadQueue();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Queue Manager" avatar={getInitials(user?.name)} />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading queue..." /> : null}
      {(queue || []).length ? (
        queue.map((item, index) => (
          <SurfaceCard key={item.id}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.listTitle}>
                  {item.patient_name || "Patient"}
                </Text>
                <Text style={styles.listMeta}>
                  Token {item.token_number || item.position_in_queue}
                </Text>
              </View>
              <Pill label={item.status} tone="info" />
            </View>
            <DetailRow
              icon="numeric"
              label="Queue Position"
              value={String(index + 1)}
            />
            <DetailRow
              icon="calendar-month-outline"
              label="Appointment Date"
              value={formatDate(item.appointment_date)}
            />
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Start"
                icon="play"
                onPress={() => runQueueAction("start", item.id)}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label="Complete"
                icon="check"
                onPress={() => runQueueAction("complete", item.id)}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label="Skip"
                icon="skip-next-outline"
                onPress={() => runQueueAction("skip", item.id)}
                style={{ flex: 1 }}
              />
            </View>
          </SurfaceCard>
        ))
      ) : !loading ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>No queue entries today</Text>
          <Text style={styles.smallText}>
            Booked and arrived appointments will appear here.
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function DoctorAppointmentsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");

  async function loadAppointments() {
    setLoading(true);
    try {
      const response = await api.appointments.getByDoctor(user.id, todayIso());
      setAppointments(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadAppointments();
    }, [user?.id]),
  );

  async function markCashPaid(paymentId) {
    if (!paymentId) return;
    try {
      await api.payments.markCashPaid(paymentId);
      await loadAppointments();
    } catch (markError) {
      setError(markError.message);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Doctor Appointments" avatar={getInitials(user?.name)} />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading appointments..." /> : null}
      {(appointments || []).length ? (
        appointments.map((appointment) => (
          <SurfaceCard key={appointment.id}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{appointment.patient_name}</Text>
                <Text style={styles.listMeta}>
                  {formatDate(appointment.appointment_date)} •{" "}
                  {appointment.slot_time}
                </Text>
              </View>
              <Pill label={appointment.status} tone="info" />
            </View>
            <DetailRow
              icon="cash-multiple"
              label="Payment"
              value={`${appointment.payment_status || "pending"} (${appointment.payment_method || "N/A"})`}
            />
            {appointment.payment_method === "cash" &&
            appointment.payment_status === "due" ? (
              <SecondaryButton
                label="Mark Cash Paid"
                icon="cash-check"
                onPress={() => markCashPaid(appointment.payment_id)}
              />
            ) : null}
          </SurfaceCard>
        ))
      ) : !loading ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>No appointments</Text>
          <Text style={styles.smallText}>
            Today’s appointments will show up here.
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

const DAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function DoctorScheduleScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    consultation_duration_minutes: "30",
  });

  async function loadSchedule() {
    setLoading(true);
    try {
      const response = await api.schedule.getDoctorSchedule(user.id);
      setSchedule(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadSchedule();
    }, [user?.id]),
  );

  async function saveSchedule() {
    setSaving(true);
    try {
      await api.schedule.setDoctorSchedule(user.id, {
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        consultation_duration_minutes: Number(
          form.consultation_duration_minutes,
        ),
      });
      await loadSchedule();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Doctor Schedule" avatar={getInitials(user?.name)} />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>Update Schedule</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {DAY_OPTIONS.map((day) => (
            <TouchableOpacity
              key={day.value}
              onPress={() => setForm({ ...form, day_of_week: day.value })}
              style={[
                styles.dayChip,
                Number(form.day_of_week) === day.value && styles.dayChipActive,
              ]}
            >
              <Text
                style={[
                  styles.dayChipText,
                  Number(form.day_of_week) === day.value &&
                    styles.dayChipTextActive,
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          value={form.start_time}
          onChangeText={(text) => setForm({ ...form, start_time: text })}
          placeholder="09:00"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.end_time}
          onChangeText={(text) => setForm({ ...form, end_time: text })}
          placeholder="17:00"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.consultation_duration_minutes}
          onChangeText={(text) =>
            setForm({ ...form, consultation_duration_minutes: text })
          }
          placeholder="30"
          placeholderTextColor={colors.outline}
          keyboardType="number-pad"
          style={styles.input}
        />
        <GradientButton
          label={saving ? "Saving..." : "Save Schedule"}
          icon="calendar-check"
          onPress={saveSchedule}
        />
      </SurfaceCard>

      {loading ? <LoadingCard label="Loading schedule..." /> : null}
      {(schedule || []).map((row) => (
        <SurfaceCard key={row.id}>
          <Text style={styles.listTitle}>
            {DAY_OPTIONS.find((day) => day.value === row.day_of_week)?.label ||
              row.day_of_week}
          </Text>
          <DetailRow
            icon="clock-outline"
            label="Window"
            value={`${row.start_time} - ${row.end_time}`}
          />
          <DetailRow
            icon="timer-outline"
            label="Duration"
            value={`${row.consultation_duration_minutes} mins`}
          />
        </SurfaceCard>
      ))}
    </ScreenScroll>
  );
}

export function DoctorProfileScreen() {
  const { user, refreshDoctorProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    specialty: user?.specialty || "",
    consultation_fee: String(user?.consultation_fee || 0),
  });

  async function loadProfile() {
    setLoading(true);
    try {
      const updatedUser = await refreshDoctorProfile();
      setProfile({
        name: updatedUser?.name || "",
        email: updatedUser?.email || "",
        specialty: updatedUser?.specialty || "",
        consultation_fee: String(updatedUser?.consultation_fee || 0),
      });
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, []),
  );

  async function saveProfile() {
    setSaving(true);
    try {
      await api.auth.updateDoctorProfile({
        name: profile.name,
        specialty: profile.specialty,
        consultation_fee: Number(profile.consultation_fee || 0),
      });
      await loadProfile();
      Alert.alert("Saved", "Doctor profile updated.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Doctor Profile" avatar={getInitials(profile.name)} />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading profile..." /> : null}
      <SurfaceCard>
        <Text style={styles.blockTitle}>Profile Settings</Text>
        <TextInput
          value={profile.name}
          onChangeText={(text) => setProfile({ ...profile, name: text })}
          placeholder="Name"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={profile.email}
          editable={false}
          placeholder="Email"
          placeholderTextColor={colors.outline}
          style={[styles.input, styles.inputDisabled]}
        />
        <TextInput
          value={profile.specialty}
          onChangeText={(text) => setProfile({ ...profile, specialty: text })}
          placeholder="Specialty"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={profile.consultation_fee}
          onChangeText={(text) =>
            setProfile({ ...profile, consultation_fee: text })
          }
          keyboardType="number-pad"
          placeholder="Consultation fee"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <GradientButton
          label={saving ? "Saving..." : "Save Profile"}
          icon="content-save-outline"
          onPress={saveProfile}
        />
      </SurfaceCard>
      <SecondaryButton label="Sign Out" icon="logout" onPress={signOut} />
    </ScreenScroll>
  );
}

export function DoctorPatientLookupScreen({ navigation }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);
  async function lookupWithCode(scannedCode) {
    setLoading(true);
    try {
      const response = await api.doctors.getPatientByCode(scannedCode);
      setResult(response);
      setError("");
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }
  function handleScan({ data }) {
    setScanning(false);
    setCode(data);

    // AUTO lookup after scan
    setTimeout(() => {
      lookupWithCode(data);
    }, 300);
  }

  async function lookup() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const response = await api.doctors.getPatientByCode(code.trim());
      setResult(response);
      setError("");
    } catch (lookupError) {
      setError(lookupError.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const patient = result?.patient;
  const history = result?.ehrHistory || [];

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Patient Lookup"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>Enter Patient Unique Code</Text>
        <SecondaryButton
          label="Scan QR"
          icon="qrcode-scan"
          onPress={() => setScanning(true)}
        />
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="ABC12345"
          placeholderTextColor={colors.outline}
          autoCapitalize="characters"
          style={styles.input}
        />
        <GradientButton
          label={loading ? "Searching..." : "Lookup Patient"}
          icon="magnify"
          onPress={lookup}
        />
      </SurfaceCard>

      {scanning && Platform.OS !== "web" ? (
        <SurfaceCard>
          <Text style={styles.blockTitle}>Scan Patient QR</Text>
          <BarCodeScanner
            onBarCodeScanned={handleScan}
            style={{ height: 250, borderRadius: 12 }}
          />
        </SurfaceCard>
      ) : scanning ? (
        <SurfaceCard>
          <Text style={styles.smallText}>
            QR scanning is not supported on web. Please use mobile device.
          </Text>
        </SurfaceCard>
      ) : null}

      {patient ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>{patient.name}</Text>
          <Text style={styles.listMeta}>{patient.email}</Text>
          <DetailRow
            icon="calendar-account"
            label="Age"
            value={String(patient.age || "N/A")}
          />
          <DetailRow
            icon="gender-male-female"
            label="Gender"
            value={patient.gender || "N/A"}
          />
          <DetailRow
            icon="phone-outline"
            label="Phone"
            value={patient.phone || "N/A"}
          />
          <View style={styles.buttonRow}>
            <SecondaryButton
              label="Manual Rx"
              icon="pill"
              onPress={() =>
                navigation.navigate("DoctorManualPrescription", {
                  patientId: patient.id,
                  patientName: patient.name,
                })
              }
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label="Upload Audio"
              icon="microphone-outline"
              onPress={() =>
                navigation.navigate("DoctorRecordingUpload", {
                  patientId: patient.id,
                  patientName: patient.name,
                })
              }
              style={{ flex: 1 }}
            />
          </View>
        </SurfaceCard>
      ) : null}

      {history.length ? (
        history.map((entry) => (
          <SurfaceCard key={entry.id}>
            <Text style={styles.listTitle}>
              {entry.predictedDisease || "Clinical entry"}
            </Text>
            <Text style={styles.listMeta}>
              {formatDate(entry.created_at || entry.timestamp)}
            </Text>
            <Text style={styles.smallText}>
              Symptoms:{" "}
              {Object.keys(entry.symptoms || {})
                .filter((key) => entry.symptoms[key])
                .join(", ") || "N/A"}
            </Text>
            <Text style={styles.smallText}>
              Heart rate: {entry.ehr?.heartRate || "N/A"} • Glucose:{" "}
              {entry.ehr?.glucose || "N/A"}
            </Text>
          </SurfaceCard>
        ))
      ) : patient ? (
        <SurfaceCard>
          <Text style={styles.smallText}>
            No EHR history available for this patient yet.
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function DoctorManualPrescriptionScreen({ navigation, route }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    patient_id: route?.params?.patientId || "",
    medicine_name: "",
    dosage: "",
    frequency: "",
    duration: "",
  });

  async function saveManualPrescription() {
    setSaving(true);
    try {
      await api.prescriptions.createManual(form);
      Alert.alert("Saved", "Manual prescription added successfully.");
      navigation.goBack();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Manual Prescription"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>Add Medicine Manually</Text>
        <TextInput
          value={form.patient_id}
          onChangeText={(text) => setForm({ ...form, patient_id: text })}
          placeholder="Patient ID"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.medicine_name}
          onChangeText={(text) => setForm({ ...form, medicine_name: text })}
          placeholder="Medicine name"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.dosage}
          onChangeText={(text) => setForm({ ...form, dosage: text })}
          placeholder="Dosage"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.frequency}
          onChangeText={(text) => setForm({ ...form, frequency: text })}
          placeholder="Frequency"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.duration}
          onChangeText={(text) => setForm({ ...form, duration: text })}
          placeholder="Duration"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <GradientButton
          label={saving ? "Saving..." : "Save Prescription"}
          icon="content-save-outline"
          onPress={saveManualPrescription}
        />
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function DoctorRecordingUploadScreen({ navigation, route }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState([]);
  const [patientId, setPatientId] = useState(route?.params?.patientId || "");
  const [appointmentId, setAppointmentId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [playingRecordingId, setPlayingRecordingId] = useState(null);
  const recordingRef = useRef(new Audio.Recording());
  const soundRef = useRef(new Audio.Sound());

  async function loadRecordings() {
    setLoading(true);
    try {
      const response = await api.recordings.listForDoctor(user.id);
      setRecordings(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadRecordings();
      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync();
        }
      };
    }, [user?.id]),
  );

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordedUri(null);
      setError("");
    } catch (recordError) {
      setError(`Recording failed: ${recordError.message}`);
    }
  }

  async function stopRecording() {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setRecordedUri(uri);
      setIsRecording(false);
    } catch (stopError) {
      setError(`Stop recording failed: ${stopError.message}`);
    }
  }

  async function uploadRecording() {
    if (!recordedUri) {
      setError("No recording available to upload");
      return;
    }
    if (!patientId) {
      setError("Please enter Patient ID");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", {
        uri: recordedUri,
        type: "audio/m4a",
        name: `consultation_${Date.now()}.m4a`,
      });
      formData.append("patient_id", patientId);
      if (appointmentId) {
        formData.append("appointment_id", appointmentId);
      }

      const response = await api.recordings.uploadDoctor(formData);
      setError("");
      setRecordedUri(null);
      Alert.alert("Success", "Recording uploaded successfully");
      await loadRecordings();
    } catch (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function playRecording(recordingUri) {
    try {
      await soundRef.current.loadAsync({ uri: recordingUri });
      setPlayingRecordingId(recordingUri);
      await soundRef.current.playAsync();
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying) {
          setPlayingRecordingId(null);
        }
      });
    } catch (playError) {
      setError(`Playback failed: ${playError.message}`);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Recording Upload"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>🎤 Record Consultation Notes</Text>
        <Text style={styles.smallText}>
          {isRecording
            ? "Recording in progress..."
            : recordedUri
              ? "Recording ready to upload"
              : "Use your app's microphone to record voice notes for this patient"}
        </Text>
        <TextInput
          value={patientId}
          onChangeText={setPatientId}
          placeholder="Patient ID"
          placeholderTextColor={colors.outline}
          style={styles.input}
          editable={!isRecording}
        />
        <TextInput
          value={appointmentId}
          onChangeText={setAppointmentId}
          placeholder="Appointment ID (optional)"
          placeholderTextColor={colors.outline}
          style={styles.input}
          editable={!isRecording}
        />
        <View style={styles.buttonRow}>
          {!isRecording && !recordedUri ? (
            <GradientButton
              label="Start Recording"
              icon="microphone-outline"
              onPress={startRecording}
              style={{ flex: 1 }}
            />
          ) : isRecording ? (
            <GradientButton
              label="Stop Recording"
              icon="stop-circle-outline"
              onPress={stopRecording}
              style={{ flex: 1 }}
            />
          ) : null}

          {recordedUri && !isRecording ? (
            <>
              <SecondaryButton
                label="Replay"
                icon="play-circle-outline"
                onPress={() => playRecording(recordedUri)}
                style={{ flex: 0.5 }}
              />
              <GradientButton
                label={uploading ? "Uploading..." : "Upload"}
                icon="cloud-upload-outline"
                onPress={uploadRecording}
                style={{ flex: 1 }}
              />
            </>
          ) : null}
        </View>
      </SurfaceCard>

      {loading ? <LoadingCard label="Loading previous recordings..." /> : null}
      <SurfaceCard tone="low">
        <Text style={styles.blockTitle}>📋 Recorded Voice Notes</Text>
        {(recordings || []).length ? (
          recordings.slice(0, 6).map((recording) => {
            const recordingUrl = toAbsoluteUrl(
              recording.audio_url || recording.file_url,
            );
            const isPlaying = playingRecordingId === recordingUrl;
            return (
              <View key={recording.id} style={styles.audioPlayerCard}>
                <View style={styles.audioPlayerHeader}>
                  <MaterialCommunityIcons
                    name="microphone-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.audioTitle}>
                      Recording #{recording.id}
                    </Text>
                    <Text style={styles.audioMeta}>
                      {recording.patient_name || "Patient audio"}
                    </Text>
                  </View>
                </View>
                <View style={styles.audioPlayerControls}>
                  <TouchableOpacity
                    onPress={() => playRecording(recordingUrl)}
                    style={styles.playButton}
                  >
                    <MaterialCommunityIcons
                      name={isPlaying ? "pause" : "play"}
                      size={20}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                  <Text style={styles.audioStatus}>
                    {isPlaying ? "Playing..." : "Tap to play"}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.smallText}>No recordings yet</Text>
        )}
      </SurfaceCard>
    </ScreenScroll>
  );
}

function Stat({ label, value }) {
  return (
    <SurfaceCard tone="low" style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.lg,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statLabel: {
    color: colors.outline,
    fontSize: typography.bodySmall,
  },
  statValue: {
    color: colors.primary,
    fontSize: typography.h2,
    fontWeight: "800",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  blockTitle: {
    color: colors.onSurface,
    fontSize: typography.h3,
    fontWeight: "800",
    flex: 1,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.bodySmall,
    fontWeight: "700",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "700",
  },
  listMeta: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
  },
  smallText: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: typography.body,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  loadingCard: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  horizontalList: {
    gap: spacing.sm,
  },
  dayChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceHighest,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
  },
  dayChipText: {
    color: colors.onSurface,
    fontWeight: "600",
  },
  dayChipTextActive: {
    color: colors.onPrimary,
  },
  audioPlayerCard: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  audioPlayerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  audioTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "700",
  },
  audioMeta: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    marginTop: 2,
  },
  audioPlayerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  playButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  audioStatus: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    fontWeight: "500",
  },
});
