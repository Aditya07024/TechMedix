const allergyMap = {
  penicillin: ["amoxicillin", "ampicillin"],
  nsaids: ["aspirin", "ibuprofen"]
};

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

export function checkAllergies(meds = [], allergies = []) {
  const warnings = [];

  if (!Array.isArray(meds) || !Array.isArray(allergies)) {
    return warnings;
  }

  for (const med of meds) {
    const medName = normalize(med?.medicine_name);

    if (!medName) continue;

    for (const allergyRaw of allergies) {
      const allergy = normalize(allergyRaw);

      const mappedDrugs = allergyMap[allergy];
      if (!mappedDrugs) continue;

      // Partial match support (e.g., "Amoxicillin 500mg")
      const isMatch = mappedDrugs.some(drug =>
        medName.includes(normalize(drug))
      );

      if (isMatch) {
        warnings.push({
          type: "allergy",
          severity: "critical",
          medicine: med.medicine_name,
          description: `Patient allergic to ${allergy}`,
          recommendation: "DO NOT TAKE",
          confidence: 1.0
        });
      }
    }
  }

  return warnings;
}