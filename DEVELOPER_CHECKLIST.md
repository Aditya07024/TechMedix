# TechMedix 2.0 - Developer Verification Checklist

## Pre-Deployment Verification

### Backend Setup Verification

#### 1. Database

```bash
# Verify database connection
psql $DATABASE_URL -c "SELECT * FROM users LIMIT 1;"

# Check all tables exist
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"

# Expected tables:
# - appointments
# - doctor_schedule
# - visits
# - prescriptions
# - prescription_medicines
# - queue_tracking
# - notifications
# - patient_diseases
# - medicine_conflicts
# - disease_medicine_conflicts
# - audit_logs
```

#### 2. Dependencies

```bash
cd backend
npm list | grep -E "(express|socket.io|pg|node-cron)"

# Should show:
# express@5.1.0
# socket.io@4.8.3
# pg@8.19.0
# node-cron@4.2.1
```

#### 3. File Structure

```bash
backend/
├── controllers/
│   ├── appointmentController.js ✓
│   ├── prescriptionController.js ✓
│   ├── queueController.js ✓
│   ├── timelineController.js ✓
│   └── notificationController.js ✓
├── services/
│   ├── appointmentService.js ✓
│   ├── prescriptionService.js ✓
│   ├── queueService.js ✓
│   ├── timelineService.js ✓
│   ├── notificationService.js ✓
│   ├── scheduleService.js ✓
│   ├── safetyChecker.js ✓
│   ├── visitService.js ✓
│   └── auditService.js ✓
├── routes/
│   ├── appointmentApiRoutes.js ✓
│   ├── prescriptionApiRoutes.js ✓
│   ├── queueApiRoutes.js ✓
│   ├── timelineApiRoutes.js ✓
│   └── notificationApiRoutes.js ✓
├── validators/
│   ├── appointmentValidator.js ✓
│   └── notificationValidator.js ✓
├── socket/
│   └── queueHandlers.js ✓
├── cron/
│   └── jobs.js ✓
└── migrations/
    └── 006_complete_enterprise_schema.sql ✓
```

### Backend Runtime Verification

#### 1. Start Server

```bash
cd backend
npm run dev

# Expected output:
# ✓ Server with Socket.io running on port 8080
# ✓ All cron jobs initialized
# ✓ Database connection active
```

#### 2. Test Health Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Expected: 200 OK

# Database connection
curl http://localhost:8080/api/health/db

# Expected: 200 OK with db status
```

#### 3. Test Authentication

```bash
# Get JWT token (assuming existing endpoint)
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@example.com","password":"pass"}'

# Expected: { token: "eyJhbGc..." }
```

#### 4. Test Core Endpoints

```bash
TOKEN="your_jwt_token"

# Test appointment endpoint
curl http://localhost:8080/api/v2/appointments/doctor/doctor-uuid \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 with appointment data or empty array

# Test WebSocket connection
wscat -c "ws://localhost:8080/queue"

# Expected: Connected message
```

### Frontend Setup Verification

#### 1. Dependencies

```bash
cd frontend
npm list | grep -E "(react|axios|socket.io-client|vite)"

# Should show:
# react@18+
# axios@1.9.0+
# socket.io-client@4.8.3+
# vite@4.0+
```

#### 2. Build Verification

```bash
npm run build

# Should complete with:
# ✓ built in Xs
# dist/ folder with optimized files
```

#### 3. Start Dev Server

```bash
npm run dev

# Expected output:
# ✓ VITE v4.x.x ready in Xs
# > Local: http://localhost:5173/
```

#### 4. File Structure

```bash
frontend/src/
├── components/
│   ├── AppointmentBooking/
│   │   └── AppointmentBooking.jsx ✓
│   ├── PatientQueuePosition/
│   │   ├── PatientQueuePosition.jsx ✓
│   │   └── QueuePosition.css ✓
│   ├── MedicalTimeline/
│   │   ├── MedicalTimeline.jsx ✓
│   │   └── MedicalTimeline.css ✓
│   ├── NotificationCenter/
│   │   └── NotificationCenter.jsx ✓
│   ├── PrescriptionView/
│   │   └── PrescriptionView.jsx ✓
│   └── DoctorQueueManager/
│       └── DoctorQueueManager.jsx ✓
└── api/
    ├── techmedixAPI.js ✓
    └── socketService.js ✓
```

### API Testing Checklist

#### Appointment Endpoints

```bash
TOKEN="your_jwt_token"

# Book appointment
curl -X POST http://localhost:8080/api/v2/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "uuid",
    "doctor_id": "uuid",
    "appointment_date": "2026-03-15",
    "slot_time": "14:00"
  }'
# Expected: 201 with appointment data

# Get doctor appointments
curl http://localhost:8080/api/v2/appointments/doctor/uuid \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with array of appointments

# Cancel appointment
curl -X POST http://localhost:8080/api/v2/appointments/uuid/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cancel_reason": "Emergency"}'
# Expected: 200 with cancelled appointment

# Reschedule appointment
curl -X POST http://localhost:8080/api/v2/appointments/uuid/reschedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"new_date": "2026-03-16", "new_slot_time": "15:00"}'
# Expected: 200 with rescheduled appointment
```

#### Prescription Endpoints

```bash
TOKEN="your_jwt_token"

# Create prescription (test safety check)
curl -X POST http://localhost:8080/api/v2/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "doctor_id": "uuid",
    "patient_id": "uuid",
    "medicines": [{
      "name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "3 times daily",
      "duration_days": 5
    }]
  }'
# Expected: 201 with prescription or 400 if safety conflict

# Get prescribed medicines
curl http://localhost:8080/api/v2/prescriptions/doctor/uuid \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with array of prescriptions

# Request refill
curl -X POST http://localhost:8080/api/v2/prescriptions/uuid/refill \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with refilled prescription
```

#### Queue Endpoints

```bash
TOKEN="your_jwt_token"

# Get queue
curl http://localhost:8080/api/v2/queue/doctor/uuid?date=2026-03-15 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with queue array

# Get queue position
curl http://localhost:8080/api/v2/queue/position/uuid \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with position data

# Mark arrived
curl -X POST http://localhost:8080/api/v2/queue/appointment-uuid/arrived \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with queue update

# Mark in progress
curl -X POST http://localhost:8080/api/v2/queue/appointment-uuid/in-progress \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with consultation started

# Mark completed
curl -X POST http://localhost:8080/api/v2/queue/appointment-uuid/completed \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with consultation complete
```

#### Timeline Endpoint

```bash
TOKEN="your_jwt_token"

# Get timeline
curl "http://localhost:8080/api/v2/timeline/patient/uuid?filter_type=all&limit=50" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with timeline array

# With specific filter
curl "http://localhost:8080/api/v2/timeline/patient/uuid?filter_type=prescription&limit=50" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with filtered timeline
```

#### Notification Endpoints

```bash
TOKEN="your_jwt_token"

# Get notifications
curl "http://localhost:8080/api/v2/notifications/user/uuid?is_read=false&limit=50" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with notifications array

# Mark as read
curl -X POST http://localhost:8080/api/v2/notifications/uuid/read \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 notification marked read

# Mark all as read
curl -X POST http://localhost:8080/api/v2/notifications/user/uuid/read-all \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 all marked read
```

### WebSocket Testing Checklist

#### Using wscat

```bash
# Install wscat
npm install -g wscat

# Connect to queue namespace
wscat -c "ws://localhost:8080/socket.io/?EIO=4&transport=websocket"

# Expected: Connected

# Connect to notifications
wscat -c "ws://localhost:8080/socket.io/?EIO=4&transport=websocket"

# Try subscribing
# Send: {"type":"emit","data":["subscribe-user","user-uuid"]}
```

#### Using Browser DevTools

1. Open http://localhost:5173
2. Open DevTools → Network → WS (WebSocket filter)
3. Should see two socket connections:
   - `namespace=/queue`
   - `namespace=/notifications`
4. Try to trigger queue/notification events
5. Verify messages in WebSocket frames

### Database Integrity Checks

```sql
-- Check table row counts
SELECT 'appointments' as table_name, COUNT(*) FROM appointments
UNION ALL
SELECT 'doctor_schedule', COUNT(*) FROM doctor_schedule
UNION ALL
SELECT 'visits', COUNT(*) FROM visits
UNION ALL
SELECT 'prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'queue_tracking', COUNT(*) FROM queue_tracking
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'appointments';

-- Check foreign key constraints
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'prescriptions' AND constraint_type = 'FOREIGN KEY';

-- Check audit logs
SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Security Checks

```bash
# Verify auth middleware is applied
grep -r "@authenticate" backend/routes/appointmentApiRoutes.js
# Should find authentication decorator on all routes

# Check RBAC implementation
grep -r "req.user?.id" backend/controllers/
# Should verify user accessing their own data

# Verify input validation
grep -r "validateAppointmentBooking\|validatePrescription" backend/routes/
# Should be called on relevant routes
```

### Performance Checks

```bash
# Test appointment booking speed
time curl -X POST http://localhost:8080/api/v2/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
# Expected: <300ms

# Test timeline fetch speed
time curl "http://localhost:8080/api/v2/timeline/patient/uuid"
# Expected: <1000ms

# Test WebSocket latency
# Send message and measure response time in DevTools
# Expected: <100ms
```

### Production Readiness Checklist

- [ ] All routes have authentication (`@authenticate`)
- [ ] All controllers validate input
- [ ] All services handle errors
- [ ] All database operations use transactions for critical flow
- [ ] Sensitive data not logged in audit
- [ ] RBAC enforced in every endpoint
- [ ] CORS configured properly
- [ ] Error messages don't expose internal details
- [ ] Rate limiting enabled (or commented for future)
- [ ] Environment variables used (no hardcoded values)
- [ ] Database backups configured
- [ ] Logs properly formatted
- [ ] WebSocket namespaces isolated
- [ ] Cron jobs scheduled correctly
- [ ] Frontend builds without warnings
- [ ] All API responses have error handling
- [ ] Medical data access is audit-logged

### Integration Testing (Manual)

#### Complete Appointment Flow

1. [ ] Patient books appointment (POST /api/v2/appointments)
2. [ ] Appointment created in database
3. [ ] Notification sent to doctor (check notifications table)
4. [ ] Patient can see appointment (GET /api/v2/appointments/patient/:id)
5. [ ] Doctor can see queue (GET /api/v2/queue/doctor/:id)
6. [ ] Patient joins queue (WebSocket patient-join-queue)
7. [ ] Queue position updates real-time
8. [ ] Doctor marks in progress (POST /api/v2/queue/:id/in-progress)
9. [ ] Patient sees "Your Turn" notification
10. [ ] Doctor creates prescription (POST /api/v2/prescriptions)
11. [ ] Safety check runs (no conflict = creates, conflict = returns error)
12. [ ] Doctor marks completed (POST /api/v2/queue/:id/completed)
13. [ ] Patient timeline updated (GET /api/v2/timeline/patient/:id)

#### Complete Prescription Refill Flow

1. [ ] Patient views prescriptions (GET /api/v2/prescriptions/patient/:id)
2. [ ] Active prescriptions show refill button
3. [ ] Patient clicks refill (POST /api/v2/prescriptions/:id/refill)
4. [ ] Refill count increments
5. [ ] Expiry extends
6. [ ] Doctor receives notification
7. [ ] Timeline updated

### Load Testing (Optional)

Using Apache Bench:

```bash
# Test appointment endpoint under load
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v2/appointments/doctor/uuid

# Should handle 10 concurrent users without errors
```

## Final Verification

Run this command sequence:

```bash
# 1. Database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments;"
# Expected: >0 or 0 (depending on test data)

# 2. Backend
npm run dev &
sleep 2
curl http://localhost:8080/health
# Expected: 200

# 3. Check socket handlers registered
grep -r "registerQueueHandlers\|registerNotificationHandlers" backend/app.js
# Expected: found in imports and executed

# 4. Check cron jobs initialized
grep "startCronJobs" backend/app.js
# Expected: found in imports and executed

# 5. Frontend build
cd frontend
npm run build
# Expected: completed successfully

# 6. Component imports work
grep -r "import.*appointmentAPI" frontend/src/
# Expected: found in components
```

## Success Criteria

✅ All 27 API endpoints responding
✅ WebSocket connections established
✅ Database queries executing <500ms
✅ Authentication working
✅ RBAC enforced
✅ Frontend components loading
✅ Real-time updates working
✅ Safety checks functioning
✅ Cron jobs running
✅ No console errors in browser/terminal

## Troubleshooting Guide

### Port Already in Use

```bash
# Find process on port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Module Not Found Error

```bash
# Reinstall dependencies
npm install

# Clear cache
npm cache clean --force
npm install
```

### Database Connection Failed

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### WebSocket Not Connecting

1. Check browser console for errors
2. Verify socket.io package installed
3. Check CORS in app.js
4. Verify server is running

---

**System is ready for production deployment once all checklist items are verified ✅**
