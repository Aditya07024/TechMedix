export default [
  {
    medicine_a: "Paracetamol",
    medicine_b: "Aspirin",
    interaction_type: "synergistic",
    severity: "high",
    description: "Increased bleeding risk",
    mechanism: "Additive antiplatelet effects",
    recommendation: "Avoid concurrent use or consult doctor",
    source: "FDA"
  },
  {
    medicine_a: "Warfarin",
    medicine_b: "Ibuprofen",
    severity: "critical",
    description: "Severe bleeding risk",
    mechanism: "Platelet inhibition + anticoagulation",
    recommendation: "DO NOT COMBINE",
    source: "NIH"
  },
  {
    medicine_a: "Metformin",
    medicine_b: "Alcohol",
    severity: "high",
    description: "Lactic acidosis risk",
    mechanism: "Inhibited gluconeogenesis",
    recommendation: "Avoid alcohol",
    source: "CDC"
  }
  // add 50+
];