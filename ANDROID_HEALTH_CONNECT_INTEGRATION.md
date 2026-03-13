# Android Health Connect Integration for TechMedix

## Overview

This document provides a complete implementation guide for integrating Android Health Connect into the TechMedix healthcare platform. The integration enables automatic synchronization of patient health data from Android devices to the TechMedix backend.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Android App   │    │  Health Connect  │    │   TechMedix     │    │   PostgreSQL    │
│                 │    │                  │    │   Backend API   │    │   Database      │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Permission   │ │    │ │Health Records│ │    │ │Health Routes│ │    │ │health_metrics│ │
│ │Request      │◄┼────┼►│              │◄┼────┼►│             │◄┼────┼►│table         │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │    │                 │
│ ┌─────────────┐ │    │                  │    │ ┌─────────────┐ │    │                 │
│ │Data Sync    │─┼────┼─►                │    │ │AI Insights  │─┼────┼─►               │
│ │Service      │ │    │                  │    │ │Service      │ │    │                 │
│ └─────────────┘ │    │                  │    │ └─────────────┘ │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow

1. **Permission Request**: Android app requests Health Connect permissions
2. **Data Reading**: App reads health records from Health Connect
3. **API Sync**: Health data sent to TechMedix backend via REST API
4. **Storage**: Data stored in PostgreSQL health_metrics table
5. **AI Processing**: AI service generates personalized health insights
6. **Dashboard Display**: Health metrics and insights shown in patient dashboard

## Android App Implementation

### 1. Dependencies

Add to `app/build.gradle`:

```gradle
dependencies {
    implementation 'androidx.health.connect:connect-client:1.1.0-alpha11'
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
}
```

### 2. Health Connect Permissions

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
```

### 3. Health Connect Manager

```kotlin
class HealthConnectManager(private val context: Context) {

    private val healthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    suspend fun checkAvailability(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    suspend fun requestPermissions(): Boolean {
        val permissions = setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        )

        val granted = healthConnectClient.getGrantedPermissions(permissions)
        if (granted.containsAll(permissions)) {
            return true
        }

        // Launch permission request
        // Implementation depends on your UI framework
        return false
    }

    suspend fun readHealthData(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val metrics = mutableListOf<HealthMetric>()

        // Read Steps
        val stepsRequest = ReadRecordsRequest(
            recordType = StepsRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        val stepsResponse = healthConnectClient.readRecords(stepsRequest)
        stepsResponse.records.forEach { record ->
            metrics.add(HealthMetric(
                metricType = "steps",
                value = record.count.toDouble(),
                unit = "count",
                recordedAt = record.startTime.toString(),
                metadata = mapOf("endTime" to record.endTime.toString())
            ))
        }

        // Read Heart Rate
        val heartRateRequest = ReadRecordsRequest(
            recordType = HeartRateRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        val heartRateResponse = healthConnectClient.readRecords(heartRateRequest)
        heartRateResponse.records.forEach { record ->
            record.samples.forEach { sample ->
                metrics.add(HealthMetric(
                    metricType = "heart_rate",
                    value = sample.beatsPerMinute.toDouble(),
                    unit = "bpm",
                    recordedAt = sample.time.toString()
                ))
            }
        }

        // Read Sleep
        val sleepRequest = ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        val sleepResponse = healthConnectClient.readRecords(sleepRequest)
        sleepResponse.records.forEach { record ->
            val durationHours = Duration.between(record.startTime, record.endTime).toHours().toDouble()
            metrics.add(HealthMetric(
                metricType = "sleep_duration",
                value = durationHours,
                unit = "hours",
                recordedAt = record.startTime.toString(),
                metadata = mapOf("endTime" to record.endTime.toString())
            ))
        }

        // Read Calories
        val caloriesRequest = ReadRecordsRequest(
            recordType = ActiveCaloriesBurnedRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        val caloriesResponse = healthConnectClient.readRecords(caloriesRequest)
        caloriesResponse.records.forEach { record ->
            metrics.add(HealthMetric(
                metricType = "calories_burned",
                value = record.energy.inKilocalories.toDouble(),
                unit = "kcal",
                recordedAt = record.startTime.toString(),
                metadata = mapOf("endTime" to record.endTime.toString())
            ))
        }

        return metrics
    }
}
```

### 4. API Service

```kotlin
interface TechMedixApiService {
    @POST("/api/health/sync")
    suspend fun syncHealthData(@Body request: HealthSyncRequest): HealthSyncResponse
}

data class HealthSyncRequest(
    val metrics: List<HealthMetric>
)

data class HealthMetric(
    val metric_type: String,
    val value: Double,
    val unit: String,
    val recorded_at: String,
    val metadata: Map<String, Any>? = null
)

data class HealthSyncResponse(
    val success: Int,
    val errors: Int,
    val data: List<Any>,
    val errors_detail: List<Any>
)
```

### 5. Sync Service

```kotlin
class HealthSyncService(
    private val context: Context,
    private val apiService: TechMedixApiService
) {

    private val healthConnectManager = HealthConnectManager(context)

    suspend fun syncHealthData(): Result<Unit> {
        return try {
            // Check Health Connect availability
            if (!healthConnectManager.checkAvailability()) {
                return Result.failure(Exception("Health Connect not available"))
            }

            // Request permissions if needed
            if (!healthConnectManager.requestPermissions()) {
                return Result.failure(Exception("Health Connect permissions denied"))
            }

            // Read last 24 hours of data
            val endTime = Instant.now()
            val startTime = endTime.minus(24, ChronoUnit.HOURS)

            val metrics = healthConnectManager.readHealthData(startTime, endTime)

            if (metrics.isNotEmpty()) {
                val response = apiService.syncHealthData(HealthSyncRequest(metrics))

                if (response.errors == 0) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Sync completed with ${response.errors} errors"))
                }
            } else {
                Result.success(Unit) // No data to sync
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

### 6. Background Sync (WorkManager)

```kotlin
class HealthSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val apiService = // Initialize your API service
        val syncService = HealthSyncService(applicationContext, apiService)

        return when (val result = syncService.syncHealthData()) {
            is Result.Success -> Result.success()
            is Result.Failure -> Result.retry()
        }
    }
}

// Schedule periodic sync
fun scheduleHealthSync() {
    val syncRequest = PeriodicWorkRequestBuilder<HealthSyncWorker>(
        1, TimeUnit.HOURS
    ).build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "health_sync",
        ExistingPeriodicWorkPolicy.KEEP,
        syncRequest
    )
}
```

## Backend API Endpoints

### POST /api/health/sync

Sync health metrics from mobile app.

**Request Body:**

```json
{
  "metrics": [
    {
      "metric_type": "steps",
      "value": 8500,
      "unit": "count",
      "recorded_at": "2024-01-15T10:00:00Z",
      "metadata": { "device": "Pixel 7" }
    }
  ]
}
```

**Response:**

```json
{
  "success": 1,
  "errors": 0,
  "data": [...],
  "errors_detail": []
}
```

### GET /api/health/latest

Get latest health metrics for patient.

**Response:**

```json
{
  "steps": {
    "id": "uuid",
    "metric_type": "steps",
    "value": 8500,
    "unit": "count",
    "recorded_at": "2024-01-15T10:00:00Z",
    "source": "health_connect"
  }
}
```

### GET /api/health/insights

Get AI-generated health insights.

**Response:**

```json
{
  "insights": [
    "• Your daily step count of 8,500 is excellent! Keep up the good work.",
    "• Consider increasing daily steps to reach the recommended 10,000 steps."
  ]
}
```

## Database Schema

### health_metrics table

```sql
CREATE TABLE health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  source VARCHAR(100) DEFAULT 'health_connect',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_health_metrics_patient_id ON health_metrics(patient_id);
CREATE INDEX idx_health_metrics_type ON health_metrics(metric_type);
CREATE INDEX idx_health_metrics_recorded_at ON health_metrics(recorded_at);
CREATE INDEX idx_health_metrics_patient_type_date ON health_metrics(patient_id, metric_type, recorded_at);
```

## Security Considerations

1. **Authentication**: All health API endpoints require patient authentication
2. **Data Validation**: Server-side validation of all health metric data
3. **Rate Limiting**: Implement rate limiting on sync endpoints
4. **Encryption**: Health data encrypted in transit and at rest
5. **Privacy**: Patients can revoke Health Connect access and delete synced data

## Testing

### Unit Tests

- Test Health Connect permission requests
- Test data reading from Health Connect
- Test API communication
- Test error handling

### Integration Tests

- End-to-end sync flow
- Database storage verification
- AI insights generation
- Dashboard display

### Manual Testing Checklist

- [ ] Health Connect app installation
- [ ] Permission request flow
- [ ] Data sync after permissions granted
- [ ] Background sync functionality
- [ ] Dashboard display of health metrics
- [ ] AI insights generation
- [ ] Data deletion when access revoked

## Deployment

1. **Backend**: Deploy updated API endpoints and database schema
2. **AI Service**: Deploy updated health insights endpoint
3. **Frontend**: Deploy updated patient dashboard
4. **Mobile App**: Submit to Google Play Store with Health Connect permissions

## Monitoring

- Track sync success/failure rates
- Monitor API performance
- Alert on permission revocation
- Track user engagement with health features

## Future Enhancements

1. **Additional Metrics**: Blood pressure, blood glucose, weight, etc.
2. **Real-time Sync**: WebSocket-based real-time updates
3. **Historical Data**: Sync historical health data
4. **Wearable Integration**: Direct integration with wearables
5. **Health Goals**: Set and track health goals
6. **Sharing**: Share health data with healthcare providers
