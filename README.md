# Marvel Students Management System 🚗

A professional Training & Certification Management Platform for Marvel Driving School.

## Features
- 👤 Student & Admin roles with JWT authentication
- 📅 Training schedule & progress tracking
- 💰 Payment & transaction management
- 📜 Certificate management
- 🔔 Alerts & notifications
- 📊 PDF report generation
- 🔍 Skipped classes monitor

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Auth:** JWT + bcrypt
- **Hosting:** Vercel (backend) 

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file
```
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key_here
NODE_ENV=production
```

### 3. Run locally
```bash
npm start
```

Visit `http://localhost:3000`

## Deployment
- Backend + Frontend: Deploy to **Vercel**
- Database: **MongoDB Atlas** (free tier)

## Project Structure
```
marvel-sms/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── marvel-logo.png
├── server.js
├── package.json
├── vercel.json
├── .env          (not committed)
└── .gitignore
```
