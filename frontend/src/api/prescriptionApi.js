import api from "./api"; // ✅ MUST EXIST

export const uploadPrescription = async (file, userId, patientId) => {
  const formData = new FormData();

  // MUST MATCH multer.single("file")
  formData.append("file", file);
  formData.append("userId", userId);
  formData.append("patientId", patientId);

  const res = await api.post(
    "/prescription/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
};

export const getPrescriptionDetails = async (prescriptionId) => {
  const res = await api.get(`/prescription/${prescriptionId}/details`);
  return res.data;
};
