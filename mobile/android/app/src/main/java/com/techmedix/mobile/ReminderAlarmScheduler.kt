package com.techmedix.mobile

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

object ReminderAlarmScheduler {
  fun scheduleReminder(context: Context, reminder: ReminderItem) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildPendingIntent(context, reminder)
    val triggerAtMillis = nextTriggerTime(reminder.hour, reminder.minute)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAtMillis,
        pendingIntent,
      )
    } else {
      alarmManager.setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAtMillis,
        pendingIntent,
      )
    }
  }

  fun cancelReminder(context: Context, reminderId: String) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(buildPendingIntent(context, ReminderItem(reminderId, "", "", 9, 0)))
  }

  fun rescheduleAll(context: Context) {
    ReminderStore.loadReminders(context).forEach { scheduleReminder(context, it) }
  }

  private fun buildPendingIntent(context: Context, reminder: ReminderItem): PendingIntent {
    val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
      putExtra("reminderId", reminder.id)
      putExtra("title", reminder.title)
      putExtra("body", reminder.body)
      putExtra("hour", reminder.hour)
      putExtra("minute", reminder.minute)
    }

    return PendingIntent.getBroadcast(
      context,
      reminder.id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun nextTriggerTime(hour: Int, minute: Int): Long {
    val now = Calendar.getInstance()
    val next = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (before(now)) {
        add(Calendar.DAY_OF_YEAR, 1)
      }
    }
    return next.timeInMillis
  }
}
