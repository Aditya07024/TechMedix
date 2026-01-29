import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { medicineApi } from "../../api/medicine.api";

export default function MedicineCompareScreen({ route }) {
  const { medicine } = route.params;
  const [alternatives, setAlternatives] = useState([]);

  useEffect(() => {
    medicineApi
      .search(medicine.salt)
      .then((res) => setAlternatives(res.data || []));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare Medicines</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{medicine.name}</Text>
        <Text>Price: ₹{medicine.price}</Text>
      </View>

      <Text style={styles.subtitle}>Alternatives</Text>

      {alternatives.map((m) => (
        <View key={m._id} style={styles.altCard}>
          <Text style={styles.name}>{m.name}</Text>
          <Text>₹{m.price}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  subtitle: { fontWeight: "600", marginVertical: 12 },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#ecfeff",
    marginBottom: 12,
  },
  altCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { fontWeight: "600" },
});