# TechMedix Deployment Guide

This repo is best deployed as three services:

1. `frontend` as a static site
2. `backend` as a Node web service
3. `ai-service` as a Python web service

If you do not use the X-ray AI features, you can skip `ai-service` and leave `AI_XRAY_SERVICE_URL` unset.

## Before Deploying

1. Rotate the secrets currently stored in local `.env` files.
2. Add the rotated secrets only in your hosting provider dashboard.
3. Make sure your Neon/Postgres database is reachable from production.
4. Make sure your Cloudinary account is enabled and working.

## Recommended Hosting

- `frontend`: Render Static Site or Vercel
- `backend`: Render Web Service
- `ai-service`: Render Web Service

This guide uses Render for all three so the setup stays simple.

## Frontend Service

Create a `Static Site` on Render:

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Environment variables:

- `VITE_API_URL=https://your-backend-domain.com`
- `VITE_RAZORPAY_KEY=your-razorpay-public-key`

## Backend Service

Create a `Web Service` on Render:

- Root directory: `backend`
- Environment: `Node`
- Build command: `npm install`
- Start command: `npm start`

Required environment variables:

- `NODE_ENV=production`
- `PORT=8080`
- `DATABASE_URL=...`
- `FRONTEND_URL=https://your-frontend-domain.com`
- `BACKEND_URL=https://your-backend-domain.com`
- `TOKEN_SECRET=...`
- `JWT_SECRET=...`
- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `CLOUDINARY_FOLDER=techmedix`
- `CLOUDINARY_HEALTH_WALLET_FOLDER=techmedix/health-wallet`
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`

Feature-specific backend env vars:

- `API_KEY`
- `BASE_URL`
- `GEMINI_API_KEY`
- `HUGGINGFACE_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_FIT_CLIENT_ID`
- `GOOGLE_FIT_CLIENT_SECRET`
- `AI_SERVICE_URL=https://your-ai-service-domain.com`
- `AI_XRAY_SERVICE_URL=https://your-ai-service-domain.com`

Notes:

- The backend uses `process.env.FRONTEND_URL` for production CORS, so this must match your deployed frontend domain exactly.
- The backend also uses Socket.IO on the same service, so use the backend public URL for API and socket connections.

## AI Service

Create a `Web Service` on Render:

- Root directory: `ai-service`
- Environment: `Python`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Recommended environment variables:

- `PORT=8000`

Notes:

- This service includes `torch` and can be memory-heavy.
- If Render free or low-tier instances struggle, deploy this service on a larger instance.

## Google Vision Credentials

Your backend expects:

- `GOOGLE_APPLICATION_CREDENTIALS=./config/google-vision.json`

For Render, either:

1. store the JSON file securely during build/deploy and place it at `backend/config/google-vision.json`, or
2. update the app later to read Google credentials from a single JSON env var instead of a file.

Option 2 is safer for production, but it is not implemented yet in this repo.

## Deployment Order

1. Deploy `ai-service`
2. Deploy `backend`
3. Set `VITE_API_URL` in `frontend`
4. Deploy `frontend`
5. Update `FRONTEND_URL` in `backend` if your frontend domain changed

## Production Checks

After deploy, verify these manually:

1. Open frontend and confirm login/signup works.
2. Confirm API calls hit the deployed backend URL.
3. Upload a prescription and confirm it is saved and visible in Health Wallet.
4. Upload a Health Wallet document directly.
5. Test a payment flow with Razorpay test keys.
6. If using X-ray AI, call `/health` on the AI service and test one scan upload.
7. Confirm Socket.IO-powered features still connect in production.

## Quick Commands

Local frontend build:

```bash
cd frontend
npm install
npm run build
```

Local backend start:

```bash
cd backend
npm install
npm start
```

Local AI service start:

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```
