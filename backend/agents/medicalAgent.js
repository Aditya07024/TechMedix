import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { mlTool } from "./tools/mlTool.js";
import { ehrTool } from "./tools/ehrTool.js";

const llm = new ChatOpenAI({
  temperature: 0.3,
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});

export const medicalAgent = async () => {
  return await initializeAgentExecutorWithOptions(
    [mlTool, ehrTool],
    llm,
    {
      agentType: "openai-functions",
      verbose: true,
    }
  );
};