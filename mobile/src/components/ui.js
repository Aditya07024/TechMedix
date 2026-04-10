import React from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/tokens";

const cardShadowStyle =
  Platform.OS === "web"
    ? {
        boxShadow: `0px 16px 24px ${colors.shadow}`,
      }
    : {
        shadowColor: colors.shadow,
        shadowOpacity: 1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
        elevation: 2,
      };

export function ScreenScroll({
  children,
  contentContainerStyle,
  safe = true,
  ...scrollProps
}) {
  const Container = safe ? SafeAreaView : View;
  return (
    <Container style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </Container>
  );
}

export function TopBar({
  title = "TechMedix",
  avatar = "TM",
  subtitle,
  showBack = false,
  onBack,
  onBell,
  brandOnly = false,
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topLeft}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : (
          <Image
            source={require("../../assets/icon.png")}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
            }}
            resizeMode="cover"
          />
        )}
        <View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.topTitle}>{title}</Text>
        </View>
      </View>
      {brandOnly ? null : (
        <TouchableOpacity onPress={onBell} style={styles.iconButton}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function AvatarBubble({ label, size = 42, tone = "default" }) {
  const background =
    tone === "secondary" ? colors.secondaryContainer : colors.surfaceHighest;
  const textColor =
    tone === "secondary" ? colors.onSecondaryContainer : colors.primary;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
    >
      <Text style={[styles.avatarText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ eyebrow, title, description, actionLabel, onActionPress }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {actionLabel ? (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SurfaceCard({ children, style, tone = "lowest" }) {
  const backgroundColor =
    tone === "low" ? colors.surfaceLow : tone === "high" ? colors.surfaceHigh : colors.surfaceLowest;

  return <View style={[styles.card, { backgroundColor }, style]}>{children}</View>;
}

export function Pill({ label, tone = "default" }) {
  const toneMap = {
    default: [colors.surfaceHigh, colors.primary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.tertiary],
    info: [colors.secondaryContainer, colors.onSecondaryContainer],
  };
  const [backgroundColor, color] = toneMap[tone] || toneMap.default;
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function GradientButton({ label, icon, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={style}>
      <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.gradientButton}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={18} color={colors.onPrimary} />
        ) : null}
        <Text style={styles.gradientButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, icon, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.secondaryButton, style]}>
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={colors.primary} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatCard({ label, value, subtext, style }) {
  return (
    <SurfaceCard tone="low" style={[{ flex: 1 }, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subtext ? <Text style={styles.statSubtext}>{subtext}</Text> : null}
    </SurfaceCard>
  );
}

export function ActionTile({ label, icon, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.actionTile, style]}
    >
      <View style={styles.actionIconWrap}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SearchField({ placeholder }) {
  return (
    <View style={styles.searchWrap}>
      <MaterialCommunityIcons name="magnify" size={20} color={colors.outline} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        style={styles.searchInput}
      />
    </View>
  );
}

export function DetailRow({ icon, label, value, bold = false }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, bold && { fontWeight: "700", color: colors.onSurface }]}>
        {value}
      </Text>
    </View>
  );
}

export function EmptyState({ title, body }) {
  return (
    <SurfaceCard tone="low" style={{ alignItems: "center" }}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(244,250,255,0.92)",
    borderRadius: radii.lg,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  topTitle: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.outline,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: typography.label,
    marginBottom: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLowest,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: typography.h1,
    fontWeight: "800",
    lineHeight: 36,
  },
  sectionDescription: {
    color: colors.onSurfaceVariant,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionAction: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  card: {
    borderRadius: radii.md,
    padding: spacing.lg,
    ...cardShadowStyle,
    gap: spacing.md,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  pillText: {
    fontSize: typography.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  gradientButton: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gradientButtonText: {
    color: colors.onPrimary,
    fontWeight: "800",
    fontSize: typography.body,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.surfaceHigh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: typography.bodySmall,
  },
  statLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
  },
  statValue: {
    color: colors.primary,
    fontSize: typography.h1,
    fontWeight: "800",
  },
  statSubtext: {
    color: colors.onSurfaceVariant,
    fontSize: typography.label,
  },
  actionTile: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
    minHeight: 112,
    flexGrow: 1,
    flexBasis: "30%",
  },
  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    textAlign: "center",
    color: colors.onSurface,
    fontSize: typography.bodySmall,
    fontWeight: "700",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: typography.body,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  detailLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
  },
  detailValue: {
    color: colors.outline,
    fontSize: typography.bodySmall,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.onSurfaceVariant,
    textAlign: "center",
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  audioPlayerCard: {
  backgroundColor: colors.surfaceHighest,
  borderRadius: radii.md,
  padding: spacing.md,
  marginTop: spacing.md,
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
},
audioPlayerControls: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: spacing.sm,
},

playButton: {
  backgroundColor: colors.primary,
  width: 50,
  height: 50,
  borderRadius: 25,
  alignItems: "center",
  justifyContent: "center",
  elevation: 4,
},
audioTextWrap: {
  marginLeft: spacing.md,
},

audioSubStatus: {
  color: colors.outline,
  fontSize: typography.label,
},

audioStatus: {
  color: colors.onSurfaceVariant,
  fontSize: typography.bodySmall,
},
});
