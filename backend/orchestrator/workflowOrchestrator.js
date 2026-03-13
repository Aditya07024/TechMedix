import { v4 as uuid } from "uuid";

import prescriptionAgent from "../agents/prescriptionAgent.js";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import { runPriceAgent } from "../agents/priceAgent.js";
import adherenceAgent from "../agents/adherenceAgent.js";

const workflowOrchestrator = {
  async execute({ prescriptionId, userId }) {
    if (!prescriptionId) throw new Error("prescriptionId missing");
    if (!userId) throw new Error("userId missing");

    const workflowId = uuid();

    const result = {
      workflow_id: workflowId,
      prescription_id: prescriptionId,
      agents: {},
      warnings: [],
      status: "in_progress",
      started_at: new Date(),
    };

    try {
      /* ---------- AGENT 1 (Extraction) ---------- */
      result.agents.extraction = await prescriptionAgent.execute({
        prescriptionId,
        userId,
        workflowId,
      });

      /* ---- AGENT 2 & 3 PARALLEL ---- */
      const [safetyRes, priceRes] = await Promise.allSettled([
        runSafetyAgent({ prescriptionId, userId }),
        runPriceAgent({ prescriptionId }),
      ]);

      if (safetyRes.status === "fulfilled") {
        result.agents.safety = safetyRes.value;

        if (!safetyRes.value.safe_to_proceed) {
          result.warnings.push("Safety risk detected");
        }
      } else {
        result.agents.safety = null;
        result.warnings.push("Safety agent failed");
      }

      if (priceRes.status === "fulfilled") {
        result.agents.price = priceRes.value;
      } else {
        result.agents.price = null;
        result.warnings.push("Price agent failed");
      }

      /* ---------- AGENT 4 (Adherence) ---------- */
      result.agents.adherence = await adherenceAgent.execute({
        prescriptionId,
      });

      result.status = "completed";
      result.completed_at = new Date();

      return result;
    } catch (error) {
      result.status = "failed";
      result.error = error.message;
      result.completed_at = new Date();
      return result;
    }
  },
};

export default workflowOrchestrator;