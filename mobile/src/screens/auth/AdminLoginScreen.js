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

export default function AdminLoginScreen({ navigation }) {
  const { signInAdmin } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!loginForm.email.trim() || !loginForm.password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInAdmin(loginForm);
    } catch (err) {
      const msg = err?.message || "Failed to authenticate. Please check your credentials.";
      setError(msg);
      Alert.alert("Authentication Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAdminLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInAdmin({
        email: "admintech@gmail.com",
        password: "1234567890",
      });
    } catch (err) {
      const msg = err?.message || "Failed to authenticate demo admin.";
      setError(msg);
      Alert.alert("Authentication Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <TopBar title="Admin Portal" showBack onBack={() => navigation.goBack()} brandOnly />

      <View style={styles.hero}>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.description}>
          Secure admin access for TechMedix management. Enter your admin credentials to access the system status console, payouts dashboard, and branches control panel.
        </Text>
      </View>

      <SurfaceCard style={styles.formCard}>
        <Text style={styles.formTitle}>Administrator Sign In</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.formBody}>
          <Field
            label="Email Address"
            value={loginForm.email}
            placeholder="admintech@gmail.com"
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

        <TouchableOpacity activeOpacity={0.92} onPress={handleSubmit} disabled={loading} style={{ marginTop: spacing.xs }}>
          <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.submitBtn}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>Sign In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDemoAdminLogin}
          disabled={loading}
          style={styles.demoBtn}
        >
          <Text style={styles.demoBtnText}>Use Demo Admin Credentials</Text>
        </TouchableOpacity>
      </SurfaceCard>
    </ScreenScroll>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
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
  submitBtn: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: "800",
  },
  demoBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    backgroundColor: colors.surfaceLow,
  },
  demoBtnText: {
    color: colors.primary,
    fontSize: typography.bodySmall,
    fontWeight: "700",
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 18,
  },
});
