import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SurfaceCard, TopBar } from "../../components/ui";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { api } from "../../lib/api";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export default function MedicineDetailScreen({ navigation, route }) {
  const { medicine } = route.params;

  const [detailedMedicine, setDetailedMedicine] = useState(medicine);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const name = firstDefined(detailedMedicine?.name, medicine?.name, "Medicine");
  const price = firstDefined(detailedMedicine?.price, detailedMedicine?.mrp, medicine?.price, medicine?.mrp);
  const salt = firstDefined(
    detailedMedicine?.salt,
    detailedMedicine?.salt_composition,
    detailedMedicine?.short_composition1,
    medicine?.salt,
    medicine?.salt_composition,
    medicine?.short_composition1,
  );
  const manufacturer = firstDefined(
    detailedMedicine?.manufacturer_name,
    detailedMedicine?.manufacturer,
    medicine?.manufacturer_name,
    medicine?.manufacturer,
  );
  const description = firstDefined(
    detailedMedicine?.medicine_desc,
    detailedMedicine?.info,
    detailedMedicine?.benefits,
    medicine?.medicine_desc,
    medicine?.info,
    medicine?.benefits,
  );
  const usage = normalizeList(firstDefined(detailedMedicine?.uses, detailedMedicine?.usage));
  const sideEffects = normalizeList(
    firstDefined(detailedMedicine?.side_effects, detailedMedicine?.sideeffects, detailedMedicine?.sideEffects),
  );
  const substitutes = normalizeList(detailedMedicine?.substitutes);

  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Safety Check States
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);
  const [safetyError, setSafetyError] = useState("");

  // Substitutions Search States
  const [subsLoading, setSubsLoading] = useState(false);
  const [substituteMedicines, setSubstituteMedicines] = useState([]);
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [submittingSearch, setSubmittingSearch] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      const targetId = medicine?.id || medicine?._id;
      if (!targetId) return;
      setLoadingDetails(true);
      try {
        const res = await api.medicines.getById(targetId);
        if (res) {
          setDetailedMedicine(res);
        }
      } catch (err) {
        console.warn("Failed to load medicine details", err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
    checkWishlist();
  }, [medicine]);

  const checkWishlist = async () => {
    try {
      const raw = await AsyncStorage.getItem("techmedix.mobile.wishlist");
      const list = raw ? JSON.parse(raw) : [];
      setInWishlist(list.some((x) => x.id === medicine.id || x.name === name));
    } catch {}
  };

  const toggleWishlist = async () => {
    setWishlistLoading(true);
    try {
      const raw = await AsyncStorage.getItem("techmedix.mobile.wishlist");
      let list = raw ? JSON.parse(raw) : [];
      const exists = list.some((x) => x.id === medicine.id || x.name === name);
      if (exists) {
        list = list.filter((x) => x.id !== medicine.id && x.name !== name);
      } else {
        list.push({ ...medicine, id: medicine.id || name, name, price });
      }
      await AsyncStorage.setItem("techmedix.mobile.wishlist", JSON.stringify(list));
      setInWishlist(!exists);
    } catch {}
    setWishlistLoading(false);
  };

  const handleSafetyCheck = async () => {
    setSafetyLoading(true);
    setSafetyError("");
    setSafetyResult(null);
    try {
      const candidate = (salt || name || "").trim();
      const res = await api.prescriptions.safetyCheckLatest(candidate);
      if (res?.success) {
        setSafetyResult(res.data);
      } else {
        setSafetyError(res?.error || "Safety check failed");
      }
    } catch (err) {
      setSafetyError(err.message || "Failed to run safety check");
    } finally {
      setSafetyLoading(false);
    }
  };

  const handleFindSubstitutions = async () => {
    if (!salt) {
      Alert.alert("Not Available", "No salt composition details available to find substitutes.");
      return;
    }
    setSubsLoading(true);
    setShowSubstitutions(true);
    try {
      const baseSalt = (salt || "").split("(")[0].trim();
      const response = await api.medicines.list({ salt_search: baseSalt });
      const list = response?.data || [];
      const filtered = list.filter((x) => {
        if (x.id === medicine.id || x.name === name) return false;
        const xSalt = (x.salt || x.salt_composition || x.short_composition1 || "").toLowerCase();
        return xSalt.includes(baseSalt.toLowerCase());
      });
      setSubstituteMedicines(filtered);
    } catch (err) {
      Alert.alert("Error", "Failed to load substitute medicines.");
    } finally {
      setSubsLoading(false);
    }
  };

  const handleSubstitutePress = async (subName) => {
    setSubmittingSearch(true);
    try {
      const results = await api.medicines.search(subName);
      const match = results?.find((x) => x.name?.toLowerCase() === subName.toLowerCase()) || results?.[0];
      if (match) {
        navigation.push("MedicineDetail", { medicine: match });
      } else {
        Alert.alert("Not Found", `We couldn't find details for "${subName}" in our database.`);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to search for substitute medicine.");
    } finally {
      setSubmittingSearch(false);
    }
  };

  const formatWarning = (warning) => {
    if (typeof warning === "string") return warning;
    const pair = [warning.medicine_1, warning.medicine_2].filter(Boolean);
    if (pair.length > 0) return `${pair.join(" + ")}: ${warning.description || ""}`;
    return warning.description || JSON.stringify(warning);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} nestedScrollEnabled={true}>
      <TopBar
        title="Medicine Detail"
        showBack
        onBack={() => navigation.goBack()}
        rightIcon={inWishlist ? "heart" : "heart-outline"}
        onRightPress={toggleWishlist}
      />

      {/* Hero section */}
      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.title}>{name}</Text>
          {medicine?.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{medicine.category}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {price != null && price !== "" ? `₹${price}` : "Price unavailable"}
          </Text>
          
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleWishlist}
            disabled={wishlistLoading}
            style={[
              styles.wishlistBadge,
              inWishlist && styles.wishlistBadgeActive
            ]}
          >
            <MaterialCommunityIcons
              name={inWishlist ? "heart" : "heart-outline"}
              size={16}
              color={inWishlist ? colors.onPrimary : colors.primary}
            />
            <Text style={[
              styles.wishlistBadgeText,
              inWishlist && { color: colors.onPrimary }
            ]}>
              {inWishlist ? "Saved" : "Wishlist"}
            </Text>
          </TouchableOpacity>
        </View>
      </SurfaceCard>

      {/* Metadata Section */}
      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionHeaderTitle}>QUICK FACTS</Text>
        
        <View style={styles.metaList}>
          <View style={styles.metaItem}>
            <View style={styles.metaIconWrap}>
              <MaterialCommunityIcons name="flask-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>PRIMARY COMPOSITION</Text>
              <Text style={styles.metaValue}>{salt || "Not specified"}</Text>
            </View>
          </View>

          <View style={styles.metaItem}>
            <View style={styles.metaIconWrap}>
              <MaterialCommunityIcons name="factory" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>MANUFACTURER</Text>
              <Text style={styles.metaValue}>{manufacturer || "Not specified"}</Text>
            </View>
          </View>

          <View style={styles.metaItem}>
            <View style={styles.metaIconWrap}>
              <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>TYPE</Text>
              <Text style={styles.metaValue}>{medicine?.type || "Not specified"}</Text>
            </View>
          </View>

          <View style={styles.metaItem}>
            <View style={styles.metaIconWrap}>
              <MaterialCommunityIcons name="package-variant" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>PACK SIZE</Text>
              <Text style={styles.metaValue}>{medicine?.pack_size_label || "Not specified"}</Text>
            </View>
          </View>
        </View>

        {/* Clinical Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSafetyCheck}
            disabled={safetyLoading}
            style={[styles.actionBtn, styles.safetyBtn]}
          >
            {safetyLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-check" size={18} color={colors.primary} />
                <Text style={styles.actionBtnText}>Run Safety Check</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleFindSubstitutions}
            disabled={subsLoading}
            style={[styles.actionBtn, styles.findBtn]}
          >
            {subsLoading ? (
              <ActivityIndicator size="small" color="#673ab7" />
            ) : (
              <>
                <MaterialCommunityIcons name="magnify" size={18} color="#673ab7" />
                <Text style={[styles.actionBtnText, { color: "#673ab7" }]}>Find Substitutes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Safety Callout */}
        {safetyError ? (
          <View style={[styles.callout, styles.errorCallout]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700", flex: 1 }}>
              {safetyError}
            </Text>
          </View>
        ) : null}

        {safetyResult ? (
          <View
            style={[
              styles.callout,
              safetyResult.warnings?.length ? styles.warningCallout : styles.safeCallout,
            ]}
          >
            <MaterialCommunityIcons
              name={safetyResult.warnings?.length ? "alert-outline" : "shield-check"}
              size={22}
              color={safetyResult.warnings?.length ? colors.error : colors.success}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: safetyResult.warnings?.length ? colors.error : colors.success,
                  marginBottom: 2,
                }}
              >
                {safetyResult.warnings?.length ? "Safety Warnings Found" : "Clinically Safe"}
              </Text>
              {safetyResult.warnings?.length ? (
                safetyResult.warnings.map((warning, index) => (
                  <Text
                    key={`${medicine.id}-warning-${index}`}
                    style={{ fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 18, marginTop: 2 }}
                  >
                    {`\u2022 ${formatWarning(warning)}`}
                  </Text>
                ))
              ) : (
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                  No active health condition or prescription conflicts detected.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Substitutions search card */}
        {showSubstitutions ? (
          <View style={styles.substitutionsCard}>
            <View style={styles.subsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="pill" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>
                  Alternatives (Same Salt)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSubstitutions(false)}>
                <MaterialCommunityIcons name="close" size={18} color={colors.outline} />
              </TouchableOpacity>
            </View>

            {subsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : substituteMedicines.length > 0 ? (
              <ScrollView
                style={{ maxHeight: 200, marginTop: 8 }}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                <View style={{ gap: 8 }}>
                  {substituteMedicines.map((alt) => (
                    <TouchableOpacity
                      key={alt.id}
                      activeOpacity={0.7}
                      onPress={() => navigation.push("MedicineDetail", { medicine: alt })}
                      style={styles.altItem}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.altName}>
                          {alt.name} {alt.salt || alt.short_composition1 ? `(${alt.salt || alt.short_composition1})` : ""}
                        </Text>
                        <Text style={styles.altMeta}>{alt.manufacturer_name}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.altPrice}>
                          {alt.price ? `₹${alt.price}` : "N/A"}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.outline} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={{ fontSize: 12, color: colors.outline, textAlign: "center", marginVertical: 10 }}>
                No database alternatives found for this salt composition.
              </Text>
            )}
          </View>
        ) : null}
      </SurfaceCard>

      {/* Detailed Clinical Sections */}
      <View style={{ gap: spacing.md }}>
        {submittingSearch ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
        ) : null}

        {salt ? (
          <SurfaceCard style={[styles.sectionCard, { borderLeftColor: colors.primary }]}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="flask-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>COMPOSITION</Text>
            </View>
            <Text style={[styles.bulletText, { marginTop: 6, fontSize: 14, fontWeight: "600" }]}>
              {salt}
            </Text>
          </SurfaceCard>
        ) : null}

        {loadingDetails ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <>
            {usage.length ? (
              <SurfaceCard style={[styles.sectionCard, { borderLeftColor: "#2196f3" }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="medical-bag" size={18} color="#2196f3" />
                  <Text style={[styles.sectionTitle, { color: "#2196f3" }]}>USES & BENEFITS</Text>
                </View>
                <View style={{ gap: 6, marginTop: 6 }}>
                  {usage.map((item, index) => (
                    <View key={`${item}-${index}`} style={styles.bulletRow}>
                      <MaterialCommunityIcons name="check-circle-outline" size={16} color="#2196f3" style={{ marginTop: 2 }} />
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </SurfaceCard>
            ) : null}

            {sideEffects.length ? (
              <SurfaceCard style={[styles.sectionCard, { borderLeftColor: "#ff9800" }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ff9800" />
                  <Text style={[styles.sectionTitle, { color: "#ff9800" }]}>SIDE EFFECTS</Text>
                </View>
                <View style={{ gap: 6, marginTop: 6 }}>
                  {sideEffects.map((item, index) => (
                    <View key={`${item}-${index}`} style={styles.bulletRow}>
                      <MaterialCommunityIcons name="minus-circle-outline" size={16} color="#ff9800" style={{ marginTop: 2 }} />
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </SurfaceCard>
            ) : null}

            {description ? (
              <SurfaceCard style={[styles.sectionCard, { borderLeftColor: colors.outline }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="information-outline" size={18} color={colors.onSurfaceVariant} />
                  <Text style={styles.sectionTitle}>DESCRIPTION</Text>
                </View>
                <Text style={[styles.bulletText, { marginTop: 6, lineHeight: 22 }]}>
                  {description}
                </Text>
              </SurfaceCard>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLowest,
    gap: spacing.md,
  },
  heroHeader: {
    gap: 4,
  },
  title: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  price: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  wishlistBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  wishlistBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  wishlistBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  infoCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLowest,
    gap: spacing.md,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.outline,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  metaList: {
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  metaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  metaLabel: {
    color: colors.outline,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  metaValue: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.pill,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  safetyBtn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer + "20",
  },
  findBtn: {
    borderColor: "#673ab7",
    backgroundColor: "#673ab710",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  callout: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  errorCallout: {
    borderColor: colors.error,
    backgroundColor: "#fff5f5",
  },
  warningCallout: {
    borderColor: colors.error,
    backgroundColor: "#fff5f5",
  },
  safeCallout: {
    borderColor: colors.success,
    backgroundColor: "#f4fcf7",
  },
  substitutionsCard: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    padding: spacing.md,
  },
  subsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
    paddingBottom: 6,
    marginBottom: 6,
  },
  altItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  altName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  altMeta: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  altPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLowest,
    borderLeftWidth: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.onSurface,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.outline,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  substitutesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  substituteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#673ab710",
    borderWidth: 1,
    borderColor: "#673ab730",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  substituteChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#673ab7",
  },
});
