import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as notificationService from "../services/smartNotificationService.js";

const router = express.Router();

/**
 * Get notifications for authenticated user
 */
router.get("/my-notifications", authenticate, async (req, res) => {
  try {
    const { limit = 20, unreadOnly = false } = req.query;

    const notifications = await notificationService.getUserNotifications(
      req.user.id,
      parseInt(limit),
      unreadOnly === "true",
    );

    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get notification statistics
 */
router.get("/stats", authenticate, async (req, res) => {
  try {
    const stats = await notificationService.getUserNotificationStats(
      req.user.id,
    );

    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Mark notification as read
 */
router.put("/:notificationId/read", authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await notificationService.markNotificationAsRead(
      notificationId,
      req.user.id,
    );

    res.json({ success: true, notification });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Mark all notifications as read
 */
router.put("/mark-all-as-read", authenticate, async (req, res) => {
  try {
    const result = await notificationService.markAllNotificationsAsRead(
      req.user.id,
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Delete notification
 */
router.delete("/:notificationId", authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await notificationService.deleteNotification(
      notificationId,
      req.user.id,
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get notification by category (type)
 */
router.get("/type/:type", authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 20 } = req.query;

    const notifications = await sql`
      SELECT *
      FROM notifications
      WHERE user_id = ${req.user.id}
        AND type = ${type}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `;

    res.json({
      type,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get unread count
 */
router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ${req.user.id}
        AND is_read = false
    `;

    res.json({
      unread_count: result[0]?.count || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
