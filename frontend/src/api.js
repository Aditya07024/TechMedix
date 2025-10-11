import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Auth APIs
export const authApi = {
  login: (data) => api.post("/auth/login", data),
  signup: (data) => api.post("/auth/signup", data),
  logout: () => api.get("/auth/logout"),
  status: () => api.get("/auth/status"),
};

export const doctorApi = {
  login: (data) => api.post("/auth/doctor/login", data),
  signup: (data) => api.post("/auth/doctor/signup", data),
  getPatientData: (uniqueCode) =>
    api.get(`/api/doctor/patient-data/${uniqueCode}`),
};

export const medicineApi = {
  addMedicine: (data) => api.post("/new", data),
  getMedicine: (id) => api.get(`/medicines/${id}`),
  updateMedicine: (id, data) => api.put(`/medicines/${id}`, data),
  deleteMedicine: (id) => api.delete(`/medicines/${id}`),
  searchMedicines: (params) => api.get("/api/medicines/search", { params }),
  getAllMedicines: () => api.get("/allmedicines"),
};

export const reportApi = {
  uploadReport: (data) => api.post("/api/upload-report", data),
  getReport: (id) => api.get(`/api/reports/${id}`),
};

export const patientDataApi = {
  saveEHR: (data) => api.post("/api/patientdata", data),
  getEHRHistory: (patientId) => api.get(`/api/patientdata/${patientId}`),
  generatePatientQR: (patientId) =>
    api.get(`/api/patient/${patientId}/generate-qr`),
  deletePatientDataRecord: (id) => api.delete(`/api/patientdata/${id}`), // New: Delete specific patient data record
};

export const patientApi = {
  getPatient: (id) => api.get(`/api/patient/${id}`),
  deletePatient: (id) => api.delete(`/api/patient/${id}`),
};

export const aiApi = {
  getAiPopResponse: (prompt) => api.post("/aipop", { prompt }),
};

export default api;
