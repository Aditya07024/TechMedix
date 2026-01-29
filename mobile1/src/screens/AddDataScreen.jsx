import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { patientDataApi } from "../api";

const fields = [
  { key: "systolic", label: "Systolic (mmHg)" },
  { key: "diastolic", label: "Diastolic (mmHg)" },
  { key: "heartRate", label: "Heart rate (bpm)" },
  { key: "glucose", label: "Glucose (mg/dL)" },
  { key: "cholesterol", label: "Cholesterol (mg/dL)" },
  { key: "temperature", label: "Temperature (°C)" },
  { key: "weight", label: "Weight (kg)" },
  { key: "bmi", label: "BMI" },
  { key: "spo2", label: "SpO₂ (%)" },
  { key: "sleep", label: "Sleep (hrs)" },
  { key: "steps", label: "Steps/day" },
];

const initialForm = {};
fields.forEach((f) => {
  initialForm[f.key] = "";
});

export default function AddDataScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
const num = (v) => (v === "" ? undefined : Number(v));

  const handleSubmit = async () => {
    if (!user?.id || !user?.email) {
      setError("Please log in again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const ehr = {
  bloodPressure: {
    systolic: num(form.systolic),
    diastolic: num(form.diastolic),
  },
  heartRate: num(form.heartRate),
  glucose: num(form.glucose),
  cholesterol: num(form.cholesterol),
  temperature: num(form.temperature),
  spo2: num(form.spo2),
  bmi: num(form.bmi),
  weight: num(form.weight),
  sleep: num(form.sleep),
  steps: num(form.steps),
};
      await patientDataApi.saveEHR({
        patientId: user.id,
        email: user.email,
        symptoms: {},
        ehr,
        medicines: [],
        prescription: [],
      });
      Alert.alert("Success", "Health data saved.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Add health data</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {fields.map(({ key, label }) => (
          <TextInput
            key={key}
            style={styles.input}
            placeholder={label}
            placeholderTextColor="#94a3b8"
            value={form[key]}
            onChangeText={(v) => update(key, v)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        ))}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancel}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 20,
  },
  error: { color: "#dc2626", marginBottom: 12, fontSize: 14 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancel: { alignItems: "center" },
  cancelText: { color: "#64748b", fontSize: 14 },
});
