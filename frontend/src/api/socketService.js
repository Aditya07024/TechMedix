import { io } from "socket.io-client";
import { API_BASE_URL } from "../utils/apiBase";

let queueSocket = null;
let notificationSocket = null;

export function initQueueSocket() {
  if (queueSocket) return queueSocket;

  queueSocket = io(API_BASE_URL || undefined, {
    auth: {
      token: localStorage.getItem("token"),
    },
  });

  queueSocket.on("connect", () => {
    console.log("Connected to queue namespace");
  });

  queueSocket.on("disconnect", () => {
    console.log("Disconnected from queue namespace");
  });

  return queueSocket;
}

export function initNotificationSocket() {
  if (notificationSocket) return notificationSocket;

  notificationSocket = io(`${API_BASE_URL}/notifications`, {
    auth: {
      token: localStorage.getItem("token"),
    },
  });

  notificationSocket.on("connect", () => {
    console.log("Connected to notifications namespace");
  });

  notificationSocket.on("disconnect", () => {
    console.log("Disconnected from notifications namespace");
  });

  return notificationSocket;
}

export function subscribeToQueue(doctorId, handler) {
  const socket = initQueueSocket();
  const join = () => {
    socket.emit("join-doctor-room", doctorId);
  };
  if (socket.connected) join();
  socket.on("connect", join);
  socket.on("queue-update", handler);
  return () => {
    socket.off("connect", join);
    socket.off("queue-update", handler);
  };
}

export function subscribeToPatientQueue(appointmentId, patientId, handler) {
  const socket = initQueueSocket();
  const join = () => {
    socket.emit("join-patient-room", patientId);
  };
  if (socket.connected) join();
  socket.on("connect", join);
  socket.on("queue-position-updated", handler);
  socket.on("your-turn", handler);
  socket.on("queue-joined", handler);
  return () => {
    socket.off("connect", join);
    socket.off("queue-position-updated", handler);
    socket.off("your-turn", handler);
    socket.off("queue-joined", handler);
  };
}

export function subscribeToNotifications(userId, handler) {
  const socket = initNotificationSocket();
  const join = () => {
    socket.emit("subscribe-user", userId);
  };
  if (socket.connected) join();
  socket.on("connect", join);
  socket.on("notification", handler);
  return () => {
    socket.off("connect", join);
    socket.off("notification", handler);
  };
}

export function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("unsupported");
  }

  if (window.Notification.permission !== "default") {
    return Promise.resolve(window.Notification.permission);
  }

  return window.Notification.requestPermission();
}

export function emitQueueEvent(event, data) {
  const socket = initQueueSocket();
  socket.emit(event, data);
}

export function disconnectSockets() {
  if (queueSocket) {
    queueSocket.disconnect();
    queueSocket = null;
  }
  if (notificationSocket) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }
}
