# PatientDashboard Integration Example

This file shows exactly how to integrate the Google Fit components into your existing PatientDashboard.

## Implementation Overview

The Google Fit integration adds two main components to the patient dashboard:

1. **GoogleFitConnect** - Connection management UI
2. **GoogleFitMetrics** - Health metrics display

## Step-by-Step Integration

### Step 1: Add Imports

Add these imports at the top of `PatientDashboard.jsx`:

```jsx
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";
```

### Step 2: Add Route Handler

Create a new tab state for health metrics:

```jsx
// In the PatientDashboard component state
const [activeTab, setActiveTab] = useState("home");
// Add this to track refresh
const [metricsRefresh, setMetricsRefresh] = useState(0);

// Handler for when Google Fit is connected
const handleGoogleFitConnected = () => {
  setMetricsRefresh((prev) => prev + 1);
  console.log("Google Fit connected successfully");
};

// Handler for when Google Fit is disconnected
const handleGoogleFitDisconnected = () => {
  setMetricsRefresh((prev) => prev + 1);
  console.log("Google Fit disconnected");
};
```

### Step 3: Add Tab Navigation

Update your tab navigation to include health metrics:

```jsx
<div className="dashboard-tabs">
  <button
    className={activeTab === "home" ? "active" : ""}
    onClick={() => setActiveTab("home")}
  >
    Home
  </button>
  <button
    className={activeTab === "appointments" ? "active" : ""}
    onClick={() => setActiveTab("appointments")}
  >
    Appointments
  </button>
  <button
    className={activeTab === "prescriptions" ? "active" : ""}
    onClick={() => setActiveTab("prescriptions")}
  >
    Prescriptions
  </button>
  <button
    className={activeTab === "health" ? "active" : ""}
    onClick={() => setActiveTab("health")}
  >
    Health Metrics
  </button>
  {/* ... other tabs ... */}
</div>
```

### Step 4: Add Content Sections

Add the new tab content to your render section:

```jsx
{
  /* Health Metrics Tab */
}
{
  activeTab === "health" && (
    <div className="tab-content health-metrics-tab">
      <div className="health-container">
        <GoogleFitConnect
          onConnected={handleGoogleFitConnected}
          onDisconnected={handleGoogleFitDisconnected}
        />
        <GoogleFitMetrics key={metricsRefresh} />
      </div>
    </div>
  );
}
```

### Step 5: Add CSS Styling

Add to `PatientDashboard.css`:

```css
/* Health Metrics Tab */
.health-metrics-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.health-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .health-container {
    flex-direction: row;
    align-items: flex-start;
  }

  .google-fit-connect-container {
    flex: 0 0 35%;
    max-width: 500px;
  }

  .google-fit-metrics-container {
    flex: 1 1 65%;
  }
}
```

---

## Complete PatientDashboard Example

Here's a complete example showing the relevant sections:

```jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  appointmentAPI,
  prescriptionAPI,
  notificationAPI,
} from "../../api/techmedixAPI";
import { patientDataApi } from "../../api";

// Add these new imports
import GoogleFitConnect from "../../components/GoogleFitConnect/GoogleFitConnect";
import GoogleFitMetrics from "../../components/GoogleFitMetrics/GoogleFitMetrics";

// Existing components
import AppointmentBooking from "../../components/AppointmentBooking/AppointmentBooking";
import PatientQueuePosition from "../../components/PatientQueuePosition/PatientQueuePosition";
import MedicalTimeline from "../../components/MedicalTimeline/MedicalTimeline";
import NotificationCenter from "../../components/NotificationCenter/NotificationCenter";
import PrescriptionView from "../../components/PrescriptionView/PrescriptionView";
import HealthMetrics from "../../components/HealthMetrics/HealthMetrics";
import HealthChat from "../../components/HealthChat/HealthChat";
import HealthWallet from "../HealthWallet/HealthWallet";
import "./PatientDashboard.css";

/**
 * PATIENT DASHBOARD
 * Central hub for patient - shows appointments, queue, prescriptions, timeline, notifications
 */
export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Existing state
  const [qrData, setQrData] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [queueInfo, setQueueInfo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState(null);
  const [healthChatOpen, setHealthChatOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [recordings, setRecordings] = useState([]);

  // New state for Google Fit
  const [metricsRefresh, setMetricsRefresh] = useState(0);

  // Handlers for Google Fit events
  const handleGoogleFitConnected = () => {
    setMetricsRefresh((prev) => prev + 1);
    console.log("Google Fit connected successfully");
    // Optional: Show success notification
  };

  const handleGoogleFitDisconnected = () => {
    setMetricsRefresh((prev) => prev + 1);
    console.log("Google Fit disconnected");
    // Optional: Show disconnect notification
  };

  // ... existing code for other methods ...

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      loadDoctors();
      generateQR(user.id);
    }
  }, [user]);

  const loadDashboardData = async () => {
    // ... existing implementation ...
  };

  const loadDoctors = async () => {
    // ... existing implementation ...
  };

  const generateQR = (userId) => {
    // ... existing implementation ...
  };

  return (
    <div className="patient-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1>Welcome {user?.name || "Patient"}</h1>
        <p>Your Health at Glance</p>
      </div>

      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        <button
          className={activeTab === "home" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          className={
            activeTab === "appointments" ? "tab-button active" : "tab-button"
          }
          onClick={() => setActiveTab("appointments")}
        >
          Appointments
        </button>
        <button
          className={
            activeTab === "prescriptions" ? "tab-button active" : "tab-button"
          }
          onClick={() => setActiveTab("prescriptions")}
        >
          Prescriptions
        </button>
        <button
          className={
            activeTab === "health" ? "tab-button active" : "tab-button"
          }
          onClick={() => setActiveTab("health")}
        >
          Health Metrics
        </button>
        <button
          className={
            activeTab === "timeline" ? "tab-button active" : "tab-button"
          }
          onClick={() => setActiveTab("timeline")}
        >
          Timeline
        </button>
        <button
          className={
            activeTab === "notifications" ? "tab-button active" : "tab-button"
          }
          onClick={() => setActiveTab("notifications")}
        >
          Notifications
        </button>
      </div>

      {/* Tab Content */}
      <div className="dashboard-content">
        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="tab-content">
            <section className="appointments-section">
              <h2>Upcoming Appointments</h2>
              <AppointmentBooking
                doctors={doctors}
                onBooking={loadDashboardData}
              />
            </section>

            <section className="queue-section">
              <h2>Queue Status</h2>
              <PatientQueuePosition queueInfo={queueInfo} />
            </section>

            <section className="wallet-section">
              <h2>Health Wallet</h2>
              <HealthWallet balance={walletBalance} />
            </section>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <div className="tab-content">
            <h2>Manage Appointments</h2>
            <AppointmentBooking
              doctors={doctors}
              appointments={appointments}
              onBooking={loadDashboardData}
            />
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === "prescriptions" && (
          <div className="tab-content">
            <h2>Your Prescriptions</h2>
            <PrescriptionView prescriptions={prescriptions} />
          </div>
        )}

        {/* Health Metrics Tab - NEW */}
        {activeTab === "health" && (
          <div className="tab-content health-metrics-tab">
            <h2>Health Metrics & Google Fit</h2>
            <div className="health-container">
              {/* Google Fit Connect Component */}
              <div className="google-fit-section">
                <GoogleFitConnect
                  onConnected={handleGoogleFitConnected}
                  onDisconnected={handleGoogleFitDisconnected}
                />
              </div>

              {/* Google Fit Metrics Display */}
              <div className="google-fit-metrics-section">
                <GoogleFitMetrics key={metricsRefresh} />
              </div>

              {/* Existing Health Metrics */}
              <div className="existing-health-metrics">
                <HealthMetrics />
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="tab-content">
            <h2>Medical Timeline</h2>
            <MedicalTimeline userId={user?.id} />
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="tab-content">
            <h2>Notifications</h2>
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={loadDashboardData}
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      )}

      {/* Floating Chat Button */}
      <button
        className="floating-chat-button"
        onClick={() => setHealthChatOpen(!healthChatOpen)}
      >
        💬
      </button>
      {healthChatOpen && (
        <HealthChat onClose={() => setHealthChatOpen(false)} />
      )}
    </div>
  );
}
```

### Additional CSS for Integration

Add to `PatientDashboard.css`:

```css
/* Health Metrics Tab Styling */
.health-metrics-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.health-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.google-fit-section {
  width: 100%;
}

.google-fit-metrics-section {
  width: 100%;
}

.existing-health-metrics {
  width: 100%;
}

@media (min-width: 1024px) {
  .health-container {
    display: grid;
    grid-template-columns: 35% 1fr;
    gap: 30px;
    align-items: start;
  }

  .google-fit-section {
    grid-column: 1;
    grid-row: 1;
  }

  .google-fit-metrics-section {
    grid-column: 2;
    grid-row: 1;
  }

  .existing-health-metrics {
    grid-column: 1 / -1;
    margin-top: 20px;
  }
}
```

---

## Customization Options

### Change Component Size

```jsx
<div style={{ maxWidth: "400px" }}>
  <GoogleFitConnect />
</div>
```

### Add Custom Styling

```jsx
<div className="custom-google-fit-wrapper">
  <GoogleFitConnect className="custom-connect-btn" />
</div>
```

### Handle Events

```jsx
const handleGoogleFitConnected = () => {
  // Show toast notification
  // Send analytics
  // Refresh other components
  // etc.
};
```

### Conditional Rendering

```jsx
{
  isGoogleFitConnected && <GoogleFitMetrics />;
}
```

---

## Testing the Integration

1. **Start both servers**:

   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Navigate to Dashboard**: http://localhost:5173/dashboard

3. **Click Health Metrics Tab**: You should see the Google Fit components

4. **Test Connect Flow**: Click "Connect Google Fit"

5. **Verify Data**: Check if metrics sync and display correctly

---

## Troubleshooting

### Components Not Appearing

- Check browser console for errors
- Verify imports are correct
- Ensure components are in correct file paths
- Check CSS is loading properly

### Google Fit Not Connecting

- Check backend is running on port 8080
- Verify environment variables are set
- Check authorization token is being sent
- Look at backend logs for errors

### Metrics Not Displaying

- Ensure Google Fit is connected
- Click "Sync Now" button
- Check Google account has health data
- Review backend logs for API errors

---

## Next Steps

1. Test the integration in development
2. Customize styling to match your theme
3. Add additional metrics as needed
4. Implement periodic auto-sync
5. Deploy to production

---

This integration is fully backward compatible and doesn't break any existing functionality.
