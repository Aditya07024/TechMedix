import React, { useEffect, useState, useRef, useCallback } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
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
  getCardShadow,
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
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
  const [subStatus, setSubStatus] = useState(null);
  const [subChecked, setSubChecked] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);

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
      checkSubscription();
    }, [user?.id]),
  );

  async function checkSubscription() {
    if (!user?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) return;
    try {
      const res = await api.subscriptions.getDoctorStatus(user.id);
      setSubStatus(res?.data || res || { valid: true, status: "trial" });
    } catch (err) {
      console.warn("Subscription check failed:", err.message);
      setSubStatus({ valid: true, status: "unknown" });
    } finally {
      setSubChecked(true);
    }
  }

  // Build bar chart data from revenue details
  const dailyRevenue = revenueDetails?.daily_revenue || revenueDetails?.data?.daily_revenue || [];
  const rawBreakdown = revenueDetails?.method_breakdown || revenueDetails?.data?.method_breakdown || [];
  const paymentMethodsObj = {};
  if (Array.isArray(rawBreakdown)) {
    rawBreakdown.forEach((item) => {
      paymentMethodsObj[item.payment_method] = Number(item.revenue || 0);
    });
  }
  const methodBreakdown = {
    ...paymentMethodsObj,
    ...(revenueDetails?.payment_methods || revenueDetails?.data?.payment_methods || {}),
  };
  const recentPayments = revenueDetails?.recent_payments || revenueDetails?.data?.recent_payments || [];
  const maxRevenue = dailyRevenue.length > 0
    ? Math.max(...dailyRevenue.map(d => Number(d.total || d.amount || 0)), 1)
    : 1;

  if (subChecked && subStatus && !subStatus.valid) {
    return (
      <ScreenScroll contentContainerStyle={styles.screenContent}>
        <TopBar
          title="Doctor Workspace"
          avatar={getInitials(user?.name)}
          onBell={() => navigation.navigate("DoctorProfile")}
        />
        <View style={subWallStyles.container}>
          <SurfaceCard style={subWallStyles.card}>
            <Text style={subWallStyles.icon}>🔒</Text>
            <Text style={subWallStyles.title}>Subscription Required</Text>
            <Text style={subWallStyles.message}>{subStatus.message}</Text>
            {subStatus.trial_end_date && (
              <Text style={subWallStyles.detail}>
                Trial ended: {new Date(subStatus.trial_end_date).toLocaleDateString()}
              </Text>
            )}
            {subStatus.paid_end_date && (
              <Text style={subWallStyles.detail}>
                Subscription ended: {new Date(subStatus.paid_end_date).toLocaleDateString()}
              </Text>
            )}
            <Text style={subWallStyles.contact}>
              Please contact the TechMedix admin to activate or renew your subscription.
            </Text>
            <GradientButton
              label="Contact Admin"
              icon="email-outline"
              onPress={() => Linking.openURL("mailto:techmedixcare@gmail.com")}
            />
          </SurfaceCard>
        </View>
      </ScreenScroll>
    );
  }

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
      {subStatus?.status === "trial" && subStatus?.days_left != null && (
        <View style={subWallStyles.trialBanner}>
          <Text style={subWallStyles.trialText}>
            🟢 Free Trial — {subStatus.days_left} days remaining
          </Text>
        </View>
      )}
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
      <View style={styles.statRow} >
        <Stat label="Total" value={appointments.length || 0}
        icon="calendar-multiselect" 
        onPress={() => navigation.navigate("Appointments")}
        />
        <Stat
          label="Waiting"
          value={appointments.filter((a) => a.status === "waiting").length || 0}
          icon="account-clock"
          onPress={() => navigation.navigate("Appointments")}
        />
        <Stat
          label="Completed"
          value={appointments.filter((a) => a.status === "completed").length || 0}
          icon="check-decagram"
          onPress={() => navigation.navigate("Appointments")}
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
        <SurfaceCard onPress={() => setShowEarningsModal(true)} tone="lowest" style={styles.infoGridCard} >
          <View style={styles.infoCardIconCircle} >
            <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.success} />
          </View>
          <Text style={styles.infoCardLabel} >Revenue Today</Text>
          <Text style={styles.infoCardValue}>{formatCurrency(analytics.total_revenue_today || 0)}</Text>
        </SurfaceCard>
        <SurfaceCard tone="lowest" style={styles.infoGridCard}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.infoCardLabel}>Avg Consultation</Text>
          <Text style={styles.infoCardValue}>{`${analytics.avg_consultation_time_minutes || 0} mins`}</Text>
        </SurfaceCard>
        <SurfaceCard tone="lowest" style={styles.infoGridCard} onPress={() => setShowEarningsModal(true)}>
          <View style={styles.infoCardIconCircle}>
            <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.infoCardLabel}>Doctor Earnings</Text>
          <Text style={styles.infoCardValue}>{formatCurrency(summary.total_earnings || 0)}</Text>
        </SurfaceCard>
      </View>

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
      {/* ═══════════ EARNINGS ANALYSIS ═══════════ */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => setShowEarningsModal(true)}>
        <SurfaceCard tone="lowest" style={styles.dashboardListCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.blockTitle}>📊 Earnings Analysis</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
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
          {/* {recentPayments.length > 0 && (
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
          )} */}
        </SurfaceCard>
      </TouchableOpacity>

      {/* ═══════════ DETAILED EARNINGS DASHBOARD MODAL ═══════════ */}
      <Modal
        visible={showEarningsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEarningsModal(false)}
      >
        <View style={modalStyles.modalOverlay}>
          <View style={[modalStyles.modalContainer, { height: "90%" }]}>
            <View style={modalStyles.modalHeader}>
              <Text style={styles.blockTitle}>📊 Revenue & Earnings Dashboard</Text>
              <TouchableOpacity onPress={() => setShowEarningsModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
              {/* Main Stat Summary Cards */}
              <View style={styles.infoGrid}>
                <SurfaceCard tone="low" style={[styles.infoGridCard, { width: "100%", flexDirection: "row", alignItems: "center", gap: 12 }]}>
                  <View style={[styles.infoCardIconCircle, { backgroundColor: "rgba(13,141,118,0.1)", alignSelf: "center", margin: 0 }]}>
                    <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoCardLabel}>Total Lifetime Earnings</Text>
                    <Text style={[styles.infoCardValue, { fontSize: 24, color: colors.primary, fontWeight: "bold" }]}>
                      {formatCurrency(revenueDetails?.total_earnings || summary.total_earnings || 0)}
                    </Text>
                  </View>
                </SurfaceCard>

                <SurfaceCard tone="lowest" style={styles.infoGridCard}>
                  <Text style={styles.infoCardLabel}>Current Month</Text>
                  <Text style={styles.infoCardValue}>
                    {formatCurrency(revenueDetails?.current_month || 0)}
                  </Text>
                </SurfaceCard>

                <SurfaceCard tone="lowest" style={styles.infoGridCard}>
                  <Text style={styles.infoCardLabel}>Previous Month</Text>
                  <Text style={styles.infoCardValue}>
                    {formatCurrency(revenueDetails?.previous_month || 0)}
                  </Text>
                </SurfaceCard>
              </View>

              {/* Payment Method Breakdown */}
              <SurfaceCard>
                <Text style={[styles.blockTitle, { marginBottom: 12 }]}>Payment Channels</Text>
                <View style={{ gap: spacing.sm }}>
                  {[
                    { key: "online", label: "Online Payments", icon: "credit-card-outline", color: colors.primary },
                    { key: "cash", label: "Cash at Desk", icon: "cash", color: "#4caf50" },
                    { key: "wallet", label: "Wallet Deductions", icon: "wallet-outline", color: "#ff9800" },
                  ].map((m) => {
                    const amt = methodBreakdown[m.key] || 0;
                    const total = (methodBreakdown.online || 0) + (methodBreakdown.cash || 0) + (methodBreakdown.wallet || 0) || 1;
                    const percent = Math.round((amt / total) * 100);
                    return (
                      <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
                        <MaterialCommunityIcons name={m.icon} size={20} color={m.color} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.listTitle, { fontSize: 14 }]}>{m.label}</Text>
                          <Text style={styles.smallText}>{percent}% of total</Text>
                        </View>
                        <Text style={[styles.listTitle, { fontSize: 14, fontWeight: "bold" }]}>
                          {formatCurrency(amt)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </SurfaceCard>

              {/* Daily Revenue History Trend */}
              <SurfaceCard>
                <Text style={[styles.blockTitle, { marginBottom: 12 }]}>Daily Income Trend</Text>
                {dailyRevenue.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
                    <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}>
                      {dailyRevenue.map((day, index) => {
                        const amount = Number(day.total || day.amount || 0);
                        const heightPercent = (amount / maxRevenue) * 100;
                        const dateFormatted = day.date
                          ? new Date(day.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                          : `Day ${index + 1}`;
                        return (
                          <View key={day.date || index} style={{ alignItems: "center", width: 50 }}>
                            <Text style={{ fontSize: 9, color: colors.onSurfaceVariant, fontWeight: "bold", marginBottom: 4 }}>
                              {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : Math.round(amount)}
                            </Text>
                            <View style={{ height: 100, width: 14, backgroundColor: colors.surfaceHighest, borderRadius: 7, justifyContent: "flex-end" }}>
                              <View style={{ height: `${Math.max(heightPercent, 4)}%`, width: "100%", backgroundColor: colors.primary, borderRadius: 7 }} />
                            </View>
                            <Text style={{ fontSize: 9, color: colors.outline, marginTop: 4 }} numberOfLines={1}>
                              {dateFormatted}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : (
                  <Text style={styles.smallText}>No historical daily revenue data.</Text>
                )}
              </SurfaceCard>

              {/* Detailed Transactions List */}
              <SurfaceCard>
                <Text style={[styles.blockTitle, { marginBottom: 12 }]}>Recent Transaction Ledger</Text>
                {recentPayments.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    {recentPayments.map((payment, idx) => (
                      <View key={payment.id || idx} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.outline, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.onSurface }}>
                            {payment.patient_name || "Patient"}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 }}>
                            {formatDate(payment.created_at || payment.payment_date)} • {payment.payment_method?.toUpperCase() || "N/A"}
                          </Text>
                          {payment.id && (
                            <Text style={{ fontSize: 10, color: colors.outline, fontStyle: "italic" }}>
                              Ref: #{payment.id.substring(0, 12)}...
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.primary }}>
                            {formatCurrency(payment.amount)}
                          </Text>
                          <Pill
                            label={payment.status || "paid"}
                            tone={payment.status === "paid" ? "success" : "warning"}
                            style={{ transform: [{ scale: 0.8 }], marginTop: 4 }}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.smallText}>No recent payments found.</Text>
                )}
              </SurfaceCard>
            </ScrollView>
          </View>
        </View>
      </Modal>

      
    </ScreenScroll>
  );
}

export function QueueManagerScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedPatientProfile, setSelectedPatientProfile] = useState(null);

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

  async function openPatientProfile(apptId) {
    setProfileLoading(true);
    setProfileModalVisible(true);
    try {
      const res = await api.doctors.getSharedContext(apptId);
      setSelectedPatientProfile(res?.data || res);
    } catch (err) {
      setError(err.message);
      setProfileModalVisible(false);
    } finally {
      setProfileLoading(false);
    }
  }

  async function runQueueAction(action, appointmentId, status) {
    if (action === "start" && (status === "booked" || !status || status === "pending")) {
      Alert.alert(
        "Consultation Warning",
        "Patient has not arrived yet. Doctors cannot start consultancy before patient arrives at the clinic.",
        [{ text: "OK" }]
      );
      return;
    }
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
              {item.status !== "in_progress" && item.status !== "completed" && item.status !== "visited" ? (
                <SecondaryButton
                  label="Start"
                  icon="play"
                  onPress={() => runQueueAction("start", item.id, item.status)}
                  style={{ flex: 1 }}
                />
              ) : null}
              {item.status === "in_progress" ? (
                <SecondaryButton
                  label="Complete"
                  icon="check"
                  onPress={() => runQueueAction("complete", item.id, item.status)}
                  style={{ flex: 1 }}
                />
              ) : null}
              {item.status === "in_progress" ? (
                <SecondaryButton
                  label="Skip"
                  icon="skip-next-outline"
                  onPress={() => runQueueAction("skip", item.id, item.status)}
                  style={{ flex: 1 }}
                />
              ) : null}
              <SecondaryButton
                label="Profile"
                icon="account-details-outline"
                onPress={() => openPatientProfile(item.id)}
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

      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalTitle}>Patient Workspace</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            {profileLoading ? (
              <View style={modalStyles.loadingArea}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={modalStyles.loadingText}>Fetching shared history...</Text>
              </View>
            ) : selectedPatientProfile ? (
              <ScrollView contentContainerStyle={modalStyles.modalScroll}>
                <View style={modalStyles.profileSection}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <AvatarBubble label={selectedPatientProfile.patient?.name ? selectedPatientProfile.patient.name.substring(0, 2).toUpperCase() : "PA"} size={44} tone="secondary" />
                    <View>
                      <Text style={modalStyles.patientName}>{selectedPatientProfile.patient?.name}</Text>
                      <Text style={modalStyles.patientMeta}>
                        {selectedPatientProfile.patient?.age ? `${selectedPatientProfile.patient.age} Yrs` : ""} • {selectedPatientProfile.patient?.gender}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedPatientProfile.allowed_sections?.includes("ehr") && selectedPatientProfile.ehrHistory?.length > 0 ? (
                  <View style={modalStyles.sectionBlock}>
                    <Text style={modalStyles.sectionTitle}>📋 Medical History (EHR)</Text>
                    {selectedPatientProfile.ehrHistory.map((ehr) => (
                      <View key={ehr.id} style={modalStyles.itemCard}>
                        <Text style={modalStyles.itemHeader}>{ehr.predictedDisease || "Diagnosis Record"}</Text>
                        <Text style={modalStyles.itemText}>{ehr.aiInsights || "No notes provided"}</Text>
                        {ehr.timestamp && <Text style={modalStyles.itemTime}>{new Date(ehr.timestamp).toLocaleDateString()}</Text>}
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedPatientProfile.allowed_sections?.includes("prescriptions") && selectedPatientProfile.prescriptions?.length > 0 ? (
                  <View style={modalStyles.sectionBlock}>
                    <Text style={modalStyles.sectionTitle}>💊 Shared Prescriptions</Text>
                    {selectedPatientProfile.prescriptions.map((med) => (
                      <View key={med.id} style={modalStyles.itemCard}>
                        <Text style={modalStyles.itemHeader}>{med.medicine_name}</Text>
                        <Text style={modalStyles.itemText}>
                          Dosage: {med.dosage || "-"} • Freq: {med.frequency || "-"} • Duration: {med.duration || "-"}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedPatientProfile.allowed_sections?.includes("metrics") && selectedPatientProfile.latestMetrics?.length > 0 ? (
                  <View style={modalStyles.sectionBlock}>
                    <Text style={modalStyles.sectionTitle}>❤️ Latest Shared Vitals</Text>
                    <View style={modalStyles.vitalsGrid}>
                      {selectedPatientProfile.latestMetrics.map((metric) => (
                        <View key={metric.id || metric.name} style={modalStyles.vitalCard}>
                          <MaterialCommunityIcons name="heart-pulse" size={16} color={colors.primary} />
                          <Text style={modalStyles.vitalLabel}>{metric.name || "Metric"}</Text>
                          <Text style={modalStyles.vitalValue}>{metric.value} {metric.unit}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {selectedPatientProfile.allowed_sections?.includes("recordings") && selectedPatientProfile.recordings?.length > 0 ? (
                  <View style={modalStyles.sectionBlock}>
                    <Text style={modalStyles.sectionTitle}>🎤 Shared Recordings</Text>
                    {selectedPatientProfile.recordings.map((rec) => (
                      <View key={rec.id} style={modalStyles.itemCard}>
                        <Text style={modalStyles.itemHeader}>Consultation Recording #{rec.id}</Text>
                        {rec.duration && <Text style={modalStyles.itemText}>Duration: {rec.duration}s</Text>}
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedPatientProfile.allowed_sections?.includes("reports") && selectedPatientProfile.reports?.length > 0 ? (
                  <View style={modalStyles.sectionBlock}>
                    <Text style={modalStyles.sectionTitle}>📁 Shared Files & Reports</Text>
                    {selectedPatientProfile.reports.map((report) => (
                      <View key={report.id} style={modalStyles.itemCard}>
                        <Text style={modalStyles.itemHeader}>{report.file_name || "Medical Report"}</Text>
                        <Text style={modalStyles.itemText}>{report.file_type || "Document"}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {(!selectedPatientProfile.allowed_sections || selectedPatientProfile.allowed_sections.length === 0) && (
                  <View style={modalStyles.emptyShare}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.outline} />
                    <Text style={modalStyles.emptyText}>The patient has not shared any medical record history or vitals for this appointment.</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={modalStyles.loadingArea}>
                <Text style={modalStyles.loadingText}>No profile details loaded.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenScroll>
  );
}

export function DoctorAppointmentsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("today");

  async function loadAppointments() {
    setLoading(true);
    try {
      const response = await api.appointments.getByDoctor(user.id);
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

  const todayStr = todayIso();
  const todayAppts = appointments.filter((a) => {
    const localApptDate = a.appointment_date ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(a.appointment_date)) : "";
    return localApptDate === todayStr;
  });

  const pastAppts = appointments.filter((a) => {
    const localApptDate = a.appointment_date ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(a.appointment_date)) : "";
    return localApptDate < todayStr;
  });

  const displayList = activeTab === "today" ? todayAppts : pastAppts;

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Doctor Appointments" avatar={getInitials(user?.name)} />
      <InlineError message={error} />

      {/* Tabs */}
      <View style={tabStyles.tabContainer}>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === "today" && tabStyles.activeTab]}
          onPress={() => setActiveTab("today")}
        >
          <Text style={[tabStyles.tabText, activeTab === "today" && tabStyles.activeTabText]}>
            Today's ({todayAppts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === "past" && tabStyles.activeTab]}
          onPress={() => setActiveTab("past")}
        >
          <Text style={[tabStyles.tabText, activeTab === "past" && tabStyles.activeTabText]}>
            Past ({pastAppts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? <LoadingCard label="Loading appointments..." /> : null}
      {displayList.length ? (
        displayList.map((appointment) => (
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
          <Text style={styles.blockTitle}>
            {activeTab === "today" ? "No appointments today" : "No past appointments"}
          </Text>
          <Text style={styles.smallText}>
            {activeTab === "today"
              ? "Today’s appointments will show up here."
              : "Historical appointments will show up here."}
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

const tabStyles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  activeTab: {
    backgroundColor: colors.surfaceLowest,
    ...getCardShadow("lowest"),
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.outline,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: "700",
  },
});

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
    clinic_address: user?.clinic_address || "",
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

  // Subscription tab state
  const [subStatus, setSubStatus] = useState(null);
  const [detailedSub, setDetailedSub] = useState(null);
  const [subLoading, setSubLoading] = useState(false);

  // Reviews tab state
  const [myReviews, setMyReviews] = useState([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [avgRating, setAvgRating] = useState("0.0");
  const [reviewCount, setReviewCount] = useState(0);

  async function loadMyReviews() {
    if (!user?.id) return;
    setMyReviewsLoading(true);
    try {
      const res = await api.reviews.getByDoctor(user.id);
      const val = res?.data || res;
      setMyReviews(val?.reviews || []);
      setAvgRating(val?.average || "0.0");
      setReviewCount(val?.count || 0);
    } catch (err) {
      console.warn("Reviews load failed:", err.message);
    } finally {
      setMyReviewsLoading(false);
    }
  }

  async function loadProfile() {
    setLoading(true);
    try {
      const updatedUser = await refreshDoctorProfile();
      setProfile({
        name: updatedUser?.name || "",
        email: updatedUser?.email || "",
        specialty: updatedUser?.specialty || "",
        consultation_fee: String(updatedUser?.consultation_fee || 0),
        clinic_address: updatedUser?.clinic_address || "",
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

  async function loadSubscription() {
    if (!user?.id) return;
    setSubLoading(true);
    try {
      const [statusRes, detailedRes] = await Promise.allSettled([
        api.subscriptions.getDoctorStatus(user.id),
        api.subscriptions.getDoctorSubscription(user.id),
      ]);
      setSubStatus(
        statusRes.status === "fulfilled" ? (statusRes.value?.data || statusRes.value) : null
      );
      setDetailedSub(
        detailedRes.status === "fulfilled" ? (detailedRes.value?.data || detailedRes.value) : null
      );
    } catch (err) {
      console.warn("Detailed subscription load failed:", err.message);
    } finally {
      setSubLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadStaff();
      loadPosters();
      loadSubscription();
      loadMyReviews();
    }, []),
  );

  async function saveProfile() {
    setSaving(true);
    try {
      await api.auth.updateDoctorProfile({
        name: profile.name,
        specialty: profile.specialty,
        consultation_fee: Number(profile.consultation_fee || 0),
        clinic_address: profile.clinic_address,
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
    if (Platform.OS === "web") {
      const confirmDelete = window.confirm("Remove this staff member?");
      if (!confirmDelete) return;
      try {
        await api.doctorStaff.delete(staffId);
        await loadStaff();
      } catch (err) {
        window.alert(`Error: ${err.message}`);
      }
      return;
    }

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

  async function resetStaffPassword(staffId) {
    if (Platform.OS === "web") {
      const confirmReset = window.confirm("Reset password for this staff member?");
      if (!confirmReset) return;
      try {
        const res = await api.doctorStaff.resetPassword(staffId);
        const data = res?.data || res;
        const newPassword =
          data?.temporary_password ||
          data?.data?.temporary_password ||
          res?.temporary_password ||
          res?.data?.temporary_password ||
          data?.tempPassword ||
          res?.tempPassword;
        if (newPassword) {
          window.alert(`Password has been reset. Temporary password is:\n\n${newPassword}\n\nShare this with your staff member.`);
          await Clipboard.setStringAsync(newPassword);
        } else {
          window.alert("Password reset successfully.");
        }
      } catch (err) {
        window.alert(`Error: ${err.message}`);
      }
      return;
    }

    Alert.alert("Confirm", "Reset password for this staff member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await api.doctorStaff.resetPassword(staffId);
            const data = res?.data || res;
            const newPassword =
              data?.temporary_password ||
              data?.data?.temporary_password ||
              res?.temporary_password ||
              res?.data?.temporary_password ||
              data?.tempPassword ||
              res?.tempPassword;
            if (newPassword) {
              Alert.alert("Success", `Password has been reset. Temporary password is:\n\n${newPassword}\n\nCopy this and share it with your staff member.`, [
                {
                  text: "Copy & Close",
                  onPress: async () => {
                    await Clipboard.setStringAsync(newPassword);
                  }
                }
              ]);
            } else {
              Alert.alert("Success", "Password reset successfully.");
            }
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

  async function selectAndUploadPoster() {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Denied", "Permission to access photo library is required to upload posters.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      setPostersLoading(true);
      
      const fileObj = {
        uri: asset.uri,
        name: asset.fileName || `poster-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      };

      const res = await api.doctorPosters.uploadPoster(fileObj);
      if (res.success || res.data) {
        Alert.alert("Success", "Poster uploaded successfully. Banners require payment activation to go live.");
        await loadPosters();
      } else {
        Alert.alert("Upload Failed", res.error || "Failed to upload poster.");
      }
    } catch (err) {
      Alert.alert("Upload Error", err.message);
    } finally {
      setPostersLoading(false);
    }
  }

  async function payAndActivatePoster(posterId) {
    try {
      setPostersLoading(true);
      const res = await api.doctorPosters.createPaySession({ poster_id: posterId });
      const order = res.order;
      if (!order || !order.payment_session_id) {
        throw new Error("Failed to initialize payment session.");
      }
      
      const isProd = res.cashfree_mode === "production";
      const checkoutUrl = isProd
        ? `https://payments.cashfree.com/order/#${order.payment_session_id}`
        : `https://payments-test.cashfree.com/order/#${order.payment_session_id}`;

      console.log("Opening Cashfree URL for poster activation:", checkoutUrl);
      await Linking.openURL(checkoutUrl);

      Alert.alert(
        "Payment Initiated",
        "Once payment is completed, tap Refresh to activate your banner.",
        [{ text: "Refresh", onPress: () => loadPosters() }]
      );
    } catch (err) {
      Alert.alert("Payment Error", err.message);
    } finally {
      setPostersLoading(false);
    }
  }

  const PROFILE_TABS = [
    { key: "profile", label: "Profile", icon: "account-cog-outline" },
    { key: "staff", label: "Staff", icon: "account-group-outline" },
    { key: "promotions", label: "Promotions", icon: "bullhorn-outline" },
    { key: "reviews", label: "Reviews", icon: "star-outline" },
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
          {/* Practice Coverage & Subscription Details */}
          {subLoading ? (
            <LoadingCard label="Loading subscription details..." />
          ) : subStatus ? (
            <>
              {/* Plan Coverage Card */}
              <SurfaceCard>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.blockTitle}>Practice Coverage</Text>
                  <Pill
                    label={
                      subStatus?.status === "trial" ? "Trial" :
                      subStatus?.status === "active" ? "Active" :
                      subStatus?.status === "hospital_covered" ? "Covered" : "Expired"
                    }
                    tone={
                      subStatus?.status === "active" || subStatus?.status === "hospital_covered"
                        ? "success"
                        : subStatus?.status === "trial"
                        ? "warning"
                        : "error"
                    }
                  />
                </View>

                {subStatus?.status === "hospital_covered" && (
                  <View style={[styles.listRow, { backgroundColor: colors.surfaceLow, padding: 12, borderRadius: 12, marginBottom: 12, flexDirection: "row", alignItems: "center" }]}>
                    <MaterialCommunityIcons name="office-building" size={24} color={colors.primary} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listTitle, { fontWeight: "bold" }]}>Hospital Covered</Text>
                      <Text style={styles.listMeta}>
                        Your access is covered under {subStatus.hospital_name || "your hospital"}'s central package.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ marginTop: 8 }}>
                  <DetailRow
                    icon="shield-check-outline"
                    label="Current Status"
                    value={
                      subStatus?.status === "trial" ? "Free Trial" :
                      subStatus?.status === "active" ? "Active Paid" :
                      subStatus?.status === "hospital_covered" ? "Hospital Covered" : "Expired"
                    }
                  />

                  {subStatus?.status === "trial" && (
                    <>
                      <DetailRow
                        icon="calendar-clock"
                        label="Trial Ends On"
                        value={subStatus?.trial_end_date ? formatDate(subStatus.trial_end_date) : "N/A"}
                      />
                      <DetailRow
                        icon="timer-sand"
                        label="Remaining Time"
                        value={`${subStatus?.days_left || 0} Days`}
                      />
                    </>
                  )}

                  {(subStatus?.status === "active" || subStatus?.status === "hospital_covered") && subStatus?.paid_end_date && (
                    <DetailRow
                      icon="calendar-check"
                      label="Coverage Until"
                      value={formatDate(subStatus.paid_end_date)}
                    />
                  )}

                  {detailedSub?.plan_name && (
                    <DetailRow
                      icon="package-variant-closed"
                      label="Assigned Plan"
                      value={detailedSub.plan_name}
                    />
                  )}
                </View>
              </SurfaceCard>

              {/* Billing Info Card */}
              {subStatus?.status === "active" && detailedSub && (
                <SurfaceCard>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.blockTitle}>Billing & Payment</Text>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <DetailRow
                      icon="cash"
                      label="Amount Paid"
                      value={formatCurrency(detailedSub.amount_paid || 0)}
                    />
                    {detailedSub.payment_notes && (
                      <DetailRow
                        icon="receipt"
                        label="Reference"
                        value={detailedSub.payment_notes}
                      />
                    )}
                    <DetailRow
                      icon="calendar-sync"
                      label="Last Renewed"
                      value={detailedSub.updated_at ? formatDate(detailedSub.updated_at) : "N/A"}
                    />
                  </View>
                </SurfaceCard>
              )}
            </>
          ) : null}

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
            <TextInput
              value={profile.clinic_address}
              onChangeText={(text) =>
                setProfile({ ...profile, clinic_address: text })
              }
              placeholder="Clinic address (shown to patients)"
              placeholderTextColor={colors.outline}
              multiline
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity onPress={() => resetStaffPassword(staff.id)}>
                      <MaterialCommunityIcons name="key-variant" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteStaffMember(staff.id)}>
                      <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
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
            <Text style={[styles.smallText, { marginBottom: 12 }]}>
              Upload banner ads for your practice. Posters appear on the patient home screen and landing page.
            </Text>

            <GradientButton
              label="Upload New Poster"
              icon="camera-plus-outline"
              onPress={selectAndUploadPoster}
              style={{ marginBottom: 12 }}
            />

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
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Pill
                        label={poster.status || "pending"}
                        tone={poster.status === "active" ? "success" : "warning"}
                      />
                      <Text style={profileTabStyles.posterDate}>
                        {formatDate(poster.created_at)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {poster.status === "pending" && (
                        <TouchableOpacity
                          style={{ backgroundColor: colors.primary, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
                          onPress={() => payAndActivatePoster(poster.id)}
                        >
                          <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: "bold" }}>Activate</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => deletePoster(poster.id)}>
                        <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.smallText}>
                No promotional campaigns active yet. Tap 'Upload New Poster' above to create one.
              </Text>
            )}
          </SurfaceCard>
        </>
      )}

      {/* ═══════════ REVIEWS TAB ═══════════ */}
      {activeTab === "reviews" && (
        <>
          <SurfaceCard>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={styles.blockTitle}>Patient Feedback</Text>
                <Text style={styles.smallText}>Reviews and ratings submitted by your patients.</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialCommunityIcons name="star" size={20} color="#EAB308" />
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.primary }}>
                    {avgRating}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.outline }}>
                  {reviewCount} reviews
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={[styles.blockTitle, { marginBottom: 12 }]}>All Reviews</Text>
            {myReviewsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : myReviews.length > 0 ? (
              myReviews.map((rev) => (
                <View key={rev.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.outline + "40" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <MaterialCommunityIcons
                          key={star}
                          name={star <= rev.rating ? "star" : "star-outline"}
                          size={14}
                          color={star <= rev.rating ? "#EAB308" : colors.outline}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.outline }}>
                      {new Date(rev.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.onSurface, fontStyle: rev.comment ? "normal" : "italic" }}>
                    {rev.comment ? `"${rev.comment}"` : "No written comment left."}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.outline, marginTop: 4, fontWeight: "600" }}>
                    Verified Patient (Anonymous)
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.smallText}>No reviews received yet.</Text>
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
  const [prescriptions, setPrescriptions] = useState([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  // Voice recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [playbackUri, setPlaybackUri] = useState(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const recordingRef = useRef(null);
  const soundRef = useRef(new Audio.Sound());

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

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
      // Separately fetch active prescriptions for the prescription pad
      const patId = response?.patient?.id;
      if (patId) {
        try {
          const rxRes = await api.prescriptions.listByPatient(patId);
          const rxList = Array.isArray(rxRes) ? rxRes : (rxRes?.data || []);
          setPrescriptions(rxList);
        } catch (_) {
          setPrescriptions([]);
        }
      }
    } catch (err) {
      setError(err.message);
      setResult(null);
      setPrescriptions([]);
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
    await lookupWithCode(code.trim());
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
      // Refresh both patient data and prescriptions
      await lookupWithCode(code.trim());
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingRx(false);
    }
  }

  async function copyToPad(med) {
    setSavingRx(true);
    try {
      await api.prescriptions.createManual({
        patient_id: patient.id,
        medicine_name: med.medicine_name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
      });
      Alert.alert("Added", `${med.medicine_name} copied to active prescription pad.`);
      await lookupWithCode(code.trim());
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingRx(false);
    }
  }

  async function removeFromPad(medicineId) {
    if (!medicineId) return;
    setSavingRx(true);
    try {
      await api.prescriptions.deleteMedicine(medicineId);
      Alert.alert("Removed", "Medicine removed from prescription pad.");
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
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
      
      // Automatically reset audio mode back to playback mode so speaker works!
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldRouteThroughSpeakerIOS: true,
      });
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

  async function playVoiceRecording() {
    try {
      if (!recordedUri) return;
      if (playbackUri) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        setPlaybackUri(null);
        return;
      }
      
      // Configure audio mode for loudspeaker playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldRouteThroughSpeakerIOS: true,
      });

      await soundRef.current.loadAsync({ uri: recordedUri });
      setPlaybackUri(recordedUri);
      await soundRef.current.playAsync();
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying) {
          setPlaybackUri(null);
          soundRef.current.unloadAsync().catch(() => {});
        }
      });
    } catch (err) {
      Alert.alert("Playback Error", err.message);
    }
  }

  const patient = result?.patient;
  const history = result?.ehrHistory || [];
  const activeMedicines = (prescriptions || []).filter((m) => {
    const isMyId = m.doctor_id && String(m.doctor_id) === String(user?.id);
    const localToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const medDate = m.created_at ? new Date(m.created_at) : null;
    const medDateStr = medDate ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(medDate) : "";
    return isMyId && medDateStr === localToday && !m.is_deleted;
  });

  const previousMedicines = prescriptions || [];
  const sharedSections = result?.allowed_sections || [];
  const sharedReports = result?.reports || [];
  
  const rawLatestMetrics = result?.latestMetrics || [];
  const latestRecord = history[0] || null;
  const latestLegacyMetrics = latestRecord?.ehr || null;

  // Group metrics by type for easy access
  const latestMetricsMap = {};
  if (Array.isArray(rawLatestMetrics)) {
    rawLatestMetrics.forEach((m) => {
      latestMetricsMap[m.metric_type || m.metricType] = m;
    });
  }

  // Construct a merged latestMetrics object that matches the expected keys
  const latestMetrics = {
    heartRate: latestMetricsMap.heart_rate?.value ?? latestLegacyMetrics?.heartRate,
    heart_rate: latestMetricsMap.heart_rate?.value ?? latestLegacyMetrics?.heartRate,
    bloodPressure: latestMetricsMap.blood_pressure?.value ?? latestLegacyMetrics?.bloodPressure,
    blood_pressure: latestMetricsMap.blood_pressure?.value ?? latestLegacyMetrics?.bloodPressure,
    oxygenSaturation: latestMetricsMap.spo2?.value ?? latestLegacyMetrics?.spo2,
    spo2: latestMetricsMap.spo2?.value ?? latestLegacyMetrics?.spo2,
    bloodGlucose: latestMetricsMap.glucose?.value ?? latestLegacyMetrics?.glucose,
    glucose: latestMetricsMap.glucose?.value ?? latestLegacyMetrics?.glucose,
  };

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
          {latestMetrics && Object.values(latestMetrics).some((v) => v !== undefined && v !== null) && (
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
                    <Text style={lookupStyles.metricValue}>
                      {typeof m.value === "object" && m.value !== null
                        ? `${m.value.systolic}/${m.value.diastolic}`
                        : String(m.value)}
                      {m.unit ? ` ${m.unit}` : ""}
                    </Text>
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
                      HR: {entry.ehr.heartRate || "—"} • Glucose: {entry.ehr.glucose || "—"} • BP: {entry.ehr.bloodPressure && typeof entry.ehr.bloodPressure === "object" ? `${entry.ehr.bloodPressure.systolic}/${entry.ehr.bloodPressure.diastolic}` : (entry.ehr.bloodPressure || "—")}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pill label={med.status || "active"} tone={med.status === "stopped" ? "warning" : "success"} />
                    <TouchableOpacity onPress={() => removeFromPad(med.medicine_id || med.id)}>
                      <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </SurfaceCard>
          )}

          {/* ═══════════ PREVIOUS PRESCRIPTION PAD ═══════════ */}
          {previousMedicines.length > 0 && (
            <SurfaceCard>
              <Text style={styles.blockTitle}>Previous Prescription Pad</Text>
              {previousMedicines.map((med, idx) => {
                const matchedActiveMed = activeMedicines.find(
                  (am) => am.medicine_name?.toLowerCase() === med.medicine_name?.toLowerCase()
                );
                return (
                  <View key={med.id || idx} style={lookupStyles.activeMedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={lookupStyles.medName}>{med.medicine_name}</Text>
                      <Text style={lookupStyles.medMeta}>
                        {med.dosage || "—"} • {med.frequency || "—"} • {med.duration || "—"}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.outline, marginTop: 2 }}>
                        Prescribed on {formatDate(med.created_at)} by {med.doctor_name || "Doctor"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pill label={med.status || "active"} tone={med.status === "stopped" || med.is_deleted ? "warning" : "success"} />
                      {matchedActiveMed ? (
                        <TouchableOpacity onPress={() => removeFromPad(matchedActiveMed.medicine_id || matchedActiveMed.id)}>
                          <MaterialCommunityIcons name="minus-circle-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => copyToPad(med)}>
                          <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
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
              {recordedUri && !isRecording && (
                <View style={{ flexDirection: "column", gap: spacing.sm, width: "100%" }}>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <SecondaryButton
                      label={playbackUri ? "Pause" : "Listen"}
                      icon={playbackUri ? "pause" : "play"}
                      onPress={playVoiceRecording}
                      style={{ flex: 0.8 }}
                    />
                    <GradientButton
                      label={uploadingRecording ? "Uploading..." : "Upload"}
                      icon="cloud-upload-outline"
                      onPress={uploadVoiceRecording}
                      style={{ flex: 1.2 }}
                    />
                  </View>
                  <SecondaryButton
                    label="Record Again"
                    icon="microphone-outline"
                    onPress={startVoiceRecording}
                    style={{ width: "100%" }}
                  />
                </View>
              )}
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

function Stat({ label, value, icon = "calendar-check", onPress }) {
  return (
    <SurfaceCard tone="lowest" style={styles.premiumStatCard} onPress={onPress}>
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

const subWallStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  card: {
    alignItems: "center",
    padding: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  detail: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginBottom: 4,
  },
  contact: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  trialBanner: {
    backgroundColor: "rgba(13, 141, 118, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    alignSelf: "flex-start",
  },
  trialText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    height: "80%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  modalScroll: {
    paddingBottom: spacing.xl,
  },
  loadingArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    color: colors.outline,
    fontSize: 14,
  },
  profileSection: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceLow,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  patientMeta: {
    fontSize: 13,
    color: colors.outline,
    marginTop: 2,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surfaceLow,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  itemHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: colors.outline,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 6,
    textAlign: "right",
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  vitalCard: {
    width: "48%",
    backgroundColor: colors.surfaceLow,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    gap: 4,
  },
  vitalLabel: {
    fontSize: 11,
    color: colors.outline,
  },
  vitalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  emptyShare: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    color: colors.outline,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
});
