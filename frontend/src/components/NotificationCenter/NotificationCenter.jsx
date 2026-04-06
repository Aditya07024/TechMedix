import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  requestNotificationPermission,
  subscribeToNotifications,
} from "../../api/socketService";
import "./NotificationCenter.css";

export default function NotificationCenter({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const shownBrowserNotificationsRef = useRef(new Set());

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return undefined;
    }

    fetchNotifications();
    requestNotificationPermission().catch((error) => {
      console.error("Failed to request desktop notification permission", error);
    });

    const unsubscribe = subscribeToNotifications(userId, (notification) => {
      let wasInserted = false;

      setNotifications((prev) => {
        const exists = prev.some((item) => item.id === notification.id);
        if (exists) {
          return prev;
        }

        wasInserted = true;
        return [notification, ...prev];
      });

      if (wasInserted) {
        setUnreadCount((prev) => prev + 1);
        showDesktopNotification(notification);
      }
    });

    return unsubscribe;
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(
        `/api/v2/notifications/user/${userId}?is_read=false&limit=20`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setNotifications(response.data.data || []);
      setUnreadCount(response.data.data?.length || 0);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  const showDesktopNotification = (notification) => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      window.Notification.permission !== "granted"
    ) {
      return;
    }

    const notificationKey = String(
      notification?.id ??
        `${notification?.title || "notification"}-${notification?.created_at || Date.now()}`,
    );

    if (shownBrowserNotificationsRef.current.has(notificationKey)) {
      return;
    }

    shownBrowserNotificationsRef.current.add(notificationKey);

    const desktopNotification = new window.Notification(
      notification?.title || "New notification",
      {
        body: notification?.message || "You have a new update in TechMedix.",
        tag: notificationKey,
      },
    );

    desktopNotification.onclick = () => {
      window.focus();
      setShowPanel(true);
      desktopNotification.close();
    };
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `/api/v2/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(
        `/api/v2/notifications/user/${userId}/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={() => setShowPanel(!showPanel)}
      >
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {showPanel && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={markAllAsRead}>
                Mark All Read
              </button>
            )}
          </div>
          {typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification.permission !== "granted" && (
              <button
                className="desktop-notification-btn"
                onClick={() => requestNotificationPermission()}
                type="button"
              >
                Enable Desktop Alerts
              </button>
            )}

          <div className="notification-list">
            {loading ? (
              <p>Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="empty-state">No new notifications</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item notification-item-${notification.type}`}
                >
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <small>
                      {new Date(notification.created_at).toLocaleString()}
                    </small>
                  </div>
                  <button
                    className="close-btn"
                    onClick={() => markAsRead(notification.id)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
