import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { aiApi } from "../../api/ai.api";

export default function AiInsightScreen({ route }) {
  const { ehr } = route.params;
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `
You are a medical assistant.
Analyze this patient health data and give:
1. Health summary
2. Possible risks
3. Lifestyle advice
4. When to see a doctor

Health data:
${JSON.stringify(ehr, null, 2)}
      `;

      const res = await aiApi.analyzeHealth(prompt);
      setResult(res.data.response || "No response from AI");
    } catch (e) {
      setError("Failed to analyze health data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Health Insights</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={analyze}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Analyze My Health</Text>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  button: {
    backgroundColor: "#0f766e",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 12 },
  resultBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#0f172a",
  },
});