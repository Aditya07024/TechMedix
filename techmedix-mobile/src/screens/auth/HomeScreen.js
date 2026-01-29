import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TechMedix</Text>
      <Text style={styles.subtitle}>Your health, simplified</Text>

      <TouchableOpacity
        style={styles.primary}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.primaryText}>Log in</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondary}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={styles.secondaryText}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f766e",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    color: "#e5f9f6",
    marginBottom: 48,
  },
  primary: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    color: "#0f766e",
    fontSize: 16,
    fontWeight: "600",
  },
  secondary: {
    borderWidth: 2,
    borderColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
  },
  secondaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});