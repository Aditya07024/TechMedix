# TechMedix

# Product Overview & Technical Brief

**Version:** MVP 1.0 (Enterprise Ready)

---

# 1. Project Overview

## Vision

TechMedix is an AI-powered digital healthcare platform designed to simplify medicine discovery, appointment management, and patient healthcare records while connecting patients, doctors, clinics, and wearable devices through a single ecosystem.

## Problem Statement

Healthcare systems often suffer from:

- Fragmented patient records and siloed medical histories
- Difficult medicine discovery and lack of transparency in pricing / generic alternatives
- Manual appointment scheduling and inefficient clinic reception workflows
- Long, unmanaged waiting queues causing patient frustration
- Paper-based prescriptions prone to loss or misinterpretation
- Lack of continuous patient monitoring and smart safety safeguards

## Solution

TechMedix provides a unified healthcare platform where patients can search medicines, upload prescriptions, book appointments, manage health records, receive AI-powered health insights, and synchronize health data from wearable devices.

---

# 2. Target Users

## Patients (Mobile App)
- Register/Login with JWT verification.
- Search medicines, salts, and view brand substitutes.
- Upload prescriptions to trigger automatic AI-extraction.
- Book appointments, select clinic times, and review doctor ratings.
- Access digital health records, previous prescription pads, and medical reports.
- View real-time queue wait-time estimation and check-in status.
- Add funds to clinical wallet using Cashfree payment gateway.
- Track wearable device health data (steps, heart rate, sleep).

## Doctors (Web & Mobile Apps)
- Dashboard overview of today's appointments, queue, and completed consults.
- Interactive Earnings Dashboard with revenue breakdown (Online, Cash, Wallet).
- Manage clinical staff profiles, request coordinator access, and reset passwords.
- Conduct consultations, review patient EHR, and listen to voice recordings.
- Maintain Active and Previous Prescription Pads with quick copy-to-pad actions.
- Upload promotional marketing banners and pay for campaign activation.

## Institutional Hospitals (Web Portal)
- Institutional workspace profile control.
- Centralized billing and corporate subscription packages.
- Link and unlink practitioners to bypass individual dashboard billing limits.
- Manage and monitor linked doctor slots.

## Clinical Staff / Receptionist (Mobile App)
- Track today's bookings, arrived patients, and active queue counts.
- Manage active doctor context switching at the reception desk.
- Handle patient check-ins, issue tokens, and notify/ping doctors when patients are ready.

---

# 3. Core Features

## 🔐 Authentication & Security
- Secure registration & login powered by JWT access/refresh tokens.
- Role-based authorization layers enforcing strict access boundaries for patients, doctors, hospital administrators, and clinic staff.

## 💊 Medicine Search & Comparison
- Rich database query searching medicines, generic salts, and substitutes.
- **Price Insights & History**: Displays price variations, historical trends, and price safety warnings to provide transparency to patients.

## 🤖 AI-Powered OCR Prescription Pipeline
- Upload prescription sheets directly from gallery or camera.
- The OCR pipeline parses text, and the AI engine extracts medicine names, dosages, frequencies, and durations.
- **AI Safety & Interaction Checker**: Scans extracted medicines against the patient's existing active drugs to flag potential duplicate therapy, negative drug-drug interactions, or safety warnings.

## 📅 Smart Appointment Booking
- Real-time slot availability, automatically filtering out past slots in the clinic's local timezone.
- Blocker systems prevent patients from booking overlapping appointments on the same day.
- Double-booking guards respect doctor schedule modes (e.g., unlimited slots vs. strict slots).

## 📊 Ratings & Reviews
- Visited patients can rate consultations (1-5 stars) and write comments.
- Reviews are fully anonymous (rendered as "Verified Patient") to protect privacy.
- Patients can read doctor feedback at the booking screen, and doctors can monitor patient feedback from their profile settings.

## ⚡ Live Queue Management
- Real-time queue sync using Socket.IO.
- Reception coordinators check in patients, auto-generating queue tokens.
- Doctors call next, skip, or complete consultations, updating queue positions in real-time.
- Smart queue wait-time estimation displays waiting times to patients based on historical queue progress.

## 💳 Integrated Payments & Wallet
- Direct credit card, UPI, and net banking checkouts via Cashfree payment gateway.
- Interactive Patient Wallet Top-up Modal with quick preset options (e.g. ₹500, ₹1000, ₹2000, ₹5000).
- Automatic wallet earnings routing and settlement tracking on the doctor dashboard.

---

# 4. System Workflow

```text
Patient Uploads Rx    →    AI OCR Pipeline    →    Safety Interaction Audit
         ↓
Books Appointment     →    Local Slot Check   →    Cashfree / Wallet Payment
         ↓
Staff Check-In        →    Auto-Token Issued  →    Real-Time Queue Wait Time
         ↓
Doctor Consults       →    EHR Pad Updates    →    AI Health Insights Generated
```

---

# 5. Technical Architecture

## Frontend
- **Web App**: Built with React.js and Tailwind CSS (Responsive Desktop and Web portals).
- **Mobile App**: Built with React Native & Expo (Cross-platform iOS and Android capability).

## Backend
- **App Server**: Node.js & Express.js hosting RESTful APIs.
- **Real-Time Communication**: Socket.IO for queue updates and reception pings.
- **AI Engine**: LLM integrations for safety check, price checks, and health summary generation.

## Database & Cloud
- **Database**: PostgreSQL (Supabase) structured for high concurrency and relational consistency.
- **Storage**: Cloudinary hosting encrypted medical reports, scan PDFs, and clinic promotional banners.

---

# 6. Technology Stack

- **React.js & React Native / Expo**
- **Node.js, Express.js & Socket.IO**
- **PostgreSQL & Supabase Client**
- **JWT (JSON Web Tokens) & Bcrypt Hashing**
- **Cashfree Payment Gateway**
- **Cloudinary Media API**

---

# 7. Enterprise Ready Scope

All core clinical, administrative, and consumer modules are fully functional within the MVP:

- **Patient Portal**: Wallet, Medicine Comparison, OCR uploads, reviews, notifications, and device syncing.
- **Doctor Portal**: consultation workspace, prescription pads, revenue analytics, staff administration, promotions.
- **Hospital Dashboard**: corporate subscriptions, practitioner linking, institutional profile management.
- **Staff Dashboard**: receptionist workflow, clinic context switching, token issuance, doctor pings.
- **Core AI Modules**: OCR medicine extraction, drug safety audit, pricing insights, health summaries.
- **Real-Time Sync**: Instant socket notifications, queue manager, booking alerts.
