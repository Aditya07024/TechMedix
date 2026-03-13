const limits = {
  paracetamol: 4000, // mg per day
  ibuprofen: 2400,   // mg per day
};

function normalize(name) {
  return (name || "").toString().trim().toLowerCase();
}

function extractMg(dosage) {
  if (!dosage) return null;

  // Supports formats like "500mg", "500 mg", "650 MG"
  const match = dosage.toString().match(/(\d+)\s*mg/i);
  if (!match) return null;

  return parseInt(match[1], 10);
}

export function checkDosage(meds = []) {
  if (!Array.isArray(meds)) return [];

  const warnings = [];

  for (const med of meds) {
    const name = normalize(med?.medicine_name);
    const limit = limits[name];

    if (!limit) continue;

    const doseMg = extractMg(med?.dosage);
    if (!doseMg) continue;

    if (doseMg > limit) {
      warnings.push({
        type: "dosage",
        severity: doseMg > limit * 1.5 ? "high" : "medium",
        medicine: med.medicine_name,
        description: `Prescribed dose (${doseMg}mg) exceeds recommended daily limit (${limit}mg).`,
        recommendation: "Consult doctor before continuing.",
        confidence: 1.0
      });
    }
  }

  return warnings;
}