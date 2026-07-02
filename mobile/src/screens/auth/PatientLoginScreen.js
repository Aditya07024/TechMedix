import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenScroll, SurfaceCard, TopBar } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing, typography } from "../../theme/tokens";

const INITIAL_SIGNUP = {
  name: "",
  email: "",
  password: "",
  age: "",
  gender: "",
  phone: "",
  address: "",
  bloodGroup: "",
  medicalHistory: "",
};

export default function PatientLoginScreen({ navigation }) {
  const { signInPatient, signUpPatient } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' or 'signup'
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState(INITIAL_SIGNUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemoPatientLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const demoCredentials = {
        email: "demo@gmail.com",
        password: "1234589",
      };
      
      try {
        await signInPatient(demoCredentials);
      } catch (loginErr) {
        try {
          await signUpPatient({
            name: "Demo Patient",
            email: "demo@gmail.com",
            password: "1234589",
            age: 28,
            gender: "Male",
            phone: "9999999999",
            bloodGroup: "B+",
            address: "TechMedix Demo Street 10",
            medicalHistory: "No major medical history",
          });
        } catch (signupErr) {
          // Ignore signup error if already registered
        }
        await signInPatient(demoCredentials);
      }
    } catch (err) {
      const msg = err?.message || "Demo patient login failed.";
      setError(msg);
      Alert.alert("Demo Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await signInPatient(loginForm);
      } else {
        await signUpPatient({
          ...signupForm,
          age: signupForm.age ? Number(signupForm.age) : undefined,
        });
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
      <TopBar title="Patient Portal" showBack onBack={() => navigation.goBack()} brandOnly />

      <View style={styles.hero}>
        <Text style={styles.title}>Welcome Patient</Text>
        <Text style={styles.description}>
          Access your digital health profile, track active doctor queues, check medicine reminders, and view clinical timeline records.
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
          {mode === "login" ? "Sign in to your account" : "Create new patient profile"}
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {mode === "login" ? (
          <View style={styles.formBody}>
            <Field
              label="Email Address"
              value={loginForm.email}
              placeholder="patient@techmedix.com"
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
              placeholder="Sarah Johnson"
              onChangeText={(text) => setSignupForm({ ...signupForm, name: text })}
            />
            <Field
              label="Email Address"
              value={signupForm.email}
              placeholder="sarah@example.com"
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
            <View style={styles.splitRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Age"
                  value={signupForm.age}
                  placeholder="28"
                  keyboardType="number-pad"
                  onChangeText={(text) => setSignupForm({ ...signupForm, age: text })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Gender"
                  value={signupForm.gender}
                  placeholder="Female"
                  onChangeText={(text) => setSignupForm({ ...signupForm, gender: text })}
                />
              </View>
            </View>
            <Field
              label="Phone Number"
              value={signupForm.phone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              onChangeText={(text) => setSignupForm({ ...signupForm, phone: text })}
            />
            <Field
              label="Blood Group"
              value={signupForm.bloodGroup}
              placeholder="O+"
              onChangeText={(text) => setSignupForm({ ...signupForm, bloodGroup: text })}
            />
            <Field
              label="Address"
              value={signupForm.address}
              placeholder="Street name, City, State"
              multiline
              onChangeText={(text) => setSignupForm({ ...signupForm, address: text })}
            />
            <Field
              label="Medical History / Allergies"
              value={signupForm.medicalHistory}
              placeholder="Allergies, chronic conditions..."
              multiline
              onChangeText={(text) => setSignupForm({ ...signupForm, medicalHistory: text })}
            />
          </View>
        )}

        <TouchableOpacity activeOpacity={0.92} onPress={handleSubmit} disabled={loading}>
          <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.submitBtn}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === "login" ? "Sign In" : "Register Profile"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {mode === "login" && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleDemoPatientLogin}
            disabled={loading}
            style={styles.demoBtn}
          >
            <Text style={styles.demoBtnText}>Demo Patient Login</Text>
          </TouchableOpacity>
        )}
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
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.pill,
    padding: 4,
    alignItems: "center",
  },
  modePill: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: "transparent",
    paddingVertical: 12,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.surfaceLowest,
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
  modePillText: {
    color: colors.onSurfaceVariant,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  modePillTextActive: {
    color: colors.primary,
  },
  formCard: {
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
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
  formTitle: {
    color: colors.onSurface,
    fontSize: typography.title,
    fontWeight: "800",
  },
  formBody: {
    gap: spacing.md,
  },
  splitRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.onSurfaceVariant,
    fontSize: typography.label,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: typography.bodySmall + 1,
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
  demoBtn: {
    backgroundColor: colors.surfaceLow,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  demoBtnText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: "800",
  },
});
