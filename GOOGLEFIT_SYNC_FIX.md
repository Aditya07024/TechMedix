# Google Fit Sync Fix - Silent Data Loss Issue

## Problem Identified

Your Google Fit sync was experiencing **silent data loss**. The system was:

1. ✓ Successfully extracting data from Google Fit API (heart rate: 76 bpm)
2. ✗ **Failing silently** when trying to save to database
3. ✗ Returning old mock data (heart rate: 72 bpm) instead of new synced data

### Root Causes

1. **Silent Failure in `createHealthMetric()`**
   - Function returned `null` on database errors
   - Calling code didn't check for null, so sync appeared successful
   - Actual SQL errors were never visible to the sync endpoint

2. **Missing Error Handling in Sync Endpoint**
   - Code didn't verify metrics were actually saved
   - No `_saved` flags to indicate success/failure per metric
   - Users couldn't tell if data persisted or failed silently

3. **Incorrect OR Conditions for Mock Data**
   - Heart rate, sleep, and calories missing `|| useMockData` condition
   - When real Google Fit data was empty/zero, mock data wasn't saved
   - Steps had the condition but others didn't (inconsistent)

## Changes Made

### 1. Fixed `healthMetrics.js` - Proper Error Handling

```javascript
// BEFORE: Silent failure
catch (error) {
  console.error("Create health metric failed:", error);
  return null;  // ← Caller never knows about error
}

// AFTER: Explicit error throwing
catch (error) {
  console.error(`[HEALTH-METRIC] ✗ Create health metric failed...`, error.message);
  throw error;  // ← Caller can handle the error
}
```

**Changes:**

- Added validation for required fields (patient_id, metric_type, value)
- Function now throws errors instead of returning null
- Better console logging with metric type info
- Validates INSERT returned a row

### 2. Fixed `googleFitRoutes.js` - Sync Endpoint Improvements

```javascript
// BEFORE: Silent failures
if (hrData.avgHeartRate > 0) {
  await createHealthMetric({...});  // ← No error check
}

// AFTER: Explicit tracking and error handling
results.heartRate_saved = false;
if (avgHR > 0 || useMockData) {  // ← Fixed OR condition
  try {
    const hrMetric = await createHealthMetric({...});
    if (hrMetric) {
      results.heartRate_saved = true;  // ← Track success
      console.log("[GOOGLEFIT-SYNC] ✓ Heart rate metric saved:", avgHR);
    }
  } catch (dbErr) {
    results.heartRate_error = `Save failed: ${dbErr.message}`;  // ← Report error
  }
}
```

**Changes:**

- Added `_saved` flags for each metric (steps_saved, heartRate_saved, etc.)
- Wrapped each metric creation in try-catch
- Fixed OR conditions: `if (value > 0 || useMockData)` for all metrics
- Better error messages reported back to frontend
- Response now includes: `syncDate`, number of saved metrics, per-metric status
- All errors are logged with `[GOOGLEFIT-SYNC]` prefix for easy debugging

### 3. Improved Sync Response

```javascript
// BEFORE:
{
  "success": true,
  "message": "Health metrics synced from Google Fit",
  "data": {...}
}

// AFTER:
{
  "success": true,
  "message": "Health metrics sync completed. Saved 2 metrics for 2026-03-15",
  "syncDate": "2026-03-15",
  "data": {
    "steps": 0,
    "steps_saved": false,
    "heartRate": { "avgHeartRate": 76, "count": 1 },
    "heartRate_saved": true,
    "heartRate_error": null,
    ...
  }
}
```

## How to Verify the Fix

### 1. Check Logs During Sync

Look for these patterns in your backend logs:

```
✓ [GOOGLEFIT-SYNC] ✓ Heart rate metric saved: 76
✓ [HEALTH-METRIC] ✓ Created heart_rate metric for patient XXX: 76 bpm
✗ [GOOGLEFIT-SYNC] ✗ Heart rate save failed: [error details]
```

### 2. Test the Sync Endpoint

```bash
POST /api/google-fit/sync
Body: {
  "useMockData": true  // Use mock for testing
}
```

Expected response will show:

- `heartRate_saved: true` (not undefined)
- `calories_saved: true`
- Actual values in the response
- Date range in syncDate

### 3. Verify Data in Database

After sync, query for metrics:

```bash
GET /api/google-fit/metrics
```

Should return NEW metrics with:

- `recorded_at` from today's OR your sync date
- `source`: "google_fit" or "google_fit_mock" (not older dates)
- Values matching what was extracted from API

### 4. Re-run Sync for Today

The cleanup logic at the start of sync deletes old metrics for that date:

```sql
DELETE FROM health_metrics
WHERE patient_id = ${patientId}
AND DATE(recorded_at) = DATE(${start})
AND source IN ('google_fit', 'google_fit_mock')
```

So running sync again will:

1. Delete old metrics from 2026-03-14
2. Fetch new data from API
3. Save new metrics with today's date

## What Fixes the "Output Data Doesn't Change" Issue

**Before:** Google Fit API extracted `76 bpm` but endpoint showed `72 bpm` (old data)

- API extraction: ✓ Working (`[GOOGLEFIT-HEARTRATE] Extracted: { avgHeartRate: 76, count: 1 }`)
- Data save: ✗ Failing silently (no indication in logs)
- Endpoint: Returns old mock data from 3/14 (seems like nothing changed)

**After:** All three steps are visible:

1. API extraction logged: `[GOOGLEFIT-HEARTRATE] Extracted: { avgHeartRate: 76, count: 1 }`
2. DB save logged: `[HEALTH-METRIC] ✓ Created heart_rate metric for patient...: 76 bpm`
3. Endpoint returns new data with `recorded_at` from sync date, `heartRate_saved: true`

## Files Changed

1. `/backend/models-pg/healthMetrics.js` - Error handling improvement
2. `/backend/routes/googleFitRoutes.js` - Sync endpoint fix with proper error checking

## Next Steps for Integration

1. Restart backend server
2. Run sync endpoint again (with today's date or any date you want to sync)
3. Check logs for `[GOOGLEFIT-SYNC]` and `[HEALTH-METRIC]` messages
4. Verify metrics endpoint shows new data with correct dates
