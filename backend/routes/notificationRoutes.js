import express from "express";
import {
  getUserNotifications,
  markNotificationAsRead,
  getUnreadCount,
} from "../services/notificationService.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get all notifications
router.get("/:type/:id", authenticate, async (req, res) => {
  try {
    const { type, id } = req.params;
    // Ensure users can only access their own notifications
    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({
        error: "You can only access your own notifications"
      });
    }
    const notifications = await getUserNotifications(type, id);
    res.json(notifications);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark notification as read
router.patch("/read/:notificationId", authenticate, async (req, res) => {
  try {
    if (!req.params.notificationId) {
      return res.status(400).json({ error: "notificationId is required" });
    }
    const updated = await markNotificationAsRead(
      req.params.notificationId
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get unread count
router.get("/unread/:type/:id", authenticate, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({
        error: "You can only access your own unread count"
      });
    }
    const count = await getUnreadCount(type, id);
    res.json({ unread: count });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;