let socketServer = null;

export function setSocketServer(io) {
  socketServer = io;
}

export function getSocketServer() {
  return socketServer;
}

export function emitUserNotification(userId, notification) {
  if (!socketServer || !userId || !notification) {
    return;
  }

  socketServer
    .of("/notifications")
    .to(`user-${userId}`)
    .emit("notification", notification);
}
