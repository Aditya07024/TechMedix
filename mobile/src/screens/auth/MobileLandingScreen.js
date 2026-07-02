import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { api } from "../../lib/api";

export default function MobileLandingScreen({ navigation }) {
  // States for interactive medicine search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [searchError, setSearchError] = useState("");

  // States for dynamic specialists and doctors list from backend database
  const [doctorsList, setDoctorsList] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // States for Admin passcode verification
  const [adminPasscodeModalVisible, setAdminPasscodeModalVisible] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  // WIDGET 1: Interactive Queue Tracker Simulator States
  const [simDoctor, setSimDoctor] = useState("Dr. John");
  const [simToken, setSimToken] = useState(4);
  const [simWaiting, setSimWaiting] = useState(3);
  const [simEstWait, setSimEstWait] = useState(12);

  // WIDGET 2: Drug Interaction Simulator States
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [interactionResult, setInteractionResult] = useState(null);

  // WIDGET 3: Sandbox Medication Reminders States
  const [sandboxReminders, setSandboxReminders] = useState([
    { id: 1, name: "Aspirin", time: "Morning", checked: false },
    { id: 2, name: "Multivitamin", time: "Night", checked: true },
  ]);
  const [newReminderName, setNewReminderName] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("Morning");

  // WIDGET 4: Interactive Health Metrics Analyzer States
  const [simHeartRate, setSimHeartRate] = useState("72");
  const [simBP, setSimBP] = useState("120");
  const [metricsReport, setMetricsReport] = useState(null);

  React.useEffect(() => {
    let active = true;
    async function getDbDoctors() {
      setLoadingDoctors(true);
      try {
        const res = await api.doctors.list();
        const list = res?.data || res || [];
        if (!active) return;
        setDoctorsList(list);
        
        // Extract unique specialties
        const uniqueSpecs = Array.from(new Set(list.map((d) => d.specialty).filter(Boolean)));
        setSpecialties(uniqueSpecs.length > 0 ? uniqueSpecs : ["General Physician", "Pediatrics", "Dermatology", "Cardiology"]);
      } catch (err) {
        console.warn("Failed to load doctor database list:", err);
      } finally {
        if (active) setLoadingDoctors(false);
      }
    }
    getDbDoctors();
    return () => {
      active = false;
    };
  }, []);

  const handlePasscodeSubmit = () => {
    if (adminPasscode === "TechMedix@Mobile") {
      setAdminPasscodeModalVisible(false);
      setAdminPasscode("");
      setPasscodeError("");
      navigation.navigate("AdminLogin");
    } else {
      setPasscodeError("Incorrect password. Please Contact techmedixcare@gmail.com for access.");
    }
  };

  const handlePortalLogin = (role) => {
    if (role === "patient") {
      navigation.navigate("PatientLogin");
    } else if (role === "doctor") {
      navigation.navigate("DoctorLogin");
    } else if (role === "staff") {
      navigation.navigate("StaffLogin");
    } else if (role === "admin") {
      setPasscodeError("");
      setAdminPasscode("");
      setAdminPasscodeModalVisible(true);
    } else {
      Alert.alert(
        "Web Portal Only",
        "The TechMedix Admin portal is only accessible via desktop web browsers at techmedix.com. Please use a web browser to log in."
      );
    }
  };

  // Sandbox Widget Simulator Actions
  const handleSimulateQueue = () => {
    setSimToken((prev) => prev + 1);
    setSimWaiting((prev) => {
      const nextWaiting = prev - 1;
      if (nextWaiting <= 0) {
        setSimEstWait(20);
        return 5;
      }
      setSimEstWait(nextWaiting * 4);
      return nextWaiting;
    });
  };

  const handleCheckInteraction = () => {
    if (!drugA.trim() || !drugB.trim()) {
      setInteractionResult("Please enter both drug names.");
      return;
    }
    const a = drugA.toLowerCase().trim();
    const b = drugB.toLowerCase().trim();

    if (
      (a.includes("aspirin") && b.includes("ibuprofen")) ||
      (b.includes("aspirin") && a.includes("ibuprofen")) ||
      (a.includes("advil") && b.includes("aspirin")) ||
      (b.includes("advil") && a.includes("aspirin"))
    ) {
      setInteractionResult({
        status: "warning",
        title: "⚠️ Moderate Risk",
        desc: "Combining Aspirin with Ibuprofen can increase risk of stomach irritation or ulcers. Space them at least 8 hours apart.",
      });
    } else if (
      (a.includes("amoxicillin") && b.includes("alcohol")) ||
      (b.includes("amoxicillin") && a.includes("alcohol")) ||
      (a.includes("antibiotic") && b.includes("alcohol")) ||
      (b.includes("antibiotic") && a.includes("alcohol"))
    ) {
      setInteractionResult({
        status: "danger",
        title: "❌ High Risk / Avoid",
        desc: "Do not mix antibiotics with alcohol. Alcohol decreases drug efficacy and increases liver load.",
      });
    } else {
      setInteractionResult({
        status: "safe",
        title: "🟢 Low Risk",
        desc: "No severe drug interaction found between these two substances. Follow standard spacing of 2 hours.",
      });
    }
  };

  const handleAddSandboxReminder = () => {
    if (!newReminderName.trim()) return;
    const newRem = {
      id: Date.now(),
      name: newReminderName.trim(),
      time: newReminderTime,
      checked: false,
    };
    setSandboxReminders((prev) => [...prev, newRem]);
    setNewReminderName("");
  };

  const handleToggleSandboxReminder = (id) => {
    setSandboxReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const handleDeleteSandboxReminder = (id) => {
    setSandboxReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCalculateMetrics = () => {
    const hr = Number(simHeartRate);
    const sbp = Number(simBP);

    if (isNaN(hr) || isNaN(sbp) || hr <= 0 || sbp <= 0) {
      setMetricsReport("Please enter valid metrics.");
      return;
    }

    let status = "🟢 Optimal";
    let color = colors.success;
    let tip = "Heart rate and blood pressure are within healthy ranges.";

    if (sbp >= 140 || hr > 100) {
      status = "🔴 High / Hypertension";
      color = colors.error;
      tip = "Elevated blood pressure or heart rate. Rest and re-measure.";
    } else if (sbp >= 120 || hr > 90) {
      status = "🟡 Pre-Hypertension / Elevated";
      color = colors.warning;
      tip = "Slightly elevated cardiovascular parameters. Maintain hydration.";
    } else if (sbp < 90 || hr < 55) {
      status = "🔵 Low / Hypotension";
      color = colors.primary;
      tip = "Cardiovascular measurements are lower than average. Hydrate.";
    }

    setMetricsReport({ status, color, tip });
  };

  const executeMedicineSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const response = await api.medicines.list({ search: searchQuery.trim(), limit: 6, page: 1 });
      const list = response?.data || response || [];
      
      let normalized = [];
      if (Array.isArray(list)) {
        normalized = list;
      } else if (list && typeof list === "object") {
        normalized = Object.values(list);
      }
      
      // If empty, try AI lookup
      if (normalized.length === 0) {
        const aiLookup = await api.medicines.lookupWithAi(searchQuery.trim()).catch(() => null);
        if (aiLookup) normalized = [aiLookup];
      }
      
      setSearchResults(normalized);
      if (normalized.length === 0) {
        setSearchError("No medicines found for your search.");
      }
    } catch (err) {
      setSearchError("Search request failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Translucent Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require("../../../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.logoText}>TechMedix</Text>
            <Text style={styles.taglineText}>Care Beyond the Clinic</Text>
          </View>
        </View>
        
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.headerWebBtn}
          onPress={() => Linking.openURL("https://techmedix.tech")}
        >
          <MaterialCommunityIcons name="earth" size={14} color="#00535b" />
          <Text style={styles.headerWebBtnText}>Web Portal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {/* Welcome Section / Login & Signup Launcher */}
        <View style={styles.sectionNoBorder}>
          <Text style={styles.sectionHeaderKicker}>PORTAL ACCESS</Text>
          <Text style={styles.sectionHeaderTitle}>Login / Signup Options</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Select your professional portal role to open your clinical workspace.
          </Text>

          <View style={styles.portalCardStack}>
            {/* Patient Card (Highlighted / Hero Card) */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.portalHeroCard}
              onPress={() => handlePortalLogin("patient")}
            >
              <View style={styles.portalHeroHeader}>
                <View style={styles.portalHeroBadge}>
                  <MaterialCommunityIcons name="star" size={10} color="#00535b" style={{ marginRight: 2 }} />
                  <Text style={styles.portalHeroBadgeText}>PRIMARY CLIENT ACCESS</Text>
                </View>
              </View>

              <View style={styles.portalHeroBody}>
                <View style={styles.portalHeroIconCircle}>
                  <MaterialCommunityIcons name="account-heart" size={32} color="#ffffff" />
                </View>
                <View style={styles.portalHeroMeta}>
                  <Text style={styles.portalHeroTitleText}>Patient Login</Text>
                  <Text style={styles.portalHeroDescText}>
                    Monitor live queues, book appointments, view timeline records, and check prescriptions.
                  </Text>
                </View>
                <View style={styles.portalHeroArrow}>
                  <MaterialCommunityIcons name="arrow-right" size={22} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Doctor & Staff Row (Secondary Cards) */}
            <View style={styles.secondaryPortalsRow}>
              {/* Doctor Card */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.portalSecondaryCard, { backgroundColor: "#0f766e" }]}
                onPress={() => handlePortalLogin("doctor")}
              >
                <View style={styles.secondaryCardIconCircle}>
                  <MaterialCommunityIcons name="stethoscope" size={20} color="#ffffff" />
                </View>
                <Text style={styles.secondaryCardTitleText}>Doctor Login</Text>
                <Text style={styles.secondaryCardDescText}>Manage queues & prescriptions</Text>
              </TouchableOpacity>

              {/* Staff Card */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.portalSecondaryCard, { backgroundColor: "#1e293b" }]}
                onPress={() => handlePortalLogin("staff")}
              >
                <View style={styles.secondaryCardIconCircle}>
                  <MaterialCommunityIcons name="shield-account-outline" size={20} color="#ffffff" />
                </View>
                <Text style={styles.secondaryCardTitleText}>Clinical Staff</Text>
                <Text style={styles.secondaryCardDescText}>Verify appts & ticket queues</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Medicine Search Section */}
        <View style={styles.sectionWithTopBorder}>
          <Text style={styles.sectionHeaderKicker}>DRUG DISCOVERY</Text>
          <Text style={styles.sectionHeaderTitle}>Medicine Search</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Lookup medicines, active compositions, or salt details instantly.
          </Text>

          <View style={styles.searchConsoleCard}>
            <View style={styles.searchConsoleField}>
              <MaterialCommunityIcons name="magnify" size={20} color="#6f797a" style={styles.searchConsoleIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search paracetamol, aspirin, ibuprofen..."
                placeholderTextColor="#6f797a"
                style={styles.searchConsoleInput}
                onSubmitEditing={executeMedicineSearch}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchConsoleClear}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#6f797a" />
                </TouchableOpacity>
              ) : null}
            </View>

            

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.searchSubmitButton}
              onPress={executeMedicineSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.searchSubmitButtonText}>Lookup Composition</Text>
                </>
              )}
            </TouchableOpacity>

            {searchError ? <Text style={styles.searchErrorText}>{searchError}</Text> : null}
          </View>

          {/* Search results list */}
          {searchResults.length > 0 ? (
            <View style={styles.premiumResultsList}>
              <Text style={styles.resultsHeaderLabel}>SEARCH RESULTS ({searchResults.length})</Text>
              {searchResults.map((item, index) => (
                <TouchableOpacity
                  key={`${item.id || item._id || item.name}-${index}`}
                  style={styles.premiumResultRow}
                  activeOpacity={0.8}
                  onPress={() => setSelectedMedicine(item)}
                >
                  <View style={styles.premiumResultIconCircle}>
                    <MaterialCommunityIcons name="pill" size={18} color="#00535b" />
                  </View>
                  <View style={styles.premiumResultMeta}>
                    <Text style={styles.premiumResultName}>{item.name}</Text>
                    <Text style={styles.premiumResultComposition} numberOfLines={1}>
                      {item.salt || item.salt_composition || item.short_composition1 || "Active salts not listed"}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#00535b" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {/* Sleek App Footer */}
        <View style={styles.appFooter}>
          <Text style={styles.disclaimerText}>
            Important Notice: TechMedix connects patients, doctors, and clinics for records and care coordination. We do not sell pharmaceuticals.
          </Text>
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => Linking.openURL("mailto:techmedixcare@gmail.com")}>
              <Text style={styles.footerContact}>techmedixcare@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handlePortalLogin("admin")}>
              <Text style={styles.footerStaffLink}>Admin Portal</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerCopyright}>© 2025 TechMedix • Calming Connected Care</Text>
        </View>
      </ScrollView>


      {/* MEDICINE DETAIL MODAL */}
      <Modal
        visible={selectedMedicine !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedMedicine(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {selectedMedicine ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedMedicine.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedMedicine(null)} style={styles.closeModalBtn}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView contentContainerStyle={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalSubtitle}>Composition</Text>
                  <Text style={styles.modalText}>
                    {selectedMedicine.salt || selectedMedicine.salt_composition || selectedMedicine.short_composition1 || "Active salts not available."}
                  </Text>

                  <Text style={styles.modalSubtitle}>Uses & Benefits</Text>
                  <Text style={styles.modalText}>
                    {selectedMedicine.medicine_desc || selectedMedicine.benefits || selectedMedicine.info || selectedMedicine.usage || "No description provided."}
                  </Text>

                  {/* Auth Promotion */}
                  <View style={styles.modalAuthPrompt}>
                    <MaterialCommunityIcons name="lock-outline" size={24} color={colors.primary} />
                    <Text style={styles.modalAuthTitle}>Prescriptions & Price Insights</Text>
                    <Text style={styles.modalAuthText}>
                      Sign in as a patient to review safety warnings, check side effects, or order through connected pharmacies.
                    </Text>
                    
                    <TouchableOpacity
                      style={styles.modalLoginBtn}
                      onPress={() => {
                        setSelectedMedicine(null);
                        handlePortalLogin("patient");
                      }}
                    >
                      <Text style={styles.modalLoginBtnText}>Secure Login as Patient</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ADMIN PASSCODE MODAL */}
      <Modal
        visible={adminPasscodeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAdminPasscodeModalVisible(false)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={styles.passcodeModalContent}>
            <View style={styles.passcodeHeader}>
              <MaterialCommunityIcons name="shield-lock-outline" size={24} color={colors.primary} />
              <Text style={styles.passcodeTitle}>Enter Admin Password</Text>
            </View>
            
            {passcodeError ? <Text style={styles.passcodeErrorText}>{passcodeError}</Text> : null}

            <TextInput
              value={adminPasscode}
              onChangeText={setAdminPasscode}
              placeholder="Enter passcode"
              placeholderTextColor={colors.outline}
              secureTextEntry={true}
              style={styles.passcodeInput}
            />

            <View style={styles.passcodeButtonRow}>
              <TouchableOpacity
                style={[styles.passcodeBtn, styles.passcodeBtnCancel]}
                onPress={() => {
                  setAdminPasscodeModalVisible(false);
                  setAdminPasscode("");
                  setPasscodeError("");
                }}
              >
                <Text style={styles.passcodeBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passcodeBtn, styles.passcodeBtnSubmit]}
                onPress={handlePasscodeSubmit}
              >
                <Text style={styles.passcodeBtnSubmitText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  logoText: {
    fontSize: typography.title + 2,
    fontWeight: "800",
    color: colors.primary,
  },
  taglineText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.outline,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerWebBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  headerWebBtnText: {
    fontSize: typography.bodySmall - 1,
    fontWeight: "800",
    color: colors.primary,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
  },
  sectionNoBorder: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  sectionWithTopBorder: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLow,
    marginTop: spacing.sm,
  },
  sectionHeaderKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: typography.h2,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 6,
  },
  sectionHeaderSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  portalCardStack: {
    gap: 12,
    marginTop: spacing.xs,
  },
  portalHeroCard: {
    backgroundColor: "#00535b",
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    borderColor: "#0f766e",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 8px 24px rgba(0,83,91,0.15)" }
      : {
          shadowColor: "rgba(0,83,91,0.15)",
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }),
  },
  portalHeroHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  portalHeroBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  portalHeroBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#00535b",
  },
  portalHeroBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  portalHeroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  portalHeroMeta: {
    flex: 1,
    paddingRight: 6,
  },
  portalHeroTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 2,
  },
  portalHeroDescText: {
    fontSize: 12,
    color: "#ffffff",
    opacity: 0.85,
    lineHeight: 16,
  },
  portalHeroArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryPortalsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  portalSecondaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }
      : {
          shadowColor: "rgba(0,0,0,0.06)",
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }),
  },
  secondaryCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryCardTitleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 2,
  },
  secondaryCardDescText: {
    fontSize: 10,
    color: "#ffffff",
    opacity: 0.8,
    lineHeight: 13,
  },
  searchConsoleCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 6px 22px rgba(14,29,37,0.05)" }
      : {
          shadowColor: "rgba(14,29,37,0.05)",
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
        }),
  },
  searchConsoleField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchConsoleIcon: {
    marginRight: 8,
  },
  searchConsoleInput: {
    flex: 1,
    fontSize: typography.bodySmall + 1,
    color: colors.onSurface,
    paddingVertical: 2,
  },
  searchConsoleClear: {
    padding: 2,
  },
  quickSearchPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  quickSearchPill: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  quickSearchPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  searchSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  searchSubmitButtonText: {
    color: "#ffffff",
    fontSize: typography.bodySmall + 1,
    fontWeight: "800",
  },
  searchErrorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  premiumResultsList: {
    marginTop: 18,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 6px 20px rgba(14,29,37,0.05)" }
      : {
          shadowColor: "rgba(14,29,37,0.05)",
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }),
  },
  resultsHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.outline,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  premiumResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  premiumResultIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLow,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  premiumResultMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  premiumResultName: {
    fontSize: typography.bodySmall + 1,
    fontWeight: "800",
    color: colors.onSurface,
  },
  premiumResultComposition: {
    fontSize: typography.label + 1,
    color: colors.outline,
    marginTop: 2,
  },
  appFooter: {
    backgroundColor: colors.onSurface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  disclaimerText: {
    fontSize: 10,
    color: colors.onPrimary,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 15,
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerContact: {
    fontSize: typography.bodySmall,
    color: colors.onPrimary,
    opacity: 0.8,
  },
  footerStaffLink: {
    fontSize: typography.bodySmall,
    color: colors.primaryFixed,
    fontWeight: "700",
  },
  footerCopyright: {
    fontSize: 9,
    color: colors.onPrimary,
    opacity: 0.4,
    marginTop: 4,
  },
  // Modal layout
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "85%",
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
    flex: 1,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalScrollBody: {
    paddingBottom: spacing.xl,
  },
  modalSubtitle: {
    fontSize: typography.bodySmall,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  modalText: {
    fontSize: typography.bodySmall + 1,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalAuthPrompt: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  modalAuthTitle: {
    fontSize: typography.body,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  modalAuthText: {
    fontSize: typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalLoginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
  },
  modalLoginBtnText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  passcodeModalContent: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    width: "100%",
    maxWidth: 320,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: spacing.md,
  },
  passcodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passcodeTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.onSurface,
  },
  passcodeErrorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 16,
  },
  passcodeInput: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: typography.bodySmall + 1,
  },
  passcodeButtonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  passcodeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  passcodeBtnCancel: {
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  passcodeBtnSubmit: {
    backgroundColor: colors.primary,
  },
  passcodeBtnCancelText: {
    color: colors.outline,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  passcodeBtnSubmitText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
});
