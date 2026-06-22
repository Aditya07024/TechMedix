import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { DetailRow, SurfaceCard, TopBar } from "../../components/ui";

export default function AdminDashboardScreen() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview"); // overview, payments, payouts, users, tickets
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Individual loading states for lazy load performance
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Data states
  const [systemStats, setSystemStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  
  // Filtering & Payout modal states
  const [selectedRole, setSelectedRole] = useState(""); // all, patient, doctor, staff, admin
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  // Individual lazy loaders
  const loadOverview = async () => {
    setOverviewLoading(true);
    setError("");
    try {
      const res = await api.admin.getOverview();
      setSystemStats(res?.data || res || {});
    } catch (err) {
      setError("Failed to load system overview stats.");
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    setError("");
    try {
      const res = await api.admin.getPayments(50, 0);
      setPayments(res?.data || res || []);
    } catch (err) {
      setError("Failed to load payment transactions.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPayouts = async () => {
    setPayoutsLoading(true);
    setError("");
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.admin.getPayoutSummary(),
        api.admin.getPayoutHistory(),
      ]);
      setPayoutSummary(summaryRes?.data || summaryRes || []);
      setPayoutHistory(historyRes?.data || historyRes || []);
    } catch (err) {
      setError("Failed to load doctor payouts statistics.");
    } finally {
      setPayoutsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setError("");
    try {
      const res = await api.admin.getUsers(selectedRole || null, 50, 0);
      setUsers(res?.data || res || []);
    } catch (err) {
      setError("Failed to load user directories.");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    setError("");
    try {
      const res = await api.admin.getTickets();
      setSupportTickets(res?.tickets || res?.data || res || []);
    } catch (err) {
      setError("Failed to load support tickets.");
    } finally {
      setTicketsLoading(false);
    }
  };

  // Trigger lazy loading per tab
  useEffect(() => {
    if (activeTab === "overview") {
      loadOverview();
    } else if (activeTab === "payments") {
      loadPayments();
    } else if (activeTab === "payouts") {
      loadPayouts();
    } else if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "tickets") {
      loadTickets();
    }
  }, [activeTab, selectedRole]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "overview") await loadOverview();
    else if (activeTab === "payments") await loadPayments();
    else if (activeTab === "payouts") await loadPayouts();
    else if (activeTab === "users") await loadUsers();
    else if (activeTab === "tickets") await loadTickets();
    setRefreshing(false);
  };

  // Actions
  const handleDeleteFailedOrPendingPayments = async () => {
    Alert.alert(
      "Confirm Cleanup",
      "Are you sure you want to delete all failed and pending payments? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setPaymentsLoading(true);
              const res = await api.admin.deleteFailedOrPendingPayments();
              Alert.alert("Success", res?.message || "Successfully deleted failed or pending payments.");
              await loadPayments();
            } catch (err) {
              Alert.alert("Error", err.message || "Failed to delete payments.");
            } finally {
              setPaymentsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      setTicketsLoading(true);
      await api.admin.updateTicketStatus(ticketId, status);
      Alert.alert("Success", `Ticket marked as ${status}.`);
      await loadTickets();
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to update ticket status.");
    } finally {
      setTicketsLoading(false);
    }
  };

  const openPayoutModal = (doctor) => {
    setSelectedDoctor(doctor);
    setPayoutAmount(String(doctor.pending_payout || doctor.pendingPayout || 0));
    setPayoutNotes("");
    setShowPayoutModal(true);
  };

  const handleRecordPayout = async () => {
    if (!selectedDoctor || !payoutAmount || Number(payoutAmount) <= 0) {
      Alert.alert("Invalid Input", "Please provide a valid payout amount.");
      return;
    }
    setPayoutSubmitting(true);
    try {
      const res = await api.admin.createPayout({
        doctor_id: selectedDoctor.doctor_id || selectedDoctor.doctorId,
        amount: parseFloat(payoutAmount),
        reference_notes: payoutNotes,
      });
      if (res?.success || res) {
        Alert.alert("Success", "Payout recorded successfully!");
        setShowPayoutModal(false);
        setSelectedDoctor(null);
        setPayoutAmount("");
        setPayoutNotes("");
        await loadPayouts();
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to record payout.");
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  const getTabLoading = () => {
    if (activeTab === "overview") return overviewLoading;
    if (activeTab === "payments") return paymentsLoading;
    if (activeTab === "payouts") return payoutsLoading;
    if (activeTab === "users") return usersLoading;
    if (activeTab === "tickets") return ticketsLoading;
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopBar title="Admin Workspace" avatar="AD" onBell={signOut} />
      
      {/* Tab bar header */}
      <View style={styles.tabScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: "overview", label: "Overview", icon: "chart-bar" },
            { id: "payments", label: "Payments", icon: "credit-card-outline" },
            { id: "payouts", label: "Payouts", icon: "cash-multiple" },
            { id: "users", label: "Users", icon: "account-multiple-outline" },
            { id: "tickets", label: "Tickets", icon: "ticket-outline" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.outline} />
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {getTabLoading() && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && systemStats && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>System Overview</Text>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <MaterialCommunityIcons name="account-group" size={24} color={colors.primary} />
                    <Text style={styles.statValue}>{systemStats.total_patients || 0}</Text>
                    <Text style={styles.statLabel}>Total Patients</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <MaterialCommunityIcons name="doctor" size={24} color={colors.success} />
                    <Text style={styles.statValue}>{systemStats.total_doctors || 0}</Text>
                    <Text style={styles.statLabel}>Total Doctors</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <MaterialCommunityIcons name="calendar-check" size={24} color={colors.secondary} />
                    <Text style={styles.statValue}>{systemStats.total_appointments || 0}</Text>
                    <Text style={styles.statLabel}>Appointments</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <MaterialCommunityIcons name="currency-inr" size={24} color={colors.primaryFixed} />
                    <Text style={[styles.statValue, { fontSize: 16 }]}>
                      {formatCurrency(systemStats.total_revenue || 0)}
                    </Text>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                  </View>
                </View>

                <SurfaceCard>
                  <Text style={styles.cardHeader}>Financial Breakdown</Text>
                  <DetailRow
                    icon="credit-card-outline"
                    label="Online Revenue"
                    value={formatCurrency(systemStats.online_revenue || 0)}
                  />
                  <DetailRow
                    icon="cash"
                    label="Cash Revenue"
                    value={formatCurrency(systemStats.offline_revenue || 0)}
                  />
                </SurfaceCard>

                <SurfaceCard>
                  <Text style={styles.cardHeader}>Operational Analytics</Text>
                  <DetailRow
                    icon="calendar-clock"
                    label="Bookings Today"
                    value={String(systemStats.bookings_today || 0)}
                  />
                  <DetailRow
                    icon="calendar-month"
                    label="Bookings This Month"
                    value={String(systemStats.bookings_this_month || 0)}
                  />
                  <DetailRow
                    icon="chart-line-variant"
                    label="Completion Rate"
                    value={`${systemStats.conversion_rate || 0}%`}
                  />
                  <DetailRow
                    icon="star-outline"
                    label="Average Rating"
                    value={`${Number(systemStats.avg_rating || 0).toFixed(1)}/5`}
                  />
                </SurfaceCard>
              </View>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === "payments" && (
              <View style={styles.tabContent}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>Payments</Text>
                  <TouchableOpacity
                    onPress={handleDeleteFailedOrPendingPayments}
                    style={styles.cleanupBtn}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error} />
                    <Text style={styles.cleanupBtnText}>Clean Failed/Pending</Text>
                  </TouchableOpacity>
                </View>

                {payments.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="credit-card-off-outline" size={32} color={colors.outline} />
                    <Text style={styles.emptyCardText}>No payment records found.</Text>
                  </View>
                ) : (
                  payments.map((p) => (
                    <SurfaceCard key={p.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemIdText}>ID: {p.id.substring(0, 8)}...</Text>
                        <View style={[styles.statusTag, p.status === "paid" || p.status === "completed" ? styles.statusTagSuccess : styles.statusTagInfo]}>
                          <Text style={[styles.statusTagText, p.status === "paid" || p.status === "completed" ? { color: colors.success } : { color: colors.primary }]}>
                            {p.status}
                          </Text>
                        </View>
                      </View>
                      
                      <DetailRow
                        icon="account-outline"
                        label="Payer"
                        value={p.patient_name || (p.doctor_name ? `Dr. ${p.doctor_name}` : "Anonymous")}
                      />
                      <DetailRow
                        icon="currency-inr"
                        label="Base Amount"
                        value={formatCurrency(p.amount)}
                      />
                      <DetailRow
                        icon="receipt"
                        label="GST + Platform Fees"
                        value={formatCurrency((p.gst_charges || 0) + (p.platform_fees || 0))}
                      />
                      <DetailRow
                        icon="cash-check"
                        label="Total Paid"
                        value={formatCurrency(p.total_amount || p.amount)}
                      />
                      <DetailRow
                        icon="calendar"
                        label="Date"
                        value={formatDate(p.created_at)}
                      />
                      <DetailRow
                        icon="wallet-outline"
                        label="Method"
                        value={String(p.payment_method || "N/A").toUpperCase()}
                      />
                    </SurfaceCard>
                  ))
                )}
              </View>
            )}

            {/* DOCTOR PAYOUTS TAB */}
            {activeTab === "payouts" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>Doctor Payout Balances</Text>
                
                {payoutSummary.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="doctor" size={32} color={colors.outline} />
                    <Text style={styles.emptyCardText}>No doctor records found.</Text>
                  </View>
                ) : (
                  payoutSummary.map((doc) => {
                    const pendingPayout = doc.pending_payout || doc.pendingPayout || 0;
                    return (
                      <SurfaceCard key={doc.doctor_id || doc.doctorId} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.doctorName}>Dr. {doc.doctor_name}</Text>
                          <Text style={styles.doctorSpec}>{doc.specialty}</Text>
                        </View>
                        
                        <DetailRow
                          icon="credit-card-outline"
                          label="Collected Online"
                          value={formatCurrency(doc.online_collected || doc.onlineCollected)}
                        />
                        <DetailRow
                          icon="cash"
                          label="Collected Cash"
                          value={formatCurrency(doc.offline_collected || doc.offlineCollected)}
                        />
                        <DetailRow
                          icon="cash-check"
                          label="Total Paid Out"
                          value={formatCurrency(doc.total_paid_out || doc.totalPaidOut)}
                        />
                        <DetailRow
                          icon="alert-circle-outline"
                          label="Pending Payout"
                          value={formatCurrency(pendingPayout)}
                        />
                        
                        {pendingPayout > 0 ? (
                          <TouchableOpacity
                            style={styles.distributeBtn}
                            onPress={() => openPayoutModal(doc)}
                          >
                            <MaterialCommunityIcons name="cash-fast" size={16} color={colors.onPrimary} />
                            <Text style={styles.distributeBtnText}>Distribute Fees</Text>
                          </TouchableOpacity>
                        ) : null}
                      </SurfaceCard>
                    );
                  })
                )}

                <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>Payout History</Text>
                {payoutHistory.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="history" size={32} color={colors.outline} />
                    <Text style={styles.emptyCardText}>No distributions recorded yet.</Text>
                  </View>
                ) : (
                  payoutHistory.map((historyItem) => (
                    <SurfaceCard key={historyItem.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.doctorName}>Dr. {historyItem.doctor_name}</Text>
                        <Text style={styles.historyAmount}>{formatCurrency(historyItem.amount)}</Text>
                      </View>
                      <DetailRow
                        icon="calendar"
                        label="Date"
                        value={formatDate(historyItem.payout_date || historyItem.payoutDate)}
                      />
                      <DetailRow
                        icon="comment-text-outline"
                        label="Reference/Notes"
                        value={historyItem.reference_notes || historyItem.referenceNotes || "None"}
                      />
                    </SurfaceCard>
                  ))
                )}
              </View>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>Registered Users</Text>
                
                {/* Role filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                  {[
                    { id: "", label: "All" },
                    { id: "patient", label: "Patients" },
                    { id: "doctor", label: "Doctors" },
                    { id: "staff", label: "Staff" },
                    { id: "admin", label: "Admins" },
                  ].map((roleFilter) => {
                    const isSelected = selectedRole === roleFilter.id;
                    return (
                      <TouchableOpacity
                        key={roleFilter.id}
                        onPress={() => setSelectedRole(roleFilter.id)}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                      >
                        <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                          {roleFilter.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {users.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="account-off-outline" size={32} color={colors.outline} />
                    <Text style={styles.emptyCardText}>No users matched this filter.</Text>
                  </View>
                ) : (
                  users.map((u, index) => (
                    <SurfaceCard key={u.id || index} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.userName}>{u.name || u.full_name || "Anonymous"}</Text>
                        <View style={[styles.statusTag, styles.statusTagInfo]}>
                          <Text style={[styles.statusTagText, { color: colors.primary }]}>
                            {u.role || "patient"}
                          </Text>
                        </View>
                      </View>
                      <DetailRow icon="email-outline" label="Email" value={u.email} />
                      <DetailRow icon="phone-outline" label="Phone" value={u.phone || "N/A"} />
                      <DetailRow icon="calendar-outline" label="Joined" value={formatDate(u.created_at || u.createdAt)} />
                    </SurfaceCard>
                  ))
                )}
              </View>
            )}

            {/* TICKETS TAB */}
            {activeTab === "tickets" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>Support Tickets</Text>

                {supportTickets.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="ticket-percent-outline" size={32} color={colors.outline} />
                    <Text style={styles.emptyCardText}>No support tickets open.</Text>
                  </View>
                ) : (
                  supportTickets.map((ticket) => (
                    <SurfaceCard key={ticket.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject || "Issue Ticket"}</Text>
                        <View style={[styles.statusTag, ticket.status === "open" ? styles.statusTagWarning : styles.statusTagSuccess]}>
                          <Text style={[styles.statusTagText, ticket.status === "open" ? { color: colors.warning } : { color: colors.success }]}>
                            {ticket.status}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.ticketDesc}>{ticket.description}</Text>
                      
                      <DetailRow
                        icon="account-outline"
                        label="Raised By"
                        value={ticket.patient_name || ticket.patientName || "Patient"}
                      />
                      <DetailRow
                        icon="calendar"
                        label="Raised At"
                        value={formatDate(ticket.created_at || ticket.createdAt)}
                      />
                      
                      {ticket.status === "open" ? (
                        <View style={styles.ticketBtnRow}>
                          <TouchableOpacity
                            style={[styles.ticketActionBtn, { backgroundColor: colors.successSoft }]}
                            onPress={() => handleUpdateTicketStatus(ticket.id, "resolved")}
                          >
                            <Text style={[styles.ticketActionBtnText, { color: colors.success }]}>Mark Resolved</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.ticketActionBtn, { backgroundColor: colors.errorContainer }]}
                            onPress={() => handleUpdateTicketStatus(ticket.id, "closed")}
                          >
                            <Text style={[styles.ticketActionBtnText, { color: colors.error }]}>Close Ticket</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </SurfaceCard>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* PAYOUT DISTRIBUTION MODAL */}
      <Modal visible={showPayoutModal} transparent animationType="slide" onRequestClose={() => setShowPayoutModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Distribute Fees</Text>
              <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            
            {selectedDoctor && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <Text style={styles.modalKicker}>Recording payout for Dr. {selectedDoctor.doctor_name}</Text>
                
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Payout Amount (₹)</Text>
                  <TextInput
                    value={payoutAmount}
                    onChangeText={setPayoutAmount}
                    keyboardType="numeric"
                    style={styles.modalInput}
                    placeholder="Enter amount"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Reference Notes / Details</Text>
                  <TextInput
                    value={payoutNotes}
                    onChangeText={setPayoutNotes}
                    style={[styles.modalInput, styles.modalTextArea]}
                    placeholder="e.g., IMPS transaction details, check number"
                    multiline
                  />
                </View>

                <TouchableOpacity
                  style={styles.submitPayoutBtn}
                  onPress={handleRecordPayout}
                  disabled={payoutSubmitting}
                >
                  {payoutSubmitting ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={18} color={colors.onPrimary} />
                      <Text style={styles.submitPayoutBtnText}>Submit Distribution</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  tabScrollContainer: {
    backgroundColor: colors.surfaceLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  tabScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.outline,
  },
  tabButtonTextActive: {
    color: colors.onPrimary,
  },
  scrollBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  tabContent: {
    gap: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.title + 1,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cleanupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  cleanupBtnText: {
    color: colors.error,
    fontSize: 10,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.surfaceLowest,
    width: "48%",
    aspectRatio: 1.25,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 4,
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
  statValue: {
    fontSize: typography.title + 2,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.outline,
    textTransform: "uppercase",
  },
  cardHeader: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: typography.bodySmall,
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
    marginTop: spacing.md,
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
    gap: 6,
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
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  itemIdText: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.outline,
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
  doctorName: {
    fontSize: typography.body + 1,
    fontWeight: "800",
    color: colors.onSurface,
  },
  doctorSpec: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.outline,
    textTransform: "uppercase",
  },
  historyAmount: {
    fontSize: typography.body,
    fontWeight: "800",
    color: colors.success,
  },
  distributeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  distributeBtnText: {
    color: colors.onPrimary,
    fontSize: typography.bodySmall,
    fontWeight: "700",
  },
  userName: {
    fontSize: typography.body + 1,
    fontWeight: "800",
    color: colors.onSurface,
  },
  filterScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterPill: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.primary,
  },
  filterPillTextActive: {
    color: colors.onPrimary,
  },
  ticketSubject: {
    fontSize: typography.body,
    fontWeight: "800",
    color: colors.onSurface,
    flex: 1,
  },
  ticketDesc: {
    fontSize: typography.bodySmall + 1,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
    marginVertical: spacing.xs,
  },
  ticketBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ticketActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  ticketActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "80%",
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.h2,
    fontWeight: "800",
    color: colors.onSurface,
  },
  modalBody: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalKicker: {
    fontSize: typography.bodySmall + 1,
    color: colors.outline,
    fontWeight: "600",
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    color: colors.outline,
    fontSize: typography.label,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modalInput: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: typography.bodySmall + 1,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitPayoutBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  submitPayoutBtnText: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: "800",
  },
});
