package com.techmedix.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra("reminderId") ?: return
    val title = intent.getStringExtra("title") ?: "Medicine Reminder"
    val body = intent.getStringExtra("body") ?: "Time to take your medicine."
    val hour = intent.getIntExtra("hour", 9)
    val minute = intent.getIntExtra("minute", 0)

    createChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    val contentIntent = PendingIntent.getActivity(
      context,
      reminderId.hashCode(),
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(contentIntent)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)
    } catch (_: SecurityException) {
      return
    }

    ReminderAlarmScheduler.scheduleReminder(
      context,
      ReminderItem(
        id = reminderId,
        title = title,
        body = body,
        hour = hour,
        minute = minute,
      ),
    )
    ReminderWidgetProvider.updateAllWidgets(context)
  }

  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Medicine Reminders",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Daily medicine reminder alerts"
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "medicine-reminders"
  }
}
