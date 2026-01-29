import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { medicineApi } from "../../api/medicine.api";

export default function MedicineSearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await medicineApi.search(query);
      setResults(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Medicines</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Medicine name"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity style={styles.button} onPress={search}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("MedicineCompare", { medicine: item })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              ₹{item.price} · {item.type}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
  },
  button: {
    backgroundColor: "#0f766e",
    padding: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    marginBottom: 10,
  },
  name: { fontWeight: "600" },
  meta: { color: "#64748b", marginTop: 4 },
});