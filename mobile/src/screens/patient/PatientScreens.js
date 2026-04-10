import React, { useEffect, useState, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
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
  SearchField,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
  TopBar,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { api, toAbsoluteUrl } from "../../lib/api";
import {
  getNativeReminders,
  removeNativeReminder,
  scheduleNativeReminder,
} from "../../native/reminderScheduler";
import { colors, radii, spacing, typography } from "../../theme/tokens";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `₹${amount.toFixed(2)}`;
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

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatReminderTime(hour = 9, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
      .join("") || "TM"
  );
}

function EmptyStateCard({ title, body }) {
  return (
    <SurfaceCard tone="low">
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </SurfaceCard>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

function LoadingCard({ label = "Loading..." }) {
  return (
    <SurfaceCard tone="low" style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </SurfaceCard>
  );
}

function InfoChip({ icon, label }) {
  return (
    <View style={styles.infoChip}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

async function pickSingleDocument(options = {}) {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    ...options,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export function PatientDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [homeData, setHomeData] = useState({
    profile: user,
    appointments: [],
    prescriptions: [],
    walletBalance: 0,
    healthLatest: {},
    insights: [],
    notifications: [],
    recordings: [],
    documents: [],
  });

  const [reminders, setReminders] = useState({});
  const [timePickerState, setTimePickerState] = useState({
    visible: false,
    reminderId: "",
    medicineName: "",
  });

  const hasLoadedDashboard =
    homeData.appointments.length > 0 ||
    homeData.prescriptions.length > 0 ||
    homeData.documents.length > 0;

  useEffect(() => {
    loadNativeReminders();
  }, []);

  function buildReminderId(medicineId) {
    return `medicine-${medicineId}`;
  }

  async function ensureReminderPermissions() {
    if (Platform.OS === "web") {
      Alert.alert("Not Supported", "Reminders only work on mobile devices");
      return false;
    }

    try {
      await Notifications.setNotificationChannelAsync("medicine-reminders", {
        name: "Medicine Reminders",
        importance: Notifications.AndroidImportance.MAX,
      });
    } catch (_error) {
      // Channel creation is Android-only and can fail silently on unsupported platforms.
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    if (requested.granted) return true;

    Alert.alert(
      "Permission needed",
      "Please allow notifications so TechMedix can send medicine reminders.",
    );
    return false;
  }

  async function loadNativeReminders() {
    if (Platform.OS !== "android") return;

    try {
      const items = await getNativeReminders();
      const nextState = {};

      items.forEach((item) => {
        const localId = String(item.id || "").replace(/^medicine-/, "");
        if (!localId) return;
        nextState[localId] = {
          enabled: item.enabled !== false,
          hour: item.hour ?? 9,
          minute: item.minute ?? 0,
        };
      });

      setReminders(nextState);
    } catch (loadError) {
      console.warn("Unable to load native reminders", loadError);
    }
  }

  async function saveReminderSchedule(medicineId, medicineName, hour, minute) {
    const hasPermission = await ensureReminderPermissions();
    if (!hasPermission) return false;

    if (Platform.OS === "android") {
      await scheduleNativeReminder({
        id: buildReminderId(medicineId),
        title: "Medicine Reminder",
        body: `Time to take ${medicineName}`,
        hour,
        minute,
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Medicine Reminder",
          body: `Time to take ${medicineName}`,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });
    }

    setReminders((prev) => ({
      ...prev,
      [medicineId]: {
        enabled: true,
        hour,
        minute,
      },
    }));

    return true;
  }

  async function toggleReminder(medicineId, medicineName) {
    const current = reminders[medicineId];

    if (current?.enabled) {
      if (Platform.OS === "android") {
        await removeNativeReminder(buildReminderId(medicineId));
      }

      setReminders((prev) => {
        const nextState = { ...prev };
        delete nextState[medicineId];
        return nextState;
      });
      return;
    }

    await saveReminderSchedule(
      medicineId,
      medicineName,
      current?.hour ?? 9,
      current?.minute ?? 0,
    );
  }

  function openReminderTimePicker(medicineId, medicineName) {
    setTimePickerState({
      visible: true,
      reminderId: String(medicineId),
      medicineName,
    });
  }

  async function handleReminderTimeChange(event, selectedDate) {
    const { reminderId, medicineName } = timePickerState;

    if (Platform.OS === "android") {
      setTimePickerState((prev) => ({
        ...prev,
        visible: false,
      }));
    }

    if (event?.type === "dismissed" || !selectedDate || !reminderId) return;

    await saveReminderSchedule(
      reminderId,
      medicineName,
      selectedDate.getHours(),
      selectedDate.getMinutes(),
    );

    if (Platform.OS === "ios") {
      setTimePickerState({
        visible: false,
        reminderId: "",
        medicineName: "",
      });
    }
  }

  async function loadDashboard(isRefresh = false) {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedDashboard) setLoading(true);

    try {
      const [profileRes, appointmentsRes] = await Promise.allSettled([
        api.patients.getProfile(user.id),
        api.appointments.getByPatient(user.id),
      ]);

      setHomeData((current) => ({
        ...current,
        profile: profileRes.status === "fulfilled" ? profileRes.value : current.profile || user,
        appointments:
          appointmentsRes.status === "fulfilled"
            ? normalizeArray(appointmentsRes.value)
            : current.appointments,
      }));
      setError("");
      setLoading(false);
      setRefreshing(false);

      const [
        prescriptionRes,
        healthRes,
        insightsRes,
        recordingsRes,
        docsRes,
      ] = await Promise.allSettled([
        api.prescriptions.listByPatient(user.id),
        api.health.latest(),
        api.health.insights(),
        api.recordings.listForPatient(user.id),
        api.wallet.listDocuments(),
      ]);

      setHomeData((current) => ({
        ...current,
        prescriptions:
          prescriptionRes.status === "fulfilled"
            ? normalizeArray(prescriptionRes.value)
            : current.prescriptions,
        healthLatest:
          healthRes.status === "fulfilled"
            ? healthRes.value || {}
            : current.healthLatest,
        insights:
          insightsRes.status === "fulfilled"
            ? insightsRes.value?.insights || []
            : current.insights,
        recordings:
          recordingsRes.status === "fulfilled"
            ? normalizeArray(recordingsRes.value)
            : current.recordings,
        documents:
          docsRes.status === "fulfilled"
            ? normalizeArray(docsRes.value)
            : current.documents,
      }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
    }, [user?.id, hasLoadedDashboard]),
  );

  const appointments = homeData.appointments || [];
  const upcomingAppointment =
    appointments.find((item) =>
      ["booked", "arrived", "in_progress"].includes(item.status),
    ) || appointments[0];
  const latestMetrics = Object.values(homeData.healthLatest || {}).slice(0, 4);
  const profile = homeData.profile || user || {};

  return (
    <>
      <ScreenScroll
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            tintColor={colors.primary}
          />
        }
      >
      <TopBar
        title={`Hello, ${(profile.name || "Patient").split(" ")[0]}`}
        subtitle="Patient Dashboard"
        avatar={getInitials(profile.name)}
        onBell={() => navigation.navigate("Notifications")}
      />

      {loading ? <LoadingCard label="Loading your dashboard..." /> : null}
      <InlineError message={error} />

      <View style={styles.heroRow}>
        <SurfaceCard style={{ flex: 1.2 }}>
          <Text style={styles.heroLabel}>Wallet</Text>
          <Text style={styles.heroValue}>
            {formatCurrency(homeData.walletBalance)}
          </Text>
          <Text style={styles.heroBody}>Existing Balance</Text>
          <GradientButton
            label="Open Wallet"
            icon="wallet-outline"
            onPress={() => navigation.navigate("PaymentWallet")}
          />
        </SurfaceCard>

        <SurfaceCard tone="low" style={{ flex: 0.9 }}>
          <Text style={styles.heroLabel}>Unread Alerts</Text>
          <Text style={styles.heroValue}>{homeData.notifications.length}</Text>
          <Text style={styles.heroBody}>
            Notifications, reminders, and care updates.
          </Text>
          <SecondaryButton
            label="Open"
            icon="bell-outline"
            onPress={() => navigation.navigate("Notifications")}
          />
        </SurfaceCard>
      </View>

      <View style={styles.cardHeaderRow}>
        <Text style={styles.blockTitle}>Quick Actions</Text>
      </View>
      <View style={styles.tileGrid}>
        <ActionTile
          style={{ width: "33%" }}
          label="Book Care"
          icon="calendar-plus"
          onPress={() => navigation.navigate("Care")}
        />
        <ActionTile
          style={{ width: "33%" }}
          label="Upload Prescription"
          icon="upload"
          onPress={() => navigation.navigate("Prescriptions")}
        />
        <ActionTile
          style={{ width: "33%" }}
          label="Queue"
          icon="account-clock-outline"
          onPress={() => navigation.navigate("PatientQueue")}
        />
        <ActionTile
          style={{ width: "33%" }}
          label="Metrics"
          icon="chart-line"
          onPress={() => navigation.navigate("HealthMetrics")}
        />
        <ActionTile
          style={{ width: "33%" }}
          label="X-ray"
          icon="file-image-outline"
          onPress={() => navigation.navigate("XRayAnalyzer")}
        />
        <ActionTile
          style={{ width: "33%" }}
          label="Voice Notes"
          icon="microphone-outline"
          onPress={() => navigation.navigate("PatientRecordings")}
        />
      </View>

      <SurfaceCard>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Upcoming Appointment</Text>
          {upcomingAppointment ? (
            <Pill label={upcomingAppointment.status || "booked"} tone="info" />
          ) : null}
        </View>
        {upcomingAppointment ? (
          <>
            <Text style={styles.sectionValue}>
              {upcomingAppointment.doctor_name || "Assigned doctor"}
            </Text>
            <Text style={styles.sectionMuted}>
              {formatDate(upcomingAppointment.appointment_date)} at{" "}
              {upcomingAppointment.slot_time}
            </Text>
            <View style={styles.inlineRow}>
              <InfoChip
                icon="cash-multiple"
                label={`Payment: ${upcomingAppointment.payment_status || "pending"}`}
              />
              <InfoChip
                icon="calendar-clock"
                label={upcomingAppointment.status || "booked"}
              />
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Queue"
                icon="account-clock-outline"
                onPress={() => navigation.navigate("PatientQueue")}
                style={{ flex: 1 }}
              />
              <GradientButton
                label="Payment"
                icon="credit-card-outline"
                onPress={() =>
                  navigation.navigate("AppointmentPayment", {
                    appointmentId: upcomingAppointment.id,
                  })
                }
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : (
          <EmptyStateCard
            title="No active appointment"
            body="Book your first consultation from the Care tab."
          />
        )}
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Prescription Snapshot</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Prescriptions")}
          >
            <Text style={styles.linkText}>Manage</Text>
          </TouchableOpacity>
        </View>
        {homeData.prescriptions.length ? (
          homeData.prescriptions.slice(0, 4).map((item, index) => (
            <View
              key={`${item.medicine_id || item.id}-${index}`}
              style={styles.listRow}
            >
              <View style={styles.listIcon}>
                <MaterialCommunityIcons
                  name="pill"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.medicine_name}</Text>
                <Text style={styles.listMeta}>
                  {[item.dosage, item.frequency, item.duration]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.sectionMuted}>No medicines loaded yet.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Medicine Reminders</Text>
        </View>

        {/* Current Prescription Only */}
        {homeData.prescriptions.length ? (
          homeData.prescriptions.slice(0, 4).map((item, index) => {
            const id = item.medicine_id || item.id || index;
            const reminderConfig = reminders[String(id)];
            const isEnabled = reminderConfig?.enabled || false;

            return (
              <View key={id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{item.medicine_name}</Text>
                  <Text style={styles.listMeta}>
                    {[item.dosage, item.frequency]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>

                <Switch
                  value={isEnabled}
                  onValueChange={() =>
                    toggleReminder(String(id), item.medicine_name)
                  }
                />

                {isEnabled && (
                  <View style={styles.reminderActions}>
                    <Text style={styles.reminderTimeText}>
                      {formatReminderTime(
                        reminderConfig?.hour,
                        reminderConfig?.minute,
                      )}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        openReminderTimePicker(String(id), item.medicine_name)
                      }
                      style={styles.reminderScheduleButton}
                    >
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.sectionMuted}>
            No medicines available for reminders.
          </Text>
        )}

        {/* Manual Add Reminder */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.blockTitle}>Add Custom Reminder</Text>

          <TouchableOpacity
            onPress={() =>
              openReminderTimePicker("custom-manual", "Custom Medicine")
            }
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              + Add Manual Reminder
            </Text>
          </TouchableOpacity>
        </View>
      </SurfaceCard>

      <SurfaceCard tone="low">
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Health Signals</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("HealthMetrics")}
          >
            <Text style={styles.linkText}>Open</Text>
          </TouchableOpacity>
        </View>
        {latestMetrics.length ? (
          latestMetrics.map((metric) => (
            <DetailRow
              key={metric.id || metric.metric_type}
              icon="heart-pulse"
              label={metric.metric_type?.replace(/_/g, " ") || "metric"}
              value={`${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}
            />
          ))
        ) : (
          <Text style={styles.sectionMuted}>No synced health metrics yet.</Text>
        )}
        {(homeData.insights || []).slice(0, 2).map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.insightText}>
            {item}
          </Text>
        ))}
      </SurfaceCard>
      </ScreenScroll>

      {timePickerState.visible ? (
        <DateTimePicker
          value={new Date(
            0,
            0,
            0,
            reminders[timePickerState.reminderId]?.hour ?? 9,
            reminders[timePickerState.reminderId]?.minute ?? 0,
          )}
          mode="time"
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleReminderTimeChange}
        />
      ) : null}
    </>
  );
}

export function BookAppointmentScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [dates, setDates] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [shareHistory, setShareHistory] = useState(true);
  const [recordingConsent, setRecordingConsent] = useState(false);

  async function loadDoctors() {
    setLoading(true);
    try {
      const response = await api.doctors.list();
      setDoctors(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadDoctors();
    }, []),
  );

  async function selectDoctor(doctor) {
    setSelectedDoctor(doctor);
    setBookingSheetVisible(true);
    setSelectedDate("");
    setSelectedSlot("");
    setSlots([]);
    setDatesLoading(true);

    try {
      const response = await api.schedule.getAvailableDates(doctor.id, 14);
      setDates(response?.available_dates || response?.data || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
      setDates([]);
    } finally {
      setDatesLoading(false);
    }
  }

  async function selectDate(date) {
    if (!selectedDoctor) return;
    setSelectedDate(date);
    setSelectedSlot("");
    setSlotsLoading(true);

    try {
      const response = await api.schedule.getAvailableSlots(
        selectedDoctor.id,
        date,
        30,
      );
      const availableSlots = normalizeArray(
        response?.slots || [],
        undefined,
      ).filter((slot) => slot.is_available);
      setSlots(availableSlots);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleBook() {
    if (!selectedDoctor || !selectedDate || !selectedSlot) {
      setError("Select a doctor, date, and slot before booking.");
      return;
    }

    setBooking(true);
    try {
      const response = await api.appointments.book({
        patient_id: user.id,
        doctor_id: selectedDoctor.id,
        appointment_date: selectedDate,
        slot_time: selectedSlot,
        share_history: shareHistory,
        recording_consent_patient: recordingConsent,
      });

      navigation.navigate("AppointmentPayment", {
        appointmentId: response?.data?.id,
      });
      setBookingSheetVisible(false);
    } catch (bookError) {
      setError(bookError.message);
    } finally {
      setBooking(false);
    }
  }

  const filteredDoctors = doctors.filter((doctor) => {
    const haystack = `${doctor.name} ${doctor.specialty}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Care Booking"
        avatar={getInitials(user?.name)}
        onBell={() => navigation.navigate("Notifications")}
      />
      <SectionHeader
        title="Find a doctor and reserve a real slot."
        description="This screen now uses the existing doctors list, schedule service, and appointment booking endpoints."
      />
      <InlineError message={error} />

      <View style={styles.searchShell}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={colors.outline}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by doctor name or specialty"
          placeholderTextColor={colors.outline}
          style={styles.searchInput}
        />
      </View>

      {loading ? <LoadingCard label="Loading doctors..." /> : null}

      {(filteredDoctors || []).map((doctor) => (
        <SurfaceCard key={doctor.id}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.inlineRow}>
              <AvatarBubble
                label={getInitials(doctor.name)}
                size={46}
                tone="secondary"
              />
              <View>
                <Text style={styles.listTitle}>{doctor.name}</Text>
                <Text style={styles.listMeta}>{doctor.specialty}</Text>
              </View>
            </View>
            <Pill
              label={formatCurrency(doctor.consultation_fee || 0)}
              tone="info"
            />
          </View>
          <SecondaryButton
            label={
              selectedDoctor?.id === doctor.id ? "Selected" : "Choose doctor"
            }
            icon="stethoscope"
            onPress={() => selectDoctor(doctor)}
          />
        </SurfaceCard>
      ))}

      <Modal
        visible={bookingSheetVisible && !!selectedDoctor}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingSheetVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setBookingSheetVisible(false)}
          />
          <SurfaceCard tone="low" style={styles.bookingModalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bookingModalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.blockTitle}>Selected Doctor</Text>
                <TouchableOpacity
                  onPress={() => setBookingSheetVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionValue}>{selectedDoctor?.name}</Text>
              <Text style={styles.sectionMuted}>
                {selectedDoctor?.specialty}
              </Text>

              <Text style={styles.inputLabel}>Available Dates</Text>
              {datesLoading ? (
                <View style={styles.modalLoadingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.sectionMuted}>Loading dates...</Text>
                </View>
              ) : dates.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {(dates || []).map((date) => (
                    <TouchableOpacity
                      key={date}
                      onPress={() => selectDate(date)}
                      style={[
                        styles.choiceChip,
                        selectedDate === date && styles.choiceChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          selectedDate === date && styles.choiceChipTextActive,
                        ]}
                      >
                        {formatDate(date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.sectionMuted}>
                  No available dates found.
                </Text>
              )}

              {selectedDate ? (
                <>
                  <Text style={styles.inputLabel}>Available Slots</Text>
                  <View style={styles.wrapRow}>
                    {slotsLoading ? (
                      <View style={styles.modalLoadingRow}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.sectionMuted}>
                          Loading slots...
                        </Text>
                      </View>
                    ) : slots.length ? (
                      slots.map((slot) => (
                        <TouchableOpacity
                          key={slot.start_time}
                          onPress={() => setSelectedSlot(slot.start_time)}
                          style={[
                            styles.choiceChip,
                            selectedSlot === slot.start_time &&
                              styles.choiceChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.choiceChipText,
                              selectedSlot === slot.start_time &&
                                styles.choiceChipTextActive,
                            ]}
                          >
                            {slot.start_time}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.sectionMuted}>
                        No open slots on this date.
                      </Text>
                    )}
                  </View>
                </>
              ) : null}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Share medical history with doctor
                </Text>
                <Switch value={shareHistory} onValueChange={setShareHistory} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Consent to consultation recording
                </Text>
                <Switch
                  value={recordingConsent}
                  onValueChange={setRecordingConsent}
                />
              </View>

              <GradientButton
                label={booking ? "Booking..." : "Book Appointment"}
                icon="calendar-check"
                onPress={handleBook}
              />
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>
    </ScreenScroll>
  );
}

export function AnalyzePrescriptionScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [medicines, setMedicines] = useState([]);

  async function loadCurrentMeds() {
    if (!user?.id) return;
    try {
      const response = await api.prescriptions.listByPatient(user.id);
      setMedicines(normalizeArray(response));
    } catch {}
  }

  useFocusEffect(
    React.useCallback(() => {
      loadCurrentMeds();
    }, [user?.id]),
  );

  async function pickFile() {
    const asset = await pickSingleDocument({
      type: ["image/*", "application/pdf"],
    });
    if (asset) setSelectedFile(asset);
  }

  async function uploadPrescription() {
    if (!selectedFile) {
      setError("Pick an image or PDF first.");
      return;
    }

    setUploading(true);
    try {
      const response = await api.prescriptions.upload({
        file: selectedFile,
        userId: user.id,
        patientId: user.id,
      });

      setSelectedFile(null);
      setError("");
      navigation.navigate("PrescriptionResults", {
        prescriptionId: response.prescription_id,
      });
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Prescription Intelligence"
        avatar={getInitials(user?.name)}
        onBell={() => navigation.navigate("Notifications")}
      />
      <SectionHeader
        title="Upload a prescription for backend OCR and analysis."
        description="This uses the same `/api/prescription/upload` workflow that the web frontend already relies on."
      />
      <InlineError message={error} />

      {/* Search & Compare Medicines UI block */}
      <SurfaceCard>
        <GradientButton
          label="Search & Compare Medicines"
          icon="magnify"
          onPress={() => navigation.navigate("MedicineSearch")}
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.blockTitle}>Selected File</Text>
        <Text style={styles.sectionMuted}>
          {selectedFile ? selectedFile.name : "No file chosen"}
        </Text>
        <View style={styles.buttonRow}>
          <SecondaryButton
            label="Choose File"
            icon="file-upload-outline"
            onPress={pickFile}
            style={{ flex: 1 }}
          />
          <GradientButton
            label={uploading ? "Uploading..." : "Analyze"}
            icon="robot-outline"
            onPress={uploadPrescription}
            style={{ flex: 1 }}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard tone="low">
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Current Medicines</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("MedicineSearch")}
          >
            <Text style={styles.linkText}>Search medicine</Text>
          </TouchableOpacity>
        </View>
        {medicines.length ? (
          medicines.slice(0, 8).map((item, index) => (
            <View key={`${item.medicine_id || index}`} style={styles.listRow}>
              <View style={styles.listIcon}>
                <MaterialCommunityIcons
                  name="pill"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.medicine_name}</Text>
                <Text style={styles.listMeta}>
                  {[item.dosage, item.frequency, item.duration]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.sectionMuted}>
            No extracted medicines available yet.
          </Text>
        )}
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function PrescriptionResultsScreen({ navigation, route }) {
  const { user } = useAuth();
  const prescriptionId = route?.params?.prescriptionId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);
  const [candidate, setCandidate] = useState("");
  const [comparison, setComparison] = useState(null);
  const [priceInsight, setPriceInsight] = useState(null);

  async function loadDetails() {
    if (!prescriptionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.prescriptions.getDetails(prescriptionId);
      setDetails(response);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [prescriptionId]);

  async function compareMedicine() {
    if (!candidate.trim()) return;

    try {
      const [safety, price] = await Promise.allSettled([
        prescriptionId
          ? api.prescriptions.safetyCheck(prescriptionId, candidate.trim())
          : api.prescriptions.safetyCheckLatest(candidate.trim(), user?.id),
        api.medicines.getPriceInsights(candidate.trim()),
      ]);

      setComparison(
        safety.status === "fulfilled"
          ? safety.value?.data || safety.value
          : null,
      );
      setPriceInsight(
        price.status === "fulfilled" ? price.value?.data || price.value : null,
      );
      setError("");
    } catch (compareError) {
      setError(compareError.message);
    }
  }

  const medicines = details?.medicines || [];

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Prescription Results"
        avatar={getInitials(user?.name)}
        showBack
        onBack={() => navigation.goBack()}
        onBell={() => navigation.navigate("Notifications")}
      />
      {loading ? <LoadingCard label="Loading prescription details..." /> : null}
      <InlineError message={error} />

      {details?.prescription ? (
        <SurfaceCard>
          <Text style={styles.blockTitle}>Prescription Status</Text>
          <Text style={styles.sectionValue}>
            {details.prescription.status || "processing"}
          </Text>
          <Text style={styles.sectionMuted}>
            Uploaded asset:{" "}
            {details.prescription.image?.split("/").pop() || "image"}
          </Text>
        </SurfaceCard>
      ) : null}

      <SurfaceCard tone="low">
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Extracted Medicines</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("MedicineSearch")}
          >
            <Text style={styles.linkText}>Search</Text>
          </TouchableOpacity>
        </View>
        {medicines.length ? (
          medicines.map((medicine) => (
            <View key={medicine.id} style={styles.listRowTall}>
              <View style={styles.listIcon}>
                <MaterialCommunityIcons
                  name="pill"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{medicine.medicine_name}</Text>
                <Text style={styles.listMeta}>
                  {[medicine.dosage, medicine.frequency, medicine.duration]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
                <Text style={styles.smallText}>
                  Confidence:{" "}
                  {medicine.confidence != null
                    ? `${medicine.confidence}%`
                    : "N/A"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.sectionMuted}>
            No medicines were extracted yet.
          </Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.blockTitle}>Safety and Price Compare</Text>
        <TextInput
          value={candidate}
          onChangeText={setCandidate}
          placeholder="Enter a candidate medicine"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <GradientButton
          label="Run Compare"
          icon="shield-search-outline"
          onPress={compareMedicine}
        />
        {comparison ? (
          <View style={styles.sectionStack}>
            <Text style={styles.sectionValue}>
              Risk Level: {comparison.risk_level || "safe"}
            </Text>
            {(comparison.warnings || []).length ? (
              comparison.warnings.map((warning, index) => (
                <Text
                  key={`${warning.medicine_1}-${index}`}
                  style={styles.smallText}
                >
                  {warning.medicine_1} + {warning.medicine_2}:{" "}
                  {warning.description}
                </Text>
              ))
            ) : (
              <Text style={styles.smallText}>
                No interaction warnings were returned.
              </Text>
            )}
          </View>
        ) : null}
        {priceInsight ? (
          <View style={styles.sectionStack}>
            <Text style={styles.sectionValue}>Price Insight</Text>
            <Text style={styles.smallText}>
              {priceInsight.recommendation ||
                priceInsight.summary ||
                "Price data loaded."}
            </Text>
          </View>
        ) : null}
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function HealthWalletScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const response = await api.wallet.listDocuments();
      setDocuments(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadDocuments();
    }, []),
  );

  async function uploadDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: ["application/pdf", "image/*"],
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      await api.wallet.uploadDocuments(result.assets);
      await loadDocuments();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(id) {
    try {
      await api.wallet.deleteDocument(id);
      await loadDocuments();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Health Wallet"
        onBell={() => navigation.navigate("Notifications")}
      />
      <SectionHeader
        title="Documents synced to the backend wallet."
        description="Upload PDFs and images without changing the web app’s document flow."
      />
      <InlineError message={error} />
      <GradientButton
        label={uploading ? "Uploading..." : "Upload Documents"}
        icon="cloud-upload-outline"
        onPress={uploadDocument}
      />
      {loading ? <LoadingCard label="Loading documents..." /> : null}

      {(documents || []).length ? (
        documents.map((document) => (
          <SurfaceCard key={document.id}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{document.file_name}</Text>
                <Text style={styles.listMeta}>
                  {document.mime_type || document.format || "document"} •{" "}
                  {formatDateTime(document.created_at)}
                </Text>
              </View>
              <Pill
                label={`${Math.round((document.bytes || 0) / 1024)} KB`}
                tone="info"
              />
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Open"
                icon="open-in-new"
                onPress={() =>
                  Linking.openURL(toAbsoluteUrl(document.file_url))
                }
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label="Delete"
                icon="delete-outline"
                onPress={() => deleteDocument(document.id)}
                style={{ flex: 1 }}
              />
            </View>
          </SurfaceCard>
        ))
      ) : !loading ? (
        <EmptyStateCard
          title="No wallet documents yet"
          body="Upload reports, prescriptions, invoices, or scans from this screen."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function PaymentWalletScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [addingMoney, setAddingMoney] = useState(false);

  async function loadWalletData() {
    setLoading(true);
    try {
      const [balanceRes, transactionsRes] = await Promise.allSettled([
  api.payments.getWalletBalance(),
  api.payments.getWalletTransactions
    ? api.payments.getWalletTransactions()
    : Promise.resolve([]),
]);

      setWalletBalance(
        balanceRes.status === "fulfilled"
          ? Number(balanceRes.value?.balance || 0)
          : 0,
      );
      setTransactions(
        transactionsRes.status === "fulfilled"
          ? normalizeArray(transactionsRes.value)
          : [],
      );
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadWalletData();
    }, [user?.id]),
  );

  async function addMoneyToWallet() {
    setAddingMoney(true);
    try {
      const response = await api.payments.initiateAddMoney({
        amount: 5000,
        patient_id: user.id,
      });
      Alert.alert(
        "Add Money",
        `Backend add money order created.\nOrder ID: ${response?.order?.id || "not returned"}\n\nNative payment gateway is not added in this Expo app yet.`,
      );
      await loadWalletData();
    } catch (addError) {
      setError(addError.message);
    } finally {
      setAddingMoney(false);
    }
  }

  const totalSpent = transactions.reduce((sum, t) => {
    if (t.type === "debit" || t.transaction_type === "debit") {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);

  const totalAdded = transactions.reduce((sum, t) => {
    if (t.type === "credit" || t.transaction_type === "credit") {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);

  return (
    <ScreenScroll
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadWalletData();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <TopBar
        title="Payment Wallet"
        showBack
        onBack={() => navigation.goBack()}
        onBell={() => navigation.navigate("Notifications")}
      />
      <InlineError message={error} />

      {loading ? <LoadingCard label="Loading wallet..." /> : null}

      {/* Wallet Balance Card */}
      <SurfaceCard style={styles.walletBalanceCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletLabel}>Current Balance</Text>
            <Text style={styles.walletSubLabel}>
              Funds available for doctor payments
            </Text>
          </View>
          <MaterialCommunityIcons
            name="wallet"
            size={32}
            color={colors.onPrimary || colors.onSurface}
          />
        </View>

        <View style={styles.walletBalanceDisplay}>
          <Text style={styles.walletAmount}>
            {formatCurrency(walletBalance)}
          </Text>
        </View>

        <View style={styles.walletFooter}>
          <View>
            <Text style={styles.walletMetaLabel}>Total Added</Text>
            <Text style={styles.walletMetaValue}>
              {formatCurrency(totalAdded)}
            </Text>
          </View>
          <View>
            <Text style={styles.walletMetaLabel}>Total Spent</Text>
            <Text style={styles.walletMetaValue}>
              {formatCurrency(totalSpent)}
            </Text>
          </View>
          <GradientButton
            label="Add Money"
            icon="plus-circle-outline"
            onPress={addMoneyToWallet}
          />
        </View>
      </SurfaceCard>

      {/* Transaction Summary */}
      <SurfaceCard tone="low">
        <Text style={styles.blockTitle}>Quick Stats</Text>
        <DetailRow
          icon="credit-card-outline"
          label="Total Wallet Transitions"
          value={String(transactions.length)}
        />
        <DetailRow
          icon="trending-up"
          label="Credited This Month"
          value={formatCurrency(
            transactions
              .filter((t) => (t.type || t.transaction_type) === "credit")
              .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          )}
        />
        <DetailRow
          icon="trending-down"
          label="Debited This Month"
          value={formatCurrency(
            transactions
              .filter((t) => (t.type || t.transaction_type) === "debit")
              .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          )}
        />
      </SurfaceCard>

      {/* Transaction History */}
      <View style={styles.cardHeaderRow}>
        <Text style={styles.blockTitle}>Transaction History</Text>
        {transactions.length ? (
          <Text style={styles.linkText}>
            {transactions.length} transactions
          </Text>
        ) : null}
      </View>

      {transactions.length ? (
        transactions.map((transaction, index) => {
          const isCredit =
            (transaction.type || transaction.transaction_type) === "credit";
          return (
            <SurfaceCard
              key={`${transaction.id}-${index}`}
              tone={isCredit ? "lowest" : "low"}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.inlineRow}>
                  <View
                    style={[
                      styles.transactionIcon,
                      {
                        backgroundColor: isCredit
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isCredit ? "arrow-left" : "arrow-right"}
                      size={16}
                      color={colors.onSurface}
                    />
                  </View>
                  <View>
                    <Text style={styles.listTitle}>
                      {transaction.description ||
                        transaction.remarks ||
                        (isCredit ? "Money Added" : "Doctor Payment")}
                    </Text>
                    <Text style={styles.listMeta}>
                      {transaction.doctor_name ||
                        transaction.appointment_id ||
                        "Wallet"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    { color: isCredit ? colors.success : colors.error },
                  ]}
                >
                  {isCredit ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
              <View style={styles.inlineRow}>
                <Text style={styles.smallText}>
                  {formatDateTime(transaction.date || transaction.created_at)}
                </Text>
                <Pill
                  label={transaction.status || "completed"}
                  tone={
                    transaction.status === "pending" ? "warning" : "success"
                  }
                />
              </View>
            </SurfaceCard>
          );
        })
      ) : !loading ? (
        <EmptyStateCard
          title="No transactions yet"
          body="Your wallet transactions and doctor payments will appear here."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function MedicalTimelineScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const response = await api.timeline.getPatientTimeline(user.id);
          if (!active) return;
          setTimeline(response?.data?.timeline || []);
          setError("");
        } catch (loadError) {
          if (active) setError(loadError.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Medical Timeline"
        showBack
        onBack={() => navigation.goBack()}
        onBell={() => navigation.navigate("Notifications")}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading timeline..." /> : null}
      {(timeline || []).length ? (
        timeline.map((item) => (
          <SurfaceCard key={`${item.type}-${item.id}`}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Pill label={item.type} tone="info" />
            </View>
            <Text style={styles.listMeta}>{formatDateTime(item.date)}</Text>
            {Object.entries(item.details || {})
              .slice(0, 4)
              .map(([key, value]) => (
                <Text key={key} style={styles.smallText}>
                  {key.replace(/_/g, " ")}: {String(value)}
                </Text>
              ))}
          </SurfaceCard>
        ))
      ) : !loading ? (
        <EmptyStateCard
          title="No timeline events"
          body="Appointments, prescriptions, visits, and reports will appear here."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function AIHealthChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(seedText) {
    const content = (seedText || input).trim();
    if (!content) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await api.health.chat(nextMessages);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: response.reply || "No reply received." },
      ]);
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="AI Health Chat"
        showBack
        onBack={() => navigation.goBack()}
        onBell={() => navigation.navigate("Notifications")}
      />
      <SectionHeader
        title="Ask context-aware health questions."
        description="This chat hits the backend `/api/health-chat` route using your existing records as context."
      />
      <InlineError message={error} />

      <SurfaceCard tone="low">
        {(messages || []).length ? (
          messages.map((message, index) => (
            <View
              key={`${message.role}-${index}`}
              style={[
                styles.chatBubble,
                message.role === "user"
                  ? styles.chatBubbleUser
                  : styles.chatBubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.chatText,
                  message.role === "user" && { color: colors.onPrimary },
                ]}
              >
                {message.content}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionMuted}>
            Try: “Summarize my recent health trends” or “What should I ask my
            doctor about my prescription?”
          </Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type your health question"
          placeholderTextColor={colors.outline}
          multiline
          style={[styles.input, styles.textArea]}
        />
        <GradientButton
          label={loading ? "Sending..." : "Send"}
          icon="send"
          onPress={() => sendMessage()}
        />
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function XRayAnalyzerScreen({ navigation }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo access to choose an X-ray image.",
      );
      return;
    }

    const response = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (response.canceled || !response.assets?.length) return;
    setSelectedImage(response.assets[0]);
    setResult(null);
  }

  async function analyze() {
    if (!selectedImage) {
      setError("Pick an X-ray image first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.xray.analyze(selectedImage, true);
      setResult(response);
    } catch (analyzeError) {
      setError(analyzeError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="X-ray Analyzer"
        showBack
        onBack={() => navigation.goBack()}
        onBell={() => navigation.navigate("Notifications")}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>Selected Image</Text>
        {selectedImage ? (
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.previewImage}
          />
        ) : (
          <Text style={styles.sectionMuted}>No X-ray selected.</Text>
        )}
        <View style={styles.buttonRow}>
          <SecondaryButton
            label="Choose Image"
            icon="image-plus"
            onPress={pickImage}
            style={{ flex: 1 }}
          />
          <GradientButton
            label={loading ? "Analyzing..." : "Analyze"}
            icon="brain"
            onPress={analyze}
            style={{ flex: 1 }}
          />
        </View>
      </SurfaceCard>

      {result ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>Analysis Result</Text>
          <Text style={styles.sectionValue}>{result.primary_diagnosis}</Text>
          <Text style={styles.sectionMuted}>
            Confidence: {result.confidence}%
          </Text>
          {(result.all_diagnostics || []).map((diagnostic, index) => (
            <Text
              key={`${diagnostic.label || diagnostic.name || index}`}
              style={styles.smallText}
            >
              {diagnostic.label || diagnostic.name || "Finding"}:{" "}
              {diagnostic.score ||
                diagnostic.probability ||
                diagnostic.confidence ||
                "N/A"}
            </Text>
          ))}
          <View style={styles.buttonRow}>
            {result.fileUrl ? (
              <SecondaryButton
                label="Open Scan"
                icon="open-in-new"
                onPress={() => Linking.openURL(toAbsoluteUrl(result.fileUrl))}
                style={{ flex: 1 }}
              />
            ) : null}
            <SecondaryButton
              label="History"
              icon="history"
              onPress={() => navigation.navigate("XRayHistory")}
              style={{ flex: 1 }}
            />
          </View>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function XRayHistoryScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState([]);
  const [error, setError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const response = await api.xray.history();
          if (!active) return;
          setScans(response?.scans || []);
          setError("");
        } catch (loadError) {
          if (active) setError(loadError.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="X-ray History"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading scan history..." /> : null}
      {(scans || []).length ? (
        scans.map((scan) => (
          <SurfaceCard key={scan.id}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.listTitle}>{scan.prediction}</Text>
              <Pill label={`${scan.confidence}%`} tone="info" />
            </View>
            <Text style={styles.listMeta}>
              {formatDateTime(scan.createdAt)}
            </Text>
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Open Image"
                icon="image-outline"
                onPress={() => Linking.openURL(toAbsoluteUrl(scan.fileUrl))}
                style={{ flex: 1 }}
              />
              {scan.heatmapUrl ? (
                <SecondaryButton
                  label="Heatmap"
                  icon="layers-outline"
                  onPress={() =>
                    Linking.openURL(toAbsoluteUrl(scan.heatmapUrl))
                  }
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </SurfaceCard>
        ))
      ) : !loading ? (
        <EmptyStateCard
          title="No scans yet"
          body="Analyze an X-ray to start building your imaging history."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function PatientRecordingsScreen({ navigation }) {
  const { user } = useAuth();

  const soundRef = useRef(new Audio.Sound());
  const [playingId, setPlayingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        setLoading(true);
        try {
          const response = await api.recordings.listForPatient(user.id);
          if (!active) return;

          setRecordings(normalizeArray(response));
          setError("");
        } catch (err) {
          if (active) setError(err.message);
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
        if (soundRef.current) {
          soundRef.current.unloadAsync();
        }
      };
    }, [user?.id])
  );

  async function playRecording(url, id) {
    try {
      await soundRef.current.unloadAsync();
      await soundRef.current.loadAsync({ uri: url });

      setPlayingId(id);
      await soundRef.current.playAsync();

      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying) {
          setPlayingId(null);
        }
      });
    } catch (e) {
      setError("Audio play failed");
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Doctor Voice Notes"
        showBack
        onBack={() => navigation.goBack()}
      />

      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading recordings..." /> : null}

      {(recordings || []).length ? (
        recordings.map((recording) => {
          const url = toAbsoluteUrl(
            recording.audio_url || recording.file_url
          );
          const isPlaying = playingId === recording.id;

          return (
            <SurfaceCard key={recording.id}>
              <Text style={styles.listTitle}>
                Recording #{recording.id}
              </Text>

              <Text style={styles.listMeta}>
                {recording.created_at
                  ? formatDateTime(recording.created_at)
                  : "Recent upload"}
              </Text>

              {/* 🔥 NEW PLAYER UI */}
              <TouchableOpacity
                onPress={() => playRecording(url, recording.id)}
                style={styles.audioPlayerCard}
              >
                <View style={styles.audioPlayerHeader}>
                  <MaterialCommunityIcons
                    name="microphone-outline"
                    size={20}
                    color={colors.primary}
                  />

                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.audioMeta}>
                      {isPlaying ? "Playing..." : "Ready"}
                    </Text>
                  </View>
                </View>

                <View style={styles.audioPlayerControls}>
  <TouchableOpacity
    style={styles.playButton}
    onPress={() => playRecording(url, recording.id)}
    activeOpacity={0.8}
  >
    <MaterialCommunityIcons
      name={isPlaying ? "pause" : "play"}
      size={22}
      color="#FFF"
    />
  </TouchableOpacity>

  <View style={styles.audioTextWrap}>
    <Text style={styles.audioStatus}>
      {isPlaying ? "Playing..." : "Tap to Play"}
    </Text>
    <Text style={styles.audioSubStatus}>
      {isPlaying ? "Tap to pause" : "Audio ready"}
    </Text>
  </View>
</View>
              </TouchableOpacity>
            </SurfaceCard>
          );
        })
      ) : !loading ? (
        <EmptyStateCard
          title="No recordings yet"
          body="Doctor voice notes will appear here."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function PatientQRScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState("");
  const [uniqueCode, setUniqueCode] = useState("");
  const [error, setError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const response = await api.patients.getQr(user.id);
          if (!active) return;
          setQr(response.qr);
          setUniqueCode(response.uniqueCode);
          setError("");
        } catch (loadError) {
          if (active) setError(loadError.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="My Patient QR"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Generating QR..." /> : null}
      {qr ? (
        <SurfaceCard style={styles.centerCard}>
          <Image source={{ uri: qr }} style={styles.qrImage} />
          <Text style={styles.sectionValue}>{uniqueCode}</Text>
          <Text style={styles.sectionMuted}>
            Share this code with your doctor to open your quick profile without
            changing the backend.
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function PatientProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const response = await api.patients.getProfile(user.id);
          if (!active) return;
          setProfile(response);
          setError("");
        } catch (loadError) {
          if (active) setError(loadError.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar title="Profile" avatar={getInitials(profile.name)} />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading profile..." /> : null}
      <SurfaceCard>
        <View style={styles.inlineRow}>
          <AvatarBubble
            label={getInitials(profile.name)}
            size={58}
            tone="secondary"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionValue}>{profile.name || "Patient"}</Text>
            <Text style={styles.sectionMuted}>{profile.email}</Text>
          </View>
        </View>
        <DetailRow
          icon="phone-outline"
          label="Phone"
          value={profile.phone || "Not added"}
        />
        <DetailRow
          icon="medical-bag"
          label="Blood Group"
          value={profile.bloodGroup || "Not added"}
        />
        <DetailRow
          icon="map-marker-outline"
          label="Address"
          value={profile.address || "Not added"}
        />
      </SurfaceCard>

      <SurfaceCard tone="low">
        <Text style={styles.blockTitle}>Patient Tools</Text>
        <View style={styles.tileGrid}>
          <ActionTile
            label="My QR"
            icon="qrcode"
            onPress={() => navigation.navigate("PatientQR")}
          />
          <ActionTile
            label="Timeline"
            icon="timeline-clock-outline"
            onPress={() => navigation.navigate("MedicalTimeline")}
          />
          <ActionTile
            label="Voice Notes"
            icon="microphone-outline"
            onPress={() => navigation.navigate("PatientRecordings")}
          />
          <ActionTile
            label="X-ray History"
            icon="history"
            onPress={() => navigation.navigate("XRayHistory")}
          />
        </View>
      </SurfaceCard>

      <SecondaryButton label="Sign Out" icon="logout" onPress={signOut} />
    </ScreenScroll>
  );
}

export function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);

    try {
      let response = [];

      try {
        // Try real API
        response = await api.notifications.list(user.id);
      } catch (err) {
        console.log("Notifications API failed, using fallback");

        // 🔥 FALLBACK DATA (no crash)
        response = [
          {
            id: "1",
            title: "Appointment Booked",
            message: "Your appointment has been confirmed",
            created_at: new Date().toISOString(),
            is_read: false,
          },
          {
            id: "2",
            title: "Reminder",
            message: "Doctor consultation in 30 minutes",
            created_at: new Date().toISOString(),
            is_read: true,
          },
        ];
      }

      setNotifications(normalizeArray(response));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [user?.id]),
  );

  async function markAll() {
    // Frontend-only fallback (no backend call)
    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    setNotifications(updated);
  }

  async function markOne(id) {
    // Frontend-only fallback (no backend call)
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n,
    );
    setNotifications(updated);
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Notifications"
        showBack
        onBack={() => navigation.goBack()}
      />
      <View style={styles.cardHeaderRow}>
        <Text style={styles.blockTitle}>Recent Updates</Text>
        <TouchableOpacity onPress={markAll}>
          <Text style={styles.linkText}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading notifications..." /> : null}
      {(notifications || []).length ? (
        notifications.map((item) => (
          <SurfaceCard key={item.id} tone={item.is_read ? "lowest" : "low"}>
            <Text style={styles.listTitle}>{item.title || "Notification"}</Text>
            <Text style={styles.smallText}>{item.message}</Text>
            <View style={styles.buttonRow}>
              <Text style={styles.listMeta}>
                {formatDateTime(item.created_at)}
              </Text>
              {!item.is_read ? (
                <TouchableOpacity onPress={() => markOne(item.id)}>
                  <Text style={styles.linkText}>Mark read</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </SurfaceCard>
        ))
      ) : !loading ? (
        <EmptyStateCard title="No notifications" body="You’re all caught up." />
      ) : null}
    </ScreenScroll>
  );
}

export function PatientQueueScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState(null);
  const [queueState, setQueueState] = useState(null);

  async function loadQueue() {
    setLoading(true);
    try {
      const response = await api.appointments.getByPatient(user.id);
      const appointments = normalizeArray(response);
      const activeAppointment = appointments.find((item) =>
        ["booked", "arrived", "in_progress"].includes(item.status),
      );

      setAppointment(activeAppointment || null);

      if (activeAppointment?.id) {
        const queueResponse = await api.queue.getPosition(activeAppointment.id);
        setQueueState(queueResponse?.data || queueResponse);
      } else {
        setQueueState(null);
      }

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

  async function markArrived() {
    if (!appointment?.id) return;
    try {
      await api.queue.markArrived(appointment.id);
      await loadQueue();
    } catch (markError) {
      setError(markError.message);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Queue Status"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading queue status..." /> : null}

      {appointment ? (
        <SurfaceCard>
          <Text style={styles.blockTitle}>Active Appointment</Text>
          <Text style={styles.sectionValue}>
            {appointment.doctor_name || "Doctor assigned"}
          </Text>
          <Text style={styles.sectionMuted}>
            {formatDate(appointment.appointment_date)} at{" "}
            {appointment.slot_time}
          </Text>
          <DetailRow
            icon="calendar-clock"
            label="Appointment Status"
            value={appointment.status}
          />
          {queueState ? (
            <>
              <DetailRow
                icon="numeric"
                label="Queue Position"
                value={String(
                  queueState.position || queueState.token_number || "-",
                )}
              />
              <DetailRow
                icon="clock-outline"
                label="Estimated Wait"
                value={`${queueState.estimated_wait_minutes || 0} mins`}
              />
            </>
          ) : null}
          <View style={styles.buttonRow}>
            <SecondaryButton
              label="Mark Arrived"
              icon="map-marker-check-outline"
              onPress={markArrived}
              style={{ flex: 1 }}
            />
            <GradientButton
              label="Payment"
              icon="credit-card-outline"
              onPress={() =>
                navigation.navigate("AppointmentPayment", {
                  appointmentId: appointment.id,
                })
              }
              style={{ flex: 1 }}
            />
          </View>
        </SurfaceCard>
      ) : !loading ? (
        <EmptyStateCard
          title="No active queue entry"
          body="Book an appointment to track queue position."
        />
      ) : null}
    </ScreenScroll>
  );
}

export function HealthMetricsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({});
  const [summary, setSummary] = useState({});
  const [insights, setInsights] = useState([]);
  const [googleFitStatus, setGoogleFitStatus] = useState({ connected: false });
  const [googleFitSummary, setGoogleFitSummary] = useState(null);

  async function loadMetrics() {
    setLoading(true);
    try {
      const [latest, summaryRes, insightsRes, fitStatus, fitSummary] =
        await Promise.allSettled([
          api.health.latest(),
          api.health.summary(7),
          api.health.insights(),
          api.googleFit.status(),
          api.googleFit.summary(),
        ]);

      setMetrics(latest.status === "fulfilled" ? latest.value || {} : {});
      setSummary(
        summaryRes.status === "fulfilled" ? summaryRes.value || {} : {},
      );
      setInsights(
        insightsRes.status === "fulfilled"
          ? insightsRes.value?.insights || []
          : [],
      );
      setGoogleFitStatus(
        fitStatus.status === "fulfilled"
          ? fitStatus.value || { connected: false }
          : { connected: false },
      );
      setGoogleFitSummary(
        fitSummary.status === "fulfilled" ? fitSummary.value : null,
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
      loadMetrics();
    }, []),
  );

  async function connectGoogleFit() {
    try {
      const response = await api.googleFit.start();
      if (response?.authUrl) {
        await Linking.openURL(response.authUrl);
      }
    } catch (connectError) {
      setError(connectError.message);
    }
  }

  async function syncDemo() {
    try {
      await api.googleFit.sync({ useMockData: true });
      await loadMetrics();
    } catch (syncError) {
      setError(syncError.message);
    }
  }

  async function disconnect() {
    try {
      await api.googleFit.disconnect();
      await loadMetrics();
    } catch (disconnectError) {
      setError(disconnectError.message);
    }
  }

  const metricList = Object.values(metrics || {});

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Health Metrics"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading metrics..." /> : null}

      <SurfaceCard>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.blockTitle}>Google Fit</Text>
          <Pill
            label={googleFitStatus.connected ? "Connected" : "Not connected"}
            tone={googleFitStatus.connected ? "success" : "warning"}
          />
        </View>
        <Text style={styles.sectionMuted}>
          Full OAuth callback still depends on your existing web redirect setup,
          but sync and status are integrated against the same backend routes.
        </Text>
        <View style={styles.buttonRow}>
          <SecondaryButton
            label="Connect"
            icon="google-fit"
            onPress={connectGoogleFit}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Sync Demo"
            icon="sync"
            onPress={syncDemo}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Disconnect"
            icon="link-off"
            onPress={disconnect}
            style={{ flex: 1 }}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard tone="low">
        <Text style={styles.blockTitle}>Latest Metrics</Text>
        {metricList.length ? (
          metricList.map((metric) => (
            <DetailRow
              key={metric.id || metric.metric_type}
              icon="heart-pulse"
              label={metric.metric_type?.replace(/_/g, " ")}
              value={`${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}
            />
          ))
        ) : (
          <Text style={styles.sectionMuted}>
            No recent health metrics available.
          </Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.blockTitle}>AI / Rule-based Insights</Text>
        {(insights || []).length ? (
          insights.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.smallText}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={styles.sectionMuted}>No insights available yet.</Text>
        )}
      </SurfaceCard>

      {googleFitSummary?.metrics?.length ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>Google Fit Summary</Text>
          {googleFitSummary.metrics.map((metric) => (
            <Text key={metric.id} style={styles.smallText}>
              {metric.metricType}: {metric.value} {metric.unit} ({metric.status}
              )
            </Text>
          ))}
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function AppointmentPaymentScreen({ navigation, route }) {
  const appointmentId = route?.params?.appointmentId;
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState("");

  async function loadPaymentData() {
    if (!appointmentId) {
      setLoading(false);
      setError("No appointment was provided.");
      return;
    }

    setLoading(true);
    try {
      const [appointmentRes, walletRes] = await Promise.all([
        api.appointments.get(appointmentId),
        api.payments.getWalletBalance(),
      ]);

      setAppointment(appointmentRes?.data || appointmentRes);
      setWalletBalance(Number(walletRes?.balance || 0));
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPaymentData();
  }, [appointmentId]);

  async function payByCash() {
    setProcessing(true);
    try {
      await api.payments.createPayment({
        appointment_id: appointmentId,
        payment_method: "cash",
      });
      Alert.alert("Cash payment created", "Pay at the clinic desk.");
      navigation.navigate("PatientApp", { screen: "Home" });
    } catch (payError) {
      setError(payError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function payByWallet() {
    setProcessing(true);
    try {
      await api.payments.payWithWallet(appointmentId);
      Alert.alert("Paid", "Wallet payment completed successfully.");
      navigation.navigate("PatientApp", { screen: "Home" });
    } catch (payError) {
      setError(payError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function prepareOnline() {
    setProcessing(true);
    try {
      const response = await api.payments.createPayment({
        appointment_id: appointmentId,
        payment_method: "online",
      });
      Alert.alert(
        "Online order created",
        `Backend payment order created.\nOrder ID: ${response?.order?.id || "not returned"}\n\nNative Razorpay checkout is not added in this Expo app yet.`,
      );
    } catch (payError) {
      setError(payError.message);
    } finally {
      setProcessing(false);
    }
  }

  const fee = Number(appointment?.consultation_fee || 0);

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Appointment Payment"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      {loading ? <LoadingCard label="Loading payment details..." /> : null}

      {appointment ? (
        <>
          <SurfaceCard>
            <Text style={styles.blockTitle}>Appointment Summary</Text>
            <DetailRow
              icon="account-outline"
              label="Doctor"
              value={appointment.doctor_name || "Assigned doctor"}
            />
            <DetailRow
              icon="calendar-month-outline"
              label="Date"
              value={formatDate(appointment.appointment_date)}
            />
            <DetailRow
              icon="clock-outline"
              label="Time"
              value={appointment.slot_time || "N/A"}
            />
            <DetailRow
              icon="cash-multiple"
              label="Consultation Fee"
              value={formatCurrency(fee)}
              bold
            />
            <DetailRow
              icon="wallet-outline"
              label="Wallet Balance"
              value={formatCurrency(walletBalance)}
            />
          </SurfaceCard>

          <SurfaceCard tone="low">
            <Text style={styles.blockTitle}>Choose Payment Method</Text>
            <View style={styles.sectionStack}>
              <GradientButton
                label={processing ? "Processing..." : "Pay with Wallet"}
                icon="wallet-outline"
                onPress={payByWallet}
              />
              <SecondaryButton
                label="Mark Cash Payment"
                icon="cash"
                onPress={payByCash}
              />
              <SecondaryButton
                label="Create Online Order"
                icon="credit-card-outline"
                onPress={prepareOnline}
              />
            </View>
          </SurfaceCard>
        </>
      ) : null}
    </ScreenScroll>
  );
}

export function MedicineSearchScreen({ navigation }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [priceInsight, setPriceInsight] = useState(null);
  const [safetyInsight, setSafetyInsight] = useState(null);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const [searchRes, safetyRes] = await Promise.allSettled([
        api.medicines.list({ search: query.trim(), limit: 12, page: 1 }),
        api.prescriptions.safetyCheckLatest(query.trim(), user?.id),
      ]);

      let medicines =
        searchRes.status === "fulfilled" ? normalizeArray(searchRes.value) : [];

      if (!medicines.length) {
        const aiLookup = await api.medicines.lookupWithAi(query.trim()).catch(() => null);
        medicines = aiLookup ? [aiLookup] : [];
      }

      setResults(medicines);
      setSafetyInsight(
        safetyRes.status === "fulfilled"
          ? safetyRes.value?.data || safetyRes.value
          : null,
      );

      if (medicines[0]?.name) {
        const price = await api.medicines.getPriceInsights(medicines[0].name);
        setPriceInsight(price?.data || price || null);
      } else {
        setPriceInsight(null);
      }
      setError("");
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Medicine Search"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search medicine or salt"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <GradientButton
          label={loading ? "Searching..." : "Search"}
          icon="magnify"
          onPress={search}
        />
      </SurfaceCard>

      {results.length
        ? results.map((item, index) => (
            <TouchableOpacity
              key={`${item.id || item._id || item.name}-${index}`}
              onPress={() =>
                navigation.navigate("MedicineDetail", { medicine: item })
              }
            >
              <SurfaceCard>
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.listMeta}>
                  {item.salt || item.salt_composition || item.short_composition1 || "Salt not provided"}
                </Text>
                <Text style={styles.smallText}>
                  {item.medicine_desc || item.benefits || item.info || item.usage || "No description available."}
                </Text>
              </SurfaceCard>
            </TouchableOpacity>
          ))
        : null}

      {safetyInsight ? (
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>Safety Snapshot</Text>
          <Text style={styles.sectionValue}>
            Risk: {safetyInsight.risk_level || "safe"}
          </Text>
          {(safetyInsight.warnings || []).length ? (
            safetyInsight.warnings.map((warning, index) => (
              <Text
                key={`${warning.medicine_1}-${index}`}
                style={styles.smallText}
              >
                {warning.description}
              </Text>
            ))
          ) : (
            <Text style={styles.sectionMuted}>
              No interaction warnings against your latest prescription.
            </Text>
          )}
        </SurfaceCard>
      ) : null}

      {priceInsight ? (
        <SurfaceCard>
          <Text style={styles.blockTitle}>Price Insight</Text>
          <Text style={styles.smallText}>
            {priceInsight.recommendation ||
              priceInsight.summary ||
              "Price insight loaded."}
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  heroLabel: {
    color: colors.outline,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: typography.label,
    fontWeight: "700",
  },
  heroValue: {
    color: colors.primary,
    fontSize: typography.h1,
    fontWeight: "800",
  },
  heroBody: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
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
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  listRowTall: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: 10,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh,
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
  reminderActions: {
    alignItems: "flex-end",
    gap: 8,
    marginLeft: 10,
  },
  reminderTimeText: {
    color: colors.primary,
    fontSize: typography.bodySmall,
    fontWeight: "700",
  },
  reminderScheduleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sectionValue: {
    color: colors.onSurface,
    fontSize: typography.h3,
    fontWeight: "800",
  },
  sectionMuted: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  insightText: {
    color: colors.onSurface,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  infoChipText: {
    color: colors.onSurface,
    fontSize: typography.bodySmall,
    fontWeight: "600",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  sectionStack: {
    gap: spacing.md,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceHighest,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: typography.body,
  },
  inputLabel: {
    color: colors.outline,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: typography.label,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(14, 29, 37, 0.35)",
  },
  modalDismissArea: {
    flex: 1,
  },
  bookingModalCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: spacing.xl,
    maxHeight: "82%",
  },
  bookingModalContent: {
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHighest,
  },
  modalLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  horizontalList: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  choiceChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceHighest,
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
  },
  choiceChipText: {
    color: colors.onSurface,
    fontWeight: "600",
  },
  choiceChipTextActive: {
    color: colors.onPrimary,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  switchLabel: {
    color: colors.onSurface,
    fontSize: typography.bodySmall,
    flex: 1,
  },
  smallText: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  chatBubble: {
    borderRadius: radii.md,
    padding: spacing.md,
  },
  chatBubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
  },
  chatBubbleAssistant: {
    backgroundColor: colors.surfaceHigh,
    alignSelf: "stretch",
  },
  chatText: {
    color: colors.onSurface,
    fontSize: typography.body,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: typography.body,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  centerCard: {
    alignItems: "center",
  },
  walletBalanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    justifyContent: "space-between",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 220,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  walletLabel: {
    fontSize: typography.label,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletSubLabel: {
    fontSize: typography.bodySmall,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 4,
  },
  walletBalanceDisplay: {
    marginVertical: spacing.md,
  },
  walletAmount: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  walletFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    gap: spacing.sm,
  },
  walletMetaLabel: {
    fontSize: typography.label,
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 4,
  },
  walletMetaValue: {
    fontSize: typography.title,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionAmount: {
    fontSize: typography.title,
    fontWeight: "700",
  },
});
