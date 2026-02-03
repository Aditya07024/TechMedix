import express from "express";
import { runSafetyAgent } from "../agents/safetyAgent.js";

const router = express.Router();

router.post("/:id/analyze", async (req, res) => {
  try {
    const report = await runSafetyAgent({
      prescriptionId: req.params.id,
      userId: req.user.id
    });

    res.json({
      message: "Safety analysis completed",
      report
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Safety analysis failed" });
  }
});

export default router;