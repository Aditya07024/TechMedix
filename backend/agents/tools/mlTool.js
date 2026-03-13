import axios from "axios";
import { DynamicTool } from "langchain/tools";

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:5001";

export const mlTool = new DynamicTool({
  name: "DiseasePredictionTool",
  description: "Predict disease based on symptoms using ML microservice",

  func: async (input) => {
    try {
      if (!input) {
        return JSON.stringify({
          status: "error",
          message: "No symptoms provided",
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(input);
      } catch {
        return JSON.stringify({
          status: "error",
          message: "Invalid JSON input",
        });
      }

      const response = await axios.post(
        `${ML_SERVICE_URL}/predict-disease`,
        { symptoms: parsed },
        { timeout: 5000 } // 5 second timeout
      );

      return JSON.stringify({
        status: "success",
        prediction: response.data,
      });

    } catch (error) {
      console.error("ML Tool error:", error.message);

      return JSON.stringify({
        status: "fallback",
        message: "Disease prediction unavailable",
      });
    }
  },
});