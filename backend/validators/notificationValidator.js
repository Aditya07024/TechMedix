export function validateNotification(data) {
  const errors = [];

  if (!data.user_id || typeof data.user_id !== "string") {
    errors.push("Valid user_id required");
  }

  if (!data.type || typeof data.type !== "string") {
    errors.push("Notification type required");
  }

  const validTypes = [
    "appointment_reminder",
    "queue_update",
    "prescription_uploaded",
    "refill_reminder",
    "doctor_delay",
  ];
  if (!validTypes.includes(data.type)) {
    errors.push(`type must be one of: ${validTypes.join(", ")}`);
  }

  if (!data.message || typeof data.message !== "string") {
    errors.push("message required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
