import { v4 as uuid } from "uuid";

import prescriptionAgent from "../agents/prescriptionAgent.js";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import { runPriceAgent } from "../agents/priceAgent.js";
import adherenceAgent from "../agents/adherenceAgent.js";

const workflowOrchestrator = {
  async execute({ prescriptionId, userId }) {
    const workflowId = uuid();

    const result = {
      workflow_id: workflowId,
      prescription_id: prescriptionId,
      agents: {},
      warnings: [],
      status: "in_progress",
    };

    /* ---------- AGENT 1 ---------- */
    result.agents.extraction = await prescriptionAgent.execute({
      prescriptionId,
      userId,
      workflowId,
    });

    /* ---- AGENT 2 & 3 PARALLEL ---- */
    const [safetyRes, priceRes] = await Promise.allSettled([
      runSafetyAgent({ prescriptionId }),
      runPriceAgent({ prescriptionId }),
    ]);

    result.agents.safety =
      safetyRes.status === "fulfilled" ? safetyRes.value : null;

    result.agents.price =
      priceRes.status === "fulfilled" ? priceRes.value : null;

    /* ---------- AGENT 4 ---------- */
    result.agents.adherence = await adherenceAgent.execute({
      prescriptionId,
    });

    result.status = "completed";
    return result;
  },
};

export default workflowOrchestrator;