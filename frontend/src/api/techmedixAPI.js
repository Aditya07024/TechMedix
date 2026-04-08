import axios from "axios";
import { API_BASE_URL } from "../utils/apiBase";

const API_BASE = "/api/v2";
const apiClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  withCredentials: true,
  timeout: 8000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const getStoredUserRole = () => {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return null;

    return JSON.parse(rawUser)?.role || null;
  } catch (error) {
    console.error("Failed to read stored user role:", error);
    return null;
  }
};

const normalizeNotificationResponse = (response, transform = (items) => items) => {
  const rawItems = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.data?.data)
      ? response.data.data
      : [];

  return {
    ...response,
    data: {
      ...(response?.data && typeof response.data === "object" ? response.data : {}),
      success: true,
      data: transform(rawItems),
    },
  };
};

export const appointmentAPI = {
  book: (data) =>
    apiClient.post(`${API_BASE}/appointments`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  get: (appointmentId) =>
    apiClient.get(`${API_BASE}/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByDoctor: (doctorId, date) =>
    apiClient.get(`${API_BASE}/appointments/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByPatient: (patientId) =>
    apiClient.get(`${API_BASE}/appointments/patient/${patientId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  cancel: (appointmentId, reason) =>
    apiClient.post(
      `${API_BASE}/appointments/${appointmentId}/cancel`,
      { cancellation_reason: reason || "Cancelled by user" },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  reschedule: (appointmentId, newDate, newTime) =>
    apiClient.post(
      `${API_BASE}/appointments/${appointmentId}/reschedule`,
      { new_date: newDate, new_slot_time: newTime },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  updateStatus: (appointmentId, status) =>
    apiClient.patch(
      `${API_BASE}/appointments/${appointmentId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const prescriptionAPI = {
  create: (data) =>
    apiClient.post(`${API_BASE}/prescriptions`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  get: (prescriptionId) =>
    apiClient.get(`${API_BASE}/prescriptions/${prescriptionId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByPatient: (patientId) =>
    apiClient.get(`${API_BASE}/prescriptions/patient/${patientId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByDoctor: (doctorId) =>
    apiClient.get(`${API_BASE}/prescriptions/doctor/${doctorId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  override: (prescriptionId, reason) =>
    apiClient.post(
      `${API_BASE}/prescriptions/${prescriptionId}/override`,
      { override_reason: reason },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  requestRefill: (prescriptionId) =>
    apiClient.post(
      `${API_BASE}/prescriptions/${prescriptionId}/refill`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  complete: (prescriptionId) =>
    apiClient.post(
      `${API_BASE}/prescriptions/${prescriptionId}/complete`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const queueAPI = {
  getForDoctor: (doctorId, date) =>
    apiClient.get(`${API_BASE}/queue/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getQueue: (doctorId, date) =>
    apiClient.get(`${API_BASE}/queue/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getPosition: (appointmentId) =>
    apiClient.get(`${API_BASE}/queue/position/${appointmentId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  markArrived: (appointmentId) =>
  apiClient.post(
    `${API_BASE}/queue/${appointmentId}/arrived`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  startConsultation: (appointmentId) =>
  apiClient.post(
    `${API_BASE}/queue/${appointmentId}/in-progress`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  completeConsultation: (appointmentId) =>
  apiClient.post(
    `${API_BASE}/queue/${appointmentId}/completed`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  skipPatient: (appointmentId) =>
    apiClient.post(
      `${API_BASE}/queue/skip`,
      { appointment_id: appointmentId },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const timelineAPI = {
  getTimeline: (patientId, type, limit) =>
    apiClient.get(`/api/v2/timeline/${patientId}/timeline`, {
      params: { type, limit }
    }),
};

export const notificationAPI = {
  getNotifications: (userId, isRead, limit) =>
    notificationAPI.getByUser(userId, isRead, limit),

  getByUser: async (userId, isRead = null, limit = 50) => {
    const userRole = getStoredUserRole();

    if (userRole === "patient") {
      const response = await apiClient.get(`/api/patient-notifications/${userId}`, {
        headers: authHeaders(),
      });

      return normalizeNotificationResponse(response, (items) => {
        let nextItems = items;

        if (isRead !== null) {
          const expectedRead = isRead === "true" || isRead === true;
          nextItems = nextItems.filter(
            (notification) => Boolean(notification?.is_read) === expectedRead,
          );
        }

        return nextItems.slice(0, Number(limit) || 50);
      });
    }

    return apiClient.get(`${API_BASE}/notifications/user/${userId}`, {
      params: { is_read: isRead, limit },
      headers: authHeaders(),
    });
  },

  markAsRead: (notificationId) =>
    getStoredUserRole() === "patient"
      ? apiClient.put(
          `/api/patient-notifications/${notificationId}/read`,
          {},
          { headers: authHeaders() },
        )
      : apiClient.post(
          `${API_BASE}/notifications/${notificationId}/read`,
          {},
          { headers: authHeaders() },
        ),

  markAllAsRead: (userId) =>
    getStoredUserRole() === "patient"
      ? apiClient.put(
          `/api/patient-notifications/${userId}/read-all`,
          {},
          { headers: authHeaders() },
        )
      : apiClient.post(
          `${API_BASE}/notifications/user/${userId}/read-all`,
          {},
          { headers: authHeaders() },
        ),

  delete: (notificationId) =>
    apiClient.delete(`${API_BASE}/notifications/${notificationId}`, {
      headers: authHeaders(),
    }),
};

export const analyticsAPI = {
  getDoctorStats: (doctorId) =>
    apiClient
      .get(`/api/analytics/doctor/${doctorId}/dashboard`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
        const r = res.data || {};
        const normalized = {
          patients_today: Number(r?.today?.appointments || 0),
          avg_consultation_time: Number(r?.this_week?.avg_consultation_minutes || 0),
          completion_rate: Number(r?.today?.conversion_rate || 0),
          no_show_rate: Number(r?.today?.no_show_rate || 0),
        };
        return { data: { data: normalized } };
      }),

  getSystemStats: () =>
    axios.get(`${API_BASE}/analytics/system`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getRevenueReport: (startDate, endDate) =>
    axios.get(`${API_BASE}/analytics/revenue`, {
      params: { start_date: startDate, end_date: endDate },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};

export const scheduleAPI = {
  getAvailableDates: (doctorId, days = 30) =>
    axios.get(`${API_BASE}/schedule/doctor/${doctorId}/available-dates`, {
      params: { days },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getAvailableSlots: (doctorId, date, duration = 30) =>
    axios.get(`${API_BASE}/schedule/doctor/${doctorId}/available-slots`, {
      params: { date, duration },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getDoctorSchedule: (doctorId) =>
    axios.get(`${API_BASE}/schedule/doctor/${doctorId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  setSchedule: (doctorId, scheduleData) =>
    axios.post(`${API_BASE}/schedule/doctor/${doctorId}`, scheduleData, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};

export const adminAPI = {
  getBranches: () =>
    axios.get(`${API_BASE}/admin/branches`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getPayments: (limit, offset) =>
    axios.get(`${API_BASE}/admin/payments`, {
      params: { limit, offset },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getUsers: (role, limit, offset) =>
    axios.get(`${API_BASE}/admin/users`, {
      params: { role, limit, offset },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};
