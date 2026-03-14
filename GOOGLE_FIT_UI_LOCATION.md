# Google Fit Integration - UI Location Map

## 📍 Where Components Appear in PatientDashboard

Your PatientDashboard now has the new **"💪 Health Metrics"** tab with the Google Fit components.

### Dashboard Structure

```
┌─────────────────────────────────────────────────────────────────┐
│         PATIENT DASHBOARD HEADER                                │
│  Welcome, [Patient Name]  |  Patient ID: [ID]  | 💬 Chatbot    │
└─────────────────────────────────────────────────────────────────┘

┌─ TABS NAVIGATION ────────────────────────────────────────────────┐
│ 📊 Home │ 📅 Appointments │ 💊 Prescriptions │ 📜 Record │     │
│ 🎧 Recordings │ 🚦 Queue │ 💪 Health Metrics │ Wallet │ ...    │
└──────────────────────────────────────────────────────────────────┘

CONTENT AREA (Changes based on active tab):

┌─ HOME TAB ───────────────────────────────────────────────────────┐
│ Stats Grid, Quick Actions, etc.                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ APPOINTMENTS TAB ───────────────────────────────────────────────┐
│ AppointmentBooking component                                     │
└──────────────────────────────────────────────────────────────────┘

┌─ PRESCRIPTIONS TAB ──────────────────────────────────────────────┐
│ Prescription details and medicines list                          │
└──────────────────────────────────────────────────────────────────┘

┌─ HEALTH METRICS TAB (NEW!) ──────────────────────────────────────┐
│                                                                  │
│  ┌─────────────────────────────────┬──────────────────────────┐ │
│  │   GoogleFitConnect Component    │ GoogleFitMetrics        │ │
│  │   (LEFT SIDE - 35% width)       │ (RIGHT SIDE - 65%)      │ │
│  │                                 │                         │ │
│  │  ┌─ Google Fit Card ───────┐   │ ┌─ Metrics Grid ───────┐│ │
│  │  │ 🔗 Connect Button       │   │ │ 👟  Steps    ❤️ Heart│ │
│  │  │ Status: Not Connected   │   │ │ 😴  Sleep    🔥 Cal  │ │
│  │  │ [Features List]         │   │ │                       │ │
│  │  │ [Information Panel]     │   │ │ Sync Button: 🔄      │ │
│  │  └─────────────────────────┘   │ └─────────────────────┘│ │
│  │                                 │                         │ │
│  └─────────────────────────────────┴──────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ RECORDINGS TAB ─────────────────────────────────────────────────┐
│ Voice notes, download buttons, etc.                              │
└──────────────────────────────────────────────────────────────────┘

┌─ QUEUE TAB ──────────────────────────────────────────────────────┐
│ Queue status for active appointments                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Locations in Code

### 1. **Health Metrics Tab Button**

```jsx
// File: PatientDashboard.jsx (Line ~305)
<button
  className={`tab-btn ${activeTab === "health" ? "active" : ""}`}
  onClick={() => setActiveTab("health")}
>
  💪 Health Metrics
</button>
```

### 2. **Tab Content Section**

```jsx
// File: PatientDashboard.jsx (Line ~680)
{
  activeTab === "health" && (
    <div className="tab-content health-metrics-tab">
      <h2>Health Metrics & Google Fit</h2>
      <div className="health-metrics-container">
        {/* Google Fit Connect Section */}
        <div className="google-fit-section">
          <GoogleFitConnect
            onConnected={handleGoogleFitConnected}
            onDisconnected={handleGoogleFitDisconnected}
          />
        </div>

        {/* Google Fit Metrics Display Section */}
        <div className="google-fit-metrics-section">
          <GoogleFitMetrics key={metricsRefresh} />
        </div>
      </div>
    </div>
  );
}
```

### 3. **OAuth Callback Route**

```jsx
// File: App.jsx (Line ~105)
<Route path="/auth/google-fit/callback" element={<GoogleFitCallback />} />
```

---

## 📱 Layout Visualization

### Desktop View (1024px+)

```
┌────────── Health Metrics Tab ──────────────┐
│                                             │
│  ┌─ Left (35%) ──┐  ┌─ Right (65%) ──┐   │
│  │ GoogleFitC   │  │ GoogleFitM     │   │
│  │ Connect      │  │               │   │
│  │              │  │ [Steps]  [HR]  │   │
│  │              │  │ [Sleep]  [Cal] │   │
│  └──────────────┘  └────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Mobile View (< 1024px)

```
┌──── Health Metrics Tab ────┐
│                            │
│  ┌─ GoogleFitConnect ────┐│
│  │ [Connect Section]     ││
│  └──────────────────────┘│
│                            │
│  ┌─ GoogleFitMetrics ───┐│
│  │ [Metrics Grid]       ││
│  │ 👟 Stats in 2 cols  ││
│  └──────────────────────┘│
│                            │
└────────────────────────────┘
```

---

## 🎨 What Each Component Shows

### GoogleFitConnect (Left Side)

When you click the **💪 Health Metrics** tab:

**Not Connected:**

```
┌─────────────────────────────────────┐
│  🔌 Google Fit Integration          │
├─────────────────────────────────────┤
│ Connect your Google Fit account...  │
│                                      │
│ ✗ Not Connected                     │
│ Your Google Fit account is...       │
│                                      │
│ [Connect Google Fit Button]          │
│                                      │
│ What data will be synced?            │
│ ✓ Steps: Daily step count           │
│ ✓ Heart Rate: Average measurements  │
│ ✓ Sleep: Sleep duration and...      │
│ ✓ Calories: Calories burned         │
└─────────────────────────────────────┘
```

**After Connection:**

```
┌─────────────────────────────────────┐
│  🔌 Google Fit Integration          │
├─────────────────────────────────────┤
│                                      │
│ ✓ Connected                         │
│ Your Google Fit account is...       │
│                                      │
│ [Disconnect Google Fit]              │
│                                      │
│ What data will be synced?            │
│ ✓ Steps: Daily step count           │
│ ✓ Heart Rate: Average measurements  │
│ ✓ Sleep: Sleep duration and...      │
│ ✓ Calories: Calories burned         │
└─────────────────────────────────────┘
```

### GoogleFitMetrics (Right Side)

Displays a grid of health metrics:

```
┌────────────────────────────────────┐
│  Health Metrics        [🔄 Sync]   │
├────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐        │
│  │ 👟       │ │ ❤️       │        │
│  │ Steps    │ │ Heart    │        │
│  │ 8,500    │ │ 72 bpm   │        │
│  │ steps    │ │ Last...  │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │ 😴       │ │ 🔥       │        │
│  │ Sleep    │ │ Calories │        │
│  │ 7.5      │ │ 2,450    │        │
│  │ hours    │ │ kcal     │        │
│  └──────────┘ └──────────┘        │
└────────────────────────────────────┘
```

---

## 🔄 User Flow

### Step 1: User navigates to Health Metrics tab

```
Click [💪 Health Metrics] tab
    ↓
Display GoogleFitConnect (not connected)
    ↓
Display GoogleFitMetrics (empty)
```

### Step 2: User connects Google Fit

```
Click [Connect Google Fit] button
    ↓
Redirect to Google OAuth login
    ↓
User authorizes app
    ↓
Redirect to /auth/google-fit/callback
    ↓
GoogleFitCallback component processes
    ↓
Navigate back to /dashboard
    ↓
Show "Connected" status
```

### Step 3: User syncs and views metrics

```
Click [🔄 Sync Now] button (or auto-sync)
    ↓
Fetch data from Google Fit API
    ↓
Store in database
    ↓
Display in metrics grid
    ↓
Show stats: Steps, HR, Sleep, Calories
```

---

## 📊 Files Modified/Created

```
✅ frontend/src/pages/PatientDashboard/PatientDashboard.jsx
   - Added imports for GoogleFitConnect & GoogleFitMetrics
   - Added "Health Metrics" tab button
   - Added tab content section with both components
   - Added state handlers for Google Fit events

✅ frontend/src/pages/PatientDashboard/PatientDashboard.css
   - Added .health-metrics-tab styles
   - Added .health-metrics-container layout
   - Added responsive styles for mobile

✅ frontend/src/App.jsx
   - Added GoogleFitCallback import
   - Added /auth/google-fit/callback route

✅ frontend/src/components/GoogleFitConnect/GoogleFitConnect.jsx (NEW)
   - OAuth connection UI

✅ frontend/src/components/GoogleFitMetrics/GoogleFitMetrics.jsx (NEW)
   - Metrics display grid

✅ frontend/src/components/GoogleFitCallback/GoogleFitCallback.jsx (NEW)
   - OAuth callback handler
```

---

## 🧪 Testing the UI

1. **Go to Dashboard**: http://localhost:5173/dashboard
2. **Click "💪 Health Metrics"** tab
3. **See GoogleFitConnect** component on the left
4. **Click "Connect Google Fit"**
5. **Authorize Google account**
6. **Redirects to callback** handler
7. **Back to dashboard** with "Connected" status
8. **Click "🔄 Sync Now"** to fetch metrics
9. **See GoogleFitMetrics** component with stats

---

## 🎯 Tab Navigation Complete

Your PatientDashboard now has 8 main sections:

| Tab                | Icon   | Component             | Function                   |
| ------------------ | ------ | --------------------- | -------------------------- |
| Home               | 📊     | Dashboard stats       | Overview & QR              |
| Appointments       | 📅     | AppointmentBooking    | Schedule appointments      |
| Prescriptions      | 💊     | PrescriptionView      | View medicines             |
| Record             | 📜     | External link         | Health record form         |
| Recordings         | 🎧     | Recordings list       | Voice notes                |
| Queue              | 🚦     | PatientQueuePosition  | Queue status               |
| **Health Metrics** | **💪** | **GoogleFit Widgets** | **NEW - Sync health data** |
| Wallet             | 📄     | Link                  | Document storage           |

---

**Everything is now integrated and ready to test!** 🚀
