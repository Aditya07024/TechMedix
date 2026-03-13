import { io } from "socket.io-client";

let queueSocket = null;
let notificationSocket = null;

export function initQueueSocket() {
  if (queueSocket) return queueSocket;

  queueSocket = io(`/queue`, {
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

  notificationSocket = io(`/notifications`, {
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
  socket.emit("doctor-join-queue", doctorId);
  socket.on("queue-update", handler);
  return () => socket.off("queue-update", handler);
}

export function subscribeToPatientQueue(appointmentId, patientId, handler) {
  const socket = initQueueSocket();
  socket.emit("patient-join-queue", appointmentId, patientId);
  socket.on("position-update", handler);
  socket.on("your-turn", handler);
  socket.on("in-consultation", handler);
  return () => {
    socket.off("position-update", handler);
    socket.off("your-turn", handler);
    socket.off("in-consultation", handler);
  };
}

export function subscribeToNotifications(userId, handler) {
  const socket = initNotificationSocket();
  socket.emit("subscribe-user", userId);
  socket.on("notification", handler);
  return () => socket.off("notification", handler);
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
