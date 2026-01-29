import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function DoctorDashboard({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctor Dashboard</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("ScanPatient")}
      >
        <Text style={styles.buttonText}>Scan Patient QR</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={() => navigation.navigate("PatientLookup")}
      >
        <Text style={styles.buttonText}>Find Patient by ID</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 32 },
  button: {
    backgroundColor: "#0f766e",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  secondary: { backgroundColor: "#334155" },
  buttonText: { color: "#fff", fontWeight: "600" },
});