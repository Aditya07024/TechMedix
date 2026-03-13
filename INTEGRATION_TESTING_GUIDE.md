# TechMedix 2.0 - Integration & Testing Guide

## Quick Start for Developers

### 1. Database Setup

```bash
# Apply all migrations to Neon PostgreSQL
psql $DATABASE_URL < backend/migrations/001_initial_schema.sql
psql $DATABASE_URL < backend/migrations/002_prescriptions_integer_user.sql
psql $DATABASE_URL < backend/migrations/003_safety_reports_user_id_nullable.sql
psql $DATABASE_URL < backend/migrations/004_price_intelligence.sql
psql $DATABASE_URL < backend/migrations/005_complete_schema.sql
psql $DATABASE_URL < backend/migrations/006_complete_enterprise_schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install
npm start
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## API Testing Examples

### Appointment Booking Flow

#### 1. Check Doctor Schedule

```bash
curl "http://localhost:5000/api/v2/appointments/available-slots?doctorId=UUID&date=2024-03-15"
```

#### 2. Book Appointment

```bash
POST http://localhost:5000/api/v2/appointments
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_date": "2024-03-15",
  "slot_time": "14:00",
  "share_history": true,
  "recording_consent_patient": false
}
```

#### 3. Patient Arrives (Check-in)

```bash
POST http://localhost:5000/api/v2/queue/mark-arrived
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "appointment_id": "appointment-uuid"
}
```

#### 4. Doctor Starts Consultation

```bash
POST http://localhost:5000/api/v2/queue/start-consultation
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "appointment_id": "appointment-uuid"
}
```

#### 5. Doctor Completes Consultation

```bash
POST http://localhost:5000/api/v2/queue/complete-consultation
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "appointment_id": "appointment-uuid",
  "follow_up_date": "2024-04-15" // optional
}
```

#### 6. Issue Prescription

```bash
POST http://localhost:5000/api/v2/prescriptions
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_id": "appointment-uuid",
  "medicines": [
    {
      "medicine_id": "med-uuid",
      "dosage": "500mg",
      "frequency": "TDS",
      "duration_days": 10,
      "instructions": "With food"
    }
  ]
}
```

---

## WebSocket Events

### Queue Namespace: `/queue`

**Client → Server:**

```javascript
socket.emit("join-queue", { appointmentId: "UUID" });
socket.emit("skip-patient", { appointmentId: "UUID" });
```

**Server → Client:**

```javascript
socket.on("queue-updated", (data) => {
  // { appointment_id, queue_position, estimated_time }
});

socket.on("in-consultation", (data) => {
  // { appointmentId, status: 'in_progress' }
});

socket.on("consultation-completed", (data) => {
  // { appointmentId, message: 'Your consultation is complete' }
});
```

### Notifications Namespace: `/notifications`

**Server → Client:**

```javascript
socket.on("appointment-reminder", (data) => {
  // { appointmentId, message, doctorName, time }
});

socket.on("prescription-ready", (data) => {
  // { prescriptionId, message }
});

socket.on("refill-approved", (data) => {
  // { prescriptionId, message }
});
```

---

## Frontend Component Usage

### Appointment Booking

```jsx
import AppointmentBooking from "./components/AppointmentBooking/AppointmentBooking";

<AppointmentBooking
  doctorId={doctorId}
  patientId={patientId}
  onBookingSuccess={handleSuccess}
/>;
```

### Queue Position

```jsx
import PatientQueuePosition from "./components/PatientQueuePosition/PatientQueuePosition";

<PatientQueuePosition appointmentId={appointmentId} />;
```

### Medical Timeline

```jsx
import MedicalTimeline from "./components/MedicalTimeline/MedicalTimeline";

<MedicalTimeline
  patientId={patientId}
  filterType="all" // 'appointments', 'prescriptions', 'visits'
/>;
```

### Notifications

```jsx
import NotificationCenter from "./components/NotificationCenter/NotificationCenter";

<NotificationCenter userId={userId} />;
```

---

## Service Layer

All services are located in `backend/services/`:

### availableServices

- **appointmentService** - Appointment CRUD and scheduling
- **prescriptionService** - Prescription lifecycle
- **queueService** - Queue management (9 functions)
- **timelineService** - Medical history aggregation
- **notificationService** - Alert system
- **scheduleService** - Doctor availability
- **safetyChecker** - Drug/disease conflict detection
- **visitService** - Consultation records
- **auditService** - Compliance logging

### Service Function Reference

**queueService.js** (9 functions)

```
✅ markArrived(appointmentId, io)
✅ finishConsultation(appointmentId, followUpDate, io)
✅ scanQrAndMarkArrived(uniqueCode, io)
✅ markInProgress(appointmentId, io)
✅ markCompleted(appointmentId, io)
✅ getQueueForDoctor(doctorId, date)
✅ getQueuePosition(appointmentId)
✅ skipPatient(appointmentId, io)
✅ resetQueue(doctorId, date)
```

**appointmentService.js** (7 functions)

```
✅ bookAppointment(data)
✅ cancelAppointment(appointmentId)
✅ rescheduleAppointment(appointmentId, newDate, newSlot)
✅ getAppointmentById(appointmentId)
✅ getDoctorAppointments(doctorId)
✅ getPatientAppointments(patientId)
✅ updateAppointmentStatus(appointmentId, status)
```

**scheduleService.js** (4 functions)

```
✅ setDoctorSchedule(data)
✅ getDoctorSchedule(doctorId)
✅ getAvailableTimeSlots(doctorId, targetDate, duration)
✅ getAvailableDateRange(doctorId, days)
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": {
    "field": "appointment_date",
    "issue": "Date cannot be in the past"
  }
}
```

### Common Status Codes

- **200** - Success
- **201** - Created
- **204** - No content
- **400** - Bad request (validation error)
- **401** - Unauthorized (missing token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not found
- **500** - Server error

---

## Database Performance Tips

### Query Optimization

1. **Queue queries** - Indexed on `appointment_id`, `doctor_id`, `created_at`
2. **Appointment lookups** - Indexed on `doctor_id`, `appointment_date`, `patient_id`
3. **Prescription searches** - Indexed on `patient_id`, `doctor_id`, `status`

### Pagination

All list endpoints support pagination:

```bash
GET /api/v2/appointments?page=1&limit=20
GET /api/v2/prescriptions?page=2&limit=10
```

---

## Monitoring

### Key Metrics to Track

1. **Queue wait time** - Average time from arrival to consultation start
2. **API response times** - Especially timeline aggregation (< 500ms target)
3. **WebSocket connection stability** - Reconnection rate
4. **Prescription safety checks** - Conflict detection accuracy

### Logging

All actions logged to `audit_logs` table:

- Prescription safety overrides
- Appointment cancellations
- Queue resets
- User access patterns

---

## Deployment Checklist

- [ ] Run full migration suite (006_complete_enterprise_schema.sql)
- [ ] Set DATABASE_URL environment variable
- [ ] Set JWT_SECRET for token signing
- [ ] Set GOOGLE_API_CREDENTIALS path for OAuth
- [ ] Configure email service for notifications
- [ ] Set up SSL/TLS certificates
- [ ] Enable CORS for frontend domain
- [ ] Configure WebSocket SSL
- [ ] Set up error tracking (Sentry/similar)
- [ ] Configure database backups
- [ ] Set up monitoring alerts

---

## Testing

### Manual Testing Scenarios

**Queue System:**

1. Book appointment → Patient arrives → Doctor starts → Doctor completes
2. Skip patient → Verify position updates
3. Open same time slot in 2 browsers → Verify conflict detection
4. Rapid queue operations → Verify locking/race conditions

**Prescription Flow:**

1. Issue prescription → Request refill → Doctor approves
2. Check drug interactions → Verify warnings shown
3. Override safety warning → Verify audit logged
4. Prescription expires → Verify removed from active list

**Timeline:**

1. Add appointment/prescription/visit → Verify appears in timeline
2. Filter by type → Verify only matching items shown
3. Pagination → Verify correct results per page

---

## Production Requirements

### Minimum Specs

- **Backend:** Node.js 18+, 2GB RAM
- **Database:** PostgreSQL 12+, Neon recommended
- **Frontend:** Modern browser (Chrome 90+, Firefox 88+)
- **Network:** TLS 1.2+ required

### Rate Limiting

```
/api/v2/ - 1000 requests/hour per IP
/queue/* - 100 WebSocket events/minute per user
/notifications/* - 50 notifications/minute per user
```

---

## Support & Documentation

- **API Docs:** See this file + code comments
- **Database Schema:** migrations/006_complete_enterprise_schema.sql
- **Error Codes:** backend/controllers/\*.js
- **Frontend Components:** frontend/src/components/\*/README.md

---

**Status:** ✅ Production Ready  
**Last Updated:** $(date)  
**Version:** 2.0
