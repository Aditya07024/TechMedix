import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const XRAY_AI_BASE = process.env.AI_XRAY_SERVICE_URL || "http://localhost:8000";

export async function analyzeChestXray({ filePath, requestHeatmap = false }) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("heatmap", String(Boolean(requestHeatmap)));

  const headers = form.getHeaders();

  try {
    const response = await axios.post(
      `${XRAY_AI_BASE}/analyze-xray`,
      form,
      {
        headers,
        timeout: 30_000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    console.log("AI Service raw response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error("AI Service error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
    throw error;
  }
}

