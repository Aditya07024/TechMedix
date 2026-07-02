import React, { useEffect, useState, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  RefreshControl,
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

export function formatSlotTime12Hour(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

export function PatientMenuDrawer({ visible, onClose, navigation }) {
  const { logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -280,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleNavigate = (screenName, params) => {
    onClose();
    if (screenName === "Logout") {
      logout();
      return;
    }
    navigation.navigate(screenName, params);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <View style={styles.drawerBackdrop}>
        <TouchableOpacity
          style={styles.drawerOverlayDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.drawerContent,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScroll}>
            <View style={styles.drawerHeader}>
              <Image
                source={require("../../../assets/icon.png")}
                style={styles.drawerLogo}
                resizeMode="contain"
              />
              <Text style={styles.drawerBrand}>TechMedix</Text>
              <Text style={styles.drawerSubBrand}>CLINICAL SANCTUARY</Text>
            </View>

            <View style={styles.drawerSection}>
              <Text style={styles.drawerSectionTitle}>Menu</Text>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("Home")}>
                <MaterialCommunityIcons name="home-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Home</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("Appointments")}>
                <MaterialCommunityIcons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Appointments</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("Prescriptions")}>
                <MaterialCommunityIcons name="pill" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Prescriptions</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("HealthWallet")}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Records</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("PatientRecordings")}>
                <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Recordings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("PatientQueue")}>
                <MaterialCommunityIcons name="account-clock-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("HealthMetrics")}>
                <MaterialCommunityIcons name="chart-line" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Metrics</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("Wallet")}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("PaymentWallet")}>
                <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Funds</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => handleNavigate("Profile")}>
                <MaterialCommunityIcons name="account-outline" size={20} color={colors.primary} />
                <Text style={styles.drawerItemText}>Profile</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function PatientDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
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
    activePosters: [],
  });

  const [reminders, setReminders] = useState({});
  const [timePickerState, setTimePickerState] = useState({
    visible: false,
    reminderId: "",
    medicineName: "",
  });
  const [tempReminderDate, setTempReminderDate] = useState(null);

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
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (_error) {
      // Channel creation is Android-only and can fail silently on unsupported platforms.
    }

    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;

      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlert: true,
        },
      });
      if (requested.granted) return true;
    } catch (err) {
      console.warn("Notifications request permissions failed", err);
    }

    // Do not block reminders if notification permissions are denied/blocked in simulator
    Alert.alert(
      "Permission Needed",
      "Notifications permission was not granted. Alarms will not trigger externally, but the schedule has been saved in-app.",
      [{ text: "OK" }]
    );
    return true;
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

    try {
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
    } catch (schedError) {
      console.warn("Failed to schedule notification/reminder natively", schedError);
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
    const current = reminders[medicineId];
    const initialDate = new Date();
    initialDate.setHours(current?.hour ?? 9, current?.minute ?? 0, 0, 0);
    setTempReminderDate(initialDate);
    setTimePickerState({
      visible: true,
      reminderId: String(medicineId),
      medicineName,
    });
  }

  async function handleSaveTime(selectedDate) {
    const { reminderId, medicineName } = timePickerState;
    if (!reminderId || !selectedDate) return;
    await saveReminderSchedule(
      reminderId,
      medicineName,
      selectedDate.getHours(),
      selectedDate.getMinutes(),
    );
    setTimePickerState({
      visible: false,
      reminderId: "",
      medicineName: "",
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
      const [profileRes, appointmentsRes, walletRes] = await Promise.allSettled([
        api.patients.getProfile(user.id),
        api.appointments.getByPatient(user.id),
        api.payments.getWalletBalance(),
      ]);

      setHomeData((current) => ({
        ...current,
        profile: profileRes.status === "fulfilled" ? profileRes.value : current.profile || user,
        appointments:
          appointmentsRes.status === "fulfilled"
            ? normalizeArray(appointmentsRes.value)
            : current.appointments,
        walletBalance:
          walletRes.status === "fulfilled"
            ? Number(walletRes.value?.balance || 0)
            : current.walletBalance,
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
        postersRes,
      ] = await Promise.allSettled([
        api.prescriptions.listByPatient(user.id),
        api.health.latest(),
        api.health.insights(),
        api.recordings.listForPatient(user.id),
        api.wallet.listDocuments(),
        api.doctorPosters.listActive(),
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
        activePosters:
          postersRes.status === "fulfilled"
            ? normalizeArray(postersRes.value)
            : current.activePosters || [],
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
  const activeAppointments = appointments
    .filter((item) => ["booked", "arrived", "in_progress"].includes(item.status))
    .sort((a, b) => {
      const dateA = new Date(`${a.appointment_date}T${a.slot_time || "00:00"}`);
      const dateB = new Date(`${b.appointment_date}T${b.slot_time || "00:00"}`);
      return dateA - dateB;
    });
  const upcomingAppointment = activeAppointments[0] || null;
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
          onMenuPress={() => setDrawerVisible(true)}
          menuIcon="logo"
          onBell={() => navigation.navigate("Notifications")}
        />

        {loading ? <LoadingCard label="Loading your dashboard..." /> : null}
        <InlineError message={error} />

        

        {/* Featured Posters */}
        {homeData.activePosters && homeData.activePosters.length > 0 ? (
          <View style={styles.posterContainer}>
            <SectionHeader
              eyebrow="Sponsored"
              title="Featured Campaigns"
              actionLabel="See All"
              onActionPress={() => navigation.navigate("MedicineSearch")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.posterScrollContent}
              style={{ marginTop: spacing.md }}
            >
              {homeData.activePosters.map((poster) => (
                <View key={poster.id} style={styles.posterCard}>
                  <Image
                    source={{ uri: toAbsoluteUrl(poster.image_url) }}
                    style={styles.posterImage}
                    resizeMode="cover"
                  />
                  <View style={styles.posterInfoOverlay}>
                    <Text style={styles.posterDocName}>
                      {poster.doctor_name.startsWith("Dr.") ? poster.doctor_name : `Dr. ${poster.doctor_name}`}
                    </Text>
                    <Text style={styles.posterDocSpecialty}>{poster.specialty}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Funds Card */}
        <View style={styles.walletBalanceCardContainer}>
          <SurfaceCard tone="lowest" style={styles.premiumWalletCard}>
            <View style={styles.walletHeaderRow}>
              <View style={styles.walletIconContainer}>
                <MaterialCommunityIcons name="wallet-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.walletTitle}>My TechMedix Funds</Text>
                <Text style={styles.walletSubtitle}>Instantly pay consultation fees</Text>
              </View>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletAmountRow}>
              <View>
                <Text style={styles.walletLabelText}>WALLET BALANCE</Text>
                <Text style={styles.walletAmountValue}>{formatCurrency(homeData.walletBalance)}</Text>
              </View>
              <GradientButton
                label="Manage Funds"
                icon="cash-multiple"
                onPress={() => navigation.navigate("PaymentWallet")}
                style={styles.walletActionBtn}
              />
            </View>
          </SurfaceCard>
        </View>

        <SectionHeader
          title="Clinical Workflows"
          eyebrow="Quick Actions"
        />
        <View style={styles.tileGrid}>
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="All Appointments"
            icon="calendar-plus"
            onPress={() => navigation.navigate("Appointments")}
          />
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="Prescription pad"
            icon="file"
            onPress={() => navigation.navigate("Prescriptions")}
          />
          
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="Metrics"
            icon="chart-line"
            onPress={() => navigation.navigate("HealthMetrics")}
          />
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="My QR"
            icon="qrcode"
            onPress={() => navigation.navigate("PatientQR")}
          />
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="Voice Notes"
            icon="microphone-outline"
            onPress={() => navigation.navigate("PatientRecordings")}
          />
          <ActionTile
            style={{ flexBasis: "30%", flexGrow: 1, border: "1.5px solid #d9cece18" }}
            label="Consult Assistant"
            icon="chat"  
            onPress={() => navigation.navigate("AIHealthChat")}
          />
        </View>

        {/* Upcoming Consultation */}
        {upcomingAppointment ? (
          <SurfaceCard tone="lowest" style={styles.appointmentCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.appointmentHeaderTitle}>Upcoming Consultation</Text>
              <Pill label={upcomingAppointment.status || "booked"} tone="info" />
            </View>
            
            <View style={styles.appointmentBody}>
              <View style={styles.appointmentDocInfo}>
                <View style={styles.appointmentAvatarCircle}>
                  <Text style={styles.appointmentAvatarText}>
                    {getInitials(upcomingAppointment.doctor_name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentDocName}>
                    {upcomingAppointment.doctor_name.startsWith("Dr.") ? upcomingAppointment.doctor_name : `Dr. ${upcomingAppointment.doctor_name}`}
                  </Text>
                  {upcomingAppointment.clinic_address ? (
                    <Text style={[styles.appointmentSpecialty, { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
                      📍 {upcomingAppointment.clinic_address}
                    </Text>
                  ) : (
                    <Text style={styles.appointmentSpecialty}>Consulting Doctor</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.appointmentTimeBox}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                <Text style={styles.appointmentTimeText}>
                  {formatDate(upcomingAppointment.appointment_date)} • {formatSlotTime12Hour(upcomingAppointment.slot_time)}
                </Text>
              </View>
              
              <View style={styles.appointmentFooterRow}>
                <View style={styles.paymentBadgeBox}>
                  <MaterialCommunityIcons 
                    name={upcomingAppointment.payment_status === "paid" ? "check-circle" : "alert-circle"} 
                    size={16} 
                    color={upcomingAppointment.payment_status === "paid" ? colors.success : colors.warning} 
                  />
                  <Text style={[styles.paymentBadgeText, { color: upcomingAppointment.payment_status === "paid" ? colors.success : colors.warning }]}>
                    Payment: {upcomingAppointment.payment_status || "pending"}
                  </Text>
                </View>
                
                <View style={styles.appointmentActions}>
                  <TouchableOpacity
                    style={styles.appointmentQueueBtn}
                    onPress={() => navigation.navigate("PatientQueue")}
                  >
                    <MaterialCommunityIcons name="account-clock-outline" size={16} color={colors.primary} />
                    <Text style={styles.appointmentQueueText}>Queue</Text>
                  </TouchableOpacity>
                  
                  {upcomingAppointment.payment_status !== "paid" ? (
                    <TouchableOpacity
                      style={styles.appointmentPayBtn}
                      onPress={() =>
                        navigation.navigate("AppointmentPayment", {
                          appointmentId: upcomingAppointment.id,
                        })
                      }
                    >
                      <Text style={styles.appointmentPayText}>Pay Now</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </SurfaceCard>
        ) : null}

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

          {homeData.prescriptions.length ? (
            homeData.prescriptions.slice(0, 4).map((item) => {
              const active = reminders[item.medicine_id || item.id];
              return (
                <View key={item.medicine_id || item.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{item.medicine_name}</Text>
                    <Text style={styles.listMeta}>
                      {active
                        ? `Scheduled daily at ${formatReminderTime(
                            active.hour,
                            active.minute,
                          )}`
                        : "No reminder schedule"}
                    </Text>
                  </View>
                  <View style={styles.buttonRow}>
                    {active ? (
                      <SecondaryButton
                        label="Set Time"
                        icon="clock-edit-outline"
                        onPress={() =>
                          openReminderTimePicker(
                            item.medicine_id || item.id,
                            item.medicine_name,
                          )
                        }
                      />
                    ) : null}
                    <SecondaryButton
                      label={active ? "Off" : "On"}
                      icon={active ? "bell-off-outline" : "bell-outline"}
                      onPress={() =>
                        toggleReminder(
                          item.medicine_id || item.id,
                          item.medicine_name,
                        )
                      }
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.sectionMuted}>No prescriptions loaded.</Text>
          )}
        </SurfaceCard>

        <SurfaceCard tone="low">
          <View style={styles.cardHeaderRow}>
            <Text style={styles.blockTitle}>Diagnostic Summary</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("HealthMetrics")}
            >
              <Text style={styles.linkText}>View Performance</Text>
            </TouchableOpacity>
          </View>
          {latestMetrics.length ? (
            Object.entries(homeData.healthLatest || {}).slice(0, 4).map(([metricKey, item]) => (
              <DetailRow
                key={metricKey}
                icon="heart-pulse"
                label={String(metricKey).toUpperCase()}
                value={item && typeof item === "object" ? `${item.value ?? ""} ${item.unit || ""}`.trim() : String(item ?? "")}
              />
            ))
          ) : (
            <Text style={styles.sectionMuted}>No metrics recorded.</Text>
          )}
        </SurfaceCard>

        {/* <SurfaceCard>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.blockTitle}>AI Insights</Text>
           
          </View>
          {homeData.insights.length ? (
            homeData.insights.map((item, index) => (
              <Text key={index} style={styles.smallText}>
                {item}
              </Text>
            ))
          ) : (
            <Text style={styles.sectionMuted}>
              No insights found. Sync Google Fit or complete an X-ray check.
            </Text>
          )}
        </SurfaceCard> */}
      </ScreenScroll>

      {timePickerState.visible ? (
        Platform.OS === "ios" ? (
          <Modal transparent visible={timePickerState.visible} animationType="fade">
            <View style={styles.timePickerModalBackdrop}>
              <SurfaceCard style={styles.timePickerCard}>
                <Text style={styles.timePickerTitle}>Set Reminder Time</Text>
                <DateTimePicker
                  value={tempReminderDate || new Date()}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTempReminderDate(selectedDate);
                    }
                  }}
                />
                <View style={styles.timePickerActionRow}>
                  <TouchableOpacity
                    style={styles.timePickerCancelBtn}
                    onPress={() => {
                      setTimePickerState((prev) => ({ ...prev, visible: false }));
                    }}
                  >
                    <Text style={styles.timePickerCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.timePickerDoneBtn}
                    onPress={async () => {
                      if (tempReminderDate) {
                        await handleSaveTime(tempReminderDate);
                      } else {
                        setTimePickerState((prev) => ({ ...prev, visible: false }));
                      }
                    }}
                  >
                    <Text style={styles.timePickerDoneBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={
              new Date(
                0,
                0,
                0,
                reminders[timePickerState.reminderId]?.hour ?? 9,
                reminders[timePickerState.reminderId]?.minute ?? 0,
              )
            }
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleReminderTimeChange}
          />
        )
      ) : null}

      <PatientMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
      />
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
  const [shareEhr, setShareEhr] = useState(true);
  const [sharePrescriptions, setSharePrescriptions] = useState(true);
  const [shareRecordings, setShareRecordings] = useState(false);
  const [shareReports, setShareReports] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("my"); // "my" or "book"
  const [myAppointments, setMyAppointments] = useState([]);
  const [myApptsLoading, setMyApptsLoading] = useState(false);
  const [reviewedAppts, setReviewedAppts] = useState(new Set());
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedApptForReview, setSelectedApptForReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedDocReviews, setSelectedDocReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [doctorReviewsModalVisible, setDoctorReviewsModalVisible] = useState(false);
  const [reviewModalDoctor, setReviewModalDoctor] = useState(null);
  const [doctorReviewsList, setDoctorReviewsList] = useState([]);
  const [doctorReviewsLoading, setDoctorReviewsLoading] = useState(false);

  async function loadMyAppointments() {
    if (!user?.id) return;
    setMyApptsLoading(true);
    try {
      const [apptsRes, reviewsRes] = await Promise.allSettled([
        api.appointments.getByPatient(user.id),
        api.reviews.getByPatient(),
      ]);

      if (apptsRes.status === "fulfilled") {
        setMyAppointments(normalizeArray(apptsRes.value));
      }
      if (reviewsRes.status === "fulfilled") {
        const reviews =
          reviewsRes.value?.reviews || reviewsRes.value?.data?.reviews || reviewsRes.value?.data || [];
        const reviewedIds = new Set(
          reviews.map((r) => r.appointment_id).filter(Boolean)
        );
        setReviewedAppts(reviewedIds);
      }
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setMyApptsLoading(false);
    }
  }

  function openReviewModal(appt) {
    setSelectedApptForReview(appt);
    setRating(5);
    setComment("");
    setReviewModalVisible(true);
  }

  async function submitReview() {
    if (!selectedApptForReview) return;
    setSubmittingReview(true);
    try {
      await api.reviews.submit({
        doctor_id: selectedApptForReview.doctor_id,
        appointment_id: selectedApptForReview.id,
        rating,
        comment: comment.trim(),
      });
      if (Platform.OS === "web") {
        window.alert("Thank you! Your review has been submitted.");
      } else {
        Alert.alert("Thank you", "Your review has been submitted.");
      }
      setReviewModalVisible(false);
      loadMyAppointments();
    } catch (err) {
      if (Platform.OS === "web") {
        window.alert(`Failed to submit review: ${err.message}`);
      } else {
        Alert.alert("Error", err.message);
      }
    } finally {
      setSubmittingReview(false);
    }
  }

  async function openDoctorReviews(doctor) {
    setReviewModalDoctor(doctor);
    setDoctorReviewsModalVisible(true);
    setDoctorReviewsLoading(true);
    setDoctorReviewsList([]);
    try {
      const res = await api.reviews.getByDoctor(doctor.id);
      const val = res?.data || res;
      setDoctorReviewsList(val?.reviews || val?.data?.reviews || val?.data || []);
    } catch (err) {
      console.warn("Failed to load doctor reviews:", err.message);
    } finally {
      setDoctorReviewsLoading(false);
    }
  }

  async function handleCancelAppointment(apptId) {
    if (Platform.OS === "web") {
      const confirmCancel = window.confirm("Are you sure you want to cancel this appointment?");
      if (!confirmCancel) return;
      try {
        await api.appointments.cancel(apptId);
        loadMyAppointments();
      } catch (err) {
        window.alert(`Error: ${err.message}`);
      }
      return;
    }

    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await api.appointments.cancel(apptId);
              loadMyAppointments();
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "my") {
      loadMyAppointments();
    } else {
      loadDoctors();
    }
  };

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
      loadMyAppointments();
    }, [user?.id]),
  );

  async function selectDoctor(doctor) {
    setSelectedDoctor(doctor);
    setBookingSheetVisible(true);
    setSelectedDate("");
    setSelectedSlot("");
    setSlots([]);
    setDatesLoading(true);
    setReviewsLoading(true);
    setSelectedDocReviews([]);

    // Fetch dates and reviews in parallel
    Promise.allSettled([
      api.schedule.getAvailableDates(doctor.id, 14),
      api.reviews.getByDoctor(doctor.id),
    ]).then(([datesRes, reviewsRes]) => {
      if (datesRes.status === "fulfilled") {
        const val = datesRes.value;
        setDates(val?.available_dates || val?.data || []);
      } else {
        setError(datesRes.reason?.message);
        setDates([]);
      }

      if (reviewsRes.status === "fulfilled") {
        const val = reviewsRes.value;
        setSelectedDocReviews(
          val?.reviews || val?.data?.reviews || val?.data || []
        );
      }
      setDatesLoading(false);
      setReviewsLoading(false);
    });
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
    <>
      <ScreenScroll contentContainerStyle={styles.screenContent}>
        <TopBar
          title="Appointments"
          avatar={getInitials(user?.name)}
          onMenuPress={() => setDrawerVisible(true)}
          onBell={() => navigation.navigate("Notifications")}
        />
        <View style={styles.tabHeaderRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "my" && styles.tabButtonActive]}
            onPress={() => handleTabChange("my")}
          >
            <Text style={[styles.tabButtonText, activeTab === "my" && styles.tabButtonTextActive]}>
              My Appointments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "book" && styles.tabButtonActive]}
            onPress={() => handleTabChange("book")}
          >
            <Text style={[styles.tabButtonText, activeTab === "book" && styles.tabButtonTextActive]}>
              Book New
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "my" ? (
          <SectionHeader
            title="My Consultations"
            description="View your upcoming and past doctor appointments, check status, make payments or request cancellation."
          />
        ) : (
          <SectionHeader
            title="Find a doctor and reserve a real slot."
            description="This screen now uses the existing doctors list, schedule service, and appointment booking endpoints."
          />
        )}

        <InlineError message={error} />

        {activeTab === "my" ? (
          myApptsLoading ? (
            <LoadingCard label="Loading your appointments..." />
          ) : myAppointments.length ? (
            myAppointments.map((appt) => (
              <SurfaceCard key={appt.id}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.inlineRow}>
                    <AvatarBubble
                      label={getInitials(appt.doctor_name || "Doc")}
                      size={40}
                      tone="secondary"
                    />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.listTitle}>{appt.doctor_name || "Assigned Doctor"}</Text>
                      <Text style={styles.listMeta}>{appt.doctor_specialty || "General Medicine"}</Text>
                    </View>
                  </View>
                  <Pill
                    label={appt.status || "booked"}
                    tone={
                      appt.status === "cancelled"
                        ? "warning"
                        : appt.status === "completed"
                        ? "success"
                        : "info"
                    }
                  />
                </View>
                <Text style={styles.sectionMuted}>
                  {formatDate(appt.appointment_date)} at {formatSlotTime12Hour(appt.slot_time)}
                </Text>
                {appt.clinic_address ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.outline} />
                    <Text style={[styles.sectionMuted, { flex: 1, fontSize: 11 }]} numberOfLines={2}>
                      {appt.clinic_address}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.inlineRow}>
                  <InfoChip
                    icon="cash-multiple"
                    label={`Payment: ${appt.payment_status || "pending"}`}
                  />
                  {appt.status !== "cancelled" && appt.status !== "completed" && appt.status !== "visited" && (
                    <InfoChip
                      icon="clock-outline"
                      label={`Slot: ${appt.slot_time}`}
                    />
                  )}
                </View>
                {appt.status !== "cancelled" && appt.status !== "completed" && appt.status !== "visited" ? (
                  <View style={styles.buttonRow}>
                    {appt.payment_status !== "paid" ? (
                      <GradientButton
                        label="Pay"
                        icon="credit-card-outline"
                        onPress={() =>
                          navigation.navigate("AppointmentPayment", {
                            appointmentId: appt.id,
                          })
                        }
                        style={{ flex: 1 }}
                      />
                    ) : null}
                    <SecondaryButton
                      label="Cancel"
                      icon="close"
                      onPress={() => handleCancelAppointment(appt.id)}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : (appt.status === "completed" || appt.status === "visited") ? (
                  <View style={styles.buttonRow}>
                    {reviewedAppts.has(appt.id) ? (
                      <SecondaryButton
                        label="Reviewed"
                        icon="star"
                        disabled={true}
                        style={{ flex: 1, opacity: 0.6 }}
                      />
                    ) : (
                      <GradientButton
                        label="Review"
                        icon="star-outline"
                        onPress={() => openReviewModal(appt)}
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                ) : null}
              </SurfaceCard>
            ))
          ) : (
            <EmptyStateCard
              title="No appointments"
              body="You haven't booked any appointments yet."
            />
          )
        ) : (
          <>
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
                  <View style={[styles.inlineRow, { flex: 1, flexWrap: "nowrap" }]}>
                    <AvatarBubble
                      label={getInitials(doctor.name)}
                      size={46}
                      tone="secondary"
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.listTitle}>{doctor.name}</Text>
                      <Text style={styles.listMeta}>{doctor.specialty}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <MaterialCommunityIcons name="star" size={14} color="#EAB308" />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.onSurface }}>
                          {doctor.average_rating || "0.0"}
                        </Text>
                        <TouchableOpacity onPress={() => openDoctorReviews(doctor)}>
                          <Text style={{ fontSize: 12, color: colors.primary}}>
                            ({doctor.review_count || 0} reviews)
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {doctor.clinic_address ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.outline} />
                          <Text style={[styles.listMeta, { fontSize: 11 }]} numberOfLines={1}>
                            {doctor.clinic_address}
                          </Text>
                        </View>
                      ) : null}
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
          </>
        )}

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
                {selectedDoctor?.clinic_address ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 6, backgroundColor: colors.surfaceLow, borderRadius: 8, padding: 10 }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.primary} />
                    <Text style={[styles.sectionMuted, { flex: 1, lineHeight: 18 }]}>
                      {selectedDoctor.clinic_address}
                    </Text>
                  </View>
                ) : null}
                {/* Patient Reviews Section */}
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.outline + "30", paddingTop: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>Patient Reviews</Text>
                    {selectedDocReviews.length > 0 ? (
                      <TouchableOpacity onPress={() => { setBookingSheetVisible(false); openDoctorReviews(selectedDoctor); }}>
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>View All</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {reviewsLoading ? (
                    <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 8 }} />
                  ) : selectedDocReviews.length > 0 ? (
                    <View style={{ maxHeight: 150, overflow: "scroll" }}>
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }} showsVerticalScrollIndicator={true}>
                        {selectedDocReviews.map((rev) => (
                          <View key={rev.id} style={{ padding: 8, backgroundColor: colors.surfaceLowest, borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.outline + "30" }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <View style={{ flexDirection: "row", gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <MaterialCommunityIcons
                                    key={s}
                                    name={s <= rev.rating ? "star" : "star-outline"}
                                    size={12}
                                    color={s <= rev.rating ? "#EAB308" : colors.outline}
                                  />
                                ))}
                              </View>
                              <Text style={{ fontSize: 10, color: colors.outline }}>
                                {new Date(rev.created_at).toLocaleDateString()}
                              </Text>
                            </View>
                            {rev.comment ? (
                              <Text style={{ fontSize: 12, color: colors.onSurface, fontStyle: "italic" }}>
                                "{rev.comment}"
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 12, color: colors.outline, fontStyle: "italic" }}>
                                Rated {rev.rating} stars
                              </Text>
                            )}
                            <Text style={{ fontSize: 10, color: colors.outline, marginTop: 4, fontWeight: "600" }}>
                              Verified Patient
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.outline, fontStyle: "italic", marginVertical: 4 }}>
                      No reviews yet for this doctor.
                    </Text>
                  )}
                </View>

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
                              {formatSlotTime12Hour(slot.start_time)}
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
                    Share health history with doctor
                  </Text>
                  <Switch value={shareHistory} onValueChange={setShareHistory} />
                </View>

                {shareHistory ? (
                  <View style={{ paddingLeft: 16, gap: 10, marginBottom: 12 }}>
                    <View style={styles.switchRowSub}>
                      <Text style={styles.switchLabelSub}>
                        Medical history and vitals
                      </Text>
                      <Switch value={shareEhr} onValueChange={setShareEhr} />
                    </View>
                    <View style={styles.switchRowSub}>
                      <Text style={styles.switchLabelSub}>
                        Prescriptions
                      </Text>
                      <Switch value={sharePrescriptions} onValueChange={setSharePrescriptions} />
                    </View>
                    <View style={styles.switchRowSub}>
                      <Text style={styles.switchLabelSub}>
                        Voice notes and recordings
                      </Text>
                      <Switch value={shareRecordings} onValueChange={setShareRecordings} />
                    </View>
                    <View style={styles.switchRowSub}>
                      <Text style={styles.switchLabelSub}>
                        Reports, PDFs, and uploads
                      </Text>
                      <Switch value={shareReports} onValueChange={setShareReports} />
                    </View>
                  </View>
                ) : null}

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

        {/* Review Modal */}
        <Modal
          visible={reviewModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={modalStyles.backdrop}>
            <SurfaceCard style={[modalStyles.card, { maxWidth: 400 }]}>
              <View style={modalStyles.header}>
                <Text style={modalStyles.title}>Rate Consultation</Text>
                <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: "center", marginVertical: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onSurface, marginBottom: 8 }}>
                  {selectedApptForReview?.doctor_name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.outline, marginBottom: 16 }}>
                  How was your experience with the doctor?
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <MaterialCommunityIcons
                        name={star <= rating ? "star" : "star-outline"}
                        size={36}
                        color={star <= rating ? "#EAB308" : colors.outline}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.outline,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  fontSize: 14,
                  color: colors.onSurface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  backgroundColor: colors.surfaceLow,
                }}
                multiline
                numberOfLines={4}
                placeholder="Write your feedback/comment here (optional)..."
                placeholderTextColor={colors.outline}
                value={comment}
                onChangeText={setComment}
              />
              <GradientButton
                label={submittingReview ? "Submitting..." : "Submit Review"}
                icon="check-decagram"
                onPress={submitReview}
                disabled={submittingReview}
              />
            </SurfaceCard>
          </View>
        </Modal>

        {/* View Doctor Reviews Modal */}
        <Modal
          visible={doctorReviewsModalVisible && !!reviewModalDoctor}
          transparent
          animationType="fade"
          onRequestClose={() => setDoctorReviewsModalVisible(false)}
        >
          <View style={modalStyles.backdrop}>
            <SurfaceCard style={[modalStyles.card, { maxWidth: 420, maxHeight: "80%" }]}>
              <View style={modalStyles.header}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={modalStyles.title} numberOfLines={1}>Reviews & Ratings</Text>
                  <Text style={{ fontSize: 12, color: colors.outline }}>
                    Dr. {reviewModalDoctor?.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setDoctorReviewsModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.outline + "20" }}>
                <MaterialCommunityIcons name="star" size={24} color="#EAB308" />
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.onSurface }}>
                  {reviewModalDoctor?.average_rating || "0.0"}
                </Text>
                <Text style={{ fontSize: 14, color: colors.outline }}>
                  ({reviewModalDoctor?.review_count || 0} reviews)
                </Text>
              </View>

              {doctorReviewsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : doctorReviewsList.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={true} style={{ maxHeight: 350 }}>
                  {doctorReviewsList.map((rev) => (
                    <View key={rev.id} style={{ padding: 12, backgroundColor: colors.surfaceLowest, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.outline + "30" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <MaterialCommunityIcons
                              key={s}
                              name={s <= rev.rating ? "star" : "star-outline"}
                              size={14}
                              color={s <= rev.rating ? "#EAB308" : colors.outline}
                            />
                          ))}
                        </View>
                        <Text style={{ fontSize: 11, color: colors.outline }}>
                          {new Date(rev.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {rev.comment ? (
                        <Text style={{ fontSize: 13, color: colors.onSurface, lineHeight: 18 }}>
                          "{rev.comment}"
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.outline, fontStyle: "italic" }}>
                          Patient rated this consultation {rev.rating} stars.
                        </Text>
                      )}
                      <Text style={{ fontSize: 10, color: colors.outline, marginTop: 6, fontWeight: "600" }}>
                        Verified Patient
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ fontSize: 14, color: colors.outline, fontStyle: "italic", textAlign: "center", marginVertical: 20 }}>
                  No patient reviews yet for this doctor.
                </Text>
              )}

              <GradientButton
                label="Close"
                icon="check"
                onPress={() => setDoctorReviewsModalVisible(false)}
              />
            </SurfaceCard>
          </View>
        </Modal>
      </ScreenScroll>

      <PatientMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
      />
    </>
  );
}

export function AnalyzePrescriptionScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [showPadSelection, setShowPadSelection] = useState(false);
  const [viewingRxPad, setViewingRxPad] = useState(false);
  const [selectedPad, setSelectedPad] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedMedicineForEdit, setSelectedMedicineForEdit] = useState(null);
  const [editForm, setEditForm] = useState({ medicine_name: "", dosage: "", frequency: "", duration: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const handleDownloadPrescription = () => {
    if (Platform.OS === "web") {
      window.print();
    } else {
      Alert.alert(
        "Prescription Downloaded",
        "The digital prescription pad has been saved to your downloads as a PDF.",
        [{ text: "OK" }]
      );
    }
  };

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
    Alert.alert(
      "Choose Prescription Source",
      "Select where you want to choose your prescription file from:",
      [
        {
          text: "Choose from Album",
          onPress: async () => {
            try {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert(
                  "Permission Needed",
                  "Allow photo library access to choose a prescription image."
                );
                return;
              }

              const response = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });

              if (response.canceled || !response.assets?.length) return;
              const selected = response.assets[0];
              setSelectedFile({
                uri: selected.uri,
                name: selected.fileName || `prescription-${Date.now()}.jpg`,
                mimeType: selected.mimeType || "image/jpeg",
              });
            } catch (err) {
              setError(err.message || "Failed to pick image from library.");
            }
          },
        },
        {
          text: "Choose from Files",
          onPress: async () => {
            try {
              const asset = await pickSingleDocument({
                type: ["image/*", "application/pdf"],
              });
              if (asset) setSelectedFile(asset);
            } catch (err) {
              setError(err.message || "Failed to pick document.");
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
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

  async function handleDeleteMedicine(id) {
    if (!id) return;

    if (Platform.OS === "web") {
      const confirmDelete = window.confirm("Are you sure you want to remove this medicine from your active list?");
      if (!confirmDelete) return;
      try {
        await api.prescriptions.deleteMedicine(id);
        await loadCurrentMeds();
      } catch (err) {
        window.alert(`Failed to delete medicine: ${err.message}`);
      }
      return;
    }

    Alert.alert(
      "Delete Medicine",
      "Are you sure you want to remove this medicine from your active list?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.prescriptions.deleteMedicine(id);
              await loadCurrentMeds();
            } catch (err) {
              setError(err.message);
            }
          },
        },
      ]
    );
  }

  function openEditModal(item) {
    setSelectedMedicineForEdit(item);
    setEditForm({
      medicine_name: item.medicine_name || "",
      dosage: item.dosage || "",
      frequency: item.frequency || "",
      duration: item.duration || "",
    });
    setEditModalVisible(true);
  }

  async function saveMedicineEdit() {
    if (!selectedMedicineForEdit) return;
    const medId = selectedMedicineForEdit.id || selectedMedicineForEdit.medicine_id;
    if (!medId) return;

    setSavingEdit(true);
    try {
      await api.prescriptions.updateMedicine(medId, {
        medicine_name: editForm.medicine_name.trim(),
        dosage: editForm.dosage.trim(),
        frequency: editForm.frequency.trim(),
        duration: editForm.duration.trim(),
      });
      setEditModalVisible(false);
      await loadCurrentMeds();
      if (Platform.OS === "web") {
        window.alert("Medicine updated successfully.");
      } else {
        Alert.alert("Success", "Medicine updated successfully.");
      }
    } catch (err) {
      if (Platform.OS === "web") {
        window.alert(`Failed to update medicine: ${err.message}`);
      } else {
        Alert.alert("Error", `Failed to update medicine: ${err.message}`);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  const groupedPrescriptionPads = React.useMemo(() => {
    if (!Array.isArray(medicines)) return [];
    const groups = {};
    medicines.forEach((item) => {
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
          latestDate: item.created_at || item.recorded_at || null,
        };
      }
      groups[docId].medicines.push(item);
      const itemDate = new Date(item.created_at || item.recorded_at || Date.now());
      const groupDate = new Date(groups[docId].latestDate);
      if (itemDate > groupDate) {
        groups[docId].latestDate = item.created_at || item.recorded_at;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
  }, [medicines]);

  return (
    <>
      <ScreenScroll contentContainerStyle={styles.screenContent}>
        <TopBar
          title="Prescription Intelligence"
          avatar={getInitials(user?.name)}
          onMenuPress={() => setDrawerVisible(true)}
          onBell={() => navigation.navigate("Notifications")}
        />
       
        {/* Search & Compare Medicines UI block */}
        <SurfaceCard>
          <GradientButton
            label="Search & Compare Medicines"
            icon="magnify"
            onPress={() => navigation.navigate("MedicineSearch")}
          />
        </SurfaceCard>
 <SectionHeader
          title="Upload Prescription"
        />
        <InlineError message={error} />

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

        <SurfaceCard tone="low" style={{ paddingHorizontal: 0 }}>
          <View style={[styles.cardHeaderRow, { paddingHorizontal: 16 }]}>
            <Text style={styles.blockTitle}>Extracted Medicines</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("PatientAddMedicine")}
            >
              <Text style={styles.linkText}>Add medicine</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <GradientButton
              label="See Prescription Pad"
              icon="file-document-outline"
              onPress={() => setShowPadSelection(true)}
              style={{ marginBottom: 12 }}
            />
          </View>

          {medicines.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={[styles.tableContainer, { minWidth: 600, borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 }]}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>MEDICINE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>DOSAGE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>FREQUENCY</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>DURATION</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: "center" }]}>ACTIONS</Text>
                </View>

                {/* Table Body */}
                {medicines.map((item, idx) => (
                  <View key={item.id || idx} style={styles.tableDataRow}>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: "700" }]}>
                      {item.medicine_name}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>
                      {item.dosage || "—"}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.5 }]}>
                      {item.frequency || "—"}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2 }]}>
                      {item.duration || "—"}
                    </Text>
                    <View style={[styles.tableActionCell, { flex: 1.8 }]}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate("MedicineSearch", { query: item.medicine_name })}
                        style={styles.actionIconButton}
                      >
                        <MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openEditModal(item)}
                        style={styles.actionIconButton}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteMedicine(item.id || item.medicine_id)}
                        style={styles.actionIconButton}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={16} color={colors.error || "#ff4d4d"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={styles.sectionMuted}>
                No extracted medicines available yet.
              </Text>
            </View>
          )}
        </SurfaceCard>
      </ScreenScroll>

      {/* Clinician Selection Modal */}
      <Modal
        visible={showPadSelection}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPadSelection(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setShowPadSelection(false)}
          />
          <SurfaceCard tone="low" style={styles.bookingModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.blockTitle}>Select Clinician Pad</Text>
              <TouchableOpacity onPress={() => setShowPadSelection(false)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              {groupedPrescriptionPads.map((pad, index) => (
                <TouchableOpacity
                  key={pad.doctor.id || index}
                  style={styles.clinicianCard}
                  onPress={() => {
                    setSelectedPad(pad);
                    setShowPadSelection(false);
                    setViewingRxPad(true);
                  }}
                >
                  <View style={styles.clinicianAvatar}>
                    <Text style={styles.clinicianInitials}>
                      {getInitials(pad.doctor.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clinicianName}>
                      {pad.doctor.name.startsWith("Dr.") ? pad.doctor.name : `Dr. ${pad.doctor.name}`}
                    </Text>
                    <Text style={styles.clinicianSpecialty}>{pad.doctor.specialty}</Text>
                    <Text style={styles.clinicianMeta}>
                      Latest: {formatDate(pad.latestDate)} • {pad.medicines.length} medicines
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.outline} />
                </TouchableOpacity>
              ))}
              {groupedPrescriptionPads.length === 0 && (
                <Text style={styles.sectionMuted}>No prescription pads available yet.</Text>
              )}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>

      {/* Fullscreen Digital Prescription Pad Modal */}
      <Modal
        visible={viewingRxPad && !!selectedPad}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setViewingRxPad(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
          {/* Header */}
          <View style={styles.padNavHeader}>
            <TouchableOpacity onPress={() => setViewingRxPad(false)} style={styles.padBackButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
              <Text style={styles.padBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.padNavTitle}>Prescription Pad</Text>
            <TouchableOpacity onPress={handleDownloadPrescription} style={styles.padBackButton}>
              <MaterialCommunityIcons name="download" size={24} color={colors.primary} />
              <Text style={styles.padBackText}>Download</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.padContentContainer}>
            {/* The Rx Sheet */}
            <View style={styles.rxSheet}>
              {/* Doctor Details */}
              <View style={styles.rxHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rxDocName}>
                    {selectedPad?.doctor.name.startsWith("Dr.") ? selectedPad.doctor.name : `Dr. ${selectedPad?.doctor.name}`}
                  </Text>
                  <Text style={styles.rxDocSpecialty}>{selectedPad?.doctor.specialty}</Text>
                  <Text style={styles.rxDocReg}>Reg No: {selectedPad?.doctor.reg_no || "TM-DOC-2024-001"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.rxHospitalName}>TechMedix</Text>
                  <Text style={styles.rxHospitalSub}>CLINICAL SANCTUARY</Text>
                  {selectedPad?.doctor.email ? <Text style={styles.rxHospitalContact}>{selectedPad.doctor.email}</Text> : null}
                  {selectedPad?.doctor.phone ? <Text style={styles.rxHospitalContact}>{selectedPad.doctor.phone}</Text> : null}
                </View>
              </View>

              <View style={styles.rxLine} />

              {/* Patient details */}
              <View style={styles.rxPatientRow}>
                <Text style={styles.rxPatientText}>
                  <Text style={{ fontWeight: "700" }}>Patient: </Text>
                  {user?.name || "Patient"}
                </Text>
                <Text style={styles.rxPatientText}>
                  <Text style={{ fontWeight: "700" }}>Date: </Text>
                  {formatDate(selectedPad?.latestDate)}
                </Text>
              </View>

              <View style={styles.rxLine} />

              {/* Rx Symbol */}
              <Text style={styles.rxSymbol}>Rx</Text>

              {/* Prescribed Medicines Table */}
              <View style={styles.padTable}>
                <View style={styles.padTableHeader}>
                  <Text style={[styles.padTableHeaderText, { flex: 2 }]}>MEDICINE</Text>
                  <Text style={[styles.padTableHeaderText, { flex: 1 }]}>DOSAGE</Text>
                  <Text style={[styles.padTableHeaderText, { flex: 1.5 }]}>FREQUENCY</Text>
                  <Text style={[styles.padTableHeaderText, { flex: 1 }]}>DURATION</Text>
                </View>
                {selectedPad?.medicines.map((med, index) => (
                  <View key={med.id || index} style={styles.padTableRow}>
                    <Text style={[styles.padTableCell, { flex: 2, fontWeight: "700" }]}>{med.medicine_name}</Text>
                    <Text style={[styles.padTableCell, { flex: 1 }]}>{med.dosage || "—"}</Text>
                    <Text style={[styles.padTableCell, { flex: 1.5 }]}>{med.frequency || "—"}</Text>
                    <Text style={[styles.padTableCell, { flex: 1 }]}>{med.duration || "—"}</Text>
                  </View>
                ))}
              </View>

              {/* QR Verification Code */}
              <View style={styles.qrVerificationContainer}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      `TechMedix Verification\nPatient: ${user?.name || "N/A"}\nPatient ID: ${user?.id || "N/A"}\nRx No: ${selectedPad?.medicines[0]?.prescription_id || selectedPad?.medicines[0]?.id || "RX-TEMP"}\nDoctor: ${selectedPad?.doctor?.name || "N/A"}`
                    )}`
                  }}
                  style={styles.qrVerificationImage}
                  resizeMode="contain"
                />
                <Text style={styles.qrVerificationText}>Scan to Verify</Text>
              </View>

              {/* Footer */}
              <View style={styles.rxFooter}>
                <View style={styles.rxFooterLine} />
                <Text style={styles.rxFooterText}>
                  This is a digitally generated prescription. It does not require a physical signature or stamp for validation.
                </Text>
                <View style={styles.safetyVerifiedRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color="#4caf50" />
                  <Text style={styles.safetyVerifiedText}>Verified by TechMedix AI Safety Audit</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={modalStyles.backdrop}>
          <SurfaceCard style={[modalStyles.card, { maxWidth: 360 }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Edit Medicine</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Medicine Name</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                padding: spacing.sm,
                fontSize: 14,
                color: colors.onSurface,
                backgroundColor: colors.surfaceLow,
                marginBottom: 12,
              }}
              value={editForm.medicine_name}
              onChangeText={(txt) => setEditForm(prev => ({ ...prev, medicine_name: txt }))}
            />

            <Text style={styles.inputLabel}>Dosage</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                padding: spacing.sm,
                fontSize: 14,
                color: colors.onSurface,
                backgroundColor: colors.surfaceLow,
                marginBottom: 12,
              }}
              placeholder="e.g. 500mg, 1 tab"
              placeholderTextColor={colors.outline}
              value={editForm.dosage}
              onChangeText={(txt) => setEditForm(prev => ({ ...prev, dosage: txt }))}
            />

            <Text style={styles.inputLabel}>Frequency</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                padding: spacing.sm,
                fontSize: 14,
                color: colors.onSurface,
                backgroundColor: colors.surfaceLow,
                marginBottom: 12,
              }}
              placeholder="e.g. Once daily, Twice a day"
              placeholderTextColor={colors.outline}
              value={editForm.frequency}
              onChangeText={(txt) => setEditForm(prev => ({ ...prev, frequency: txt }))}
            />

            <Text style={styles.inputLabel}>Duration</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                padding: spacing.sm,
                fontSize: 14,
                color: colors.onSurface,
                backgroundColor: colors.surfaceLow,
                marginBottom: 20,
              }}
              placeholder="e.g. 5 days, 1 month"
              placeholderTextColor={colors.outline}
              value={editForm.duration}
              onChangeText={(txt) => setEditForm(prev => ({ ...prev, duration: txt }))}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <SecondaryButton
                label="Cancel"
                onPress={() => setEditModalVisible(false)}
                style={{ flex: 1 }}
              />
              <GradientButton
                label={savingEdit ? "Saving..." : "Save"}
                icon="check"
                disabled={savingEdit}
                onPress={saveMedicineEdit}
                style={{ flex: 1 }}
              />
            </View>
          </SurfaceCard>
        </View>
      </Modal>

      <PatientMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
      />
    </>
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
    Alert.alert(
      "Choose Source",
      "Select where you want to upload your documents from:",
      [
        {
          text: "Choose from Album",
          onPress: async () => {
            try {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert(
                  "Permission Needed",
                  "Allow photo library access to choose images."
                );
                return;
              }

              const response = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
              });

              if (response.canceled || !response.assets?.length) return;

              setUploading(true);
              try {
                const mappedAssets = response.assets.map((asset) => ({
                  uri: asset.uri,
                  name: asset.fileName || `document-${Date.now()}.jpg`,
                  mimeType: asset.mimeType || "image/jpeg",
                }));
                await api.wallet.uploadDocuments(mappedAssets);
                await loadDocuments();
              } catch (uploadError) {
                setError(uploadError.message);
              } finally {
                setUploading(false);
              }
            } catch (err) {
              setError(err.message || "Failed to pick image from library.");
            }
          },
        },
        {
          text: "Choose from Files",
          onPress: async () => {
            try {
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
            } catch (err) {
              setError(err.message || "Failed to pick document.");
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
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
        title="Wallet"
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

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

  function addMoneyToWallet() {
    setTopUpAmount("");
    setTopUpModalVisible(true);
  }

  async function triggerAddMoney() {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      if (Platform.OS === "web") {
        window.alert("Please enter a valid amount greater than 0.");
      } else {
        Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      }
      return;
    }

    setAddingMoney(true);
    try {
      const response = await api.payments.initiateAddMoney({
        amount: amt,
        patient_id: user.id,
      });
      const sessionId = response?.payment_session_id;
      if (!sessionId) {
        throw new Error("Failed to obtain payment session from server.");
      }
      const isProd = response.cashfree_mode === "production";
      const checkoutUrl = isProd
        ? `https://payments.cashfree.com/order/#${sessionId}`
        : `https://payments-test.cashfree.com/order/#${sessionId}`;

      console.log("Opening Cashfree wallet topup URL:", checkoutUrl);
      setTopUpModalVisible(false);
      await Linking.openURL(checkoutUrl);

      if (Platform.OS === "web") {
        window.alert("Top-up Process Launched. Once payment is completed, tap Refresh to update your balance.");
        loadWalletData();
      } else {
        Alert.alert(
          "Top-up Process Launched",
          "Once payment is completed, tap Refresh to update your balance.",
          [{ text: "Refresh Now", onPress: () => loadWalletData() }]
        );
      }
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
    <>
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
          title="Funds"
          showBack={navigation.canGoBack()}
          onBack={() => navigation.goBack()}
          onMenuPress={() => setDrawerVisible(true)}
          onBell={() => navigation.navigate("Notifications")}
        />
        <InlineError message={error} />

        {loading ? <LoadingCard label="Loading wallet..." /> : null}

        {/* Wallet Balance Card */}
        <SurfaceCard style={styles.walletBalanceCard}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.walletLabel}>WALLET</Text>
              <Text style={styles.walletSubLabel}>
                Existing Balance
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
              label={addingMoney ? "Launching..." : "Add Money"}
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

      {/* Top-up Amount Modal */}
      <Modal
        visible={topUpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTopUpModalVisible(false)}
      >
        <View style={modalStyles.backdrop}>
          <SurfaceCard style={[modalStyles.card, { maxWidth: 360 }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Top-up Wallet</Text>
              <TouchableOpacity onPress={() => setTopUpModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.outline, marginBottom: 12 }}>
              Enter the amount you wish to add to your TechMedix wallet.
            </Text>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                padding: spacing.sm,
                fontSize: 18,
                fontWeight: "700",
                color: colors.onSurface,
                backgroundColor: colors.surfaceLow,
                textAlign: "center",
                marginBottom: 16,
              }}
              placeholder="Enter Amount (₹)"
              placeholderTextColor={colors.outline}
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
            />

            {/* Quick Presets */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 8 }}>
              {["500", "1000", "2000", "5000"].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setTopUpAmount(preset)}
                  style={{
                    flex: 1,
                    backgroundColor: topUpAmount === preset ? colors.primary : colors.surfaceLowest,
                    borderColor: colors.outline + "40",
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: topUpAmount === preset ? colors.onPrimary : colors.primary
                  }}>
                    ₹{preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <SecondaryButton
                label="Cancel"
                onPress={() => setTopUpModalVisible(false)}
                style={{ flex: 1 }}
              />
              <GradientButton
                label={addingMoney ? "Paying..." : "Pay"}
                icon="cash-multiple"
                disabled={addingMoney}
                onPress={triggerAddMoney}
                style={{ flex: 1 }}
              />
            </View>
          </SurfaceCard>
        </View>
      </Modal>

      <PatientMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
      />
    </>
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
    Alert.alert(
      "Choose X-Ray Source",
      "Select where you want to choose your X-ray image from:",
      [
        {
          text: "Choose from Album",
          onPress: async () => {
            try {
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
            } catch (err) {
              setError(err.message || "Failed to pick image from library.");
            }
          },
        },
        {
          text: "Choose from Files",
          onPress: async () => {
            try {
              const asset = await pickSingleDocument({
                type: ["image/*"],
              });
              if (asset) {
                setSelectedImage(asset);
                setResult(null);
              }
            } catch (err) {
              setError(err.message || "Failed to pick document.");
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
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

  const soundRef = useRef(null);
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
          soundRef.current.unloadAsync().catch(() => {});
        }
      };
    }, [user?.id])
  );

  async function playRecording(url, id) {
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (_) {}
      }

      const newSound = new Audio.Sound();
      soundRef.current = newSound;

      await newSound.loadAsync({ uri: url });
      setPlayingId(id);
      await newSound.playAsync();

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.isPlaying) {
          setPlayingId(null);
        }
      });
    } catch (e) {
      setError("Audio play failed: " + e.message);
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
            Show this QR code to your doctor to instantly share your health
            profile and medical records during your visit.
          </Text>
        </SurfaceCard>
      ) : null}
    </ScreenScroll>
  );
}

export function PatientProfileScreen({ navigation }) {
  const { user, signOut, updateSessionUser } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingMessage, setSavingMessage] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [qrShareEhr, setQrShareEhr] = useState(true);
  const [qrSharePrescriptions, setQrSharePrescriptions] = useState(true);
  const [qrShareRecordings, setQrShareRecordings] = useState(true);
  const [qrShareReports, setQrShareReports] = useState(true);
  const [qrShareMetrics, setQrShareMetrics] = useState(true);

  // Modals & States
  const [darkMode, setDarkMode] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);

  const [modalReminders, setModalReminders] = useState({});
  const [prescriptions, setPrescriptions] = useState([]);
  const [timePickerState, setTimePickerState] = useState({
    visible: false,
    reminderId: "",
    medicineName: "",
  });
  const [tempReminderDate, setTempReminderDate] = useState(null);

  const [wishlist, setWishlist] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resettingQr, setResettingQr] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadWishlist = async () => {
    try {
      const raw = await AsyncStorage.getItem("techmedix.mobile.wishlist");
      setWishlist(raw ? JSON.parse(raw) : []);
    } catch {}
  };

  useEffect(() => {
    if (showWishlistModal) {
      loadWishlist();
    }
  }, [showWishlistModal]);

  const handleRemoveWishlistItem = async (item) => {
    try {
      const updated = wishlist.filter((x) => x.id !== item.id && x.name !== item.name);
      await AsyncStorage.setItem("techmedix.mobile.wishlist", JSON.stringify(updated));
      setWishlist(updated);
    } catch {}
  };

  async function ensureReminderPermissions() {
    if (Platform.OS === "web") {
      Alert.alert("Not Supported", "Reminders only work on mobile devices");
      return false;
    }

    try {
      await Notifications.setNotificationChannelAsync("medicine-reminders", {
        name: "Medicine Reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (_error) {}

    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;

      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlert: true,
        },
      });
      if (requested.granted) return true;
    } catch (err) {
      console.warn("Notifications request permissions failed", err);
    }

    Alert.alert(
      "Permission Needed",
      "Notifications permission was not granted. Alarms will not trigger externally, but the schedule has been saved in-app.",
      [{ text: "OK" }]
    );
    return true;
  }

  function buildReminderId(medicineId) {
    return `medicine-${medicineId}`;
  }

  const loadReminders = async () => {
    try {
      const items = await getNativeReminders();
      const nextState = {};
      if (Array.isArray(items)) {
        items.forEach((x) => {
          if (x?.id) {
            const localId = String(x.id).replace(/^medicine-/, "");
            nextState[localId] = {
              enabled: x.enabled !== false,
              hour: x.hour ?? 9,
              minute: x.minute ?? 0,
            };
          }
        });
      }
      setModalReminders(nextState);

      const rx = await api.prescriptions.listByPatient(user.id);
      setPrescriptions(normalizeArray(rx));
    } catch {}
  };

  useEffect(() => {
    if (showRemindersModal) {
      loadReminders();
    }
  }, [showRemindersModal]);

  async function saveReminderSchedule(medicineId, medicineName, hour, minute) {
    const hasPermission = await ensureReminderPermissions();
    if (!hasPermission) return false;

    try {
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
    } catch (schedError) {
      console.warn("Failed to schedule notification/reminder natively", schedError);
    }

    setModalReminders((prev) => ({
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
    const current = modalReminders[medicineId];

    if (current?.enabled) {
      if (Platform.OS === "android") {
        await removeNativeReminder(buildReminderId(medicineId));
      }

      setModalReminders((prev) => {
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
    const current = modalReminders[medicineId];
    const initialDate = new Date();
    initialDate.setHours(current?.hour ?? 9, current?.minute ?? 0, 0, 0);
    setTempReminderDate(initialDate);
    setTimePickerState({
      visible: true,
      reminderId: String(medicineId),
      medicineName,
    });
  }

  async function handleSaveTime(selectedDate) {
    const { reminderId, medicineName } = timePickerState;
    if (!reminderId || !selectedDate) return;
    await saveReminderSchedule(
      reminderId,
      medicineName,
      selectedDate.getHours(),
      selectedDate.getMinutes(),
    );
    setTimePickerState({
      visible: false,
      reminderId: "",
      medicineName: "",
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

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const response = await api.patients.getProfile(user.id);
          if (!active) return;
          const nextProfile = response?.data || response || {};
          setProfile(nextProfile);

          setName(nextProfile.name || "");
          setEmail(nextProfile.email || "");
          setPhone(nextProfile.phone || "");
          setAge(nextProfile.age ? String(nextProfile.age) : "");
          setGender(nextProfile.gender || "");
          setBloodGroup(nextProfile.bloodGroup || "");
          setMedicalHistory(nextProfile.medicalHistory || "");
          setQrShareEhr(nextProfile.qrShareEhr ?? true);
          setQrSharePrescriptions(nextProfile.qrSharePrescriptions ?? true);
          setQrShareRecordings(nextProfile.qrShareRecordings ?? true);
          setQrShareReports(nextProfile.qrShareReports ?? true);
          setQrShareMetrics(nextProfile.qrShareMetrics ?? true);
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

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    setSavingMessage("");
    try {
      const payload = {
        name,
        email,
        phone,
        age: age === "" ? null : Number(age),
        gender,
        bloodGroup,
        medicalHistory,
        qrShareEhr,
        qrSharePrescriptions,
        qrShareRecordings,
        qrShareReports,
        qrShareMetrics,
      };
      const response = await api.patients.updateProfile(payload);
      const updatedProfile = response?.data || response;
      setProfile(updatedProfile);
      await updateSessionUser(updatedProfile);
      setSavingMessage("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetQr = async () => {
    setResettingQr(true);
    setError("");
    setSavingMessage("");
    try {
      const response = await api.patients.resetQrCode();
      const updatedProfile = response?.data || response;
      setProfile(updatedProfile);
      await updateSessionUser(updatedProfile);
      setSavingMessage("Patient QR code has been reset.");
    } catch (resetError) {
      setError(resetError.message || "Failed to reset QR code.");
    } finally {
      setResettingQr(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError("");
            try {
              await api.patients.deleteProfile();
              await signOut();
            } catch (deleteError) {
              setError(deleteError.message || "Failed to delete account.");
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <ScreenScroll contentContainerStyle={styles.screenContent}>
        <TopBar
          title="Profile"
          avatar={getInitials(profile.name)}
          onMenuPress={() => setDrawerVisible(true)}
        />
        <InlineError message={error} />
        {savingMessage ? (
          <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600", marginHorizontal: spacing.md }}>
            {savingMessage}
          </Text>
        ) : null}
        {loading ? <LoadingCard label="Loading profile..." /> : null}

        {/* Quick Options Grid */}
        <SurfaceCard tone="low">
          <Text style={styles.blockTitle}>Quick Portal Options</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 8 }}>
            {[

              { label: "Search Medicine", icon: "magnify", onPress: () => navigation.navigate("MedicineSearch") },
              { label: "Reminders", icon: "alarm", onPress: () => setShowRemindersModal(true) },
              { label: "Health Tips", icon: "lightbulb-outline", onPress: () => setShowTipsModal(true) },
              { label: "Wishlist", icon: "heart-outline", onPress: () => setShowWishlistModal(true) },
              { label: "Logout", icon: "logout", onPress: signOut },
            ].map((item, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={item.onPress}
                style={{
                  width: idx < 3 ? "31.3%" : "48.5%",
                  aspectRatio: idx < 3 ? 1.1 : 1.6,
                  backgroundColor: colors.surfaceLowest,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: colors.outline,
                  marginBottom: 8,
                }}
              >
                <MaterialCommunityIcons name={item.icon} size={22} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.onSurface, textAlign: "center" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SurfaceCard>

        

        {/* Edit Profile Form */}
        <SurfaceCard>
          <Text style={styles.blockTitle}>Manage Your Account</Text>
          <Text style={styles.sectionMuted}>
            Edit your patient details, delete your account, or reset your QR code.
          </Text>

          <View style={{ marginTop: 12, gap: 4 }}>
            <LocalField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
            <LocalField label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />
            <LocalField label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LocalField label="Age" value={age} onChangeText={setAge} placeholder="Age" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalField label="Gender" value={gender} onChangeText={setGender} placeholder="Gender" />
              </View>
            </View>

            <LocalField label="Blood Group" value={bloodGroup} onChangeText={setBloodGroup} placeholder="e.g. O+" />
            <LocalField label="Medical History" value={medicalHistory} onChangeText={setMedicalHistory} placeholder="Allergies, chronic conditions..." multiline />
            <LocalField label="Current QR Code" value={profile.uniqueCode || ""} editable={false} />
<SecondaryButton
                label={resettingQr ? "Resetting..." : "Reset QR Code"}
                icon="qrcode-scan"
                onPress={handleResetQr}
                disabled={resettingQr}
              />
            {/* Sharing Preferences */}
            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
                QR / Manual Code Access Sharing Preferences
              </Text>
              <Text style={[styles.sectionMuted, { marginBottom: 10 }]}>
                Choose what health information is shared when a medical provider scans your QR code or enters your manual access code.
              </Text>

              <LocalCheckboxRow label="EHR History" checked={qrShareEhr} onChange={setQrShareEhr} />
              <LocalCheckboxRow label="Prescriptions" checked={qrSharePrescriptions} onChange={setQrSharePrescriptions} />
              <LocalCheckboxRow label="Recordings" checked={qrShareRecordings} onChange={setQrShareRecordings} />
              <LocalCheckboxRow label="Reports & Files" checked={qrShareReports} onChange={setQrShareReports} />
              <LocalCheckboxRow label="Health Metrics" checked={qrShareMetrics} onChange={setQrShareMetrics} />
            </View>

            {/* Actions */}
            <View style={{ gap: 10, marginTop: 16 }}>
              <GradientButton
                label={saving ? "Saving..." : "Save Profile"}
                onPress={handleSaveProfile}
                disabled={saving}
              />
              
              <SecondaryButton
                label={deleting ? "Deleting..." : "Delete Account"}
                icon="delete-outline"
                onPress={handleDeleteAccount}
                disabled={deleting}
                style={{ borderColor: colors.error }}
              />
            </View>
          </View>
        </SurfaceCard>

        {/* Support Help Card */}
        <SurfaceCard style={{ gap: 10, borderColor: colors.primaryContainer, borderWidth: 1 }}>
          <Text style={[styles.blockTitle, { color: colors.primary }]}>Need billing help?</Text>
          <Text style={styles.sectionMuted}>
            Our care support team can help with refunds, invoice clarifications, and wallet issues.
          </Text>
          <SecondaryButton
            label="Contact Support"
            icon="email-outline"
            onPress={() => Linking.openURL("mailto:techmedixcare@gmail.com")}
          />
        </SurfaceCard>
      </ScreenScroll>

      {/* Modals */}
      <Modal transparent visible={showTipsModal} onRequestClose={() => setShowTipsModal(false)} animationType="fade">
        <View style={modalStyles.backdrop}>
          <SurfaceCard style={modalStyles.card}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Clinical Health Tips</Text>
              <TouchableOpacity onPress={() => setShowTipsModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.scroll}>
              {[
                { title: "Stay Hydrated", desc: "Drink at least 8-10 glasses of water daily to maintain proper body hydration and kidney function." },
                { title: "Prioritize Sleep", desc: "Aim for 7-9 hours of quality sleep each night to help your body repair and boost immunity." },
                { title: "Daily Movement", desc: "Get at least 30 minutes of moderate exercise, such as brisk walking, to improve cardiovascular health." },
                { title: "Balanced Nutrition", desc: "Incorporate fresh vegetables, fruits, whole grains, and lean proteins into your meals." },
                { title: "Manage Stress", desc: "Practice deep breathing, meditation, or take short outdoor breaks to keep stress levels low." },
              ].map((tip, idx) => (
                <View key={idx} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary, marginBottom: 2 }}>
                    {idx + 1}. {tip.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 }}>
                    {tip.desc}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>

      <Modal transparent visible={showRemindersModal} onRequestClose={() => setShowRemindersModal(false)} animationType="fade">
        <View style={modalStyles.backdrop}>
          <SurfaceCard style={modalStyles.card}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Medicine Reminders</Text>
              <TouchableOpacity onPress={() => setShowRemindersModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.scroll}>
              {prescriptions.length > 0 ? (
                prescriptions.map((item, idx) => {
                  const active = modalReminders[item.medicine_id || item.id];
                  return (
                    <View
                      key={`${item.medicine_id || item.id}-${idx}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surfaceLow,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface }}>
                          {item.medicine_name}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 }}>
                          {active
                            ? `Scheduled daily at ${formatReminderTime(
                                active.hour,
                                active.minute,
                              )}`
                            : "No reminder schedule"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {active ? (
                          <TouchableOpacity
                            onPress={() =>
                              openReminderTimePicker(
                                item.medicine_id || item.id,
                                item.medicine_name,
                              )
                            }
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: colors.outline,
                              backgroundColor: colors.surfaceLowest,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.outline }}>
                              Set Time
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          onPress={() =>
                            toggleReminder(
                              item.medicine_id || item.id,
                              item.medicine_name,
                            )
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: active ? colors.surfaceLow : colors.primary,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: active ? colors.onSurface : "#ffffff",
                            }}
                          >
                            {active ? "Off" : "On"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: colors.outline, fontSize: 13, textAlign: "center", marginVertical: 20 }}>
                  No active medicines loaded.
                </Text>
              )}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>

      {timePickerState.visible ? (
        Platform.OS === "ios" ? (
          <Modal transparent visible={timePickerState.visible} animationType="fade">
            <View style={styles.timePickerModalBackdrop}>
              <SurfaceCard style={styles.timePickerCard}>
                <Text style={styles.timePickerTitle}>Set Reminder Time</Text>
                <DateTimePicker
                  value={tempReminderDate || new Date()}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTempReminderDate(selectedDate);
                    }
                  }}
                />
                <View style={styles.timePickerActionRow}>
                  <TouchableOpacity
                    style={styles.timePickerCancelBtn}
                    onPress={() => {
                      setTimePickerState((prev) => ({ ...prev, visible: false }));
                    }}
                  >
                    <Text style={styles.timePickerCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.timePickerDoneBtn}
                    onPress={async () => {
                      if (tempReminderDate) {
                        await handleSaveTime(tempReminderDate);
                      } else {
                        setTimePickerState((prev) => ({ ...prev, visible: false }));
                      }
                    }}
                  >
                    <Text style={styles.timePickerDoneBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={
              new Date(
                0,
                0,
                0,
                modalReminders[timePickerState.reminderId]?.hour ?? 9,
                modalReminders[timePickerState.reminderId]?.minute ?? 0,
              )
            }
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleReminderTimeChange}
          />
        )
      ) : null}

      <Modal transparent visible={showWishlistModal} onRequestClose={() => setShowWishlistModal(false)} animationType="fade">
        <View style={modalStyles.backdrop}>
          <SurfaceCard style={modalStyles.card}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Saved Medicine Wishlist</Text>
              <TouchableOpacity onPress={() => setShowWishlistModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.scroll}>
              {wishlist.length > 0 ? (
                wishlist.map((item, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surfaceLow,
                    }}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setShowWishlistModal(false);
                        navigation.navigate("MedicineDetail", { medicine: item });
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface }}>
                        {item.name}
                      </Text>
                      {item.price ? (
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
                          ₹{item.price}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveWishlistItem(item)}>
                      <MaterialCommunityIcons name="heart" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.outline, fontSize: 13, textAlign: "center", marginVertical: 20 }}>
                  Your wishlist is empty. Tap the heart on medicine details to save items.
                </Text>
              )}
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>

      <PatientMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
      />
    </>
  );
}

export function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" or "unread"

  async function loadNotifications() {
    if (!user?.id) return;
    setLoading(true);

    try {
      const response = await api.notifications.list(user.id);
      setNotifications(normalizeArray(response));
      setError("");
    } catch (err) {
      setNotifications([]);
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
    if (!user?.id) return;
    try {
      await api.notifications.markAllRead(user.id);
    } catch (e) {
      console.warn("Backend markAllRead failed:", e.message);
    }
    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    setNotifications(updated);
  }

  async function markOne(id) {
    try {
      await api.notifications.markRead(id);
    } catch (e) {
      console.warn("Backend markRead failed:", e.message);
    }
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    );
    setNotifications(updated);
  }

  function getNotificationIcon(title) {
    const t = (title || "").toLowerCase();
    if (t.includes("appointment") || t.includes("book") || t.includes("consult")) {
      return { name: "calendar-clock", color: colors.primary, bg: colors.primary + "15" };
    }
    if (t.includes("payment") || t.includes("wallet") || t.includes("rupee") || t.includes("cash")) {
      return { name: "cash-multiple", color: colors.success, bg: colors.success + "15" };
    }
    if (t.includes("prescription") || t.includes("medicine")) {
      return { name: "pill", color: colors.info || "#0EA5E9", bg: (colors.info || "#0EA5E9") + "15" };
    }
    if (t.includes("risk") || t.includes("alert") || t.includes("critical") || t.includes("vital")) {
      return { name: "alert-decagram", color: colors.error, bg: colors.error + "15" };
    }
    return { name: "bell-outline", color: colors.outline, bg: colors.outline + "15" };
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    return true;
  });

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Notifications"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />

      {/* Segmented Filters & Mark All Action */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setFilter("all")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: filter === "all" ? colors.primary : colors.surfaceLow,
              borderWidth: 1,
              borderColor: filter === "all" ? colors.primary : colors.outline + "20",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: filter === "all" ? colors.onPrimary : colors.outline }}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilter("unread")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: filter === "unread" ? colors.primary : colors.surfaceLow,
              borderWidth: 1,
              borderColor: filter === "unread" ? colors.primary : colors.outline + "20",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: filter === "unread" ? colors.onPrimary : colors.outline }}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={{ backgroundColor: filter === "unread" ? colors.onPrimary : colors.primary, borderRadius: 10, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: filter === "unread" ? colors.primary : colors.onPrimary }}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAll}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? <LoadingCard label="Loading notifications..." /> : null}

      {filteredNotifications.length ? (
        filteredNotifications.map((item) => {
          const badge = getNotificationIcon(item.title);
          return (
            <SurfaceCard
              key={item.id}
              tone={item.is_read ? "lowest" : "low"}
              style={{
                paddingLeft: 12,
                borderLeftWidth: item.is_read ? 0 : 4,
                borderLeftColor: colors.primary,
                position: "relative",
              }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Icon bubble */}
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: badge.bg, justifyContent: "center", alignItems: "center" }}>
                  <MaterialCommunityIcons name={badge.name} size={20} color={badge.color} />
                </View>

                {/* Content block */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                    <Text style={[styles.listTitle, { fontWeight: item.is_read ? "600" : "800", flex: 1, paddingRight: 8 }]}>
                      {item.title || "Notification"}
                    </Text>
                    {!item.is_read && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 }} />
                    )}
                  </View>

                  <Text style={[styles.smallText, { color: item.is_read ? colors.outline : colors.onSurface, lineHeight: 18, marginBottom: 8 }]}>
                    {item.message}
                  </Text>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 11, color: colors.outline }}>
                      {formatDateTime(item.created_at)}
                    </Text>

                    {!item.is_read && (
                      <TouchableOpacity
                        onPress={() => markOne(item.id)}
                        style={{
                          backgroundColor: colors.surfaceLowest,
                          borderWidth: 1,
                          borderColor: colors.outline + "30",
                          borderRadius: 6,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>
                          Mark Read
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </SurfaceCard>
          );
        })
      ) : !loading ? (
        <EmptyStateCard
          title={filter === "unread" ? "No unread notifications" : "All caught up!"}
          body={filter === "unread" ? "You don't have any unread notifications." : "Your inbox is empty."}
        />
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
            {appointment.payment_status !== "paid" ? (
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
            ) : (
              <Pill label="Paid ✓" tone="success" style={{ flex: 1, justifyContent: "center" }} />
            )}
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

  const [manualType, setManualType] = useState("steps");
  const [manualValue, setManualValue] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  async function handleAddManualMetric() {
    if (!manualValue || isNaN(Number(manualValue))) {
      Alert.alert("Invalid Input", "Please enter a valid numeric value.");
      return;
    }
    setManualSaving(true);
    setManualMessage("");
    setError("");
    try {
      let unit = "count";
      if (manualType === "heart_rate") unit = "bpm";
      else if (manualType === "sleep_duration") unit = "hours";
      else if (manualType === "calories_burned") unit = "kcal";

      const payload = {
        metrics: [
          {
            metric_type: manualType,
            value: Number(manualValue),
            unit: unit,
            recorded_at: new Date().toISOString(),
            source: "manual",
            metadata: { entry: "Manual Mobile Entry" },
          },
        ],
      };

      await api.health.sync(payload);
      setManualValue("");
      setManualMessage("Metric added successfully!");
      await loadMetrics();
    } catch (err) {
      setError(err.message || "Failed to add manual metric.");
    } finally {
      setManualSaving(false);
    }
  }

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

      <SurfaceCard>
        <Text style={styles.blockTitle}>Add Metric Manually</Text>
        {manualMessage ? (
          <Text style={{ color: colors.success, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>
            {manualMessage}
          </Text>
        ) : null}
        <Text style={styles.sectionMuted}>Select Metric Type:</Text>
        <View style={{ flexDirection: "row", gap: 6, marginVertical: 8, flexWrap: "wrap" }}>
          {[
            { key: "steps", label: "Steps" },
            { key: "heart_rate", label: "Heart Rate" },
            { key: "sleep_duration", label: "Sleep" },
            { key: "calories_burned", label: "Calories" },
          ].map((type) => {
            const active = manualType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                activeOpacity={0.8}
                onPress={() => {
                  setManualType(type.key);
                  setManualMessage("");
                }}
                style={{
                  backgroundColor: active ? colors.primary : colors.surfaceLow,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.outline,
                }}
              >
                <Text style={{ color: active ? colors.onPrimary : colors.onSurface, fontWeight: "600", fontSize: 12 }}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={styles.fieldLabel}>Value</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              value={manualValue}
              onChangeText={(text) => {
                setManualValue(text);
                setManualMessage("");
              }}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.outline}
              keyboardType="numeric"
              style={{
                flex: 1,
                backgroundColor: colors.surfaceLowest,
                borderWidth: 1,
                borderColor: colors.outline,
                borderRadius: radii.md,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.onSurface,
                fontSize: 14,
              }}
            />
            <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, width: 60, fontWeight: "600" }}>
              {manualType === "steps"
                ? "steps"
                : manualType === "heart_rate"
                ? "bpm"
                : manualType === "sleep_duration"
                ? "hours"
                : "kcal"}
            </Text>
          </View>
        </View>

        <SecondaryButton
          label={manualSaving ? "Adding..." : "Add Metric"}
          icon="plus"
          onPress={handleAddManualMetric}
          disabled={manualSaving}
          style={{ marginTop: 12 }}
        />
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
      const sessionId = response?.payment_session_id;
      if (!sessionId) {
        throw new Error("Failed to obtain payment session from server.");
      }
      const isProd = response.cashfree_mode === "production";
      const checkoutUrl = isProd
        ? `https://payments.cashfree.com/order/#${sessionId}`
        : `https://payments-test.cashfree.com/order/#${sessionId}`;

      console.log("Opening Cashfree checkout URL:", checkoutUrl);
      await Linking.openURL(checkoutUrl);

      Alert.alert(
        "Payment Process Launched",
        "Once payment is completed, go back and refresh to view your booked status.",
        [
          {
            text: "Done",
            onPress: () => navigation.navigate("PatientApp", { screen: "Home" }),
          },
        ]
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
              value={formatSlotTime12Hour(appointment.slot_time) || "N/A"}
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
                label="Pay Online (Cashfree)"
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

export function PatientAddMedicineScreen({ navigation }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "",
    duration: "",
  });

  async function saveManualMedicine() {
    if (!form.medicine_name.trim()) {
      setError("Please enter a medicine name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        patient_id: user.id,
        medicine_name: form.medicine_name.trim(),
        dosage: form.dosage.trim(),
        frequency: form.frequency.trim(),
        duration: form.duration.trim(),
      };
      await api.prescriptions.createManual(payload);
      Alert.alert("Success", "Medicine added to your prescription pad.");
      navigation.goBack();
    } catch (saveError) {
      setError(saveError.message || "Failed to save medicine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.screenContent}>
      <TopBar
        title="Add Medicine"
        showBack
        onBack={() => navigation.goBack()}
      />
      <InlineError message={error} />
      <SurfaceCard>
        <Text style={styles.blockTitle}>Prescription Details</Text>
        <Text style={[styles.sectionMuted, { marginBottom: 12 }]}>
          Manually add a medicine to your prescription list.
        </Text>

        <TextInput
          value={form.medicine_name}
          onChangeText={(text) => setForm({ ...form, medicine_name: text })}
          placeholder="Medicine name (e.g. Adoloc 20mg)"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.dosage}
          onChangeText={(text) => setForm({ ...form, dosage: text })}
          placeholder="Dosage (e.g. 1 capsule / 5mg)"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.frequency}
          onChangeText={(text) => setForm({ ...form, frequency: text })}
          placeholder="Frequency (e.g. Once daily / 1-0-1)"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />
        <TextInput
          value={form.duration}
          onChangeText={(text) => setForm({ ...form, duration: text })}
          placeholder="Duration (e.g. 5 days / 1 month)"
          placeholderTextColor={colors.outline}
          style={styles.input}
        />

        <GradientButton
          label={saving ? "Saving..." : "Add to Prescription"}
          icon="plus"
          onPress={saveManualMedicine}
          disabled={saving}
        />
      </SurfaceCard>
    </ScreenScroll>
  );
}

export function MedicineSearchScreen({ navigation, route }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [priceInsight, setPriceInsight] = useState(null);
  const [safetyInsight, setSafetyInsight] = useState(null);

  const routeQuery = route?.params?.query || "";

  async function performSearch(searchTerm) {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const [searchRes, safetyRes] = await Promise.allSettled([
        api.medicines.list({ search: searchTerm.trim(), limit: 12, page: 1 }),
        api.prescriptions.safetyCheckLatest(searchTerm.trim(), user?.id),
      ]);

      let medicines =
        searchRes.status === "fulfilled" ? normalizeArray(searchRes.value) : [];

      if (!medicines.length) {
        const aiLookup = await api.medicines.lookupWithAi(searchTerm.trim()).catch(() => null);
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

  async function search() {
    await performSearch(query);
  }

  useEffect(() => {
    if (routeQuery) {
      setQuery(routeQuery);
      performSearch(routeQuery);
    }
  }, [routeQuery]);

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
                  Price: {item.price ? `₹${item.price}` : item.mrp ? `₹${item.mrp}` : "Price not available"}
                </Text>
                { (item.medicine_desc || item.benefits || item.info || item.usage) ? (
                  <Text style={[styles.smallText, { marginTop: 2 }]}>
                    {item.medicine_desc || item.benefits || item.info || item.usage}
                  </Text>
                ) : null }
              </SurfaceCard>
            </TouchableOpacity>
          ))
        : null}

      {/* {safetyInsight ? (
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
      ) : null} */}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  timePickerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 20, 43, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  timePickerCard: {
    width: "85%",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  timePickerTitle: {
    fontSize: typography.title || 18,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  timePickerActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  timePickerCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  timePickerCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.outline,
  },
  timePickerDoneBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  timePickerDoneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  screenContent: {
    gap: spacing.lg,
  },
  tabHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLowest || "#ffffff",
    borderRadius: radii.pill || 24,
    padding: 4,
    marginVertical: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.pill || 24,
  },
  tabButtonActive: {
    backgroundColor: colors.primary || "#1976d2",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.outline || "#999999",
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  posterContainer: {
    marginVertical: 4,
  },
  posterHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.outline || "#999999",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  posterScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  posterCard: {
    width: 310,
    height: 155,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.surfaceLowest || "#ffffff",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterInfoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  posterDocName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  posterDocSpecialty: {
    color: "#cccccc",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  switchRowSub: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingLeft: 16,
  },
  switchLabelSub: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall - 1,
    flex: 1,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flexDirection: "row",
  },
  drawerOverlayDismiss: {
    flex: 1,
  },
  drawerContent: {
    width: 280,
    height: "100%",
    backgroundColor: colors.surfaceLowest || "#ffffff",
    borderTopRightRadius: radii.lg || 16,
    borderBottomRightRadius: radii.lg || 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  drawerScroll: {
    paddingBottom: 40,
  },
  drawerHeader: {
    paddingHorizontal: spacing.md || 16,
    paddingBottom: spacing.md || 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh || "#f0f0f0",
    marginBottom: spacing.md || 16,
    alignItems: "center",
  },
  drawerLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  drawerBrand: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  drawerSubBrand: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.outline || "#999999",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  drawerSection: {
    paddingHorizontal: spacing.md || 16,
    gap: 4,
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.outline || "#999999",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 8,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md || 8,
    gap: 12,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface || "#333333",
  },
  drawerDivider: {
    height: 1,
    backgroundColor: colors.surfaceHigh || "#f0f0f0",
    marginVertical: 16,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: colors.outlineVariant || "#e0e0e0",
    borderRadius: radii.md || 8,
    overflow: "hidden",
    // marginTop: 8,
    backgroundColor: colors.surfaceLowest || "#ffffff",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceHigh || "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant || "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.outline || "#999999",
    letterSpacing: 0.8,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant || "#e0e0e0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  tableCell: {
    fontSize: 12,
    color: colors.onSurface || "#333333",
  },
  tableActionCell: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionIconButton: {
    padding: 6,
    borderRadius: radii.sm || 4,
    backgroundColor: colors.surfaceHigh || "#f0f0f0",
  },
  clinicianCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radii.md || 8,
    backgroundColor: colors.surfaceLowest || "#ffffff",
    borderWidth: 1,
    borderColor: colors.surfaceHigh || "#f0f0f0",
    gap: 12,
  },
  clinicianAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer || "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicianInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary || "#1976d2",
  },
  clinicianName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface || "#333333",
  },
  clinicianSpecialty: {
    fontSize: 12,
    color: colors.primary || "#1976d2",
    fontWeight: "600",
    marginTop: 2,
  },
  clinicianMeta: {
    fontSize: 10,
    color: colors.outline || "#999999",
    marginTop: 4,
  },
  padNavHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#ffffff",
  },
  padBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  padBackText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  padNavTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  padContentContainer: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  rxSheet: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 500,
  },
  rxHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rxDocName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  rxDocSpecialty: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.outline,
    marginTop: 2,
  },
  rxDocReg: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 4,
  },
  rxHospitalName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  rxHospitalSub: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.outline,
    letterSpacing: 1,
    marginTop: 2,
  },
  rxHospitalContact: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 2,
  },
  rxLine: {
    height: 2,
    backgroundColor: colors.primary || "#1976d2",
    marginVertical: 14,
  },
  rxPatientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rxPatientText: {
    fontSize: 12,
    color: colors.onSurface,
  },
  rxSymbol: {
    fontSize: 28,
    fontStyle: "italic",
    fontWeight: "800",
    color: colors.primary,
    marginTop: 10,
    marginBottom: 10,
  },
  padTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 20,
  },
  padTableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  padTableHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.outline,
  },
  padTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  padTableCell: {
    fontSize: 11,
    color: colors.onSurface,
  },
  rxFooter: {
    marginTop: 30,
  },
  rxFooterLine: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginBottom: 10,
  },
  rxFooterText: {
    fontSize: 9,
    color: colors.outline,
    textAlign: "center",
    lineHeight: 14,
  },
  safetyVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  safetyVerifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4caf50",
  },
  qrVerificationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 6,
  },
  qrVerificationImage: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 4,
  },
  qrVerificationText: {
    fontSize: 10,
    color: colors.outline,
    fontWeight: "600",
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
    gap: 2,
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
  categoryContainer: {
    marginVertical: spacing.sm,
  },
  categoryScroll: {
    gap: spacing.md,
    paddingHorizontal: 4,
  },
  categoryBtn: {
    alignItems: "center",
    width: 72,
  },
  categoryIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outline,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 16px rgba(17,20,43,0.06)" }
      : {
          shadowColor: "rgba(17,20,43,0.06)",
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }),
  },
  categoryLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  premiumWalletCard: {
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primaryFixed,
  },
  walletHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  walletIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outline,
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
  },
  walletSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  walletDivider: {
    height: 1,
    backgroundColor: colors.outline,
    marginVertical: spacing.md,
  },
  walletAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  walletAmountValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 2,
  },
  walletActionBtn: {
    minWidth: 130,
  },
  appointmentCard: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
  appointmentHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  appointmentBody: {
    gap: spacing.md,
    marginTop: 4,
  },
  appointmentDocInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  appointmentAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outline,
  },
  appointmentAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  appointmentDocName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  appointmentSpecialty: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  appointmentTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  appointmentTimeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  appointmentFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  paymentBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  appointmentActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  appointmentQueueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  appointmentQueueText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  appointmentPayBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  appointmentPayText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.onPrimary,
  },
});

function LocalField({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false, editable = true }) {
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
      <Text style={{
        color: colors.onSurfaceVariant,
        fontSize: typography.label,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        autoCapitalize="none"
        style={{
          backgroundColor: editable ? colors.surfaceLowest : colors.surfaceLow,
          borderWidth: 1,
          borderColor: colors.outline,
          borderRadius: radii.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: editable ? colors.onSurface : colors.outline,
          fontSize: 14,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function LocalCheckboxRow({ label, checked, onChange }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onChange(!checked)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
      }}
    >
      <MaterialCommunityIcons
        name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
        size={22}
        color={colors.primary}
      />
      <Text style={{ fontSize: 14, color: colors.onSurface }}>{label}</Text>
    </TouchableOpacity>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 20, 43, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.primary,
  },
  scroll: {
    maxHeight: 400,
  }
});
