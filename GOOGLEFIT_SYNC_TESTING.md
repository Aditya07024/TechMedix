# Google Fit Sync - Quick Debug Checklist

## Issue Summary

**Google Fit data was extracted correctly but silently failed to save to database. The metrics endpoint would return old data, making it seem like nothing changed.**

### Error Pattern You Were Seeing:

```
[GOOGLEFIT-HEARTRATE] Extracted: { avgHeartRate: 76, count: 1 }
[METRICS-ENDPOINT] Retrieved metrics: [... old data from 2026-03-14 with heart_rate: 72 ...]
```

## What Was Fixed

| Issue               | Before                | After                               |
| ------------------- | --------------------- | ----------------------------------- |
| DB save failure     | Silent (returns null) | Thrown error logged                 |
| Error checking      | None                  | Per-metric `_saved` flag            |
| Mock data condition | Inconsistent          | All metrics have `\|\| useMockData` |
| Sync response       | Generic success       | Detailed save status per metric     |
| Frontend visibility | Can't tell if saved   | Clear indicators in response        |

## Testing Steps

### Step 1: Check Backend Logs

When you call the sync endpoint, look for:

- ✓ `[GOOGLEFIT-SYNC] ✓ Heart rate metric saved: 76`
- ✓ `[HEALTH-METRIC] ✓ Created heart_rate metric for patient...`
- ✗ `[GOOGLEFIT-SYNC] ✗ Heart rate save failed: [error]`

### Step 2: Inspect Sync Response

```bash
curl -X POST http://localhost:5000/api/google-fit/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "useMockData": true,
    "startDate": "2026-03-15T00:00:00Z"
  }'
```

Look for in response:

```json
{
  "success": true,
  "message": "Health metrics sync completed. Saved X metrics for 2026-03-15",
  "syncDate": "2026-03-15",
  "data": {
    "heartRate_saved": true, // ← Should be TRUE if saved
    "calories_saved": true, // ← Should be TRUE if saved
    "heartRate": { "avgHeartRate": 76, "count": 1 },
    "heartRate_error": null // ← Should be null if success
  }
}
```

**Red flags:**

- `*_saved: false` - metric wasn't saved (check `*_error` field)
- `*_error` has a message - something went wrong
- Missing `syncDate` - old response format

### Step 3: Verify Metrics Endpoint

```bash
curl -X GET http://localhost:5000/api/google-fit/metrics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should show:

- ✓ Most recent recorded_at date (should be your sync date)
- ✓ heart_rate value of 76 (not 72)
- ✓ source: "google_fit" or "google_fit_mock"

### Step 4: Verify Database Directly (if needed)

```sql
SELECT metric_type, value, unit, recorded_at, source, metadata
FROM health_metrics
WHERE patient_id = YOUR_PATIENT_ID
ORDER BY recorded_at DESC, metric_type;
```

Should show:

- Recent metrics from today's sync (or your test date)
- Correct values extracted from API
- `source` in ('google_fit', 'google_fit_mock')

## Common Issues & Solutions

### Issue: Still seeing old data

**Solution:**

- Sync endpoint deletes old metrics for that date at the start
- Make sure you're syncing for TODAY or the date you want fresh data for
- Check `syncDate` in response - it should be "2026-03-15" not "2026-03-14"

### Issue: heartRate_saved is false

**Solution:**

- Check the `heartRate_error` field for details
- Verify patient_id exists in database
- Check patient_id matches your auth token

### Issue: Getting avgHeartRate: 0 from real API

**Solution:**

- This is likely real data (API returned no measurements)
- Sync won't save it (condition: `if (avgHR > 0 || useMockData)`)
- Use `"useMockData": true` in request to test with sample data

### Issue: Logs not showing [GOOGLEFIT-SYNC] prefix

**Solution:**

- Restart backend: `npm run dev` or `nodemon`
- Check you're looking at backend logs, not frontend
- Verify sync endpoint is actually being called

## Files That Were Changed

1. ✅ `/backend/models-pg/healthMetrics.js` - Now throws errors instead of silent failure
2. ✅ `/backend/routes/googleFitRoutes.js` - Proper error handling and status tracking

## Revert Plan (if needed)

If something breaks after this fix:

1. Sync endpoint response format changed (now includes `syncDate`)
2. If frontend expects old response format, use `data` property: `response.data.data`
3. Check for `_saved` flags in response for success indication

## Next: Testing Real Google Fit

Once this works with mock data:

1. Click "Connect Google Fit" button in your app
2. Complete OAuth flow
3. Call sync endpoint WITH `useMockData: false`
4. Check if real data is being extracted and saved

---

**TL;DR:** Your API extraction was working fine. The problem was the data silently failed to save to the database. Now you'll see exactly when/why saves fail with clear error messages and per-metric status.
