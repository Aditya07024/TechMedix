import React, { useEffect, useState } from "react";
import { ScrollView, Text, StyleSheet, ActivityIndicator } from "react-native";
import { ehrApi } from "../../api/ehr.api";

export default function DoctorPatientView({ route }) {
  const { patientId } = route.params;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ehrApi
      .history(patientId)
      .then((res) => setRecords(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Patient Health Records</Text>

      {records.map((r) => (
        <Text key={r._id} style={styles.record}>
          {new Date(r.timestamp).toDateString()} | Glucose:{" "}
          {r.ehr?.glucose || "—"} | SpO₂: {r.ehr?.spo2 || "—"}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  record: { marginBottom: 8 },
});