import api from "./index";

export const ehrApi = {
  save: (data) => api.post("/api/patientdata", data),
  history: (patientId) => api.get(`/api/patientdata/${patientId}`),
};