import axios from "axios";
import { API_BASE_URL } from "./utils/apiBase";

const API_URL = API_BASE_URL;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

// Auth APIs
export const authApi = {
  login: (data) => api.post("/auth/login", data),
  signup: (data) => api.post("/auth/signup", data),
  logout: () => api.get("/auth/logout"),
  status: () => api.get("/auth/status"),
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (data) => api.patch("/auth/profile", data),
  deleteProfile: () => api.delete("/auth/profile"),
  resetPatientQrCode: () => api.post("/auth/profile/reset-qr"),
  staffLogin: (data) => api.post("/auth/staff/login", data),
  staffProfile: () => api.get("/auth/staff/profile"),
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

export const healthWalletApi = {
  listDocuments: () =>
    api.get("/api/health-wallet/documents", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  uploadDocuments: (formData) =>
    api.post("/api/health-wallet/documents", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  deleteDocument: (id) =>
    api.delete(`/api/health-wallet/documents/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};

export const paymentApi = {
  createPayment: (data) => api.post("/api/payments/create", data),
  createRazorpayOrder: (data) => api.post("/api/payments/create-order", data),
  verifyRazorpayPayment: (data) => api.post("/api/payments/verify", data),
  verifyCashfreePayment: (data) => api.post("/api/payments/verify", data),
  confirmPayment: (data) => api.post("/api/payments/confirm", data),
  markCashPaid: (data) => api.post("/api/payments/mark-cash-paid", data),
  getDoctorSummary: (doctorId) =>
    api.get(`/api/payments/doctor/${doctorId}/summary`),
  getDoctorRevenueDetails: (doctorId) =>
    api.get(`/api/payments/doctor/${doctorId}/details`),
  payWithWallet: (data) => api.post("/api/payments/pay-with-wallet", data),
  getWalletBalance: () => api.get("/api/payments/wallet/balance"),
  initiateAddMoney: (data) => api.post("/api/payments/wallet/add-money", data),
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
    api.patch(`/api/v2/appointments/${appointmentId}/status`, { status }),

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
  getSharedAppointmentContext: (appointmentId) =>
    api.get(`/api/doctor/appointments/${appointmentId}/shared-context`),
  createStaff: (data) => api.post("/api/doctor/staff/create", data),
  getMyStaff: () => api.get("/api/doctor/staff"),
  getStaffRequests: () => api.get("/api/doctor/staff/requests"),
  resolveStaffRequest: (requestId, status) =>
    api.patch(`/api/doctor/staff/request/${requestId}`, { status }),
  resetStaffPassword: (staffId) =>
    api.post(`/api/doctor/staff/${staffId}/reset-password`),
  removeStaff: (staffId) => api.delete(`/api/doctor/staff/${staffId}`),
};

export const staffApi = {
  getOverview: (params = {}) => api.get("/api/staff/overview", { params }),
  getTodayAppointments: (params = {}) =>
    api.get("/api/staff/appointments/today", { params }),
  markArrived: (appointmentId) =>
    api.post(`/api/staff/appointments/${appointmentId}/arrive`),
  generateToken: (appointmentId, doctor_id = null) =>
    api.post("/api/staff/queue/token", { appointment_id: appointmentId, doctor_id }),
  getLiveQueue: (doctorId, date) =>
    api.get("/api/staff/queue/live", {
      params: { doctor_id: doctorId, date },
    }),
  updateQueueStatus: (queueId, status) =>
    api.patch(`/api/staff/queue/${queueId}/status`, { status }),
  getPatient: (patientId) => api.get(`/api/staff/patients/${patientId}`),
  updatePatient: (patientId, payload) =>
    api.patch(`/api/staff/patients/${patientId}`, payload),
  uploadReport: (formData) =>
    api.post("/api/staff/reports", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  getPatientReports: (patientId) =>
    api.get(`/api/staff/patients/${patientId}/reports`),
  notifyDoctor: (payload) => api.post("/api/staff/notify-doctor", payload),
  getActivity: (limit = 25) =>
    api.get("/api/staff/activity", { params: { limit } }),
  getPerformance: (params = {}) => api.get("/api/staff/performance", { params }),
  getDoctors: () => api.get("/api/staff/doctors"),
  requestDoctorAccess: (doctor_id) =>
    api.post("/api/staff/request-doctor", { doctor_id }),
  switchDoctor: (doctor_id) =>
    api.post("/api/staff/switch-doctor", { doctor_id }),
};

export const doctorPosterApi = {
  uploadPoster: (formData) =>
    api.post("/api/doctor-posters/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }),
  createPaySession: (data) =>
    api.post("/api/doctor-posters/pay", data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
  verifyPaySignature: (data) =>
    api.post("/api/doctor-posters/verify", data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
  getActivePosters: () => api.get("/api/doctor-posters/active"),
  getMyPosters: () =>
    api.get("/api/doctor-posters/my-posters", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
  deletePoster: (id) =>
    api.delete(`/api/doctor-posters/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};

export default api;
