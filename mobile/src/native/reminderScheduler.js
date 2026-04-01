import { NativeModules, Platform } from "react-native";

const nativeReminderScheduler = NativeModules.ReminderScheduler;

function ensureModule() {
  if (!nativeReminderScheduler) {
    throw new Error("ReminderScheduler native module is not available.");
  }
}

export async function scheduleNativeReminder(reminder) {
  if (Platform.OS !== "android") return false;
  ensureModule();
  return nativeReminderScheduler.scheduleReminder(reminder);
}

export async function removeNativeReminder(reminderId) {
  if (Platform.OS !== "android") return false;
  ensureModule();
  return nativeReminderScheduler.removeReminder(reminderId);
}

export async function getNativeReminders() {
  if (Platform.OS !== "android" || !nativeReminderScheduler) return [];
  return nativeReminderScheduler.getReminders();
}
