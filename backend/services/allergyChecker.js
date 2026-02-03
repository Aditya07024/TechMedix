const allergyMap = {
  penicillin: ["Amoxicillin", "Ampicillin"],
  nsaids: ["Aspirin", "Ibuprofen"]
};

export function checkAllergies(meds, allergies) {
  const warnings = [];

  for (const med of meds) {
    for (const allergy of allergies) {
      if (allergyMap[allergy]?.includes(med.medicine_name)) {
        warnings.push({
          type: "allergy",
          severity: "critical",
          medicine: med.medicine_name,
          description: `Patient allergic to ${allergy}`,
          recommendation: "DO NOT TAKE"
        });
      }
    }
  }
  return warnings;
}