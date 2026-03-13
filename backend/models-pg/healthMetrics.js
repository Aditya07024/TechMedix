import sql from "../config/database.js";

/*
  HEALTH METRICS MODEL
  Stores health data synced from Android Health Connect
*/

export const createHealthMetric = async (metricData) => {
  try {
    const {
      patient_id,
      metric_type, // 'steps', 'heart_rate', 'sleep_duration', 'calories_burned', 'activity'
      value,
      unit,
      recorded_at,
      source, // 'health_connect'
      metadata, // JSON object for additional data
    } = metricData;

    const result = await sql`
      INSERT INTO health_metrics (
        patient_id,
        metric_type,
        value,
        unit,
        recorded_at,
        source,
        metadata,
        created_at
      )
      VALUES (
        ${patient_id},
        ${metric_type},
        ${value},
        ${unit},
        ${recorded_at},
        ${source || "health_connect"},
        ${JSON.stringify(metadata || {})},
        NOW()
      )
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error("Create health metric failed:", error);
    return null;
  }
};

export const getHealthMetricsByPatient = async (
  patientId,
  metricType = null,
  startDate = null,
  endDate = null,
) => {
  try {
    let query = sql`
      SELECT id, metric_type, value, unit, recorded_at, source, metadata, created_at
      FROM health_metrics
      WHERE patient_id = ${patientId}
        AND is_deleted = FALSE
    `;

    if (metricType) {
      query = sql`${query} AND metric_type = ${metricType}`;
    }

    if (startDate) {
      query = sql`${query} AND recorded_at >= ${startDate}`;
    }

    if (endDate) {
      query = sql`${query} AND recorded_at <= ${endDate}`;
    }

    query = sql`${query} ORDER BY recorded_at DESC`;

    const result = await query;
    return result;
  } catch (error) {
    console.error("Get health metrics failed:", error);
    return [];
  }
};

export const getLatestHealthMetrics = async (patientId) => {
  try {
    const result = await sql`
      SELECT DISTINCT ON (metric_type)
        id, metric_type, value, unit, recorded_at, source, metadata, created_at
      FROM health_metrics
      WHERE patient_id = ${patientId}
        AND is_deleted = FALSE
      ORDER BY metric_type, recorded_at DESC
    `;
    return result;
  } catch (error) {
    console.error("Get latest health metrics failed:", error);
    return [];
  }
};

export const getHealthMetricsSummary = async (patientId, days = 7) => {
  try {
    const result = await sql`
      SELECT
        metric_type,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as count,
        unit
      FROM health_metrics
      WHERE patient_id = ${patientId}
        AND is_deleted = FALSE
        AND recorded_at >= NOW() - INTERVAL '${days} days'
      GROUP BY metric_type, unit
    `;
    return result;
  } catch (error) {
    console.error("Get health metrics summary failed:", error);
    return [];
  }
};

export const deleteHealthMetric = async (id, patientId) => {
  try {
    const result = await sql`
      UPDATE health_metrics
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = ${id} AND patient_id = ${patientId}
      RETURNING id
    `;
    return result.length > 0;
  } catch (error) {
    console.error("Delete health metric failed:", error);
    return false;
  }
};
