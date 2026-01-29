import React from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../context/AuthContext";

export default function QrCodeScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Health QR Code</Text>
      <Text style={styles.subtitle}>
        Show this to a doctor to share your records
      </Text>

      <QRCode
        value={JSON.stringify({ patientId: user.id })}
        size={220}
      />

      <Text style={styles.code}>Patient ID: {user.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 24,
  },
  code: {
    marginTop: 16,
    fontSize: 12,
    color: "#64748b",
  },
});