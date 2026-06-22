import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenScroll, SurfaceCard, TopBar } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing, typography } from "../../theme/tokens";

export default function StaffLoginScreen({ navigation }) {
  const { signInStaff } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await signInStaff(loginForm);
    } catch (err) {
      const msg = err?.message || "Failed to authenticate. Please check your credentials.";
      setError(msg);
      Alert.alert("Authentication Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <TopBar title="Staff Portal" showBack onBack={() => navigation.goBack()} brandOnly />

      <View style={styles.hero}>
        <Text style={styles.title}>Welcome Staff</Text>
        <Text style={styles.description}>
          Access your clinical workspace console. Coordinate patient queues, verify appointments, issue token numbers, and notify active doctors.
        </Text>
      </View>

      <SurfaceCard style={styles.formCard}>
        <Text style={styles.formTitle}>Sign in to clinic workspace</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.formBody}>
          <Field
            label="Email Address"
            value={loginForm.email}
            placeholder="staff@techmedix.com"
            keyboardType="email-address"
            onChangeText={(text) => setLoginForm({ ...loginForm, email: text })}
          />
          <Field
            label="Password"
            value={loginForm.password}
            placeholder="••••••••"
            secureTextEntry
            onChangeText={(text) => setLoginForm({ ...loginForm, password: text })}
          />
        </View>

        <TouchableOpacity activeOpacity={0.92} onPress={handleSubmit} disabled={loading}>
          <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.submitBtn}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>Sign In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </SurfaceCard>
    </ScreenScroll>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, multiline = false, keyboardType = "default" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.onSurface,
    fontSize: 30,
    fontWeight: "800",
  },
  description: {
    color: colors.onSurfaceVariant,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
  formCard: {
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginTop: spacing.md,
  },
  formTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "800",
  },
  formBody: {
    gap: spacing.md,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.outline,
    fontSize: typography.label,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: typography.bodySmall + 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitBtn: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  submitBtnText: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: "800",
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 18,
  },
});
