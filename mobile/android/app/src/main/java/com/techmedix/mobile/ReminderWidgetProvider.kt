package com.techmedix.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ReminderWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { appWidgetId ->
      appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context))
    }
  }

  companion object {
    fun updateAllWidgets(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, ReminderWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isNotEmpty()) {
        ids.forEach { manager.updateAppWidget(it, buildRemoteViews(context)) }
      }
    }

    private fun buildRemoteViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.reminder_widget)
      val reminders = ReminderStore.loadReminders(context).sortedWith(compareBy({ it.hour }, { it.minute }))
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return views
      val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      if (reminders.isEmpty()) {
        views.setTextViewText(R.id.widget_subtitle, "No reminders scheduled")
        views.setTextViewText(R.id.widget_line_one, "Tap to open TechMedix")
        views.setTextViewText(R.id.widget_line_two, "Create reminders from the app")
        views.setTextViewText(R.id.widget_line_three, "")
        return views
      }

      views.setTextViewText(R.id.widget_subtitle, "Today's medicine plan")
      views.setTextViewText(R.id.widget_line_one, formatReminder(reminders.getOrNull(0)))
      views.setTextViewText(R.id.widget_line_two, formatReminder(reminders.getOrNull(1)))
      views.setTextViewText(R.id.widget_line_three, formatReminder(reminders.getOrNull(2)))
      return views
    }

    private fun formatReminder(reminder: ReminderItem?): String {
      if (reminder == null) return ""
      val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, reminder.hour)
        set(Calendar.MINUTE, reminder.minute)
      }
      val time = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(calendar.time)
      return "$time  ${reminder.body.removePrefix("Time to take ").trim()}"
    }
  }
}
