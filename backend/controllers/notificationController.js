import {
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../services/notificationService.js";

export async function getNotifications(req, res) {
  try {
    const { user_id } = req.params;
    const { is_read, limit = 50 } = req.query;

    if (req.user?.id !== user_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const notifications = await getNotificationsByUser(user_id, is_read, limit);
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const { notification_id } = req.params;

    const result = await markAsRead(notification_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function markAllNotificationsAsRead(req, res) {
  try {
    const { user_id } = req.params;

    if (req.user?.id !== user_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const result = await markAllAsRead(user_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function deleteNotifHandler(req, res) {
  try {
    const { notification_id } = req.params;

    const result = await deleteNotification(notification_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
