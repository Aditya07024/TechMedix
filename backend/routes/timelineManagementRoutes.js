import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import * as timelineService from "../services/timelineService.js";
import { logAudit } from "../services/auditService.js";

const router = express.Router();

/**
 * Get full medical timeline for patient
 */
router.get("/patient/:patientId", authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify patient can only access their own timeline
    if (
      req.user.id !== patientId &&
      req.user.role !== "doctor" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Unauthorized access to timeline" });
    }

    const timeline = await timelineService.getPatientTimeline(patientId);

    // Log access
    await logAudit({
      action: "timeline_accessed",
      table_name: "patients",
      record_id: patientId,
      metadata: { accessed_by: req.user.id, accessed_by_role: req.user.role },
    });

    res.json(timeline);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get timeline by category (appointment, prescription, visit, disease, report)
 */
router.get(
  "/patient/:patientId/category/:category",
  authenticate,
  async (req, res) => {
    try {
      const { patientId, category } = req.params;

      // Verify access
      if (
        req.user.id !== patientId &&
        req.user.role !== "doctor" &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const timeline = await timelineService.getPatientTimelineByCategory(
        patientId,
        category,
      );
      res.json(timeline);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

/**
 * Get recent timeline events (last N items)
 */
router.get("/patient/:patientId/recent", authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    // Verify access
    if (
      req.user.id !== patientId &&
      req.user.role !== "doctor" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const events = await timelineService.getRecentTimelineEvents(
      patientId,
      parseInt(limit),
    );
    res.json(events);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Export timeline as PDF/CSV (admin only)
 */
router.get(
  "/patient/:patientId/export/:format",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { patientId, format } = req.params;

      if (!["pdf", "csv"].includes(format)) {
        return res.status(400).json({ error: "Format must be pdf or csv" });
      }

      const timeline = await timelineService.getPatientTimeline(patientId);

      if (format === "csv") {
        // Generate CSV
        const headers = ["Date", "Type", "Title", "Status", "Details"];
        const rows = timeline.timeline.map((item) => [
          item.date,
          item.type,
          item.title,
          item.status,
          JSON.stringify(item.details),
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="timeline_${patientId}.csv"`,
        );
        res.send(csv);
      } else {
        // PDF export would use a library like pdfkit
        res.status(501).json({ error: "PDF export not yet implemented" });
      }

      await logAudit({
        action: "timeline_exported",
        table_name: "patients",
        record_id: patientId,
        metadata: { format },
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
