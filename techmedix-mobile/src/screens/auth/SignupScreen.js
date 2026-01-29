import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { authApi } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";

export default function SignupScreen() {
  const { login } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Name, email and password required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await authApi.signup(form);
      const res = await authApi.login({
        email: form.email,
        password: form.password,
      });
      await login(res.data.user, res.data.token);
    } catch (e) {
      setError(e.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create account</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {[
        ["name", "Name"],
        ["email", "Email"],
        ["password", "Password"],
        ["age", "Age"],
        ["gender", "Gender"],
        ["bloodGroup", "Blood group"],
      ].map(([k, label]) => (
        <TextInput
          key={k}
          style={styles.input}
          placeholder={label}
          secureTextEntry={k === "password"}
          autoCapitalize="none"
          onChangeText={(v) => update(k, v)}
        />
      ))}

      <TouchableOpacity style={styles.button} onPress={submit}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create account</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 20 },
  error: { color: "#dc2626", marginBottom: 12 },
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