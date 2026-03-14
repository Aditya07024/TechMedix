# Google Fit API Integration - Complete Implementation Guide

## Overview

This guide provides complete implementation details for integrating Google Fit API into the TechMedix healthcare platform. Users can now connect their Google Fit accounts to automatically sync health metrics like steps, heart rate, sleep duration, and calories burned.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [API Routes](#api-routes)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Usage](#usage)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Google Cloud Console Project** with Google Fit API enabled
- **Neon PostgreSQL** database (already configured)
- **Node.js** 16+
- **React** with Vite (already configured)

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select your project
3. Enable the **Google Fit API**
4. Create an **OAuth 2.0 Client ID** (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:8080/auth/google-fit/callback` (development)
   - `http://localhost:5173/auth/google-fit/callback` (frontend development)
   - `https://yourdomain.com/auth/google-fit/callback` (production)

---

## Backend Setup

### 1. Install Required Packages

The necessary packages are already installed:

```bash
npm list axios google-auth-library googleapis
```

### 2. Set Environment Variables

Update `/backend/.env`:

```env
# Google Fit OAuth Credentials
GOOGLE_FIT_CLIENT_ID=your_google_client_id_here
GOOGLE_FIT_CLIENT_SECRET=your_google_client_secret_here

# Frontend URL (for OAuth redirect)
FRONTEND_URL=http://localhost:5173

# Database URL (already configured)
DATABASE_URL=postgresql://...

# Other existing variables...
```

### 3. Run Database Migration

Create the database schema for Google Fit tokens:

```bash
cd backend
node scripts/migrateGoogleFit.js
```

This adds the following columns to the `patients` table:

- `google_fit_access_token` (TEXT) - Stores Google OAuth access token
- `google_fit_refresh_token` (TEXT) - Stores refresh token for token renewal
- `google_fit_connected_at` (TIMESTAMP) - Tracks when connection was established

### 4. Backend Files Created

#### Service Layer

- **`/backend/services/googleFitService.js`**
  - `fetchGoogleFitData()` - Fetch aggregated data from Google Fit
  - `getTodaySteps()` - Get today's step count
  - `getHeartRateData()` - Get heart rate measurements
  - `getSleepData()` - Get sleep duration
  - `getCaloriesData()` - Get calories burned
  - `storeGoogleFitToken()` - Store OAuth tokens in database
  - `getGoogleFitToken()` - Retrieve stored tokens
  - `disconnectGoogleFit()` - Remove tokens and disconnect

#### Routes

- **`/backend/routes/googleFitRoutes.js`**
  - `POST /auth/google-fit/start` - Generate OAuth consent URL
  - `POST /auth/google-fit/callback` - Exchange authorization code for tokens
  - `GET /api/google-fit/status` - Check connection status
  - `POST /api/google-fit/disconnect` - Disconnect Google Fit
  - `POST /api/google-fit/sync` - Sync health data from Google Fit
  - `GET /api/google-fit/metrics` - Retrieve latest synced metrics

#### Migration Script

- **`/backend/scripts/migrateGoogleFit.js`** - Creates required database columns

---

## Frontend Setup

### 1. Frontend Files Created

#### API Layer

- **`/frontend/src/api/googleFitAPI.js`**
  - `startGoogleFitAuth()` - Initiate OAuth flow
  - `handleGoogleFitCallback()` - Process OAuth callback
  - `getGoogleFitStatus()` - Check connection status
  - `syncGoogleFitData()` - Trigger data sync
  - `getGoogleFitMetrics()` - Fetch health metrics
  - `disconnectGoogleFit()` - Disconnect account

#### Components

- **`/frontend/src/components/GoogleFitConnect/GoogleFitConnect.jsx`**
  - Connect/Disconnect button
  - Connection status display
  - Connection information
  - Styling: `GoogleFitConnect.css`

- **`/frontend/src/components/GoogleFitMetrics/GoogleFitMetrics.jsx`**
  - Display health metrics in a card-based grid
  - Manual sync button
  - Loading and error states
  - Styling: `GoogleFitMetrics.css`

- **`/frontend/src/components/GoogleFitCallback/GoogleFitCallback.jsx`**
  - Handle OAuth redirect from Google
  - Process authorization code
  - Display success/error messages
  - Styling: `GoogleFitCallback.css`

### 2. Integration with Existing Components

Add to your **PatientDashboard**:

```jsx
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";

export default function PatientDashboard() {
  // ... existing code ...

  return (
    <div className="dashboard">
      {/* ... existing content ... */}

      {/* Add Google Fit section */}
      <section className="google-fit-section">
        <GoogleFitConnect />
        <GoogleFitMetrics />
      </section>
    </div>
  );
}
```

### 3. Update App Routes

Add the callback route in your main routing file:

```jsx
// In App.jsx or your routing configuration
import GoogleFitCallback from "./components/GoogleFitCallback/GoogleFitCallback";

<Route path="/auth/google-fit/callback" element={<GoogleFitCallback />} />;
```

---

## API Routes

### Authentication Routes

#### Start OAuth Flow

```
POST /auth/google-fit/start
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### OAuth Callback (Exchange Code for Tokens)

```
POST /auth/google-fit/callback
Authorization: Bearer <JWT_TOKEN>
Body: {
  "code": "4/0AZ..."
}

Response:
{
  "success": true,
  "message": "Google Fit connected successfully",
  "data": {
    "connected_at": "2024-03-15T10:30:00Z"
  }
}
```

### Health Data Routes

#### Get Connection Status

```
GET /api/google-fit/status
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "connected": true
}
```

#### Sync Health Data

```
POST /api/google-fit/sync
Authorization: Bearer <JWT_TOKEN>
Body: {
  "startDate": "2024-03-15",
  "endDate": "2024-03-16"
}

Response:
{
  "success": true,
  "message": "Health metrics synced from Google Fit",
  "data": {
    "steps": 8500,
    "heartRate": {
      "avgHeartRate": 72,
      "count": 45,
      "points": [...]
    },
    "sleep": {
      "totalSleepHours": 7.5,
      "count": 1,
      "sessions": [...]
    },
    "calories": {
      "totalCalories": 2450
    }
  }
}
```

#### Get Latest Metrics

```
GET /api/google-fit/metrics
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "metric_type": "steps",
      "value": 8500,
      "unit": "count",
      "recorded_at": "2024-03-15T00:00:00Z",
      "source": "google_fit",
      "created_at": "2024-03-15T10:30:00Z"
    },
    ...
  ]
}
```

#### Disconnect Google Fit

```
POST /api/google-fit/disconnect
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "success": true,
  "message": "Google Fit disconnected"
}
```

---

## Database Schema

### Patients Table Additions

```sql
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS google_fit_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_fit_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_fit_connected_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_patients_google_fit_connected
ON patients(google_fit_connected_at);
```

### Health Metrics Table (Already Exists)

The `health_metrics` table stores synced data:

```sql
CREATE TABLE health_metrics (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  metric_type VARCHAR(50) NOT NULL, -- 'steps', 'heart_rate', 'sleep_duration', 'calories'
  value NUMERIC NOT NULL,
  unit VARCHAR(20),
  recorded_at TIMESTAMP,
  source VARCHAR(50), -- 'google_fit', 'health_connect', etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);
```

---

## Configuration

### Environment Variables Checklist

```
✓ GOOGLE_FIT_CLIENT_ID
✓ GOOGLE_FIT_CLIENT_SECRET
✓ FRONTEND_URL
✓ DATABASE_URL
✓ JWT_SECRET
✓ PORT
✓ NODE_ENV
```

### Scopes

The following Google Fit OAuth scopes are requested:

- `https://www.googleapis.com/auth/fitness.activity.read` - Steps and activity
- `https://www.googleapis.com/auth/fitness.heart_rate.read` - Heart rate
- `https://www.googleapis.com/auth/fitness.sleep.read` - Sleep data

---

## Usage

### For Users

#### 1. Connect Google Fit

1. Navigate to Patient Dashboard
2. Find "Google Fit Integration" section
3. Click "Connect Google Fit"
4. Approve permissions on Google consent screen
5. You'll be redirected back to the app

#### 2. View Health Metrics

1. Once connected, health metrics display automatically
2. Click "Sync Now" to manually update
3. Metrics update in real-time

#### 3. Disconnect Google Fit

1. In Google Fit section, click "Disconnect Google Fit"
2. Confirm disconnection
3. Your Google Fit account will be disconnected

### For Developers

#### Accessing Metrics Programmatically

```javascript
// Frontend
import { googleFitAPI } from "./api/googleFitAPI";

// Check if connected
const status = await googleFitAPI.getGoogleFitStatus();
console.log(status.connected);

// Get metrics
const response = await googleFitAPI.getGoogleFitMetrics();
const metrics = response.data;

// Custom date range sync
await googleFitAPI.syncGoogleFitData("2024-03-01", "2024-03-15");
```

#### Backend Service Usage

```javascript
import {
  getTodaySteps,
  getHeartRateData,
  getSleepData,
  getCaloriesData,
  storeGoogleFitToken,
} from "../services/googleFitService.js";

// Fetch specific metrics
const steps = await getTodaySteps(accessToken);
const heartRate = await getHeartRateData(accessToken, startDate, endDate);
const sleep = await getSleepData(accessToken, startDate, endDate);
const calories = await getCaloriesData(accessToken, startDate, endDate);
```

---

## Data Flow Diagram

```
User Browser
    ↓
[Connect Button] → POST /auth/google-fit/start
    ↓
Redirect to Google OAuth Login
    ↓
User Authorizes App
    ↓
Google Redirects to /auth/google-fit/callback?code=...
    ↓
POST /auth/google-fit/callback
    ↓
exchange code for tokens
    ↓
store in patients table (google_fit_access_token, google_fit_refresh_token)
    ↓
React Component Shows Success
    ↓
POST /api/google-fit/sync (manual or automatic)
    ↓
Fetch from Google Fit API
    ↓
Store in health_metrics table
    ↓
GET /api/google-fit/metrics
    ↓
Display in Dashboard
```

---

## Security Considerations

### Best Practices Implemented

1. **Token Storage**: OAuth tokens stored securely in database
2. **Authentication**: All routes require JWT authentication
3. **Authorization**: Only patients can access their own data
4. **Scopes**: Minimal scopes requested (read-only)
5. **HTTPS**: Use HTTPS in production
6. **Environment Variables**: Secrets in .env files, never hardcoded

### Token Refresh

Currently, the implementation stores but does not auto-refresh expired tokens. To add refresh:

```javascript
// In googleFitService.js
export const refreshAccessToken = async (refreshToken) => {
  const { tokens } = await oauth2Client.refreshAccessToken(refreshToken);
  return tokens.access_token;
};
```

---

## Troubleshooting

### Issue: "Google Fit not connected" Error

**Solution**:

- Ensure user has completed OAuth flow
- Check database for stored tokens: `SELECT google_fit_access_token FROM patients WHERE id = ?`
- Verify GOOGLE_FIT_CLIENT_ID and CLIENT_SECRET in .env

### Issue: Authorization Code Error During Callback

**Solution**:

- Verify redirect URI matches in Google Cloud Console
- Check FRONTEND_URL matches your frontend URL
- Ensure code hasn't expired (valid for ~10 minutes)

### Issue: No Health Data Synced

**Solution**:

- Check if Google Account has health data in Google Fit
- Verify API scope permissions
- Check database connectivity
- Review error logs for specific failures

### Issue: CORS Error During Sync

**Solution**:

- Ensure backend CORS is properly configured
- Verify Authorization header is included
- Check that JWT token is valid

### Issue: "Unauthorized" Error on Routes

**Solution**:

- Ensure JWT token is passed in Authorization header: `Bearer <token>`
- Verify token is not expired
- Check that user is authenticated

### Debug Mode

Enable detailed logging by adding to backend:

```javascript
// In googleFitRoutes.js
console.log("Request user:", req.user);
console.log("Tokens stored:", tokenData);
console.log("Google Fit response:", response.data);
```

---

## Performance Optimization

### Caching Metrics

Implement caching to reduce API calls:

```javascript
// Add to frontend component
const [cache, setCache] = useState({
  metrics: null,
  timestamp: null,
});

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchMetrics = async () => {
  if (cache.metrics && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.metrics;
  }
  // fetch new data
};
```

### Batch Processing

For multiple users, implement batch sync:

```javascript
// Backend - sync multiple patients
const patientIds = [1, 2, 3, ...];
await Promise.all(
  patientIds.map(id => syncPatientGoogleFit(id))
);
```

---

## Future Enhancements

1. **Historical Data Sync**: Fetch data from arbitrary date ranges
2. **Real-time Notifications**: Alert when metrics exceed thresholds
3. **Automatic Syncing**: Background job to periodically sync data
4. **Token Refresh**: Auto-refresh expired tokens
5. **Data Aggregation**: Weekly/monthly summaries
6. **Trend Analysis**: Show health trends over time
7. **Goal Setting**: Compare against personal health goals
8. **Export**: Download health data as CSV/PDF

---

## Support & Resources

- [Google Fit API Documentation](https://developers.google.com/fit/rest)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [TechMedix GitHub](https://github.com/Aditya07024/TechMedix)

---

## Version History

| Version | Date       | Changes                |
| ------- | ---------- | ---------------------- |
| 1.0.0   | 2024-03-15 | Initial implementation |

---

## License

This implementation is part of the TechMedix project. Follow the project's license terms.

---

**Last Updated**: March 15, 2024
**Maintained By**: TechMedix Development Team
