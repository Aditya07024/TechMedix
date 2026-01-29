import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "@techmedix_token";

// Log API URL for debugging
console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach stored token as Cookie so backend auth works (backend reads req.cookies.token)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Cookie = `token=${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Enhanced error logging for debugging
    if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
      console.error("Network Error:", {
        message: err.message,
        baseURL: API_BASE_URL,
        url: err.config?.url,
        fullURL: err.config ? `${API_BASE_URL}${err.config.url}` : "unknown",
      });
    } else {
      console.error("API Error:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }

    if (err.response?.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem("@techmedix_user");
    }
    return Promise.reject(err);
  },
);

export const setAuthToken = (token) => AsyncStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken = () => AsyncStorage.removeItem(TOKEN_KEY);

export const authApi = {
  login: (data) => api.post("/auth/login", data),
  signup: (data) => api.post("/auth/signup", data),
  logout: () => api.get("/auth/logout"),
  status: () => api.get("/auth/status"),
};

export const patientApi = {
  getPatient: (id) => api.get(`/api/patient/${id}`),
  deletePatient: (id) => api.delete(`/api/patient/${id}`),
};

export const patientDataApi = {
  saveEHR: (data) => api.post("/api/patientdata", data),
  getEHRHistory: (patientId) => api.get(`/api/patientdata/${patientId}`),
  deletePatientDataRecord: (id) => api.delete(`/api/patientdata/${id}`),
  generatePatientQR: (patientId) =>
    api.get(`/api/patient/${patientId}/generate-qr`),
};

export const aiApi = {
  getAiPopResponse: (prompt) => api.post("/aipop", { prompt }),
};

export default api;
