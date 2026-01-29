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
import { useAuth } from "../context/AuthContext";
import { patientApi, patientDataApi } from "../api";

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ehrHistory, setEhrHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!user?.id) {
      setError("User not logged in or patient ID not found.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [patientRes, ehrRes] = await Promise.allSettled([
        patientApi.getPatient(user.id),
        patientDataApi.getEHRHistory(user.id),
      ]);
      if (patientRes.status === "fulfilled" && patientRes.value?.data) {
        setProfile(patientRes.value.data);
      }
      if (ehrRes.status === "fulfilled" && Array.isArray(ehrRes.value?.data)) {
        setEhrHistory(ehrRes.value.data);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout(); /* RootNavigator switches to AuthStack */
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = profile?.name || user?.name || "Patient";
const sortedHistory = [...ehrHistory].sort(
  (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
);
const latestRecord = sortedHistory[0];
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{displayName}</Text>
        <Text style={styles.meta}>Email: {profile?.email || user?.email}</Text>
        {profile?.age != null && (
          <Text style={styles.meta}>Age: {profile.age}</Text>
        )}
        {profile?.bloodGroup && (
          <Text style={styles.meta}>Blood: {profile.bloodGroup}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate("AddData")}
      >
        <Text style={styles.primaryButtonText}>Add health data</Text>
      </TouchableOpacity>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent records</Text>
        {ehrHistory.length === 0 ? (
          <Text style={styles.meta}>
            No health records yet. Add your first one above.
          </Text>
        ) : (
          ehrHistory.slice(0, 5).map((record) => (
            <View key={record._id || record.id} style={styles.record}>
              <Text style={styles.recordDate}>
                {record.timestamp
                  ? new Date(record.timestamp).toLocaleDateString()
                  : "—"}
              </Text>
              {record.predictedDisease && (
                <Text style={styles.recordDisease}>
                  {record.predictedDisease}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  error: { color: "#dc2626", marginBottom: 16, textAlign: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  logout: { color: "#0f766e", fontSize: 14, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  meta: { fontSize: 14, color: "#64748b", marginBottom: 4 },
  primaryButton: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  record: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recordDate: { fontSize: 14, color: "#0f172a" },
  recordDisease: { fontSize: 12, color: "#64748b" },
  button: {
    backgroundColor: "#0f766e",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
