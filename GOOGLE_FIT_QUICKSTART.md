# Google Fit Integration - Quick Start Guide

## 5-Minute Setup

### Step 1: Set Environment Variables

Edit `/backend/.env`:

```env
GOOGLE_FIT_CLIENT_ID=your_client_id_from_google_cloud
GOOGLE_FIT_CLIENT_SECRET=your_secret_from_google_cloud
FRONTEND_URL=http://localhost:5173
```

### Step 2: Run Database Migration

```bash
cd backend
node scripts/migrateGoogleFit.js
```

Expected output:

```
✓ Added Google Fit columns to patients table
✓ Created index for Google Fit connected patients
✅ Migration completed successfully!
```

### Step 3: Update App.jsx Routes

Add the callback route to your main routing file:

```jsx
import GoogleFitCallback from "./components/GoogleFitCallback/GoogleFitCallback";

// In your routes configuration
<Route path="/auth/google-fit/callback" element={<GoogleFitCallback />} />;
```

### Step 4: Update PatientDashboard.jsx

Add imports:

```jsx
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";
```

Add to JSX (inside the dashboard content):

```jsx
<section className="health-metrics-section">
  <GoogleFitConnect />
  <GoogleFitMetrics />
</section>
```

Complete example section:

```jsx
{
  activeTab === "health" && (
    <div className="tab-content">
      <h2>Health Dashboard</h2>
      <GoogleFitConnect />
      <GoogleFitMetrics />
    </div>
  );
}
```

### Step 5: Start Your Servers

**Backend:**

```bash
cd backend
npm run dev
# Runs on http://localhost:8080
```

**Frontend:**

```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

### Step 6: Test the Integration

1. Navigate to `http://localhost:5173`
2. Login to your patient account
3. Go to Dashboard
4. Find "Google Fit Integration" section
5. Click "Connect Google Fit"
6. Authorize the application in Google's consent screen
7. You'll be redirected back with success message
8. Health metrics will start displaying

---

## File Structure Created

```
TechMedix/
├── backend/
│   ├── routes/
│   │   └── googleFitRoutes.js          ← OAuth & sync routes
│   ├── services/
│   │   └── googleFitService.js         ← Google Fit API calls
│   ├── scripts/
│   │   └── migrateGoogleFit.js         ← Database migration
│   └── .env                             ← Add Google Fit credentials
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── googleFitAPI.js         ← API adapter
│   │   └── components/
│   │       ├── GoogleFitConnect/       ← Connect button
│   │       │   ├── GoogleFitConnect.jsx
│   │       │   └── GoogleFitConnect.css
│   │       ├── GoogleFitMetrics/       ← Metrics display
│   │       │   ├── GoogleFitMetrics.jsx
│   │       │   └── GoogleFitMetrics.css
│   │       └── GoogleFitCallback/      ← OAuth callback
│   │           ├── GoogleFitCallback.jsx
│   │           └── GoogleFitCallback.css
│   └── src/
│       └── pages/
│           └── PatientDashboard/       ← Add components here
│               └── PatientDashboard.jsx
│
└── GOOGLE_FIT_INTEGRATION.md            ← Full documentation
```

---

## API Endpoints Summary

| Method | Endpoint                     | Purpose                  |
| ------ | ---------------------------- | ------------------------ |
| POST   | `/auth/google-fit/start`     | Get OAuth consent URL    |
| POST   | `/auth/google-fit/callback`  | Exchange code for tokens |
| GET    | `/api/google-fit/status`     | Check connection         |
| POST   | `/api/google-fit/sync`       | Sync health data         |
| GET    | `/api/google-fit/metrics`    | Get latest metrics       |
| POST   | `/api/google-fit/disconnect` | Disconnect account       |

---

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Environment variables are set correctly
- [ ] Backend server starts without errors
- [ ] Frontend connects to backend API
- [ ] Can navigate to dashboard
- [ ] Google Fit connect button appears
- [ ] Can click "Connect Google Fit"
- [ ] Redirects to Google login
- [ ] Can authorize app
- [ ] Redirects back to app with success
- [ ] Connection status shows "Connected"
- [ ] Can see health metrics
- [ ] "Sync Now" button works
- [ ] Can disconnect Google Fit

---

## Common Issues & Fixes

### Issue: Module not found errors

```
Error: Cannot find module '@google/generative-ai'
```

**Fix**: Run `npm install` in backend directory

### Issue: CORS error

```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix**: Ensure FRONTEND_URL in .env matches your frontend URL

### Issue: Migration fails

```
Error: ALTER TABLE syntax error
```

**Fix**: Verify PostgreSQL version and database connection

### Issue: "Invalid OAuth request"

```
Error: The OAuth client was not found
```

**Fix**:

1. Verify GOOGLE_FIT_CLIENT_ID and CLIENT_SECRET
2. Check Google Cloud Console has Google Fit API enabled
3. Verify redirect URI is in authorized list

---

## Environment Variables Reference

```env
# Required for Google Fit OAuth
GOOGLE_FIT_CLIENT_ID=<your-client-id>
GOOGLE_FIT_CLIENT_SECRET=<your-client-secret>

# Must match your frontend URL
FRONTEND_URL=http://localhost:5173

# Connection string to Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# JWT secret for token signing
JWT_SECRET=your_jwt_secret_key

# Server configuration
PORT=8080
NODE_ENV=development
```

---

## Next Steps

1. ✅ Complete quick start above
2. Read [Full Documentation](./GOOGLE_FIT_INTEGRATION.md)
3. Customize UI components as needed
4. Add additional health metrics
5. Implement periodic auto-sync
6. Deploy to production

---

## Support

For issues or questions:

1. Check [Full Documentation](./GOOGLE_FIT_INTEGRATION.md#troubleshooting)
2. Review [Google Fit API Docs](https://developers.google.com/fit)
3. Check browser console for errors
4. Check backend logs: `npm run dev`

---

**Setup Time**: ~5 minutes  
**Complexity**: Low to Medium  
**No Breaking Changes**: ✓ Fully backward compatible
