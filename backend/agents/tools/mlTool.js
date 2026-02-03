import axios from "axios";
import { DynamicTool } from "langchain/tools";

export const mlTool = new DynamicTool({
  name: "DiseasePredictionTool",
  description: "Predict disease based on symptoms",
  func: async (input) => {
    const { data } = await axios.post(
      "http://localhost:5001/predict-disease",
      { symptoms: JSON.parse(input) }
    );
    return JSON.stringify(data);
  },
});