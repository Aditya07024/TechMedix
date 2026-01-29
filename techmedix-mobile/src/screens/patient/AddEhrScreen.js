import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { ehrApi } from "../../api/ehr.api";

const num = (v) => (v === "" ? undefined : Number(v));

export default function AddEhrScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setLoading(true);
    try {
      await ehrApi.save({
        patientId: user.id,
        email: user.email,
        ehr: {
          bloodPressure: {
            systolic: num(form.systolic),
            diastolic: num(form.diastolic),
          },
          glucose: num(form.glucose),
          heartRate: num(form.heartRate),
          spo2: num(form.spo2),
          temperature: num(form.temperature),
          weight: num(form.weight),
        },
        symptoms: {},
        medicines: [],
      });

      Alert.alert("Saved", "Health data added", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add Health Data</Text>

      {[
        ["systolic", "Systolic BP"],
        ["diastolic", "Diastolic BP"],
        ["glucose", "Glucose"],
        ["heartRate", "Heart Rate"],
        ["spo2", "SpO₂"],
        ["temperature", "Temperature"],
        ["weight", "Weight"],
      ].map(([k, label]) => (
        <TextInput
          key={k}
          style={styles.input}
          placeholder={label}
          keyboardType="numeric"
          onChangeText={(v) => update(k, v)}
        />
      ))}

      <TouchableOpacity style={styles.button} onPress={submit}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0f766e",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});