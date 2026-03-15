import api from "./api";

export const analyzeXray = async ({ file, heatmap = false }) => {
  const form = new FormData();
  form.append("image", file);
  const q = heatmap ? "?heatmap=true" : "";
  return api.post(`/scan/xray/analyze${q}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getXrayHistory = async () => {
  return api.get(`/scan/xray/history`);
};
