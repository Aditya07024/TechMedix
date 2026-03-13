import axios from "axios";

const API_BASE = "/api/v2";

export const appointmentAPI = {
  book: (data) =>
    axios.post(`${API_BASE}/appointments`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  get: (appointmentId) =>
    axios.get(`${API_BASE}/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByDoctor: (doctorId, date) =>
    axios.get(`${API_BASE}/appointments/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByPatient: (patientId) =>
    axios.get(`${API_BASE}/appointments/patient/${patientId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  cancel: (appointmentId, reason) =>
    axios.post(
      `${API_BASE}/appointments/${appointmentId}/cancel`,
      { cancellation_reason: reason || "Cancelled by user" },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  reschedule: (appointmentId, newDate, newTime) =>
    axios.post(
      `${API_BASE}/appointments/${appointmentId}/reschedule`,
      { new_date: newDate, new_slot_time: newTime },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  updateStatus: (appointmentId, status) =>
    axios.patch(
      `${API_BASE}/appointments/${appointmentId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const prescriptionAPI = {
  create: (data) =>
    axios.post(`${API_BASE}/prescriptions`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  get: (prescriptionId) =>
    axios.get(`${API_BASE}/prescriptions/${prescriptionId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByPatient: (patientId) =>
    axios.get(`${API_BASE}/prescriptions/patient/${patientId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByDoctor: (doctorId) =>
    axios.get(`${API_BASE}/prescriptions/doctor/${doctorId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  override: (prescriptionId, reason) =>
    axios.post(
      `${API_BASE}/prescriptions/${prescriptionId}/override`,
      { override_reason: reason },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  requestRefill: (prescriptionId) =>
    axios.post(
      `${API_BASE}/prescriptions/${prescriptionId}/refill`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  complete: (prescriptionId) =>
    axios.post(
      `${API_BASE}/prescriptions/${prescriptionId}/complete`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const queueAPI = {
  getForDoctor: (doctorId, date) =>
    axios.get(`${API_BASE}/queue/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getQueue: (doctorId, date) =>
    axios.get(`${API_BASE}/queue/doctor/${doctorId}`, {
      params: { date },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getPosition: (appointmentId) =>
    axios.get(`${API_BASE}/queue/position/${appointmentId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  markArrived: (appointmentId) =>
  axios.post(
    `${API_BASE}/queue/${appointmentId}/arrived`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  startConsultation: (appointmentId) =>
  axios.post(
    `${API_BASE}/queue/${appointmentId}/in-progress`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  completeConsultation: (appointmentId) =>
  axios.post(
    `${API_BASE}/queue/${appointmentId}/completed`,
    {},
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }
  ),

  skipPatient: (appointmentId) =>
    axios.post(
      `${API_BASE}/queue/skip`,
      { appointment_id: appointmentId },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),
};

export const timelineAPI = {
  getTimeline: (patientId, type, limit) =>
    axios.get(`/api/v2/timeline/${patientId}/timeline`, {
      params: { type, limit }
    }),
};

export const notificationAPI = {
  getNotifications: (userId, isRead, limit) =>
    axios.get(`${API_BASE}/notifications`, {
      params: { user_id: userId, is_read: isRead, limit },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  getByUser: (userId, isRead = null, limit = 50) =>
    axios.get(`${API_BASE}/notifications`, {
      params: { user_id: userId, is_read: isRead, limit },
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),

  markAsRead: (notificationId) =>
    axios.post(
      `${API_BASE}/notifications/${notificationId}/read`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  markAllAsRead: (userId) =>
    axios.post(
      `${API_BASE}/notifications/read-all`,
      { user_id: userId },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
    ),

  delete: (notificationId) =>
    axios.delete(`${API_BASE}/notifications/${notificationId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
};

export const analyticsAPI = {
  getDoctorStats: (doctorId) =>
    axios.get(`${API_BASE}/analytics/doctor/${doctorId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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
