package com.techmedix.mobile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

class ReminderSchedulerModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ReminderScheduler"

  @ReactMethod
  fun scheduleReminder(reminderMap: ReadableMap, promise: Promise) {
    try {
      val reminder = ReminderItem(
        id = reminderMap.getString("id")
          ?: throw IllegalArgumentException("Reminder id is required"),
        title = reminderMap.getString("title") ?: "Medicine Reminder",
        body = reminderMap.getString("body") ?: "Time to take your medicine.",
        hour = reminderMap.getInt("hour"),
        minute = reminderMap.getInt("minute"),
        enabled = true,
      )

      ReminderStore.upsertReminder(reactApplicationContext, reminder)
      ReminderAlarmScheduler.scheduleReminder(reactApplicationContext, reminder)
      ReminderWidgetProvider.updateAllWidgets(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("REMINDER_SCHEDULE_ERROR", error)
    }
  }

  @ReactMethod
  fun removeReminder(reminderId: String, promise: Promise) {
    try {
      ReminderAlarmScheduler.cancelReminder(reactApplicationContext, reminderId)
      ReminderStore.removeReminder(reactApplicationContext, reminderId)
      ReminderWidgetProvider.updateAllWidgets(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("REMINDER_REMOVE_ERROR", error)
    }
  }

  @ReactMethod
  fun getReminders(promise: Promise) {
    try {
      val items = Arguments.createArray()
      ReminderStore.loadReminders(reactApplicationContext).forEach { reminder ->
        items.pushMap(Arguments.createMap().apply {
          putString("id", reminder.id)
          putString("title", reminder.title)
          putString("body", reminder.body)
          putInt("hour", reminder.hour)
          putInt("minute", reminder.minute)
          putBoolean("enabled", reminder.enabled)
        })
      }
      promise.resolve(items)
    } catch (error: Exception) {
      promise.reject("REMINDER_FETCH_ERROR", error)
    }
  }

  @ReactMethod
  fun syncReminders(reminderArray: ReadableArray, promise: Promise) {
    try {
      val existing = ReminderStore.loadReminders(reactApplicationContext)
      existing.forEach { ReminderAlarmScheduler.cancelReminder(reactApplicationContext, it.id) }

      val reminders = mutableListOf<ReminderItem>()
      for (index in 0 until reminderArray.size()) {
        val reminderMap = reminderArray.getMap(index) ?: continue
        val reminder = ReminderItem(
          id = reminderMap.getString("id") ?: continue,
          title = reminderMap.getString("title") ?: "Medicine Reminder",
          body = reminderMap.getString("body") ?: "Time to take your medicine.",
          hour = reminderMap.getInt("hour"),
          minute = reminderMap.getInt("minute"),
          enabled = reminderMap.getBoolean("enabled"),
        )
        if (reminder.enabled) {
          reminders.add(reminder)
          ReminderAlarmScheduler.scheduleReminder(reactApplicationContext, reminder)
        }
      }

      ReminderStore.saveReminders(reactApplicationContext, reminders)
      ReminderWidgetProvider.updateAllWidgets(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("REMINDER_SYNC_ERROR", error)
    }
  }
}
