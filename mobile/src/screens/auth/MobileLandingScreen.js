import React, { useState } from "react";
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
  SafeAreaView,
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
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require("../../../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.logoText}>TechMedix</Text>
            <Text style={styles.taglineText}>Care beyond the clinic</Text>
          </View>
        </View>
        
        {/* Go to Website Button */}
        <TouchableOpacity
          style={styles.headerWebBtn}
          onPress={() => Linking.openURL("https://techmedix.onrender.com")}
        >
          <MaterialCommunityIcons name="earth" size={16} color={colors.primary} />
          <Text style={styles.headerWebBtnText}>Go to website</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {/* Welcome Banner */}
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          style={styles.heroBanner}
        >
          <Text style={styles.heroTitle}>Trust beyond the screen.</Text>
          <Text style={styles.heroDescription}>
            Book appointments, follow real-time queues, track health metrics, and access AI-assisted insights in one calm place.
          </Text>

          <View style={styles.loginCardRow}>
            <TouchableOpacity
              style={styles.heroLoginCard}
              onPress={() => handlePortalLogin("patient")}
            >
              <View style={[styles.loginIconCircle, { backgroundColor: "#e2f1f1" }]}>
                <MaterialCommunityIcons name="account-heart" size={20} color={colors.primary} />
              </View>
              <Text style={styles.loginCardLabel}>Patient</Text>
              <Text style={styles.loginCardSub}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroLoginCard}
              onPress={() => handlePortalLogin("doctor")}
            >
              <View style={[styles.loginIconCircle, { backgroundColor: "#e8f5e9" }]}>
                <MaterialCommunityIcons name="doctor" size={20} color={colors.success} />
              </View>
              <Text style={styles.loginCardLabel}>Doctor</Text>
              <Text style={styles.loginCardSub}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroLoginCard}
              onPress={() => handlePortalLogin("staff")}
            >
              <View style={[styles.loginIconCircle, { backgroundColor: "#fff8e1" }]}>
                <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.warning} />
              </View>
              <Text style={styles.loginCardLabel}>Staff</Text>
              <Text style={styles.loginCardSub}>Admin</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Live Medicine Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Medicine Search</Text>
          <Text style={styles.sectionSubtitle}>
            Lookup medicines, compositions, or salt details instantly.
          </Text>

          <View style={styles.searchFieldContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.outline} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search paracetamol, aspirin, ibuprofen..."
              placeholderTextColor={colors.outline}
              style={styles.searchInputField}
              onSubmitEditing={executeMedicineSearch}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.outline} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.searchSubmitBtn} onPress={executeMedicineSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.searchSubmitBtnText}>Search Composition</Text>
            )}
          </TouchableOpacity>

          {searchError ? <Text style={styles.searchErrorText}>{searchError}</Text> : null}

          {/* Search results list */}
          {searchResults.length > 0 ? (
            <View style={styles.searchResultsContainer}>
              {searchResults.map((item, index) => (
                <TouchableOpacity
                  key={`${item.id || item._id || item.name}-${index}`}
                  style={styles.resultItemRow}
                  onPress={() => setSelectedMedicine(item)}
                >
                  <View style={styles.resultDetails}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultComposition} numberOfLines={1}>
                      {item.salt || item.salt_composition || item.short_composition1 || "Active salts not listed"}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {/* Specialists & Doctors List from Database */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Specialist Care Pathways</Text>
          <Text style={styles.sectionSubtitle}>Find the right care path quickly.</Text>

          {loadingDoctors ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 10 }} />
          ) : specialties.length === 0 ? (
            <Text style={styles.emptyText}>No specialties available.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specialtiesScroll}>
              {specialties.map((spec) => (
                <View key={spec} style={styles.specialtyPill}>
                  <Text style={styles.specialtyText}>{spec}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.doctorsMockList}>
            {loadingDoctors ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : doctorsList.length === 0 ? (
              <Text style={styles.emptyText}>No featured doctors available.</Text>
            ) : (
              doctorsList.slice(0, 4).map((doc, idx) => {
                const initials = doc.name
                  ? doc.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "DR";
                const isEven = idx % 2 === 0;
                return (
                  <View key={doc.id || idx} style={styles.doctorItemCard}>
                    <View style={[styles.doctorAvatarBox, { backgroundColor: colors.surfaceHigh }]}>
                      <Text style={styles.doctorInitials}>{initials}</Text>
                    </View>
                    <View style={styles.doctorInfo}>
                      <Text style={styles.doctorName}>Dr. {doc.name}</Text>
                      <Text style={styles.doctorSpecialty}>{doc.specialty || "General Physician"}</Text>
                    </View>
                    <View
                      style={[
                        styles.doctorStatusBadge,
                        { backgroundColor: isEven ? colors.successSoft : colors.warningSoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.doctorStatusText,
                          { color: isEven ? colors.success : colors.warning },
                        ]}
                      >
                        {isEven ? "Available" : "Queue Active"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Core Capabilities */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Platform Workflows</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="calendar-check" size={24} color={colors.primary} style={styles.featureIcon} />
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Appointments & Queue</Text>
                <Text style={styles.featureDesc}>Book appointments and follow active real-time doctor queues.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="bell-outline" size={24} color={colors.secondary} style={styles.featureIcon} />
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Medicine Reminders</Text>
                <Text style={styles.featureDesc}>Get scheduled notifications for prescription tracking.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="brain" size={24} color={colors.primaryContainer} style={styles.featureIcon} />
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>AI Diagnostics </Text>
                <Text style={styles.featureDesc}>Upload prescription with intelligent health models.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="wallet-outline" size={24} color={colors.tertiary} style={styles.featureIcon} />
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Health Wallet</Text>
                <Text style={styles.featureDesc}>Manage wallet balances, payment receipts, and health reports.</Text>
              </View>
            </View>
          </View>
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
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: typography.title + 1,
    fontWeight: "800",
    color: colors.primary,
  },
  taglineText: {
    fontSize: 9,
    fontWeight: "600",
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
    fontWeight: "700",
    color: colors.primary,
  },
  scrollContainer: {
    paddingBottom: spacing.lg,
  },
  heroBanner: {
    padding: spacing.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  heroTitle: {
    fontSize: typography.h2,
    fontWeight: "800",
    color: colors.onPrimary,
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: typography.bodySmall,
    color: colors.onPrimary,
    opacity: 0.9,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  loginCardRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  heroLoginCard: {
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
  loginIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  loginCardLabel: {
    fontSize: typography.bodySmall + 1,
    fontWeight: "800",
    color: colors.onSurface,
  },
  loginCardSub: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  sectionHeader: {
    fontSize: typography.title + 1,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  searchFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 16px rgba(17,20,43,0.06)" }
      : {
          shadowColor: "rgba(17,20,43,0.06)",
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 1,
        }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputField: {
    flex: 1,
    color: colors.onSurface,
    fontSize: typography.bodySmall + 1,
    paddingVertical: 4,
  },
  searchSubmitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  searchSubmitBtnText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  searchErrorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  searchResultsContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
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
  resultItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  resultDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  resultName: {
    fontSize: typography.bodySmall + 1,
    fontWeight: "700",
    color: colors.onSurface,
  },
  resultComposition: {
    fontSize: typography.label + 1,
    color: colors.outline,
    marginTop: 2,
  },
  specialtiesScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  specialtyPill: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  specialtyText: {
    fontSize: typography.label + 1,
    fontWeight: "700",
    color: colors.onSurface,
  },
  doctorsMockList: {
    gap: spacing.sm,
  },
  doctorItemCard: {
    flexDirection: "row",
    alignItems: "center",
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
  doctorAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  doctorInitials: {
    fontSize: typography.bodySmall,
    fontWeight: "800",
    color: colors.primary,
  },
  doctorInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  doctorName: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.onSurface,
  },
  doctorSpecialty: {
    fontSize: typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  doctorStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  doctorStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  featuresList: {
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radii.md,
    padding: spacing.md,
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
  featureIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: typography.bodySmall,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  appFooter: {
    backgroundColor: colors.onSurface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: "center",
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
