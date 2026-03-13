<div align="left" style="position: relative;">
<img src="frontend/public/Screenshot_2025-05-21_at_9.08.34_PM-removebg-preview.png" align="right" width="30%" style="margin-top: 20px;">

<h1>TECHMEDIX</h1>

<p align="left">
<em>
TechMedix is a full-stack healthcare intelligence platform built on the MERN stack that enables users to compare medicines, access AI-powered recommendations, manage prescriptions, and generate health insights — all in one secure ecosystem.
</em>
</p>

<p align="left">
<img src="https://img.shields.io/github/license/Aditya07024/TechMedix?color=0080ff">
<img src="https://img.shields.io/github/last-commit/Aditya07024/TechMedix?color=0080ff">
<img src="https://img.shields.io/github/languages/top/Aditya07024/TechMedix?color=0080ff">
<img src="https://img.shields.io/github/languages/count/Aditya07024/TechMedix?color=0080ff">
</p>
</div>

<br clear="right">

---

# 🌐 Live Demo

🔗 https://techmedix.onrender.com  

### Demo Credentials

```bash
Email: demo@techmedix.com
Password: demo123
```

---

# 🛠 Tech Stack

## 🔹 Frontend
- React.js (Vite)
- Context API
- CSS3
- Responsive UI Design

## 🔹 Backend
- Node.js
- Express.js
- PostgreSQL (Neon)
- JWT Authentication
- Role-Based Access Control

## 🔹 AI & Intelligence
- AI-based medicine recommendation engine
- Smart health insights generation

## 🔹 Deployment
- Render (Backend + Frontend)
- GitHub

---

# 👾 Features

- 🔍 Medicine Comparison (Generic vs Branded)
- 💡 AI-Powered Recommendations
- 👩‍⚕️ Doctor Portal (Role-Based Access)
- 💊 Medicine Tracking & Management
- ⏰ Smart Medicine Reminders
- 📈 Health Report Generation
- ⚠️ Detailed Safety & Side Effects Information
- 💬 Real User Reviews
- 🛒 One-Click Purchase Integration
- 🧰 Healthcare Essentials Marketplace

---

# 📁 Project Structure

```sh
TechMedix/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── config/
│   └── server.js
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── test-qr.js
├── package.json
└── README.md
```

---

# 🔐 Environment Variables

Create a `.env` file inside `backend/`

```env
PORT=5000
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret
```

---

# 📡 API Endpoints

## 🔑 Auth
```
POST /api/auth/register
POST /api/auth/login
```

## 💊 Medicines
```
GET /api/medicines
POST /api/medicines
```

## 👩‍⚕️ Doctors
```
GET /api/doctors
```

## 📈 Reports
```
GET /api/reports
```

---

# 🚀 Getting Started

## ☑️ Prerequisites

- Node.js (v18+ recommended)
- npm

---

## ⚙️ Installation

```bash
git clone https://github.com/Aditya07024/TechMedix
cd TechMedix
```

---

## 🔹 Install Backend

```bash
cd backend
npm install
npm start
```

---

## 🔹 Install Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# 🧪 Testing

```bash
npm test
```

---

# 🏗 Architecture Overview

```
Client (React)
      ↓
Express API (Node.js)
      ↓
PostgreSQL (Neon)
      ↓
AI Recommendation Engine
```

---

# 📌 Project Roadmap

- [x] Core MERN stack implementation
- [x] Third-party medicine APIs integration
- [x] AI-based recommendation system
- [ ] Mobile app (React Native / Expo)
- [ ] Multilingual support
- [ ] Teleconsultation integration

---

# 🔰 Contributing

1. Fork the repository  
2. Create a feature branch  
3. Commit changes  
4. Push and create PR  

---

# 🙌 Acknowledgments

This project was built to promote transparency, affordability, and intelligence in healthcare decision-making.

---

# 📜 License

This project is licensed under the MIT License.
