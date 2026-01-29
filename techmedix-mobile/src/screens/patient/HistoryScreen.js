import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ehrApi } from "../../api/ehr.api";
import { useAuth } from "../../context/AuthContext";

export default function HistoryScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ehrApi
      .history(user.id)
      .then((res) => setRecords(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Health History</Text>

      {records.map((r) => (
        <View key={r._id} style={styles.card}>
          <Text style={styles.date}>
            {new Date(r.timestamp).toDateString()}
          </Text>

          {r.ehr?.bloodPressure && (
            <Text>
              BP: {r.ehr.bloodPressure.systolic}/
              {r.ehr.bloodPressure.diastolic}
            </Text>
          )}
          {r.ehr?.glucose && <Text>Glucose: {r.ehr.glucose}</Text>}
          {r.ehr?.weight && <Text>Weight: {r.ehr.weight} kg</Text>}
          {r.ehr?.spo2 && <Text>SpO₂: {r.ehr.spo2}%</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  date: { fontSize: 12, color: "#64748b", marginBottom: 4 },
});