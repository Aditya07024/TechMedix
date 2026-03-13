export function registerQueueHandlers(io) {
  const queueNamespace = io.of("/queue");

  queueNamespace.on("connection", (socket) => {
    console.log(`Queue client connected: ${socket.id}`);

    // Doctor joins queue room
    socket.on("doctor-join-queue", (doctorId) => {
      socket.join(`doctor-queue-${doctorId}`);
      console.log(`Doctor ${doctorId} joined queue room`);
    });

    // Patient joins queue room
    socket.on("patient-join-queue", (appointmentId, patientId) => {
      socket.join(`appointment-${appointmentId}`);
      socket.join(`patient-${patientId}`);
      console.log(
        `Patient ${patientId} joined appointment queue ${appointmentId}`,
      );
    });

    // Doctor advances queue
    socket.on(
      "advance-queue",
      ({ doctorId, appointmentId, nextAppointmentId }) => {
        // Emit to completed patient
        io.to(`appointment-${appointmentId}`).emit("consultation-completed", {
          appointmentId,
          message: "Your consultation is complete",
        });

        // Emit to next patient
        if (nextAppointmentId) {
          io.to(`appointment-${nextAppointmentId}`).emit("your-turn", {
            appointmentId: nextAppointmentId,
            message: "Your turn! Doctor is ready",
          });
        }

        // Emit to doctor
        io.to(`doctor-queue-${doctorId}`).emit("queue-advanced", {
          doctorId,
          nextAppointmentId,
        });
      },
    );

    // Doctor marks patient in progress
    socket.on("patient-in-progress", ({ doctorId, appointmentId }) => {
      io.to(`appointment-${appointmentId}`).emit("in-consultation", {
        appointmentId,
        status: "in_progress",
      });

      io.to(`doctor-queue-${doctorId}`).emit("patient-in-progress", {
        appointmentId,
      });
    });

    // Patient arrival
    socket.on(
      "patient-arrived",
      ({ doctorId, appointmentId, position, waitTimeMinutes }) => {
        io.to(`appointment-${appointmentId}`).emit("position-update", {
          position,
          waitTimeMinutes,
          message: `You are #${position} in queue. Estimated wait: ${waitTimeMinutes} min`,
        });

        io.to(`doctor-queue-${doctorId}`).emit("patient-arrived", {
          appointmentId,
          position,
        });
      },
    );

    // Doctor delay announcement
    socket.on("doctor-delay", ({ doctorId, delayMinutes, reason }) => {
      io.to(`doctor-queue-${doctorId}`).emit("doctor-delayed", {
        delayMinutes,
        reason,
        message: `Doctor is running ${delayMinutes} minutes late${reason ? `: ${reason}` : ""}`,
      });
    });

    // Queue reset
    socket.on("queue-reset", ({ doctorId, date }) => {
      io.to(`doctor-queue-${doctorId}`).emit("queue-reset", {
        date,
        message: "Queue has been reset",
      });
    });

    socket.on("disconnect", () => {
      console.log(`Queue client disconnected: ${socket.id}`);
    });
  });
}

export function registerNotificationHandlers(io) {
  const notifNamespace = io.of("/notifications");

  notifNamespace.on("connection", (socket) => {
    console.log(`Notification client connected: ${socket.id}`);

    socket.on("subscribe-user", (userId) => {
      socket.join(`user-${userId}`);
      console.log(`Subscribed to notifications for user ${userId}`);
    });

    socket.on("subscribe-doctor", (doctorId) => {
      socket.join(`doctor-${doctorId}`);
      console.log(`Doctor ${doctorId} subscribed to notifications`);
    });

    socket.on("disconnect", () => {
      console.log(`Notification client disconnected: ${socket.id}`);
    });
  });
}

export function broadcastNotification(io, userId, notification) {
  io.of("/notifications")
    .to(`user-${userId}`)
    .emit("notification", notification);
}

export function broadcastQueueUpdate(io, doctorId, queueData) {
  io.of("/queue")
    .to(`doctor-queue-${doctorId}`)
    .emit("queue-update", queueData);
}
