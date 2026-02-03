const limits = {
  Paracetamol: 4000,
  Ibuprofen: 2400,
};

export function checkDosage(meds) {
  return meds.filter(m =>
    limits[m.medicine_name] &&
    parseInt(m.dosage) > limits[m.medicine_name]
  ).map(m => ({
    type: "dosage",
    severity: "medium",
    medicine: m.medicine_name,
    description: "Dosage exceeds safe limit",
    recommendation: "Reduce dose"
  }));
}