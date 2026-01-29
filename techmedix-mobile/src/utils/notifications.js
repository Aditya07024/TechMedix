import * as Notifications from "expo-notifications";

export async function scheduleMedicineReminder(time, medicineName) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Medicine Reminder 💊",
      body: `Time to take ${medicineName}`,
    },
    trigger: time,
  });
}