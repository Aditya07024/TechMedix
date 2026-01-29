import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";

export default function ScanPatientScreen({ navigation }) {
  const [permission, setPermission] = useState(null);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setPermission(status === "granted")
    );
  }, []);

  if (permission === null) return <Text>Requesting camera permission</Text>;
  if (!permission) return <Text>Camera permission denied</Text>;

  return (
    <BarCodeScanner
      style={StyleSheet.absoluteFillObject}
      onBarCodeScanned={({ data }) => {
        const parsed = JSON.parse(data);
        navigation.replace("DoctorPatientView", {
          patientId: parsed.patientId,
        });
      }}
    />
  );
}