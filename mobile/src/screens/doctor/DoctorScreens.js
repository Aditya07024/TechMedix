import React, { useEffect, useState, useRef, useCallback } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
  const [revenueDetails, setRevenueDetails] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [dashboardRes, analyticsRes, summaryRes, appointmentsRes, revenueRes] =
        await Promise.allSettled([
          api.doctors.getDashboard(),
          api.doctors.getAnalytics(),
          api.payments.getDoctorSummary(user.id),
          api.appointments.getByDoctor(user.id, todayIso()),
          api.payments.getDoctorRevenueDetails(user.id),
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
      setRevenueDetails(
        revenueRes.status === "fulfilled" ? revenueRes.value : null,
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

  // Build bar chart data from revenue details
  const dailyRevenue = revenueDetails?.daily_revenue || revenueDetails?.data?.daily_revenue || [];
  const methodBreakdown = revenueDetails?.payment_methods || revenueDetails?.data?.payment_methods || {};
  const recentPayments = revenueDetails?.recent_payments || revenueDetails?.data?.recent_payments || [];
  const maxRevenue = dailyRevenue.length > 0
    ? Math.max(...dailyRevenue.map(d => Number(d.total || d.amount || 0)), 1)
    : 1;

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

      {/* 3-up Stat row */}
      <View style={styles.statRow}>
        <Stat label="Total" value={appointments.length || 0} icon="calendar-multiselect" />
        <Stat
          label="Waiting"
          value={appointments.filter((a) => a.status === "waiting").length || 0}
          icon="account-clock"
        />
        <Stat
          label="Completed"
          value={appointments.filter((a) => a.status === "completed").length || 0}
          icon="check-decagram"
        />
      </View>

      <SectionHeader title="Clinic Snapshot" />
      {/* 2-column info grid */}
      <View style={styles.infoGrid}>
        <SurfaceCard tone="lowest" style={styles.infoGridCard}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />
          </View>
          <Text style={styles.infoCardLabel}>Avg Risk Score</Text>
          <Text style={styles.infoCardValue}>{String(dashboard.average_risk_score || 0)}</Text>
        </SurfaceCard>
        <SurfaceCard tone="lowest" style={styles.infoGridCard}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.success} />
          </View>
          <Text style={styles.infoCardLabel}>Revenue Today</Text>
          <Text style={styles.infoCardValue}>{formatCurrency(analytics.total_revenue_today || 0)}</Text>
        </SurfaceCard>
        <SurfaceCard tone="lowest" style={styles.infoGridCard}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.infoCardLabel}>Avg Consultation</Text>
          <Text style={styles.infoCardValue}>{`${analytics.avg_consultation_time_minutes || 0} mins`}</Text>
        </SurfaceCard>
        <SurfaceCard tone="lowest" style={styles.infoGridCard}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.infoCardLabel}>Doctor Earnings</Text>
          <Text style={styles.infoCardValue}>{formatCurrency(summary.total_earnings || 0)}</Text>
        </SurfaceCard>
      </View>

      {/* ═══════════ EARNINGS ANALYSIS ═══════════ */}
      <SurfaceCard tone="lowest" style={styles.dashboardListCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>📊 Earnings Analysis</Text>
        </View>

        {/* Bar Chart */}
        {dailyRevenue.length > 0 ? (
          <View style={earningStyles.chartContainer}>
            <View style={earningStyles.chartArea}>
              {dailyRevenue.slice(-7).map((day, index) => {
                const amount = Number(day.total || day.amount || 0);
                const heightPercent = (amount / maxRevenue) * 100;
                const dayLabel = day.date
                  ? new Date(day.date).toLocaleDateString(undefined, { weekday: "short" })
                  : `D${index + 1}`;
                return (
                  <View key={day.date || index} style={earningStyles.barColumn}>
                    <Text style={earningStyles.barValue}>
                      {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : String(Math.round(amount))}
                    </Text>
                    <View style={earningStyles.barTrack}>
                      <View
                        style={[
                          earningStyles.barFill,
                          { height: `${Math.max(heightPercent, 4)}%` },
                        ]}
                      />
                    </View>
                    <Text style={earningStyles.barLabel}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.smallText}>No daily revenue data available yet.</Text>
        )}

        {/* Method Breakdown */}
        <View style={earningStyles.methodRow}>
          {[
            { key: "online", label: "Online", icon: "credit-card-outline", color: colors.primary },
            { key: "cash", label: "Cash", icon: "cash", color: "#4caf50" },
            { key: "wallet", label: "Wallet", icon: "wallet-outline", color: "#ff9800" },
          ].map((m) => (
            <View key={m.key} style={earningStyles.methodCard}>
              <MaterialCommunityIcons name={m.icon} size={18} color={m.color} />
              <Text style={earningStyles.methodLabel}>{m.label}</Text>
              <Text style={earningStyles.methodValue}>
                {formatCurrency(methodBreakdown[m.key] || 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={[styles.smallText, { fontWeight: "700", marginBottom: 8 }]}>Recent Payments</Text>
            {recentPayments.slice(0, 5).map((payment, idx) => (
              <View key={payment.id || idx} style={earningStyles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={earningStyles.paymentName}>
                    {payment.patient_name || "Patient"}
                  </Text>
                  <Text style={earningStyles.paymentMeta}>
                    {formatDate(payment.created_at || payment.payment_date)} • {payment.payment_method || "N/A"}
                  </Text>
                </View>
                <Text style={earningStyles.paymentAmount}>
                  {formatCurrency(payment.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SurfaceCard>

      <SurfaceCard tone="lowest" style={styles.dashboardListCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Today's Appointments</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Appointments")}>
            <Text style={styles.linkText}>Open list</Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: spacing.sm }}>
          {appointments.length === 0 ? (
            <Text style={styles.smallText}>No appointments today</Text>
          ) : (
            (appointments || []).slice(0, 4).map((appointment) => (
              <View key={appointment.id} style={styles.dashboardApptRow}>
                <AvatarBubble
                  label={getInitials(appointment.patient_name)}
                  size={36}
                  tone="secondary"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.apptPatientName}>{appointment.patient_name}</Text>
                  <Text style={styles.apptTimeMeta}>
                    {formatDate(appointment.appointment_date)} • {appointment.slot_time}
                  </Text>
                </View>
                <Pill label={appointment.status || "booked"} tone="info" />
              </View>
            ))
          )}
        </View>
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
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    specialty: user?.specialty || "",
    consultation_fee: String(user?.consultation_fee || 0),
  });

  // Staff tab state
  const [soloMode, setSoloMode] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "" });
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Promotions tab state
  const [posters, setPosters] = useState([]);
  const [postersLoading, setPostersLoading] = useState(false);

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

  async function loadStaff() {
    setStaffLoading(true);
    try {
      const res = await api.doctorStaff.list();
      setStaffList(normalizeArray(res));
    } catch (err) {
      console.warn("Staff load failed:", err.message);
    } finally {
      setStaffLoading(false);
    }
  }

  async function loadPosters() {
    setPostersLoading(true);
    try {
      const res = await api.doctorPosters.getMyPosters();
      setPosters(normalizeArray(res));
    } catch (err) {
      console.warn("Posters load failed:", err.message);
    } finally {
      setPostersLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadStaff();
      loadPosters();
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

  async function createStaffMember() {
    if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.password.trim()) {
      Alert.alert("Required", "Please fill all staff fields.");
      return;
    }
    setCreatingStaff(true);
    try {
      await api.doctorStaff.create(staffForm);
      setStaffForm({ name: "", email: "", password: "" });
      Alert.alert("Created", "Staff member account created.");
      await loadStaff();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setCreatingStaff(false);
    }
  }

  async function deleteStaffMember(staffId) {
    Alert.alert("Confirm", "Remove this staff member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.doctorStaff.delete(staffId);
            await loadStaff();
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  async function deletePoster(posterId) {
    Alert.alert("Confirm", "Delete this promotional poster?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.doctorPosters.deletePoster(posterId);
            await loadPosters();
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  const PROFILE_TABS = [
    { key: "profile", label: "Profile", icon: "account-cog-outline" },
    { key: "staff", label: "Staff", icon: "account-group-outline" },
    { key: "promotions", label: "Promotions", icon: "bullhorn-outline" },
  ];

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Doctor Profile" avatar={getInitials(profile.name)} />
      <InlineError message={error} />

      {/* Tab Switcher */}
      <View style={profileTabStyles.tabBar}>
        {PROFILE_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[profileTabStyles.tabBtn, isActive && profileTabStyles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={16}
                color={isActive ? colors.onPrimary : colors.outline}
              />
              <Text style={[profileTabStyles.tabBtnText, isActive && profileTabStyles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? <LoadingCard label="Loading profile..." /> : null}

      {/* ═══════════ PROFILE SETTINGS TAB ═══════════ */}
      {activeTab === "profile" && (
        <>
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
        </>
      )}

      {/* ═══════════ STAFF SUPPORT TAB ═══════════ */}
      {activeTab === "staff" && (
        <>
          {/* Solo Mode Toggle */}
          <SurfaceCard>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.blockTitle}>Operation Mode</Text>
            </View>
            <View style={profileTabStyles.soloRow}>
              <View style={{ flex: 1 }}>
                <Text style={profileTabStyles.soloLabel}>
                  {soloMode ? "Solo Mode" : "Staff Mode"}
                </Text>
                <Text style={styles.smallText}>
                  {soloMode
                    ? "You are operating without staff. Front-desk controls are shown on your dashboard."
                    : "Staff members manage your reception desk and patient queue."}
                </Text>
              </View>
              <Switch
                value={soloMode}
                onValueChange={setSoloMode}
                trackColor={{ false: colors.surfaceHigh, true: colors.primaryContainer }}
                thumbColor={soloMode ? colors.primary : colors.outline}
              />
            </View>
          </SurfaceCard>

          {/* Create Staff */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>Add Staff Member</Text>
            <TextInput
              value={staffForm.name}
              onChangeText={(t) => setStaffForm({ ...staffForm, name: t })}
              placeholder="Staff name"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <TextInput
              value={staffForm.email}
              onChangeText={(t) => setStaffForm({ ...staffForm, email: t })}
              placeholder="Staff email"
              placeholderTextColor={colors.outline}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={staffForm.password}
              onChangeText={(t) => setStaffForm({ ...staffForm, password: t })}
              placeholder="Password"
              placeholderTextColor={colors.outline}
              secureTextEntry
              style={styles.input}
            />
            <GradientButton
              label={creatingStaff ? "Creating..." : "Create Staff Account"}
              icon="account-plus-outline"
              onPress={createStaffMember}
            />
          </SurfaceCard>

          {/* Staff List */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>Current Staff</Text>
            {staffLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : staffList.length > 0 ? (
              staffList.map((staff) => (
                <View key={staff.id} style={profileTabStyles.staffRow}>
                  <AvatarBubble label={getInitials(staff.name)} size={36} tone="secondary" />
                  <View style={{ flex: 1 }}>
                    <Text style={profileTabStyles.staffName}>{staff.name}</Text>
                    <Text style={profileTabStyles.staffEmail}>{staff.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteStaffMember(staff.id)}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.smallText}>No staff members yet.</Text>
            )}
          </SurfaceCard>
        </>
      )}

      {/* ═══════════ PROMOTIONS TAB ═══════════ */}
      {activeTab === "promotions" && (
        <>
          <SurfaceCard>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.blockTitle}>Promotional Campaigns</Text>
            </View>
            <Text style={styles.smallText}>
              Upload banner ads for your practice. Posters appear on the patient home screen and landing page.
            </Text>

            {/* AI Prompt Card */}
            <View style={profileTabStyles.aiPromptCard}>
              <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={profileTabStyles.aiPromptTitle}>AI Poster Assistant</Text>
                <Text style={styles.smallText}>
                  Use ChatGPT to generate promotional poster content. Copy this prompt:
                </Text>
                <View style={profileTabStyles.promptBox}>
                  <Text style={profileTabStyles.promptText} numberOfLines={3}>
                    Create a healthcare promotional poster for Dr. {profile.name}, specialty: {profile.specialty}. Include clinic benefits, patient testimonials, and a call to action.
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      const promptText = `Create a healthcare promotional poster for Dr. ${profile.name}, specialty: ${profile.specialty}. Include clinic benefits, patient testimonials, and a call to action.`;
                      try {
                        await Clipboard.setStringAsync(promptText);
                        Alert.alert("Copied", "AI prompt copied to clipboard!");
                      } catch {
                        Alert.alert("Info", "Please copy the prompt manually.");
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SurfaceCard>

          {/* Posters Grid */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>My Posters</Text>
            {postersLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : posters.length > 0 ? (
              posters.map((poster) => (
                <View key={poster.id} style={profileTabStyles.posterCard}>
                  {poster.image_url && (
                    <Image
                      source={{ uri: toAbsoluteUrl(poster.image_url) }}
                      style={profileTabStyles.posterImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={profileTabStyles.posterInfo}>
                    <Pill
                      label={poster.status || "pending"}
                      tone={poster.status === "active" ? "success" : "warning"}
                    />
                    <Text style={profileTabStyles.posterDate}>
                      {formatDate(poster.created_at)}
                    </Text>
                    <TouchableOpacity onPress={() => deletePoster(poster.id)}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.smallText}>
                No posters yet. Upload banners from the web dashboard to promote your practice.
              </Text>
            )}
          </SurfaceCard>
        </>
      )}
    </ScreenScroll>
  );
}

export function DoctorPatientLookupScreen({ navigation }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  // Prescription builder
  const [rxForm, setRxForm] = useState({ medicine_name: "", dosage: "", frequency: "", duration: "" });
  const [savingRx, setSavingRx] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  // Voice recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const recordingRef = useRef(null);

  const startScanning = async () => {
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (res && res.granted) {
        setScanning(true);
      } else {
        Alert.alert("Permission Denied", "Camera permission is required to scan QR codes.");
      }
    } else {
      setScanning(true);
    }
  };

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

  async function addMedicine() {
    if (!rxForm.medicine_name.trim()) {
      Alert.alert("Required", "Please enter a medicine name.");
      return;
    }
    setSavingRx(true);
    try {
      await api.prescriptions.createManual({
        patient_id: patient.id,
        ...rxForm,
      });
      setRxForm({ medicine_name: "", dosage: "", frequency: "", duration: "" });
      Alert.alert("Added", "Medicine added to prescription pad.");
      await lookupWithCode(code.trim());
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingRx(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      Alert.alert("Finalized", "Prescription has been finalized and sent to the patient.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setFinalizing(false);
    }
  }

  // Voice recording functions
  async function startVoiceRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordedUri(null);
    } catch (err) {
      Alert.alert("Recording Error", err.message);
    }
  }

  async function stopVoiceRecording() {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setRecordedUri(uri);
      setIsRecording(false);
    } catch (err) {
      Alert.alert("Stop Error", err.message);
    }
  }

  async function uploadVoiceRecording() {
    if (!recordedUri || !patient) return;
    setUploadingRecording(true);
    try {
      await api.recordings.upload({
        audio: { uri: recordedUri, type: "audio/m4a", name: `consult_${Date.now()}.m4a` },
        patientId: patient.id,
      });
      setRecordedUri(null);
      Alert.alert("Uploaded", "Voice recording uploaded successfully.");
    } catch (err) {
      Alert.alert("Upload Failed", err.message);
    } finally {
      setUploadingRecording(false);
    }
  }

  const patient = result?.patient;
  const history = result?.ehrHistory || [];
  const activeMedicines = result?.activePrescriptions || result?.prescriptions || [];
  const sharedSections = result?.allowed_sections || [];
  const sharedReports = result?.reports || [];
  const latestMetrics = result?.latestMetrics || null;

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Patient Lookup"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />

      {/* ═══════════ PATIENT INTAKE ═══════════ */}
      <SurfaceCard>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Patient Intake</Text>
        </View>
        <Text style={styles.smallText}>Search or scan a patient</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Enter unique code..."
          placeholderTextColor={colors.outline}
          autoCapitalize="characters"
          style={styles.input}
        />
        <View style={styles.buttonRow}>
          <GradientButton
            label={loading ? "Searching..." : "Search"}
            icon="magnify"
            onPress={lookup}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Open QR Scanner"
            icon="qrcode-scan"
            onPress={startScanning}
            style={{ flex: 1 }}
          />
        </View>
      </SurfaceCard>

      {scanning && Platform.OS !== "web" ? (
        <SurfaceCard>
          <Text style={styles.blockTitle}>Scan Patient QR</Text>
          <CameraView
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
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

      {/* ═══════════ PATIENT PROFILE ═══════════ */}
      {patient ? (
        <>
          <SurfaceCard tone="low">
            <View style={styles.cardHeaderRow}>
              <Text style={styles.blockTitle}>Patient Profile</Text>
            </View>
            <View style={lookupStyles.profileHeader}>
              <AvatarBubble label={getInitials(patient.name)} size={56} tone="secondary" />
              <View style={{ flex: 1 }}>
                <Text style={lookupStyles.profileName}>{patient.name}</Text>
                <View style={lookupStyles.profileBadgeRow}>
                  {patient.age ? <Pill label={`${patient.age} YRS`} tone="info" /> : null}
                  {patient.gender ? <Pill label={patient.gender.toUpperCase()} tone="info" /> : null}
                </View>
              </View>
            </View>
            <DetailRow icon="email-outline" label="Email" value={patient.email || "N/A"} />
            <DetailRow icon="phone-outline" label="Phone" value={patient.phone || "N/A"} />
            <DetailRow icon="identifier" label="Unique Code" value={patient.unique_code || code || "N/A"} />

            {/* Shared sections */}
            {sharedSections.length > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[styles.smallText, { fontWeight: "700", marginBottom: 6 }]}>Shared with doctor</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {sharedSections.map((section) => (
                    <Pill key={section} label={section} tone="success" />
                  ))}
                </View>
              </View>
            )}
          </SurfaceCard>

          {/* ═══════════ SHARED HEALTH METRICS ═══════════ */}
          {latestMetrics && (
            <SurfaceCard>
              <Text style={styles.blockTitle}>Shared Health Metrics</Text>
              <View style={styles.infoGrid}>
                {[
                  { label: "Heart Rate", value: latestMetrics.heart_rate || latestMetrics.heartRate, unit: "bpm", icon: "heart-pulse" },
                  { label: "Blood Pressure", value: latestMetrics.blood_pressure || latestMetrics.bloodPressure, unit: "", icon: "water" },
                  { label: "SpO2", value: latestMetrics.spo2 || latestMetrics.oxygenSaturation, unit: "%", icon: "lungs" },
                  { label: "Glucose", value: latestMetrics.glucose || latestMetrics.bloodGlucose, unit: "mg/dL", icon: "needle" },
                ].filter((m) => m.value).map((m) => (
                  <View key={m.label} style={lookupStyles.metricMini}>
                    <MaterialCommunityIcons name={m.icon} size={16} color={colors.primary} />
                    <Text style={lookupStyles.metricLabel}>{m.label}</Text>
                    <Text style={lookupStyles.metricValue}>{String(m.value)}{m.unit ? ` ${m.unit}` : ""}</Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          )}

          {/* ═══════════ MEDICAL RECORD SNAPSHOTS ═══════════ */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>Medical Record Snapshots</Text>
            {history.length ? (
              history.map((entry) => (
                <View key={entry.id} style={lookupStyles.ehrCard}>
                  <Text style={lookupStyles.ehrDate}>{formatDate(entry.created_at || entry.timestamp)}</Text>
                  <Text style={lookupStyles.ehrDisease}>
                    Predicted disease: {entry.predictedDisease || "Unknown"}
                  </Text>
                  <Text style={styles.smallText}>
                    {entry.aiInsights || entry.insights || (
                      `Symptoms: ${Object.keys(entry.symptoms || {}).filter((k) => entry.symptoms[k]).join(", ") || "N/A"}`
                    )}
                  </Text>
                  {entry.ehr && (
                    <Text style={[styles.smallText, { marginTop: 4, fontStyle: "italic" }]}>
                      HR: {entry.ehr.heartRate || "—"} • Glucose: {entry.ehr.glucose || "—"} • BP: {entry.ehr.bloodPressure || "—"}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.smallText}>No EHR history available for this patient yet.</Text>
            )}
          </SurfaceCard>

          {/* ═══════════ PRESCRIPTION BUILDER ═══════════ */}
          <SurfaceCard>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.blockTitle}>Prescription Builder</Text>
            </View>
            <Text style={styles.smallText}>Add and adjust treatment</Text>

            {!sharedSections.includes("prescriptions") && !sharedSections.includes("ehr") && sharedSections.length > 0 && (
              <View style={lookupStyles.warningBanner}>
                <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#ff9800" />
                <Text style={lookupStyles.warningText}>
                  Patient history not shared. Queue access opened the patient profile only. Historical records stay hidden for this appointment.
                </Text>
              </View>
            )}

            <TextInput
              value={rxForm.medicine_name}
              onChangeText={(t) => setRxForm({ ...rxForm, medicine_name: t })}
              placeholder="Medicine name"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <TextInput
              value={rxForm.dosage}
              onChangeText={(t) => setRxForm({ ...rxForm, dosage: t })}
              placeholder="Dosage (e.g. 500mg)"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <TextInput
              value={rxForm.frequency}
              onChangeText={(t) => setRxForm({ ...rxForm, frequency: t })}
              placeholder="Frequency (e.g. Twice daily)"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <TextInput
              value={rxForm.duration}
              onChangeText={(t) => setRxForm({ ...rxForm, duration: t })}
              placeholder="Duration (e.g. 7 days)"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <GradientButton
              label={savingRx ? "Adding..." : "Add to Prescription"}
              icon="plus"
              onPress={addMedicine}
            />
          </SurfaceCard>

          {/* ═══════════ ACTIVE PRESCRIPTION PAD ═══════════ */}
          {activeMedicines.length > 0 && (
            <SurfaceCard>
              <Text style={styles.blockTitle}>Active Prescription Pad</Text>
              {activeMedicines.map((med, idx) => (
                <View key={med.id || idx} style={lookupStyles.activeMedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={lookupStyles.medName}>{med.medicine_name}</Text>
                    <Text style={lookupStyles.medMeta}>
                      {med.dosage || "—"} • {med.frequency || "—"} • {med.duration || "—"}
                    </Text>
                  </View>
                  <Pill label={med.status || "active"} tone={med.status === "stopped" ? "warning" : "success"} />
                </View>
              ))}
            </SurfaceCard>
          )}

          {/* ═══════════ DIAGNOSIS & INSTRUCTIONS ═══════════ */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>Diagnosis</Text>
            <TextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder="Enter diagnosis..."
              placeholderTextColor={colors.outline}
              multiline
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            />
            <Text style={[styles.blockTitle, { marginTop: spacing.md }]}>Additional Instructions</Text>
            <TextInput
              value={additionalInstructions}
              onChangeText={setAdditionalInstructions}
              placeholder="Any additional notes or advice..."
              placeholderTextColor={colors.outline}
              multiline
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            />
            <GradientButton
              label={finalizing ? "Finalizing..." : "Finalize & Send to Patient"}
              icon="check-decagram"
              onPress={handleFinalize}
            />
          </SurfaceCard>

          {/* ═══════════ VOICE PRESCRIPTION ═══════════ */}
          <SurfaceCard>
            <Text style={styles.blockTitle}>🎤 Voice Prescription</Text>
            <Text style={styles.smallText}>
              {isRecording ? "Recording in progress..." : recordedUri ? "Recording ready to upload" : "Record voice notes for this consultation"}
            </Text>
            <View style={styles.buttonRow}>
              {!isRecording && !recordedUri ? (
                <GradientButton
                  label="Start Recording"
                  icon="microphone-outline"
                  onPress={startVoiceRecording}
                  style={{ flex: 1 }}
                />
              ) : isRecording ? (
                <GradientButton
                  label="Stop Recording"
                  icon="stop-circle-outline"
                  onPress={stopVoiceRecording}
                  style={{ flex: 1 }}
                />
              ) : null}
              {recordedUri && !isRecording ? (
                <GradientButton
                  label={uploadingRecording ? "Uploading..." : "Upload Recording"}
                  icon="cloud-upload-outline"
                  onPress={uploadVoiceRecording}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </SurfaceCard>

          {/* ═══════════ SHARED REPORTS ═══════════ */}
          {sharedReports.length > 0 && (
            <SurfaceCard>
              <Text style={styles.blockTitle}>Shared Reports & Files</Text>
              {sharedReports.map((report, idx) => (
                <TouchableOpacity
                  key={report.id || idx}
                  style={lookupStyles.reportRow}
                  onPress={() => {
                    const url = toAbsoluteUrl(report.file_url || report.url);
                    if (url) Linking.openURL(url);
                  }}
                >
                  <MaterialCommunityIcons name="file-document-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={lookupStyles.reportName}>{report.name || report.file_name || `Report #${idx + 1}`}</Text>
                    <Text style={lookupStyles.reportMeta}>{formatDate(report.uploaded_at || report.created_at)}</Text>
                  </View>
                  <MaterialCommunityIcons name="open-in-new" size={16} color={colors.outline} />
                </TouchableOpacity>
              ))}
            </SurfaceCard>
          )}

          {/* Quick Nav */}
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
        </>
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
      await api.recordings.upload({
        audio: {
          uri: recordedUri,
          type: "audio/m4a",
          name: `consultation_${Date.now()}.m4a`,
        },
        patientId,
        appointmentId: appointmentId || undefined,
      });
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

function Stat({ label, value, icon = "calendar-check" }) {
  return (
    <SurfaceCard tone="lowest" style={styles.premiumStatCard}>
      <View style={styles.statIconCircle}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  premiumStatCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 8,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  infoGridCard: {
    width: "47%",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 8,
  },
  infoCardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  infoCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  dashboardListCard: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
  dashboardApptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  apptPatientName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  apptTimeMeta: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});

const earningStyles = StyleSheet.create({
  chartContainer: {
    marginVertical: spacing.sm,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
    gap: 6,
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
  },
  barTrack: {
    width: "100%",
    height: 120,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.outline,
  },
  methodRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  methodCard: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  methodLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.outline,
  },
  methodValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  paymentName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  paymentMeta: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
});

const lookupStyles = StyleSheet.create({
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  profileName: {
    fontSize: typography.h3,
    fontWeight: "800",
    color: colors.onSurface,
  },
  profileBadgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  metricMini: {
    width: "47%",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.outline,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  ehrCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  ehrDate: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.outline,
    marginBottom: 4,
  },
  ehrDisease: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 6,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff3e0",
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#e65100",
    lineHeight: 18,
  },
  activeMedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  medName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  medMeta: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  reportName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  reportMeta: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
});

const profileTabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.pill,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.outline,
  },
  tabBtnTextActive: {
    color: colors.onPrimary,
  },
  soloRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  soloLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 4,
  },
  staffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  staffName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  staffEmail: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  aiPromptCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  aiPromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 4,
  },
  promptBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  promptText: {
    flex: 1,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  posterCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  posterImage: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceHigh,
  },
  posterInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  posterDate: {
    flex: 1,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
});
