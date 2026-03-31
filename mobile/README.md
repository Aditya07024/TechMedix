# TechMedix Mobile

React Native / Expo scaffold generated from the `stitch/` UI exports and extended to cover missing app flows.

## Included screen coverage

Stitch-derived screens:
- Login / role selection
- Patient dashboard
- Book appointment
- Analyze prescription
- Prescription results
- Health wallet
- Medical timeline
- AI health chat
- X-ray analyzer
- Doctor dashboard
- Queue manager

Additional screens added to complete navigation:
- Appointment payment
- Notifications
- Patient queue
- Health metrics
- Doctor appointments
- Doctor schedule
- Doctor profile

## Run

```bash
cd mobile
npm install
npm run start
```

## Notes

- The app currently uses mock data shaped around the existing TechMedix product flows.
- Buttons that depend on backend or native device features are scaffolded and marked with clear placeholder actions.
- Existing web app files were left untouched outside the new `mobile/` project.
