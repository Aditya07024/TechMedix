import { DynamicTool } from "langchain/tools";

export const ehrTool = new DynamicTool({
  name: "EHRAnalyzer",
  description: "Analyze vitals and generate medical advice",
  func: async (input) => {
    const ehr = JSON.parse(input);

    let warnings = [];
    if (ehr.glucose > 140) warnings.push("High glucose level");
    if (ehr.spo2 < 92) warnings.push("Low oxygen saturation");

    return warnings.length
      ? warnings.join(", ")
      : "Vitals appear normal";
  },
});