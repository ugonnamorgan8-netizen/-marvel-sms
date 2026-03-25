# Quick Start Guide - Marvel Students Management System

## ✅ What's Been Done

- [x] Complete Supabase backend created (server.js - 600+ lines)
- [x] Package.json updated with all dependencies
- [x] Database schema ready (supabase-schema.sql)
- [x] npm install completed (126 packages, 0 vulnerabilities)
- [x] Frontend updated for Supabase API calls
- [x] Configuration files ready (.env, vercel.json, .gitignore)
- [x] README with full documentation

## ⏭️ Next Steps (What You Need to Do)

### Step 1: Create Supabase Account & Project (5 min)

```
1. Go to https://supabase.com
2. Sign up with GitHub or email
3. Create new project:
   - Name: marvel-sms (or your choice)
   - Region: Choose closest to you
   - Database password: Save securely
4. Wait 2-3 minutes for project to be ready
```

### Step 2: Get Supabase Credentials (2 min)

```
1. In Supabase, go to Project Settings > API
2. Copy these:
   - Project URL (looks like https://xxxxx.supabase.co)
   - Anon Key (public key)
```

### Step 3: Create Database Schema (2 min)

```
1. In Supabase, go to SQL Editor > New Query
2. Open file: Back end/supabase-schema.sql
3. Copy ALL contents
4. Paste into Supabase SQL editor
5. Click Run
6. Wait for tables to be created ✓
```

### Step 4: Configure Environment Variables (2 min)

Edit `Back end/.env`:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
JWT_SECRET=your-random-secret-here
NODE_ENV=development
```

Example for JWT_SECRET (run in terminal):
```bash
openssl rand -base64 32
```

### Step 5: Run Server Locally (1 min)

```bash
cd "c:\Users\LENOVO\Desktop\Claude\Back end"
npm start
```

You should see:
```
🚀 ================================
   Marvel Students Management API
   ================================
   📡 Server: http://localhost:3000
   🎯 Frontend: http://localhost:3000
   🗄️  Database: Supabase (PostgreSQL)
   ...
```

### Step 6: Test the Application (5 min)

```
1. Open http://localhost:3000 in browser
2. Create test account:
   - Username: teststudent
   - Password: password123
   - Role: Student
   - PIN: 1234
   - Schedule: Check multiple days
3. Login with these credentials
4. Test features:
   - Log activities
   - View transactions
   - Download PDF
5. Create admin account and test admin dashboard
```

### Step 7: Deploy to Vercel (Optional but Recommended)

```bash
# 1. Initialize Git (if not already done)
git init
git add .
git commit -m "Supabase backend migration"

# 2. Push to GitHub
git remote add origin https://github.com/ugonnamorgan8-netizen/marvel-sms.git
git push -u origin main

# 3. In Vercel:
#    - Import project from GitHub
#    - Add Environment Variables (SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET)
#    - Click Deploy
```

Your live app will be at: `https://marvel-sms.vercel.app`

## 📋 Verification Checklist

Before proceeding, make sure you have:

- [ ] Supabase account created
- [ ] Project URL and Anon Key copied
- [ ] Database schema (supabase-schema.sql) executed in Supabase
- [ ] .env file filled with real Supabase credentials
- [ ] npm install completed (no errors)
- [ ] Server starts without errors (npm start)
- [ ] Frontend loads at http://localhost:3000
- [ ] Can register and login
- [ ] All features work (activities, transactions, PDF)

## 🐛 Troubleshooting

### "SUPABASE_URL not found"
→ Check .env file exists and is in Back end/ folder

### "Cannot find module '@supabase/supabase-js'"
→ Run: `npm install` again

### "Unauthorized" errors
→ Check your SUPABASE_ANON_KEY is correct in .env

### "Connection refused" at localhost:3000
→ Make sure `npm start` is running and no errors in terminal

### Database queries fail
→ Verify schema was run in Supabase SQL Editor

## 📚 Important Files

```
Back end/
├── server.js              ← Main API server
├── package.json           ← Dependencies
├── .env                   ← YOUR credentials (don't commit!)
├── supabase-schema.sql    ← Database schema
├── README.md              ← Full documentation
├── QUICKSTART.md          ← This file
└── public/
    ├── index.html         ← Frontend UI
    ├── script.js          ← Frontend logic
    ├── style.css          ← Styling
    └── marvel-logo.png    ← Logo

Root/
├── vercel.json           ← Vercel deployment config
└── .gitignore            ← Git ignore rules
```

## 💡 Key Endpoints Available

```
POST   /api/register              - Create account
POST   /api/login                 - Login
GET    /api/me                    - Get current user (with all data)
POST   /api/activities            - Log activity
POST   /api/transactions          - Record transaction (admin)
GET    /api/transactions          - Get user transactions
POST   /api/certificates          - Add certificate (admin)
POST   /api/alerts                - Broadcast alert (admin)
DELETE /api/alerts/:id            - Delete alert (admin)
GET    /api/users                 - Get all users (admin)
GET    /api/skipped-classes       - Check skipped (admin)
POST   /api/license-payment       - Record license payment
POST   /api/verify-pin            - Verify student PIN
GET    /hello                     - Health check
GET    /db-status                 - Database status
```

## 🎯 Success Indicators

When everything works:
✅ Server starts without errors
✅ Frontend loads with logo visible
✅ Registration creates new account
✅ Login works and shows dashboard
✅ Can log activities with PIN
✅ Admin panel shows all students
✅ PDF downloads without errors
✅ All data persists in Supabase

---

**Estimated Total Setup Time: 20-30 minutes**

Need help? Re-read the README.md or check Supabase docs at https://supabase.com/docs
