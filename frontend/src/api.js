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

export const paymentApi = {
  createPayment: (data) => api.post("/api/payments/create", data),
  createRazorpayOrder: (data) => api.post("/api/payments/create-order", data),
  verifyRazorpayPayment: (data) => api.post("/api/payments/verify", data),
  confirmPayment: (data) => api.post("/api/payments/confirm", data),
  markCashPaid: (data) => api.post("/api/payments/mark-cash-paid", data),
  getDoctorSummary: (doctorId) =>
    api.get(`/api/payments/doctor/${doctorId}/summary`),
  payWithWallet: (data) => api.post("/api/payments/pay-with-wallet", data),
  getWalletBalance: () => api.get("/api/payments/wallet/balance"),
};

export const aiApi = {
  getAiPopResponse: (prompt) => api.post("/aipop", { prompt }),
};

export const doctorApi = {
  login: (data) => api.post("/auth/doctor/login", data),
  signup: (data) => api.post("/auth/doctor/signup", data),

  // 👇 Get appointments
  getDoctorAppointments: (doctorId) =>
    api.get(`/api/appointments/doctor/${doctorId}`),
  getProfile: () => api.get("/auth/doctor/profile"),
  updateProfile: (data) => api.patch("/auth/doctor/profile", data),

  // 👇 Update appointment status
  updateAppointmentStatus: (appointmentId, status) =>
    api.put(`/api/appointments/${appointmentId}/status`, { status }),

  // 👇 Upload recording
  uploadRecording: (formData) =>
    api.post("/api/recordings", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      withCredentials: true,
    }),

  // 👇 Get all recordings
  getDoctorRecordings: (doctorId) =>
    api.get(`/api/recordings/doctor/${doctorId}`),

  // 👇 Patient data access
  getPatientData: (uniqueCode) =>
    api.get(`/api/doctor/patient-data/${uniqueCode}`),
};
export default api;
