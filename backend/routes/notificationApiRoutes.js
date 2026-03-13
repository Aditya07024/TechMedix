import express from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotifHandler,
} from "../controllers/notificationController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get user notifications
router.get("/user/:user_id", authenticate, getNotifications);

// Mark as read
router.post("/:notification_id/read", authenticate, markNotificationAsRead);

// Mark all as read
router.post(
  "/user/:user_id/read-all",
  authenticate,
  markAllNotificationsAsRead,
);

// Delete notification
router.delete("/:notification_id", authenticate, deleteNotifHandler);

export default router;
