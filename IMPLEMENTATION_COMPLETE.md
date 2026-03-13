# TechMedix 2.0 - COMPLETE IMPLEMENTATION GUIDE

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                        │
│  Components: Appointments, Queue, Prescriptions, Timeline       │
│  State: Context API, WebSocket Integration                      │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP + WebSocket
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                           │
├─────────────────────────────────────────────────────────────────┤
│ Routes Layer        │ Controllers Layer   │ Services Layer      │
│ /api/v2/appointments│ appointmentController│ appointmentService │
│ /api/v2/prescriptions│prescriptionController│prescriptionService│
│ /api/v2/queue       │ queueController     │ queueService       │
│ /api/v2/timeline    │ timelineController  │ timelineService    │
│ /api/v2/notifications│notificationController│notificationService│
├─────────────────────────────────────────────────────────────────┤
│ Middleware    │ Validators     │ Socket.IO Handlers             │
│ auth.js       │ appointmentValidator.js   │ queueHandlers.js   │
│ upload.js     │ notificationValidator.js  │                    │
├────────────────────────────────────────────────────────────────┤
│ Database Layer (PostgreSQL + Neon)                              │
│ Tables: appointments, prescriptions, visits, queue_tracking,   │
│         notifications, patient_diseases, medicine_conflicts    │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables

**appointments**

- id (UUID)
- patient_id, doctor_id (FK)
- appointment_date, slot_time
- status: pending_payment → booked → arrived → completed → cancelled
- payment_status: pending → completed → refunded
- share_history, recording_consent_patient

**doctor_schedule**

- id (UUID)
- doctor_id (FK)
- day_of_week (0-6)
- start_time, end_time
- consultation_duration_minutes
- is_active

**visits**

- id (UUID)
- appointment_id, doctor_id, patient_id (FKs)
- chief_complaint, visit_notes
- vitals (JSON)
- diagnosis, treatment_plan
- created_at

**prescriptions**

- id (UUID)
- visit_id, appointment_id (FKs)
- doctor_id, patient_id (FKs)
- medicine_name, dosage, frequency, duration_days
- override_flag, override_reason
- refill_count, max_refills
- expires_at (calculated)

**prescription_medicines**

- id (UUID)
- prescription_id (FK)
- medicine_name, dosage, frequency, duration_days
- generic_name, contraindications

**queue_tracking**

- id (UUID)
- doctor_id, appointment_id (FKs)
- token_number, status
- position_in_queue, estimated_wait_minutes
- actual_started_at, actual_completed_at

**notifications**

- id (UUID)
- user_id (FK)
- type: appointment_reminder | queue_update | prescription_uploaded | refill_reminder | doctor_delay
- message, is_read
- related_entity_id, related_entity_type

**patient_diseases**

- id (UUID)
- patient_id (FK)
- disease_name, icd_code, severity
- diagnosed_on, notes, is_active

**medicine_conflicts**

- id (UUID)
- medicine_a, medicine_b
- severity: low | moderate | high | critical
- clinical_effect, recommendation

**disease_medicine_conflicts**

- id (UUID)
- disease_name, medicine_name
- severity
- contraindication, recommendation

## API Routes (V2)

### Appointments

```
POST   /api/v2/appointments                    # Book appointment
GET    /api/v2/appointments/:appointment_id   # Get appointment
GET    /api/v2/appointments/doctor/:doctor_id # Doctor's appointments
GET    /api/v2/appointments/patient/:patient_id # Patient's appointments
POST   /api/v2/appointments/:appointment_id/cancel # Cancel
POST   /api/v2/appointments/:appointment_id/reschedule # Reschedule
PATCH  /api/v2/appointments/:appointment_id/status # Update status
```

### Prescriptions

```
POST   /api/v2/prescriptions                   # Create prescription
GET    /api/v2/prescriptions/:prescription_id # Get prescription
GET    /api/v2/prescriptions/patient/:patient_id # Patient's prescriptions
GET    /api/v2/prescriptions/doctor/:doctor_id # Doctor's prescriptions
POST   /api/v2/prescriptions/:prescription_id/override # Override with reason
POST   /api/v2/prescriptions/:prescription_id/refill # Request refill
POST   /api/v2/prescriptions/:prescription_id/complete # Mark completed
```

### Queue

```
GET    /api/v2/queue/doctor/:doctor_id       # Get queue for doctor
GET    /api/v2/queue/position/:appointment_id # Get queue position
POST   /api/v2/queue/:appointment_id/arrived # Mark arrived
POST   /api/v2/queue/:appointment_id/in-progress # Start consultation
POST   /api/v2/queue/:appointment_id/completed # Mark completed
POST   /api/v2/queue/:appointment_id/skip # Skip patient
POST   /api/v2/queue/doctor/:doctor_id/reset # Reset queue
```

### Timeline

```
GET    /api/v2/timeline/patient/:patient_id  # Get medical timeline
                                             # ?filter_type=all|appointment|prescription|visit|disease|report
                                             # ?limit=100&offset=0
```

### Notifications

```
GET    /api/v2/notifications/user/:user_id  # Get user notifications
                                            # ?is_read=false&limit=50
POST   /api/v2/notifications/:notification_id/read # Mark as read
POST   /api/v2/notifications/user/:user_id/read-all # Mark all as read
DELETE /api/v2/notifications/:notification_id # Delete notification
```

## WebSocket Events

### Queue Namespace (/queue)

**Client → Server:**

- `doctor-join-queue` - Doctor joins queue room
- `patient-join-queue` - Patient joins appointment queue
- `advance-queue` - Move to next patient
- `patient-in-progress` - Mark patient in consultation
- `patient-arrived` - Patient arrived
- `doctor-delay` - Announce delay
- `queue-reset` - Reset queue

**Server → Client:**

- `queue-update` - Queue state changed
- `position-update` - Queue position changed
- `your-turn` - It's patient's turn
- `in-consultation` - Patient in session
- `patient-arrived` - Patient arrived (to doctor)
- `doctor-delayed` - Doctor delay announcement
- `queue-reset` - Queue reset

### Notifications Namespace (/notifications)

**Client → Server:**

- `subscribe-user` - Subscribe to user notifications
- `subscribe-doctor` - Subscribe to doctor notifications

**Server → Client:**

- `notification` - New notification received

## Service Layer

### appointmentService.js

```javascript
bookAppointment(data);
cancelAppointment(appointmentId, reason);
rescheduleAppointment(appointmentId, newDate, newTime);
getAppointmentById(appointmentId);
getDoctorAppointments(doctorId, date);
getPatientAppointments(patientId);
updateAppointmentStatus(appointmentId, status);
```

### prescriptionService.js

```javascript
createPrescription(data);
getPrescriptionById(prescriptionId);
getPrescriptionsByPatient(patientId);
getPrescriptionsByDoctor(doctorId);
updatePrescriptionOverride(prescriptionId, doctorId, reason);
requestRefill(prescriptionId, patientId);
completePrescription(prescriptionId);
getExpiredPrescriptions(patientId);
searchPrescriptions(patientId, query);
```

### queueService.js

```javascript
markArrived(appointmentId, io);
markInProgress(appointmentId, io);
markCompleted(appointmentId, io);
getQueueForDoctor(doctorId, date);
getQueuePosition(appointmentId);
skipPatient(appointmentId, io);
resetQueue(doctorId, date);
```

### timelineService.js

```javascript
getPatientTimeline(patientId, filterType, limit, offset);
```

### notificationService.js

```javascript
sendAppointmentReminders(io);
getNotificationsByUser(userId, isRead, limit);
markAsRead(notificationId);
markAllAsRead(userId);
deleteNotification(notificationId);
createNotification(userId, type, title, message, relatedId, relatedType);
```

### scheduleService.js

```javascript
getDoctorSchedule(doctorId, dayOfWeek);
setDoctorSchedule(doctorId, dayOfWeek, startTime, endTime, duration);
getDoctorWeeklySchedule(doctorId);
generateAvailableSlots(doctorId, date);
disableDoctorSchedule(doctorId, dayOfWeek);
```

### safetyChecker.js

```javascript
checkDiseaseConflict(patientId, medicines);
checkDrugDrugInteraction(medicines);
```

### visitService.js

```javascript
createVisit(appointmentId, doctorId, patientId, visitData);
getVisitById(visitId);
getPatientVisits(patientId);
getDoctorVisits(doctorId, date);
updateVisit(visitId, doctorId, updates);
```

## Frontend Components

### appointmentBooking/AppointmentBooking.jsx

- Date picker
- Time slot selection
- Share history toggle
- Booking confirmation

### PatientQueuePosition/PatientQueuePosition.jsx

- Real-time queue position
- Estimated wait time
- Status badge (waiting/in_progress)
- WebSocket integration for live updates

### MedicalTimeline/

- Chronological timeline of all medical events
- Filter by category: appointments, prescriptions, visits, diseases, reports
- Expandable cards with details
- Date grouping

### NotificationCenter/NotificationCenter.jsx

- Bell icon with unread count badge
- Notification panel with list
- Mark as read functionality
- WebSocket integration for real-time notifications
- Filter by type

### PrescriptionView/PrescriptionView.jsx

- List of patient's prescriptions
- Status badges (active/expired/completed)
- Dosage, frequency, duration info
- Refill request button
- Expiry tracking

### DoctorQueueManager/DoctorQueueManager.jsx

- Real-time queue display
- Action buttons: Start, Complete, Skip
- Queue statistics
- WebSocket integration for live updates

## Frontend API Services

### techmedixAPI.js

```javascript
appointmentAPI.book(data);
appointmentAPI.cancel(appointmentId, reason);
appointmentAPI.reschedule(appointmentId, newDate, newTime);

prescriptionAPI.create(data);
prescriptionAPI.override(prescriptionId, reason);
prescriptionAPI.requestRefill(prescriptionId);

queueAPI.getQueue(doctorId, date);
queueAPI.getPosition(appointmentId);
queueAPI.markArrived(appointmentId);

notificationAPI.getNotifications(userId);
notificationAPI.markAsRead(notificationId);

timelineAPI.getTimeline(patientId, filterType);
```

## Cron Jobs

**Every 30 minutes:**

- Check and send appointment reminders (1 hour before)

**Daily at midnight:**

- Cancel expired appointments with pending payment

**Daily at 8 AM:**

- Send prescription refill reminders

**Weekly (Sunday 2 AM):**

- Clean up old read notifications (>30 days)

**Daily at 11:59 PM:**

- Generate and aggregate analytics

## Input Validation

**appointmentValidator.js**

- Patient/Doctor ID validation
- Date/Time format validation
- Boolean flags validation
- All fields present validation

**notificationValidator.js**

- User ID validation
- Type validation (enum)
- Message validation
- Required fields check

## Security Features

### RBAC (Role-Based Access Control)

- Doctor cannot access other doctor's data
- Patient cannot access other patient's data
- Admin-only routes enforced
- Medical data always protected

### Audit Logging

- All critical actions logged
- User ID, action, entity ID tracked
- Timestamp of each action
- Status recorded (success/failure)

### Transaction Management

- Critical operations use DB transactions
- Prescription overrides logged
- Appointment cancellations tracked
- Payment status updates atomic

## Safety Engine

**Disease-Medicine Conflicts**

- Check patient's active diseases
- Match with prescribed medicines
- Return severity level
- Block if high/critical (requires override)

**Drug-Drug Interactions**

- Check all medicine pairs
- Return interaction details
- Display warnings to doctor
- Can be overridden with reason

## Cron Jobs Configuration

Location: `/backend/cron/jobs.js`

Initialized in: `app.js` - `startCronJobs(io)`

## Testing E2E Flow

### Appointment Booking Flow

1. Patient selects doctor
2. System checks doctor schedule
3. System shows available slots
4. Patient books appointment
5. Payment gateway triggered
6. Appointment status: booked (payment success)
7. Notification sent to both parties

### Queue Management Flow

1. Patient arrives and marks attendance
2. System assigns token number
3. Queue position calculated
4. Real-time updates via WebSocket
5. Doctor marks in progress
6. Doctor creates visit record
7. Doctor prescribes medicines (with safety checks)
8. Doctor marks completed
9. Queue advances to next patient

### Prescription Refill Flow

1. Patient views prescriptions
2. Refill button available if active & refills < max
3. Patient clicks refill
4. System updates expiry date
5. System increments refill count
6. Notification sent to doctor
7. Doctor approves/reviews

## Deployment Ready

- Clean architecture: Controllers → Services → Database
- All endpoints have authentication middleware
- Input validation on all endpoints
- Error handling with proper HTTP status codes
- WebSocket namespace isolation
- Cron jobs for background tasks
- Audit logging for critical operations
- RBAC enforcement throughout
