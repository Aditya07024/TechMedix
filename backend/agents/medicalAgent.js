import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { mlTool } from "./tools/mlTool.js";
import { ehrTool } from "./tools/ehrTool.js";
import { medicineTool } from "./tools/medicineTool.js";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini", // safer + cheaper production model
  temperature: 0.3,
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});

export const medicalAgent = async () => {
  return await initializeAgentExecutorWithOptions(
    [mlTool, ehrTool, medicineTool],
    llm,
    {
      agentType: "openai-functions",
      verbose: true,
      maxIterations: 5,
      agentArgs: {
        systemMessage: `
You are TechMedix AI Medical Assistant.
You help with:
- Disease prediction
- EHR analysis
- Medicine information lookup
Be precise, clinical, and structured in responses.
        `,
      },
    }
  );
};