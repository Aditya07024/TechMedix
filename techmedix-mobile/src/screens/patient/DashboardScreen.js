import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { ehrApi } from "../../api/ehr.api";

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ehrApi.history(user.id);

      // Ensure latest record comes first
      const sorted = (res.data || []).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setRecords(sorted);
    } catch (e) {
      console.error("Failed to load EHR:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const latest = records.length > 0 ? records[0] : null;

  const handleLogout = () => {
  Alert.alert("Log out", "Are you sure?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Log out",
      style: "destructive",
      onPress: async () => {
        await logout();
      },
    },
  ]);
};

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || "Patient"}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.primary}
        onPress={() => navigation.navigate("AddEhr")}
      >
        <Text style={styles.primaryText}>Add Health Data</Text>
      </TouchableOpacity>

      {latest && (
        <TouchableOpacity
          style={[styles.primary, styles.aiButton]}
          onPress={() =>
            navigation.navigate("AiInsight", { ehr: latest.ehr })
          }
        >
          <Text style={styles.primaryText}>AI Health Insights</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.primary, { backgroundColor: "#64748b" }]}
        onPress={() => navigation.navigate("MyQR")}
      >
        <Text style={styles.primaryText}>My QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primary, { backgroundColor: "#16a34a" }]}
        onPress={() => navigation.navigate("MedicineSearch")}
      >
        <Text style={styles.primaryText}>Medicines</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primary, styles.secondaryButton]}
        onPress={() => navigation.navigate("History")}
      >
        <Text style={styles.primaryText}>Health History</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primary, styles.darkButton]}
        onPress={() => navigation.navigate("Charts")}
      >
        <Text style={styles.primaryText}>Health Charts</Text>
      </TouchableOpacity>

      {/* Recent Records */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Records</Text>

        {loading ? (
          <ActivityIndicator color="#0f766e" />
        ) : records.length === 0 ? (
          <Text style={styles.meta}>No health records yet</Text>
        ) : (
          records.slice(0, 3).map((r) => (
            <View key={r._id} style={styles.record}>
              <Text style={styles.date}>
                {r.timestamp
                  ? new Date(r.timestamp).toDateString()
                  : "—"}
              </Text>

              {r.ehr?.bloodPressure && (
                <Text>
                  BP: {r.ehr.bloodPressure.systolic}/
                  {r.ehr.bloodPressure.diastolic}
                </Text>
              )}
              {r.ehr?.glucose && (
                <Text>Glucose: {r.ehr.glucose}</Text>
              )}
              {r.ehr?.spo2 && <Text>SpO₂: {r.ehr.spo2}%</Text>}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  logout: {
    color: "#0f766e",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  meta: {
    color: "#64748b",
    marginTop: 4,
  },
  primary: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  aiButton: {
    backgroundColor: "#334155",
  },
  secondaryButton: {
    backgroundColor: "#475569",
  },
  darkButton: {
    backgroundColor: "#1e293b",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cardTitle: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#0f172a",
  },
  record: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  date: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
});