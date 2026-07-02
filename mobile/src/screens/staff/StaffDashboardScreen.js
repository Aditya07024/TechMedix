import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function StaffDashboardScreen() {
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [stats, setStats] = useState({ appointments_today: 0, arrived_today: 0, queue_active: 0 });
  const [doctors, setDoctors] = useState([]);
  const [activeDoctor, setActiveDoctor] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [liveQueue, setLiveQueue] = useState([]);
  
  // Dashboard view toggle: 'appointments' or 'queue'
  const [activeTab, setActiveTab] = useState("appointments");

  const loadDoctors = async () => {
    try {
      const response = await api.staff.getDoctors();
      const docs = response?.data || response || [];
      setDoctors(docs);
      
      // Pre-select active doctor based on backend active_doctor_id
      if (user?.active_doctor_id) {
        const activeDoc = docs.find((d) => d.id === user.active_doctor_id);
        if (activeDoc) setActiveDoctor(activeDoc);
      } else if (docs.length > 0) {
        setActiveDoctor(docs[0]);
      }
    } catch (err) {
      console.warn("Failed to load doctors:", err.message);
    }
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Load stats
      const statsRes = await api.staff.getOverview().catch(() => null);
      if (statsRes?.data) setStats(statsRes.data);

      // Load today's appointments
      const apptsRes = await api.staff.getTodayAppointments().catch(() => null);
      if (apptsRes?.data) setAppointments(apptsRes.data);

      // Load active queue
      const queueRes = await api.staff.getLiveQueue().catch(() => null);
      if (queueRes?.data) setLiveQueue(queueRes.data);
    } catch (err) {
      Alert.alert("Data Sync Failed", "Unable to pull live status. Please swipe down to refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDoctors(), loadDashboardData()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadDoctors().then(() => {
      loadDashboardData();
    });
  }, [loadDashboardData]);

  // Actions
  const handleSwitchDoctor = async (doc) => {
    try {
      setLoading(true);
      await api.staff.switchDoctor(doc.id);
      setActiveDoctor(doc);
      // Reload overview & live queue under new doctor context
      await loadDashboardData();
      Alert.alert("Doctor Changed", `Active clinical context switched to Dr. ${doc.name}.`);
    } catch (err) {
      Alert.alert("Switch Failed", err.message || "Failed to switch active doctor.");
      setLoading(false);
    }
  };

  const handleMarkArrived = async (appointmentId) => {
    try {
      await api.staff.markArrived(appointmentId);
      Alert.alert("Success", "Appointment marked as arrived.");
      loadDashboardData();
    } catch (err) {
      Alert.alert("Check-in Failed", err.message || "Unable to check in patient.");
    }
  };

  const handleGenerateToken = async (appointmentId) => {
    try {
      const res = await api.staff.generateQueueToken(appointmentId);
      const tokenNo = res?.data?.token_no || res?.token_no || "-";
      Alert.alert("Token Generated", `Patient assigned Token Number: ${tokenNo}`);
      loadDashboardData();
    } catch (err) {
      Alert.alert("Token Error", err.message || "Unable to issue queue token.");
    }
  };

  const handleNotifyDoctor = async (patientId, appointmentId, patientName) => {
    try {
      if (!activeDoctor) {
        Alert.alert("Context Error", "Please select an active doctor context first.");
        return;
      }
      await api.staff.notifyDoctor({
        doctor_id: activeDoctor.id,
        patient_id: patientId,
        appointment_id: appointmentId,
        message: `Patient ${patientName} is ready and waiting in the queue.`,
      });
      Alert.alert("Doctor Pinned", `Sent ready signal to Dr. ${activeDoctor.name}.`);
    } catch (err) {
      Alert.alert("Notification Failed", err.message || "Unable to notify doctor.");
    }
  };

  const handleUpdateQueueStatus = async (queueId, status) => {
    try {
      await api.staff.updateQueueStatus(queueId, status);
      loadDashboardData();
    } catch (err) {
      Alert.alert("Status Update Failed", err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Staff Dashboard</Text>
          <Text style={styles.headerSubtitle}>{user?.name || "Clinic Coordinator"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
          <TouchableOpacity 
            style={[styles.logoutBtn, { backgroundColor: colors.surfaceLow }]} 
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {/* Doctor Context Switcher */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="doctor" size={20} color={colors.primary} />
            <Text style={styles.sectionCardTitle}>Active Doctor Context</Text>
          </View>
          <Text style={styles.sectionCardSubtitle}>
            Select which doctor queue you are managing at the reception desk.
          </Text>

          {doctors.length === 0 ? (
            <Text style={styles.emptyText}>No doctors assigned to you.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.doctorsScroll}>
              {doctors.map((doc) => {
                const isActive = activeDoctor?.id === doc.id;
                return (
                  <TouchableOpacity
                    key={doc.id}
                    onPress={() => handleSwitchDoctor(doc)}
                    style={[styles.doctorPill, isActive && styles.doctorPillActive]}
                  >
                    <Text style={[styles.doctorPillText, isActive && styles.doctorPillTextActive]}>
                      Dr. {doc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Overview Stats Cards */}
        {(() => {
          const activeAppts = (appointments || []).filter(
            (appt) => appt.status !== "cancelled" && appt.status !== "cancel"
          );
          const arrivedCount = (appointments || []).filter(
            (appt) => appt.status === "arrived"
          ).length;
          const activeQueueCount = (liveQueue || []).filter(
            (q) => q.status === "waiting" || q.status === "in_progress"
          ).length;

          return (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Today's Bookings</Text>
                  <Text style={styles.statValue}>{activeAppts.length}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Arrived</Text>
                  <Text style={[styles.statValue, { color: colors.success }]}>{arrivedCount}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Active Queue</Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{activeQueueCount}</Text>
                </View>
              </View>

              {/* Tab Controls */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === "appointments" && styles.tabButtonActive]}
                  onPress={() => setActiveTab("appointments")}
                >
                  <Text style={[styles.tabButtonText, activeTab === "appointments" && styles.tabButtonTextActive]}>
                    Appointments ({activeAppts.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === "queue" && styles.tabButtonActive]}
                  onPress={() => setActiveTab("queue")}
                >
                  <Text style={[styles.tabButtonText, activeTab === "queue" && styles.tabButtonTextActive]}>
                    Live Queue ({activeQueueCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
              ) : activeTab === "appointments" ? (
                /* APPOINTMENTS VIEW */
                <View style={styles.listWrapper}>
                  {activeAppts.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <MaterialCommunityIcons name="calendar-blank" size={32} color={colors.outline} />
                      <Text style={styles.emptyCardText}>No appointments scheduled for today.</Text>
                    </View>
                  ) : (
                    activeAppts.map((appt) => (
                      <View key={appt.id} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                    <View>
                      <Text style={styles.patientName}>{appt.patient_name || "Patient Profile"}</Text>
                      <Text style={styles.apptTime}>Slot: {appt.slot_time || appt.appointment_time || "Scheduled"}</Text>
                    </View>
                    <View style={[styles.statusTag, appt.status === "arrived" ? styles.statusTagSuccess : styles.statusTagInfo]}>
                      <Text style={[styles.statusTagText, appt.status === "arrived" ? { color: colors.success } : { color: colors.primary }]}>
                        {appt.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {appt.status !== "arrived" && appt.status !== "completed" ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => handleMarkArrived(appt.id)}
                      >
                        <Text style={styles.actionBtnText}>Arrived</Text>
                      </TouchableOpacity>
                    ) : null}

                    {appt.status === "arrived" && !appt.token_no ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnAccent]}
                        onPress={() => handleGenerateToken(appt.id)}
                      >
                        <Text style={styles.actionBtnText}>Issue Token</Text>
                      </TouchableOpacity>
                    ) : null}

                    {appt.token_no ? (
                      <View style={styles.tokenIndicator}>
                        <Text style={styles.tokenText}>Token: #{appt.token_no}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => handleNotifyDoctor(appt.patient_id, appt.id, appt.patient_name)}
                    >
                      <MaterialCommunityIcons name="bell-ring" size={16} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Ping Doc</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          /* LIVE QUEUE VIEW */
          <View style={styles.listWrapper}>
            {liveQueue.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={colors.outline} />
                <Text style={styles.emptyCardText}>No patients in the active queue.</Text>
              </View>
            ) : (
              liveQueue.map((entry, index) => (
                <View key={entry.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View>
                      <Text style={styles.patientName}>
                        {index + 1}. {entry.patient_name || "Patient"}
                      </Text>
                      <Text style={styles.apptTime}>Token: #{entry.token_number || entry.token_no}</Text>
                    </View>
                    <View style={[styles.statusTag, entry.status === "in_progress" ? styles.statusTagWarning : styles.statusTagSuccess]}>
                      <Text style={[styles.statusTagText, entry.status === "in_progress" ? { color: colors.warning } : { color: colors.success }]}>
                        {entry.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.queueActionsRow}>
                    {entry.status === "waiting" ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => handleUpdateQueueStatus(entry.id, "in_progress")}
                      >
                        <Text style={styles.actionBtnText}>Call Patient</Text>
                      </TouchableOpacity>
                    ) : null}

                    {entry.status === "in_progress" ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnSuccess]}
                        onPress={() => handleUpdateQueueStatus(entry.id, "completed")}
                      >
                        <Text style={styles.actionBtnText}>Complete</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => handleUpdateQueueStatus(entry.id, "skipped")}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => handleNotifyDoctor(entry.patient_id, entry.appointment_id, entry.patient_name)}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Ping</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </>
    );
  })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  headerTitle: {
    fontSize: typography.h2,
    fontWeight: "800",
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.outline,
    fontWeight: "600",
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.errorContainer,
  },
  scrollBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    marginBottom: spacing.md,
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.onSurface,
  },
  sectionCardSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.outline,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  doctorsScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  doctorPill: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  doctorPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  doctorPillText: {
    fontSize: typography.label + 1,
    fontWeight: "700",
    color: colors.primary,
  },
  doctorPillTextActive: {
    color: colors.onPrimary,
  },
  emptyText: {
    fontSize: typography.bodySmall,
    color: colors.outline,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surfaceLowest,
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
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
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.outline,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValue: {
    fontSize: typography.h2,
    fontWeight: "800",
    color: colors.onSurface,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.pill,
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceLowest,
  },
  tabButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.outline,
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  listWrapper: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: spacing.sm,
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
  emptyCardText: {
    fontSize: typography.bodySmall,
    color: colors.outline,
    textAlign: "center",
  },
  itemCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    padding: spacing.md,
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
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  patientName: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.onSurface,
  },
  apptTime: {
    fontSize: typography.bodySmall,
    color: colors.outline,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusTagSuccess: {
    backgroundColor: colors.successSoft,
  },
  statusTagInfo: {
    backgroundColor: colors.infoSoft,
  },
  statusTagWarning: {
    backgroundColor: colors.warningSoft,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  queueActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnAccent: {
    backgroundColor: colors.primaryContainer,
  },
  actionBtnSuccess: {
    backgroundColor: colors.success,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  actionBtnText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  tokenIndicator: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  tokenText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "800",
  },
});
