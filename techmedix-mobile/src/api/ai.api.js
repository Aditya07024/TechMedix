import api from "./index";

export const aiApi = {
  analyzeHealth: (prompt) =>
    api.post("/aipop", { prompt }),
};