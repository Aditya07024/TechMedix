# TechMedix Mobile (React Native / Expo)

React Native app for TechMedix that uses the same backend API as the web app.

**Expo SDK:** 54.0.0  
**React Native:** 0.81.0  
**React:** 19.1.0

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go on your phone (optional, for physical device)
- iOS Simulator (Mac) or Android Emulator

## Setup

1. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

   If upgrading from an older SDK version, run:

   ```bash
   npm install expo@~54.0.0
   npx expo install --fix
   ```

   This will automatically update all Expo packages to SDK 54 compatible versions.

2. Start the backend (from project root):

   ```bash
   cd backend && npm run dev
   ```

   Ensure it runs on `http://localhost:8080` and CORS allows your environment.

3. API URL (for device/emulator):
   - **iOS Simulator**: uses `http://localhost:8080` by default.
   - **Android Emulator**: uses `http://10.0.2.2:8080` by default.
   - **Physical device**: set `EXPO_PUBLIC_API_URL` to your machine’s IP, e.g. `http://192.168.1.5:8080`, and ensure the device and machine are on the same network.

   To use a custom URL:

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.5:8080 npx expo start
   ```

## Run

```bash
cd mobile
npx expo start
```

Then:

- Press `i` for iOS Simulator (Mac only)
- Press `a` for Android Emulator
- Scan the QR code with Expo Go for a physical device (same Wi‑Fi and correct `EXPO_PUBLIC_API_URL` if needed)

## Features

- **Auth**: Log in / Sign up (same `/auth/login`, `/auth/signup` as web).
- **Dashboard**: View profile and recent health records (uses `/api/patient/:id`, `/api/patientdata/:patientId`).
- **Add health data**: Submit EHR (same `/api/patientdata` as web).

Auth uses the token returned by the backend; the app sends it as a `Cookie` header so the existing backend auth middleware works without changes.
