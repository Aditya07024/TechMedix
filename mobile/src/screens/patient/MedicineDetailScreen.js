import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SurfaceCard, TopBar } from "../../components/ui";
import { colors, spacing, typography } from "../../theme/tokens";

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

function InfoBlock({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function MedicineDetailScreen({ navigation, route }) {
  const { medicine } = route.params;

  const name = firstDefined(medicine?.name, "Medicine");
  const price = firstDefined(medicine?.price, medicine?.mrp);
  const salt = firstDefined(
    medicine?.salt,
    medicine?.salt_composition,
    medicine?.short_composition1,
  );
  const manufacturer = firstDefined(medicine?.manufacturer_name, medicine?.manufacturer);
  const description = firstDefined(medicine?.medicine_desc, medicine?.info, medicine?.benefits);
  const usage = normalizeList(firstDefined(medicine?.uses, medicine?.usage));
  const sideEffects = normalizeList(
    firstDefined(medicine?.side_effects, medicine?.sideeffects, medicine?.sideEffects),
  );
  const substitutes = normalizeList(medicine?.substitutes);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TopBar title="Medicine Detail" showBack onBack={() => navigation.goBack()} />

      <SurfaceCard>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.meta}>{salt || "Salt not provided"}</Text>
        <Text style={styles.price}>
          {price != null && price !== "" ? `₹${price}` : "Price unavailable"}
        </Text>
      </SurfaceCard>

      <SurfaceCard tone="low">
        <InfoBlock label="Manufacturer" value={manufacturer} />
        <InfoBlock label="Type" value={medicine?.type} />
        <InfoBlock label="Pack Size" value={medicine?.pack_size_label} />
        <InfoBlock label="Category" value={medicine?.category} />
        <InfoBlock label="Description" value={description} />

        {usage.length ? (
          <View style={styles.section}>
            <Text style={styles.label}>Uses</Text>
            {usage.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.value}>
                {`\u2022 ${item}`}
              </Text>
            ))}
          </View>
        ) : null}

        {sideEffects.length ? (
          <View style={styles.section}>
            <Text style={styles.label}>Side Effects</Text>
            {sideEffects.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.value}>
                {`\u2022 ${item}`}
              </Text>
            ))}
          </View>
        ) : null}

        {substitutes.length ? (
          <View style={styles.section}>
            <Text style={styles.label}>Substitutes</Text>
            {substitutes.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.value}>
                {`\u2022 ${item}`}
              </Text>
            ))}
          </View>
        ) : null}
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.onSurface,
    fontSize: typography.h2,
    fontWeight: "800",
  },
  meta: {
    color: colors.onSurfaceVariant,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  price: {
    color: colors.primary,
    fontSize: typography.h3,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  section: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.onSurface,
    fontSize: typography.label,
    fontWeight: "700",
  },
  value: {
    color: colors.onSurfaceVariant,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
