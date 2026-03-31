import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SurfaceCard, GradientButton, SecondaryButton } from "../../components/ui";

export default function MedicineDetailScreen({ route }) {
  const { medicine } = route.params;

  return (
    <ScrollView style={{ padding: 16 }}>
      <SurfaceCard>
        <Text style={{ fontSize: 22, fontWeight: "bold" }}>
          {medicine.name}
        </Text>

        <Text style={{ marginTop: 6, color: "#666" }}>
          Salt: {medicine.salt}
        </Text>

        <Text style={{ marginTop: 10, fontSize: 18 }}>
          ₹{medicine.price || 120}
        </Text>

        <GradientButton label="Buy Now" icon="cart" />
        <GradientButton label="Run Safety Check" icon="shield-check" />

        <Text style={{ marginTop: 20, fontWeight: "bold" }}>
          📊 View Price Insights
        </Text>

        <Text style={{ marginTop: 10, fontWeight: "bold" }}>
          Product Information
        </Text>

        <Text>Benefits: {medicine.benefits || "Relieves swelling and joint pain."}</Text>
        <Text>Side Effects: {medicine.sideEffects || "Nausea."}</Text>
        <Text>Usage: {medicine.usage || "Take after meals."}</Text>
        <Text>How it Works: {medicine.howItWorks || "Reduces inflammation and pain signals."}</Text>
        <Text>Safety Advice: {medicine.safety || "Use under doctor advice."}</Text>
      </SurfaceCard>
    </ScrollView>
  );
}