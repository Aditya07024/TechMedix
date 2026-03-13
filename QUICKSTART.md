# TechMedix 2.0 - Quick Start Guide

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Variables

Create `.env` file:

```
PORT=8080
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your_secret_key
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

### 3. Initialize Database

```bash
npm run migrate
# Runs all migrations from /migrations folder
```

### 4. Start Server

```bash
npm run dev  # Development with nodemon
npm start    # Production
```

Server runs on `http://localhost:8080`

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Variables

Create `.env` file:

```
VITE_API_URL=http://localhost:8080
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## API Usage Examples

### Book Appointment

```javascript
import { appointmentAPI } from "@/api/techmedixAPI";

await appointmentAPI.book({
  patient_id: "uuid",
  doctor_id: "uuid",
  appointment_date: "2026-03-15",
  slot_time: "14:00",
  share_history: true,
});
```

### Create Prescription

```javascript
import { prescriptionAPI } from "@/api/techmedixAPI";

await prescriptionAPI.create({
  visit_id: "uuid",
  doctor_id: "uuid",
  patient_id: "uuid",
  medicines: [
    {
      name: "Paracetamol",
      dosage: "500mg",
      frequency: "3 times daily",
      duration_days: 5,
      generic_name: "Acetaminophen",
    },
  ],
  special_instructions: "Take after food",
});
```

### Get Queue Position

```javascript
import { queueAPI } from "@/api/techmedixAPI";

const position = await queueAPI.getPosition(appointmentId);
// Returns: { position: 3, estimated_wait_minutes: 45, status: 'waiting' }
```

### Get Medical Timeline

```javascript
import { timelineAPI } from "@/api/techmedixAPI";

const timeline = await timelineAPI.getTimeline(patientId, "appointment", 50);
// Returns chronological timeline of all medical events
```

### Subscribe to Real-Time Updates

```javascript
import {
  subscribeToPatientQueue,
  subscribeToNotifications,
} from "@/api/socketService";

// Queue updates
const unsubscribeQueue = subscribeToPatientQueue(
  appointmentId,
  patientId,
  (data) => {
    console.log("Queue position updated:", data.position);
  },
);

// Notifications
const unsubscribeNotif = subscribeToNotifications(userId, (notification) => {
  console.log("New notification:", notification.message);
});

// Cleanup
unsubscribeQueue();
unsubscribeNotif();
```

## Component Usage

### Appointment Booking

```jsx
import AppointmentBooking from "@/components/AppointmentBooking/AppointmentBooking";

<AppointmentBooking doctorId={doctorId} patientId={patientId} />;
```

### Queue Position

```jsx
import PatientQueuePosition from "@/components/PatientQueuePosition/PatientQueuePosition";

<PatientQueuePosition appointmentId={appointmentId} />;
```

### Medical Timeline

```jsx
import MedicalTimeline from "@/components/MedicalTimeline/MedicalTimeline";

<MedicalTimeline patientId={patientId} />;
```

### Notifications

```jsx
import NotificationCenter from "@/components/NotificationCenter/NotificationCenter";

<NotificationCenter userId={userId} />;
```

### Doctor Queue Manager

```jsx
import DoctorQueueManager from "@/components/DoctorQueueManager/DoctorQueueManager";

<DoctorQueueManager doctorId={doctorId} />;
```

## Database Tables

### Key Tables

- **appointments** - Appointment bookings
- **doctor_schedule** - Doctor availability
- **visits** - Completed consultations
- **prescriptions** - Medicine prescriptions
- **queue_tracking** - Real-time queue position
- **notifications** - User notifications
- **patient_diseases** - Medical history
- **medicine_conflicts** - Drug interactions
- **audit_logs** - Activity logging

## WebSocket Events

### Connect to Queue Namespace

```javascript
const socket = io("/queue");

// Doctor joins
socket.emit("doctor-join-queue", doctorId);

// Patient joins
socket.emit("patient-join-queue", appointmentId, patientId);

// Listen for updates
socket.on("queue-update", (data) => {});
socket.on("your-turn", (data) => {});
socket.on("position-update", (data) => {});
```

### Connect to Notifications Namespace

```javascript
const socket = io("/notifications");

socket.emit("subscribe-user", userId);

socket.on("notification", (notification) => {
  console.log(notification.message);
});
```

## Health Checks

### API Health

```bash
curl http://localhost:8080/health
```

### Database Connection

```bash
curl http://localhost:8080/api/health/db
```

## Common Workflows

### Complete Appointment Flow

1. **Patient books** → `POST /api/v2/appointments`
2. **Payment processed** → Status: `pending_payment` → `booked`
3. **Patient arrives** → `POST /api/v2/queue/{id}/arrived`
4. **Doctor starts** → `POST /api/v2/queue/{id}/in-progress`
5. **Create visit** → Visit record with vitals
6. **Prescribe** → `POST /api/v2/prescriptions`
7. **Complete** → `POST /api/v2/queue/{id}/completed`

### Prescription Safety

1. Create prescription endpoint checks:
   - Disease-medicine conflicts
   - Drug-drug interactions
2. If high/critical severity:
   - Return error with conflict details
   - Require override reason
   - Use `POST /api/v2/prescriptions/{id}/override`
3. Log audit trail

### Refill Request

1. Patient views prescriptions
2. Finds active prescription with refills < max
3. Clicks refill button
4. `POST /api/v2/prescriptions/{id}/refill`
5. Doctor receives notification
6. Prescription expiry extended

## Troubleshooting

### WebSocket Connection Issues

- Check CORS settings in app.js
- Verify socket.io package version
- Check browser console for errors

### Database Migrations Not Applied

```bash
# Manually trigger migration
npm run migrate

# Check migration status
npm run migrate:status
```

### Prescription Safety Checks Not Working

- Verify `patient_diseases` table has data
- Check `medicine_conflicts` and `disease_medicine_conflicts` populated
- Ensure request has all medicine data

### Real-time Updates Not Working

- Check WebSocket connection in Network tab
- Verify user has subscribe events sent
- Check browser console for socket errors

## Performance Tips

### Database Queries

- All critical queries use indexes
- Use pagination on timeline (limit 50-100)
- Aggregate doctor analytics queries

### Frontend

- Use React.lazy() for heavy components
- Memoize queue/timeline components
- Debounce WebSocket subscriptions

### Backend

- Use connection pooling (Neon handles this)
- Cache doctor schedules
- Queue batch notifications per minute

## Monitoring

### Useful Queries

```sql
-- Active queue size
SELECT COUNT(*) FROM queue_tracking
WHERE status IN ('waiting', 'in_progress');

-- Prescription refill requests
SELECT * FROM notifications
WHERE type = 'refill_request' AND is_read = false;

-- Daily appointments by doctor
SELECT doctor_id, COUNT(*) FROM appointments
WHERE DATE(appointment_date) = CURRENT_DATE
GROUP BY doctor_id;
```

## Security Checklist

- [ ] All routes have `authenticate` middleware
- [ ] RBAC validation in controllers
- [ ] Input validation on all endpoints
- [ ] Medical data access controlled
- [ ] Audit logging for critical actions
- [ ] SQL injection prevention via parameterized queries
- [ ] CORS properly configured
- [ ] JWT tokens expire
- [ ] Passwords hashed with bcrypt
- [ ] Production environment variables set
