import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// Get patient notifications
router.get(
  "/:patientId",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      if (String(req.user.id) !== String(patientId)) {
        return res.status(403).json({
          error: "You can only access your own notifications"
        });
      }
      const notifications = await sql`
        SELECT *
        FROM patient_notifications
        WHERE patient_id = ${patientId}
        ORDER BY created_at DESC
      `;
      res.json(notifications);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  }
);

// Mark as read
router.put(
  "/:id/read",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      if (!req.params.id) {
        return res.status(400).json({ error: "Notification id is required" });
      }
      const { id } = req.params;
      await sql`
        UPDATE patient_notifications
        SET is_read = true
        WHERE id = ${id}
      `;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  }
);
// Get unread count
router.get(
  "/:patientId/unread-count",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      if (String(req.user.id) !== String(patientId)) {
        return res.status(403).json({
          error: "You can only access your own unread count"
        });
      }
      const result = await sql`
        SELECT COUNT(*) as unread
        FROM patient_notifications
        WHERE patient_id = ${patientId}
        AND is_read = false
      `;
      res.json({
        unread_count: Number(result[0].unread)
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  }
);
// Mark all notifications as read
router.put(
  "/:patientId/read-all",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      if (String(req.user.id) !== String(patientId)) {
        return res.status(403).json({
          error: "You can only update your own notifications"
        });
      }
      await sql`
        UPDATE patient_notifications
        SET is_read = true
        WHERE patient_id = ${patientId}
      `;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  }
);
export default router;