let authToken = null;
const DEPLOYED_API_URL = "https://techmedix-backend.onrender.com";

function trimSlash(value = "") {
  return String(value).replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const envUrl = trimSlash(process.env.EXPO_PUBLIC_API_URL);
  if (envUrl) return envUrl;

  return DEPLOYED_API_URL;
}

export function toAbsoluteUrl(value) {
  if (!value || typeof value !== "string") return value;
  if (/^(https?:|data:|file:)/i.test(value)) return value;
  return `${getApiBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`;
}

export function setAuthToken(token) {
  authToken = token || null;
}

function buildUrl(path, query) {
  const url = new URL(`${getApiBaseUrl()}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers,
    auth = true,
    query,
    raw = false,
  } = options;

  const requestHeaders = {
    Accept: "application/json",
    ...(headers || {}),
  };

  if (auth && authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (body && !isFormData && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: requestHeaders,
    body:
      body == null
        ? undefined
        : isFormData
        ? body
        : requestHeaders["Content-Type"] === "application/json"
        ? JSON.stringify(body)
        : body,
  });

  if (raw) return response;

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      payload?.errors?.join?.(", ") ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function getMultipartMetadata(asset, fallbackType = "application/octet-stream") {
  if (!asset) {
    throw new Error("Missing file URI");
  }

  const type =
    asset.file?.type ||
    asset.mimeType ||
    (typeof asset.type === "string" && asset.type.includes("/") ? asset.type : null) ||
    fallbackType;
  const name = asset.name || asset.file?.name || asset.fileName || `upload-${Date.now()}`;

  return { name, type };
}

async function appendMultipartField(formData, fieldName, asset, fallbackType = "application/octet-stream") {
  const { name, type } = getMultipartMetadata(asset, fallbackType);

  const browserFile = asset?.file;
  if (
    browserFile &&
    ((typeof File !== "undefined" && browserFile instanceof File) ||
      (typeof Blob !== "undefined" && browserFile instanceof Blob))
  ) {
    formData.append(fieldName, browserFile, browserFile.name || name);
    return;
  }

  if (
    (typeof File !== "undefined" && asset instanceof File) ||
    (typeof Blob !== "undefined" && asset instanceof Blob)
  ) {
    formData.append(fieldName, asset, asset.name || name);
    return;
  }

  if (typeof window !== "undefined" && typeof fetch === "function") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, name);
    return;
  }

  formData.append(fieldName, {
    uri: asset.uri,
    name,
    type,
  });
}

export const api = {
  auth: {
    patientLogin: (payload) =>
      apiRequest("/auth/login", { method: "POST", body: payload, auth: false }),
    patientSignup: (payload) =>
      apiRequest("/auth/signup", { method: "POST", body: payload, auth: false }),
    doctorLogin: (payload) =>
      apiRequest("/auth/doctor/login", {
        method: "POST",
        body: payload,
        auth: false,
      }),
    doctorSignup: (payload) =>
      apiRequest("/auth/doctor/signup", {
        method: "POST",
        body: payload,
        auth: false,
      }),
    status: () => apiRequest("/auth/status"),
    doctorProfile: () => apiRequest("/auth/doctor/profile"),
    updateDoctorProfile: (payload) =>
      apiRequest("/auth/doctor/profile", { method: "PATCH", body: payload }),
    logout: () => apiRequest("/auth/logout"),
  },

  patients: {
    getProfile: (patientId) => apiRequest(`/api/patient/${patientId}`),
    getQr: (patientId) => apiRequest(`/api/patient/${patientId}/generate-qr`),
    getEhrHistory: (patientId) => apiRequest(`/api/patientdata/${patientId}`),
  },

  doctors: {
    list: () => apiRequest("/api/admin/doctors", { auth: false }),
    getPatientByCode: (uniqueCode) =>
      apiRequest(`/api/doctor/patient-data/${encodeURIComponent(uniqueCode)}`),
    getDashboard: () => apiRequest("/api/doctor/dashboard"),
    getAnalytics: () => apiRequest("/api/doctor/analytics"),
  },

  appointments: {
    book: (payload) =>
      apiRequest("/api/v2/appointments", { method: "POST", body: payload }),
    get: (appointmentId) => apiRequest(`/api/v2/appointments/${appointmentId}`),
    getByPatient: (patientId) =>
      apiRequest(`/api/v2/appointments/patient/${patientId}`),
    getByDoctor: (doctorId, date) =>
      apiRequest(`/api/v2/appointments/doctor/${doctorId}`, {
        query: date ? { date } : undefined,
      }),
    cancel: (appointmentId, reason) =>
      apiRequest(`/api/v2/appointments/${appointmentId}/cancel`, {
        method: "POST",
        body: { cancellation_reason: reason || "Cancelled by user" },
      }),
    updateStatus: (appointmentId, status) =>
      apiRequest(`/api/v2/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: { status },
      }),
  },

  schedule: {
    getAvailableDates: (doctorId, days = 14) =>
      apiRequest(`/api/v2/schedule/doctor/${doctorId}/available-dates`, {
        query: { days },
      }),
    getAvailableSlots: (doctorId, date, duration = 30) =>
      apiRequest(`/api/v2/schedule/doctor/${doctorId}/available-slots`, {
        query: { date, duration },
      }),
    getDoctorSchedule: (doctorId) =>
      apiRequest(`/api/v2/schedule/doctor/${doctorId}`),
    setDoctorSchedule: (doctorId, payload) =>
      apiRequest(`/api/v2/schedule/doctor/${doctorId}`, {
        method: "POST",
        body: payload,
      }),
  },

  payments: {
    getWalletBalance: () => apiRequest("/api/payments/wallet/balance"),
    createPayment: (payload) =>
      apiRequest("/api/payments/create", { method: "POST", body: payload }),
    payWithWallet: (appointmentId) =>
      apiRequest("/api/payments/pay-with-wallet", {
        method: "POST",
        body: { appointment_id: appointmentId },
      }),
    markCashPaid: (paymentId) =>
      apiRequest("/api/payments/mark-cash-paid", {
        method: "POST",
        body: { payment_id: paymentId },
      }),
    getDoctorSummary: (doctorId) =>
      apiRequest(`/api/payments/doctor/${doctorId}/summary`),
  },

  prescriptions: {
    upload: async ({ file, userId, patientId }) => {
      const formData = new FormData();
      await appendMultipartField(formData, "file", file);
      formData.append("userId", String(userId));
      formData.append("patientId", String(patientId || userId));
      return apiRequest("/api/prescription/upload", {
        method: "POST",
        body: formData,
      });
    },
    getDetails: (prescriptionId) =>
      apiRequest(`/api/prescription/${prescriptionId}/details`),
    listByPatient: (patientId) =>
      apiRequest(`/api/prescriptions/patient/${patientId}`),
    createManual: (payload) =>
      apiRequest("/api/prescriptions/manual", {
        method: "POST",
        body: payload,
      }),
    safetyCheck: (prescriptionId, candidateMedicine) =>
      apiRequest(`/api/prescriptions/${prescriptionId}/safety-check`, {
        method: "POST",
        body: { candidate_medicine: candidateMedicine },
      }),
    safetyCheckLatest: (candidateMedicine, patientId) =>
      apiRequest("/api/prescriptions/safety-check-latest", {
        method: "POST",
        body: { candidate_medicine: candidateMedicine, patientId },
      }),
    priceCheck: (prescriptionId) =>
      apiRequest(`/api/prescriptions/${prescriptionId}/price-check`, {
        method: "POST",
      }),
  },

  medicines: {
    search: (query) =>
      apiRequest("/api/medicines/search", {
        auth: false,
        query: { q: query },
      }),
    getPriceInsights: (name) =>
      apiRequest(`/api/medicines/${encodeURIComponent(name)}/price-insights`, {
        auth: false,
      }),
  },

  queue: {
    getPosition: (appointmentId) =>
      apiRequest(`/api/v2/queue/position/${appointmentId}`),
    markArrived: (appointmentId) =>
      apiRequest(`/api/v2/queue/${appointmentId}/arrived`, {
        method: "POST",
      }),
    getForDoctor: (doctorId, date) =>
      apiRequest(`/api/v2/queue/doctor/${doctorId}`, {
        query: { date },
      }),
    startConsultation: (appointmentId) =>
      apiRequest(`/api/v2/queue/${appointmentId}/in-progress`, {
        method: "POST",
      }),
    completeConsultation: (appointmentId) =>
      apiRequest(`/api/v2/queue/${appointmentId}/completed`, {
        method: "POST",
      }),
    skipPatient: (appointmentId) =>
      apiRequest(`/api/v2/queue/${appointmentId}/skip`, {
        method: "POST",
      }),
  },

  wallet: {
    listDocuments: () => apiRequest("/api/health-wallet/documents"),
    uploadDocuments: async (documents) => {
      const formData = new FormData();
      for (const asset of documents) {
        await appendMultipartField(
          formData,
          "documents",
          asset,
          asset.mimeType || "application/octet-stream",
        );
      }
      return apiRequest("/api/health-wallet/documents", {
        method: "POST",
        body: formData,
      });
    },
    deleteDocument: (documentId) =>
      apiRequest(`/api/health-wallet/documents/${documentId}`, {
        method: "DELETE",
      }),
  },

  timeline: {
    getPatientTimeline: (patientId) =>
      apiRequest(`/api/v2/timeline/${patientId}/timeline`),
  },

  notifications: {
    list: (userId) => apiRequest(`/api/v2/notifications/user/${userId}`),
    markRead: (notificationId) =>
      apiRequest(`/api/v2/notifications/${notificationId}/read`, {
        method: "POST",
      }),
    markAllRead: (userId) =>
      apiRequest(`/api/v2/notifications/user/${userId}/read-all`, {
        method: "POST",
      }),
    remove: (notificationId) =>
      apiRequest(`/api/v2/notifications/${notificationId}`, {
        method: "DELETE",
      }),
  },

  health: {
    latest: () => apiRequest("/api/health/latest"),
    summary: (days = 7) => apiRequest("/api/health/summary", { query: { days } }),
    insights: () => apiRequest("/api/health/insights"),
    chat: (messages) =>
      apiRequest("/api/health-chat", {
        method: "POST",
        body: {
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content || message.text || "",
          })),
        },
      }),
  },

  googleFit: {
    start: () =>
      apiRequest("/auth/google-fit/start", { method: "POST", body: {} }),
    status: () => apiRequest("/api/google-fit/status"),
    sync: (payload = {}) =>
      apiRequest("/api/google-fit/sync", { method: "POST", body: payload }),
    summary: () => apiRequest("/api/google-fit/metrics/summary"),
    metrics: () => apiRequest("/api/google-fit/metrics"),
    disconnect: () =>
      apiRequest("/api/google-fit/disconnect", { method: "POST", body: {} }),
  },

  xray: {
    analyze: async (asset, heatmap = false) => {
      const formData = new FormData();
      await appendMultipartField(formData, "image", asset, asset.mimeType || "image/jpeg");
      return apiRequest(`/api/scan/xray/analyze${heatmap ? "?heatmap=true" : ""}`, {
        method: "POST",
        body: formData,
      });
    },
    history: () => apiRequest("/api/scan/xray/history"),
  },

  recordings: {
    listForPatient: (patientId) =>
      apiRequest(`/api/recordings/patient/${patientId}`),
    listForDoctor: (doctorId) =>
      apiRequest(`/api/recordings/doctor/${doctorId}`),
    upload: async ({ audio, appointmentId, patientId }) => {
      const formData = new FormData();
      await appendMultipartField(formData, "audio", audio, audio.mimeType || "audio/mpeg");
      formData.append("patient_id", String(patientId));
      if (appointmentId) {
        formData.append("appointment_id", String(appointmentId));
      }
      return apiRequest("/api/recordings", {
        method: "POST",
        body: formData,
      });
    },
  },
};
