import React from "react";
import { View, Text } from "react-native";
import { VictoryLine, VictoryChart, VictoryTheme } from "victory-native";

export default function HealthChart({ data, title }) {
  if (!data.length) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontWeight: "600", marginBottom: 8 }}>{title}</Text>
      <VictoryChart theme={VictoryTheme.material}>
        <VictoryLine
          data={data}
          x="date"
          y="value"
          interpolation="natural"
        />
      </VictoryChart>
    </View>
  );
}