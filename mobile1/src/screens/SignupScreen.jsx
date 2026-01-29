import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api";

export default function SignupScreen({ navigation }) {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required");
      return;
    }
    setLoading(true);
    try {
      await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        age: age.trim() || undefined,
        gender: gender.trim() || undefined,
        phone: phone.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        medicalHistory: medicalHistory.trim() || undefined,
      });
      const res = await authApi.login({ email: email.trim(), password });
      const data = res.data;
      if (data?.user && data?.token) {
        await login(data.user, data.token);
        // RootNavigator switches to AppStack (Dashboard) when user is set
      } else {
        setError("Account created. Please log in.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Signup failed");
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
        <Text style={styles.title}>Sign up</Text>
        <Text style={styles.subtitle}>TechMedix</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="Name *"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Email *"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password *"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Age"
          placeholderTextColor="#94a3b8"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Gender"
          placeholderTextColor="#94a3b8"
          value={gender}
          onChangeText={setGender}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#94a3b8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Blood group"
          placeholderTextColor="#94a3b8"
          value={bloodGroup}
          onChangeText={setBloodGroup}
          editable={!loading}
        />
        <TextInput
          style={[styles.input, styles.inputArea]}
          placeholder="Medical history (optional)"
          placeholderTextColor="#94a3b8"
          value={medicalHistory}
          onChangeText={setMedicalHistory}
          multiline
          numberOfLines={2}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          disabled={loading}
        >
          <Text style={styles.link}>Already have an account? Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={loading}
          style={styles.back}
        >
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
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
  inputArea: { minHeight: 60 },
  button: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#0f766e", fontSize: 14, textAlign: "center" },
  back: { marginTop: 8 },
});
