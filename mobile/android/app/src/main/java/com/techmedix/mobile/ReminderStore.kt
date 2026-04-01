package com.techmedix.mobile

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class ReminderItem(
  val id: String,
  val title: String,
  val body: String,
  val hour: Int,
  val minute: Int,
  val enabled: Boolean = true,
)

object ReminderStore {
  private const val PREFS_NAME = "techmedix_reminders"
  private const val KEY_REMINDERS = "items"

  fun loadReminders(context: Context): List<ReminderItem> {
    val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_REMINDERS, "[]") ?: "[]"

    return try {
      val json = JSONArray(raw)
      List(json.length()) { index ->
        val item = json.getJSONObject(index)
        ReminderItem(
          id = item.optString("id"),
          title = item.optString("title", "Medicine Reminder"),
          body = item.optString("body", ""),
          hour = item.optInt("hour", 9),
          minute = item.optInt("minute", 0),
          enabled = item.optBoolean("enabled", true),
        )
      }.filter { it.id.isNotBlank() && it.enabled }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun saveReminders(context: Context, reminders: List<ReminderItem>) {
    val json = JSONArray()
    reminders.forEach { reminder ->
      json.put(JSONObject().apply {
        put("id", reminder.id)
        put("title", reminder.title)
        put("body", reminder.body)
        put("hour", reminder.hour)
        put("minute", reminder.minute)
        put("enabled", reminder.enabled)
      })
    }

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_REMINDERS, json.toString())
      .apply()
  }

  fun upsertReminder(context: Context, reminder: ReminderItem) {
    val current = loadReminders(context).filterNot { it.id == reminder.id }.toMutableList()
    current.add(reminder)
    saveReminders(context, current.sortedWith(compareBy({ it.hour }, { it.minute }, { it.title })))
  }

  fun removeReminder(context: Context, reminderId: String) {
    saveReminders(context, loadReminders(context).filterNot { it.id == reminderId })
  }
}
