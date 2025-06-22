export const medicineData = [
  // ...existing csv data converted to array of objects...
];

export const getMedicineByName = (name) => {
  return medicineData.find(
    (med) => med.name.toLowerCase() === name.toLowerCase()
  );
};

export const searchMedicines = (query) => {
  const searchTerm = query.toLowerCase();
  return medicineData.filter(
    (med) =>
      med.name.toLowerCase().includes(searchTerm) ||
      med.salt_composition?.toLowerCase().includes(searchTerm)
  );
};

export const getMedicineById = (id) => {
  return medicineData.find((med) => med.id === id);
};
