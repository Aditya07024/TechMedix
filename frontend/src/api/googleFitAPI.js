import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const googleFitAPI = {
  /**
   * Start Google Fit OAuth flow
   */
  startGoogleFitAuth: async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/google-fit/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to start Google Fit auth:", error);
      throw error;
    }
  },

  /**
   * Exchange authorization code for access token
   */
  handleGoogleFitCallback: async (code) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/google-fit/callback`,
        { code },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to handle Google Fit callback:", error);
      throw error;
    }
  },

  /**
   * Check if Google Fit is connected
   */
  getGoogleFitStatus: async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/google-fit/status`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get Google Fit status:", error);
      throw error;
    }
  },

  /**
   * Sync health data from Google Fit
   */
  syncGoogleFitData: async (
    startDate = null,
    endDate = null,
    useMockData = false,
  ) => {
    try {
      const payload = {};
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      if (useMockData) payload.useMockData = true;

      const response = await axios.post(
        `${API_BASE_URL}/api/google-fit/sync`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to sync Google Fit data:", error);
      throw error;
    }
  },

  /**
   * Get latest Google Fit metrics
   */
  getGoogleFitMetrics: async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/google-fit/metrics`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get Google Fit metrics:", error);
      throw error;
    }
  },

  /**
   * Get detailed Google Fit metrics summary with status info
   */
  getGoogleFitMetricsSummary: async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/google-fit/metrics/summary`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get Google Fit metrics summary:", error);
      throw error;
    }
  },

  /**
   * Get raw DB rows for today (debug)
   */
  getGoogleFitMetricsRaw: async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/google-fit/metrics/raw`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get Google Fit raw metrics:", error);
      throw error;
    }
  },

  /**
   * Disconnect Google Fit
   */
  disconnectGoogleFit: async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/google-fit/disconnect`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to disconnect Google Fit:", error);
      throw error;
    }
  },
};
