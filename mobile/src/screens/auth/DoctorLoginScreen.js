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

const INITIAL_SIGNUP = {
  name: "",
  email: "",
  password: "",
  specialty: "",
};

export default function DoctorLoginScreen({ navigation }) {
  const { signInDoctor, signUpDoctor } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' or 'signup'
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState(INITIAL_SIGNUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await signInDoctor(loginForm);
      } else {
        await signUpDoctor(signupForm);
      }
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
      <TopBar title="Doctor Portal" showBack onBack={() => navigation.goBack()} brandOnly />

      <View style={styles.hero}>
        <Text style={styles.title}>Welcome Doctor</Text>
        <Text style={styles.description}>
          Access your clinical workspace, monitor live patient queues, manage schedules, and lookup medical history context.
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setMode("login");
            setError("");
          }}
          style={[styles.modePill, mode === "login" && styles.modePillActive]}
        >
          <Text style={[styles.modePillText, mode === "login" && styles.modePillTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setMode("signup");
            setError("");
          }}
          style={[styles.modePill, mode === "signup" && styles.modePillActive]}
        >
          <Text style={[styles.modePillText, mode === "signup" && styles.modePillTextActive]}>Create Account</Text>
        </TouchableOpacity>
      </View>

      <SurfaceCard style={styles.formCard}>
        <Text style={styles.formTitle}>
          {mode === "login" ? "Sign in to clinical console" : "Create doctor account"}
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {mode === "login" ? (
          <View style={styles.formBody}>
            <Field
              label="Email Address"
              value={loginForm.email}
              placeholder="doctor@techmedix.com"
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
        ) : (
          <View style={styles.formBody}>
            <Field
              label="Full Name"
              value={signupForm.name}
              placeholder="Dr. Aris Thorne"
              onChangeText={(text) => setSignupForm({ ...signupForm, name: text })}
            />
            <Field
              label="Email Address"
              value={signupForm.email}
              placeholder="doctor@techmedix.com"
              keyboardType="email-address"
              onChangeText={(text) => setSignupForm({ ...signupForm, email: text })}
            />
            <Field
              label="Password"
              value={signupForm.password}
              placeholder="Choose a secure password"
              secureTextEntry
              onChangeText={(text) => setSignupForm({ ...signupForm, password: text })}
            />
            <Field
              label="Specialty"
              value={signupForm.specialty}
              placeholder="Cardiology, Pediatrics, Dermatology..."
              onChangeText={(text) => setSignupForm({ ...signupForm, specialty: text })}
            />
          </View>
        )}

        <TouchableOpacity activeOpacity={0.92} onPress={handleSubmit} disabled={loading}>
          <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.submitBtn}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === "login" ? "Sign In" : "Register Account"}
              </Text>
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
  toggleRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modePill: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    paddingVertical: 12,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    color: colors.onSurface,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  modePillTextActive: {
    color: colors.onPrimary,
  },
  formCard: {
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
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
