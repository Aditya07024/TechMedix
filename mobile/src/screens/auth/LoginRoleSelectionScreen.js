import React, { useMemo, useState } from "react";
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

const PATIENT_SIGNUP = {
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

const DOCTOR_SIGNUP = {
  name: "",
  email: "",
  password: "",
  specialty: "",
};

export default function LoginRoleSelectionScreen() {
  const {
    signInPatient,
    signUpPatient,
    signInDoctor,
    signUpDoctor,
  } = useAuth();

  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("login");
  const [patientLogin, setPatientLogin] = useState({ email: "", password: "" });
  const [doctorLogin, setDoctorLogin] = useState({ email: "", password: "" });
  const [patientSignup, setPatientSignup] = useState(PATIENT_SIGNUP);
  const [doctorSignup, setDoctorSignup] = useState(DOCTOR_SIGNUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPatient = role === "patient";
  const formTitle = useMemo(() => {
    if (mode === "signup") {
      return isPatient ? "Create patient account" : "Create doctor account";
    }
    return isPatient ? "Patient sign in" : "Doctor sign in";
  }, [isPatient, mode]);

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      if (isPatient && mode === "login") {
        await signInPatient(patientLogin);
      } else if (isPatient && mode === "signup") {
        await signUpPatient({
          ...patientSignup,
          age: patientSignup.age ? Number(patientSignup.age) : undefined,
        });
      } else if (!isPatient && mode === "login") {
        await signInDoctor(doctorLogin);
      } else {
        await signUpDoctor(doctorSignup);
      }
    } catch (submitError) {
      const message =
        submitError?.message ||
        "Unable to authenticate with the backend right now.";
      setError(message);
      Alert.alert("Authentication failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <TopBar title="TechMedix" brandOnly />

      <View style={styles.hero}>
        <Text style={styles.title}>Care, records, and clinical workflows in one mobile app.</Text>
        <Text style={styles.description}>
          Sign in with the same backend used by the web app. No mock role switching,
          no fake session state.
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <RolePill
          active={isPatient}
          label="Patient"
          onPress={() => {
            setRole("patient");
            setError("");
          }}
        />
        <RolePill
          active={!isPatient}
          label="Doctor"
          onPress={() => {
            setRole("doctor");
            setError("");
          }}
        />
      </View>

      <View style={styles.toggleRow}>
        <RolePill
          active={mode === "login"}
          label="Sign In"
          onPress={() => {
            setMode("login");
            setError("");
          }}
        />
        <RolePill
          active={mode === "signup"}
          label="Create Account"
          onPress={() => {
            setMode("signup");
            setError("");
          }}
        />
      </View>

      <SurfaceCard style={styles.formCard}>
        <Text style={styles.formTitle}>{formTitle}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isPatient && mode === "login" ? (
          <PatientLoginForm value={patientLogin} onChange={setPatientLogin} />
        ) : null}

        {isPatient && mode === "signup" ? (
          <PatientSignupForm value={patientSignup} onChange={setPatientSignup} />
        ) : null}

        {!isPatient && mode === "login" ? (
          <DoctorLoginForm value={doctorLogin} onChange={setDoctorLogin} />
        ) : null}

        {!isPatient && mode === "signup" ? (
          <DoctorSignupForm value={doctorSignup} onChange={setDoctorSignup} />
        ) : null}

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient colors={[colors.primary, colors.primaryContainer]} style={styles.submitButton}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitText}>
                {mode === "login" ? "Continue" : "Create and continue"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </SurfaceCard>
    </ScreenScroll>
  );
}

function RolePill({ active, label, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.rolePill, active && styles.rolePillActive]}
    >
      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>{label}</Text>
    </TouchableOpacity>
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

function PatientLoginForm({ value, onChange }) {
  return (
    <View style={styles.formBody}>
      <Field
        label="Email"
        value={value.email}
        placeholder="patient@techmedix.com"
        keyboardType="email-address"
        onChangeText={(text) => onChange({ ...value, email: text })}
      />
      <Field
        label="Password"
        value={value.password}
        placeholder="••••••••"
        secureTextEntry
        onChangeText={(text) => onChange({ ...value, password: text })}
      />
    </View>
  );
}

function PatientSignupForm({ value, onChange }) {
  return (
    <View style={styles.formBody}>
      <Field label="Full Name" value={value.name} placeholder="Sarah Johnson" onChangeText={(text) => onChange({ ...value, name: text })} />
      <Field label="Email" value={value.email} placeholder="patient@techmedix.com" keyboardType="email-address" onChangeText={(text) => onChange({ ...value, email: text })} />
      <Field label="Password" value={value.password} placeholder="Choose a secure password" secureTextEntry onChangeText={(text) => onChange({ ...value, password: text })} />
      <View style={styles.splitRow}>
        <View style={{ flex: 1 }}>
          <Field label="Age" value={value.age} placeholder="29" keyboardType="number-pad" onChangeText={(text) => onChange({ ...value, age: text })} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Gender" value={value.gender} placeholder="Female" onChangeText={(text) => onChange({ ...value, gender: text })} />
        </View>
      </View>
      <Field label="Phone" value={value.phone} placeholder="+91 98765 43210" keyboardType="phone-pad" onChangeText={(text) => onChange({ ...value, phone: text })} />
      <Field label="Blood Group" value={value.bloodGroup} placeholder="B+" onChangeText={(text) => onChange({ ...value, bloodGroup: text })} />
      <Field label="Address" value={value.address} placeholder="Street, city, state" multiline onChangeText={(text) => onChange({ ...value, address: text })} />
      <Field label="Medical History" value={value.medicalHistory} placeholder="Diabetes, allergies, previous surgeries..." multiline onChangeText={(text) => onChange({ ...value, medicalHistory: text })} />
    </View>
  );
}

function DoctorLoginForm({ value, onChange }) {
  return (
    <View style={styles.formBody}>
      <Field label="Email" value={value.email} placeholder="doctor@techmedix.com" keyboardType="email-address" onChangeText={(text) => onChange({ ...value, email: text })} />
      <Field label="Password" value={value.password} placeholder="••••••••" secureTextEntry onChangeText={(text) => onChange({ ...value, password: text })} />
    </View>
  );
}

function DoctorSignupForm({ value, onChange }) {
  return (
    <View style={styles.formBody}>
      <Field label="Full Name" value={value.name} placeholder="Dr. Aris Thorne" onChangeText={(text) => onChange({ ...value, name: text })} />
      <Field label="Email" value={value.email} placeholder="doctor@techmedix.com" keyboardType="email-address" onChangeText={(text) => onChange({ ...value, email: text })} />
      <Field label="Password" value={value.password} placeholder="Choose a secure password" secureTextEntry onChangeText={(text) => onChange({ ...value, password: text })} />
      <Field label="Specialty" value={value.specialty} placeholder="Cardiology" onChangeText={(text) => onChange({ ...value, specialty: text })} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  title: {
    color: colors.onSurface,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
  },
  description: {
    color: colors.onSurfaceVariant,
    fontSize: typography.body,
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rolePill: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHighest,
    paddingVertical: 14,
    alignItems: "center",
  },
  rolePillActive: {
    backgroundColor: colors.primary,
  },
  rolePillText: {
    color: colors.onSurface,
    fontWeight: "700",
    fontSize: typography.bodySmall,
  },
  rolePillTextActive: {
    color: colors.onPrimary,
  },
  formCard: {
    gap: spacing.lg,
  },
  formTitle: {
    color: colors.onSurface,
    fontSize: typography.h2,
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
    gap: 8,
  },
  fieldLabel: {
    color: colors.outline,
    fontSize: typography.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: typography.body,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  submitButton: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitText: {
    color: colors.onPrimary,
    fontSize: typography.title,
    fontWeight: "800",
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    lineHeight: 20,
  },
});
