import sql from "../config/database.js";

/**
 * Record appointment completion for analytics
 */
export async function recordAppointmentCompletion(
  appointmentId,
  doctorId,
  durationMinutes = 30,
) {
  const today = new Date().toISOString().split("T")[0];

  // Get or insert analytics record for today
  const analytics = await sql`
    INSERT INTO doctor_analytics (
      doctor_id,
      date,
      completed_appointments,
      total_patients_seen,
      avg_consultation_duration_minutes
    ) VALUES (
      ${doctorId},
      ${today},
      1,
      1,
      ${durationMinutes}
    )
    ON CONFLICT (doctor_id, date)
    DO UPDATE SET
      completed_appointments = doctor_analytics.completed_appointments + 1,
      total_patients_seen = doctor_analytics.total_patients_seen + 1,
      avg_consultation_duration_minutes = (
        (doctor_analytics.avg_consultation_duration_minutes * doctor_analytics.total_patients_seen + ${durationMinutes}) /
        (doctor_analytics.total_patients_seen + 1)
      ),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return analytics[0];
}

/**
 * Get doctor's daily analytics
 */
export async function getDoctorDailyAnalytics(doctorId, date) {
  const analytics = await sql`
    SELECT *
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date = ${date}
  `;

  if (analytics.length === 0) {
    return null;
  }

  const data = analytics[0];

  // Calculate conversion rate (booked to completed)
  const totalAppointments = await sql`
    SELECT COUNT(*) as count
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND DATE(appointment_date) = ${date}
  `;

  const conversionRate =
    totalAppointments[0]?.count > 0
      ? (
          (data.completed_appointments / totalAppointments[0].count) *
          100
        ).toFixed(2)
      : 0;

  return {
    ...data,
    conversion_rate: conversionRate,
    no_show_rate: (
      ((totalAppointments[0]?.count - data.completed_appointments) /
        totalAppointments[0]?.count) *
      100
    ).toFixed(2),
  };
}

/**
 * Get doctor's analytics for date range
 */
export async function getDoctorAnalyticsBetweenDates(
  doctorId,
  startDate,
  endDate,
) {
  const analytics = await sql`
    SELECT *
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${startDate}
      AND date <= ${endDate}
    ORDER BY date DESC
  `;

  if (analytics.length === 0) {
    return { message: "No analytics data available for this period" };
  }

  // Calculate aggregates
  const totalCompleted = analytics.reduce(
    (sum, a) => sum + (a.completed_appointments || 0),
    0,
  );
  const totalCancelled = analytics.reduce(
    (sum, a) => sum + (a.cancelled_appointments || 0),
    0,
  );
  const avgDuration = (
    analytics.reduce(
      (sum, a) => sum + (a.avg_consultation_duration_minutes || 0),
      0,
    ) / analytics.length
  ).toFixed(2);
  const totalRevenue = analytics.reduce(
    (sum, a) => sum + (a.revenue_estimated || 0),
    0,
  );

  return {
    doctor_id: doctorId,
    period: { start: startDate, end: endDate },
    summary: {
      total_completed_appointments: totalCompleted,
      total_cancelled_appointments: totalCancelled,
      avg_consultation_duration: avgDuration,
      total_revenue_estimated: totalRevenue.toFixed(2),
      daily_average: (totalCompleted / analytics.length).toFixed(2),
    },
    daily_breakdown: analytics,
  };
}

/**
 * Get doctor dashboard metrics (comprehensive)
 */
export async function getDoctorDashboardMetrics(doctorId) {
  const today = new Date().toISOString().split("T")[0];

  // Today's metrics
  const todayData = await sql`
    SELECT 
      COUNT(CASE WHEN status = 'booked' THEN 1 END) as appointments_today,
      COUNT(CASE WHEN status IN ('completed','visited') THEN 1 END) as completed_today,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND DATE(appointment_date) = ${today}
  `;

  // Upcoming appointments
  const upcomingAppointments = await sql`
    SELECT COUNT(*) as count
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND status = 'booked'
      AND appointment_date > ${today}
  `;

  // This week analytics
  const thisWeekDate = new Date();
  thisWeekDate.setDate(thisWeekDate.getDate() - 7);
  const weekStartDate = thisWeekDate.toISOString().split("T")[0];

  const weekAnalytics = await sql`
    SELECT 
      SUM(completed_appointments) as week_completed,
      SUM(cancelled_appointments) as week_cancelled,
      AVG(avg_consultation_duration_minutes) as avg_duration,
      AVG(revenue_estimated) as avg_daily_revenue
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${weekStartDate}
      AND date <= ${today}
  `;

  // This month analytics
  const monthStartDate = new Date();
  monthStartDate.setDate(1);
  const formattedMonthStart = monthStartDate.toISOString().split("T")[0];

  const monthAnalytics = await sql`
    SELECT 
      SUM(completed_appointments) as month_completed,
      SUM(revenue_estimated) as month_revenue,
      COUNT(*) as operating_days
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${formattedMonthStart}
      AND date <= ${today}
  `;

  // Patient load - peak hours
  const peakHoursData = await sql`
    SELECT 
      EXTRACT(HOUR FROM appointment_time)::INTEGER as hour,
      COUNT(*) as appointment_count
    FROM appointments
    WHERE doctor_id = ${doctorId}
      AND DATE(appointment_date) = ${today}
    GROUP BY EXTRACT(HOUR FROM appointment_time)
    ORDER BY appointment_count DESC
    LIMIT 1
  `;

  // Conversion metrics
  const conversionData = await sql`
    SELECT 
      (SELECT COUNT(*) FROM appointments WHERE doctor_id = ${doctorId} AND DATE(appointment_date) = ${today}) as total_booked,
      (SELECT COUNT(*) FROM appointments WHERE doctor_id = ${doctorId} AND DATE(appointment_date) = ${today} AND status IN ('completed','visited')) as completed,
      (SELECT COUNT(*) FROM appointments WHERE doctor_id = ${doctorId} AND DATE(appointment_date) = ${today} AND status = 'cancelled') as cancelled
  `;

  const conv = conversionData[0];
  const conversionRate =
    conv?.total_booked > 0
      ? ((conv?.completed / conv?.total_booked) * 100).toFixed(2)
      : 0;
  const noShowRate =
    conv?.total_booked > 0
      ? (
          ((conv?.total_booked - conv?.completed - conv?.cancelled) /
            conv?.total_booked) *
          100
        ).toFixed(2)
      : 0;

  return {
    doctor_id: doctorId,
    today: {
      appointments: todayData[0]?.appointments_today || 0,
      completed: todayData[0]?.completed_today || 0,
      cancelled: todayData[0]?.cancelled_today || 0,
      conversion_rate: conversionRate,
      no_show_rate: noShowRate,
    },
    upcoming: {
      next_appointments: upcomingAppointments[0]?.count || 0,
    },
    this_week: {
      completed_appointments: weekAnalytics[0]?.week_completed || 0,
      cancelled_appointments: weekAnalytics[0]?.week_cancelled || 0,
      avg_consultation_minutes: parseFloat(
        weekAnalytics[0]?.avg_duration || 0,
      ).toFixed(2),
      avg_daily_revenue: parseFloat(
        weekAnalytics[0]?.avg_daily_revenue || 0,
      ).toFixed(2),
    },
    this_month: {
      completed_appointments: monthAnalytics[0]?.month_completed || 0,
      total_revenue: parseFloat(monthAnalytics[0]?.month_revenue || 0).toFixed(
        2,
      ),
      operating_days: monthAnalytics[0]?.operating_days || 0,
      avg_per_day:
        monthAnalytics[0]?.operating_days > 0
          ? (
              (monthAnalytics[0]?.month_completed || 0) /
              monthAnalytics[0]?.operating_days
            ).toFixed(2)
          : 0,
    },
    peak_hour: {
      hour: peakHoursData[0]?.hour || "N/A",
      appointments: peakHoursData[0]?.appointment_count || 0,
    },
  };
}

/**
 * Get doctor's revenue metrics
 */
export async function getDoctorRevenueMetrics(doctorId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const formattedStart = startDate.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const revenue = await sql`
    SELECT 
      SUM(revenue_estimated) as total_revenue,
      AVG(revenue_estimated) as avg_daily_revenue,
      MAX(revenue_estimated) as best_day_revenue,
      COUNT(*) as days_with_data,
      STDDEV_POP(revenue_estimated) as revenue_variance
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${formattedStart}
      AND date <= ${today}
      AND revenue_estimated > 0
  `;

  const dailyRevenue = await sql`
    SELECT date, revenue_estimated
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${formattedStart}
      AND date <= ${today}
    ORDER BY date DESC
  `;

  return {
    doctor_id: doctorId,
    period_days: days,
    summary: {
      total_revenue: parseFloat(revenue[0]?.total_revenue || 0).toFixed(2),
      avg_daily_revenue: parseFloat(revenue[0]?.avg_daily_revenue || 0).toFixed(
        2,
      ),
      best_day_revenue: parseFloat(revenue[0]?.best_day_revenue || 0).toFixed(
        2,
      ),
      variance: parseFloat(revenue[0]?.revenue_variance || 0).toFixed(2),
    },
    daily_breakdown: dailyRevenue,
  };
}

/**
 * Update appointment cancellation in analytics
 */
export async function recordAppointmentCancellation(appointmentId, doctorId) {
  const appointment = await sql`
    SELECT appointment_date
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  if (!appointment || appointment.length === 0) {
    throw new Error("Appointment not found");
  }

  const appointmentDate = appointment[0].appointment_date;
  const dateStr = new Date(appointmentDate).toISOString().split("T")[0];

  await sql`
    INSERT INTO doctor_analytics (
      doctor_id,
      date,
      cancelled_appointments
    ) VALUES (
      ${doctorId},
      ${dateStr},
      1
    )
    ON CONFLICT (doctor_id, date)
    DO UPDATE SET
      cancelled_appointments = doctor_analytics.cancelled_appointments + 1,
      updated_at = CURRENT_TIMESTAMP
  `;
}

/**
 * Get comparative metrics vs peer average
 */
export async function getDoctorComparativeAnalytics(doctorId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const formattedStart = startDate.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // Doctor's metrics
  const doctorMetrics = await sql`
    SELECT 
      AVG(completed_appointments) as avg_completed,
      AVG(avg_consultation_duration_minutes) as avg_duration,
      AVG(revenue_estimated) as avg_revenue
    FROM doctor_analytics
    WHERE doctor_id = ${doctorId}
      AND date >= ${formattedStart}
      AND date <= ${today}
  `;

  // Peer average (all doctors)
  const peerMetrics = await sql`
    SELECT 
      AVG(completed_appointments) as avg_completed,
      AVG(avg_consultation_duration_minutes) as avg_duration,
      AVG(revenue_estimated) as avg_revenue
    FROM doctor_analytics
    WHERE date >= ${formattedStart}
      AND date <= ${today}
  `;

  const doc = doctorMetrics[0];
  const peer = peerMetrics[0];

  return {
    doctor_id: doctorId,
    period_days: days,
    doctor: {
      avg_completed_daily: parseFloat(doc?.avg_completed || 0).toFixed(2),
      avg_duration_minutes: parseFloat(doc?.avg_duration || 0).toFixed(2),
      avg_daily_revenue: parseFloat(doc?.avg_revenue || 0).toFixed(2),
    },
    peer_average: {
      avg_completed_daily: parseFloat(peer?.avg_completed || 0).toFixed(2),
      avg_duration_minutes: parseFloat(peer?.avg_duration || 0).toFixed(2),
      avg_daily_revenue: parseFloat(peer?.avg_revenue || 0).toFixed(2),
    },
    performance: {
      completion_performance:
        doc && peer
          ? ((doc.avg_completed / peer.avg_completed) * 100).toFixed(2) + "%"
          : "N/A",
      duration_efficiency:
        doc && peer
          ? ((peer.avg_duration / doc.avg_duration) * 100).toFixed(2) +
            "% (lower is better)"
          : "N/A",
      revenue_performance:
        doc && peer
          ? ((doc.avg_revenue / peer.avg_revenue) * 100).toFixed(2) + "%"
          : "N/A",
    },
  };
}
