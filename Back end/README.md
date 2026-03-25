# Marvel Students Management System - Supabase Edition

A complete student management system for Marvel Driving School built with Node.js, Express, Supabase (PostgreSQL), and JWT authentication.

## Features

- ✅ Student and Admin role-based access
- ✅ User registration and login with JWT
- ✅ Activity logging with PIN verification
- ✅ Transaction management (payments, expenses)
- ✅ Certificate tracking
- ✅ Alert system
- ✅ Training schedule management
- ✅ PDF export for reports
- ✅ Responsive UI with Font Awesome icons

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing
- **Hosting**: Vercel (ready to deploy)

## Setup Instructions

### Step 1: Create a Free Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Create a new project:
   - Organization name: anything you want
   - Project name: `marvel-sms` or your choice
   - Database password: save this securely
   - Region: choose closest to you
5. Wait for project to be ready (2-3 minutes)

### Step 2: Get Your Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Key**: The `anon` public key
3. These go in your `.env` file

### Step 3: Create Database Tables

1. In Supabase, go to **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase-schema.sql`
3. Paste into the SQL editor
4. Click **Run**
5. Wait for all tables to be created successfully

### Step 4: Fill in Your .env File

Create/edit `.env` in your project root:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
JWT_SECRET=change-this-to-something-random
NODE_ENV=development
```

Get these values from Step 2:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Your anon key from API settings
- `JWT_SECRET`: Create a random string (e.g., generate with `openssl rand -base64 32`)

### Step 5: Install Dependencies

```bash
cd "Back end"
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `express` - Web server
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens
- `cors` - Cross-origin requests
- `dotenv` - Environment variables

### Step 6: Run the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

You should see:
```
🚀 ================================
   Marvel Students Management API
   ================================
   📡 Server: http://localhost:3000
   🎯 Frontend: http://localhost:3000
   🗄️  Database: Supabase (PostgreSQL)
   📝 Environment: development
   📅 Started: [timestamp]
   ================================
```

### Step 7: Test the Application

1. Open browser to `http://localhost:3000`
2. You should see the login page with Marvel logo
3. Click "Register here" to create test account:
   - Username: `teststudent`
   - Password: `password123`
   - Role: `Student`
   - PIN: `1234`
   - Schedule: Check multiple days
4. After registration, login with these credentials
5. Try all features:
   - Log activities
   - View transactions  
   - Download PDF reports
   - As admin: manage certificates, see all students

## Deployment to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - Supabase backend"
git remote add origin https://github.com/ugonnamorgan8-netizen/marvel-sms.git
git branch -M main
git push -u origin main
```

### Step 2: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Select your `marvel-sms` repository
5. Click "Import"

### Step 3: Add Environment Variables

In Vercel Project Settings → **Environment Variables**, add:

```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_ANON_KEY = your-anon-key
JWT_SECRET = your-secret
NODE_ENV = production
```

### Step 4: Deploy

Click "Deploy"

Your app will be live at `https://marvel-sms.vercel.app` (or your custom domain)

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `POST /api/verify-pin` - Verify student PIN
- `GET /api/me` - Get current user data

### Users
- `GET /api/users` - Get all users (admin only)

### Activities
- `POST /api/activities` - Log activity (student)

### Transactions
- `POST /api/transactions` - Record transaction (admin)
- `GET /api/transactions` - Get user transactions

### Certificates
- `POST /api/certificates` - Add/update certificate (admin)

### Alerts
- `POST /api/alerts` - Broadcast alert (admin)
- `DELETE /api/alerts/:id` - Delete alert

### Specialized
- `POST /api/license-payment` - Record license payment (admin)
- `GET /api/skipped-classes` - Check skipped classes (admin)

### Health Check
- `GET /hello` - Server status
- `GET /db-status` - Database status

## Database Schema

### users
- id, username, password, role, pin, schedule
- registration_date, training_duration_days, required_amount, course_end_date

### activities
- id, user_id, description, date

### transactions
- id, user_id, amount, type, payment_category, paid_online, date

### certificates
- id, user_id, name, status, added_date

### alerts
- id, user_id, message, is_read

## Development

### Start with nodemon (auto-reload on changes):

```bash
npm run dev
```

### Environment Variables

See `.env.example` for template. Never commit `.env` with real credentials!

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install --save @supabase/supabase-js
```

### "SUPABASE_URL not found"
- Check `.env` file exists in the project root
- Verify all required variables are set
- Restart the server

### "Unauthorized" on API calls
- Check JWT token is being sent in Authorization header
- Verify token is not expired (7 days)
- Check JWT_SECRET matches between server and token generation

### Database connection fails
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check Supabase project is active
- Tables were properly created with supabase-schema.sql

## Security Notes

⚠️ **Change these before production:**
- `JWT_SECRET` - Use `openssl rand -base64 32` to generate random string
- Database passwords - Supabase auto-generates strong ones
- Enable row-level security policies in Supabase

## License

ISC

## Support

For issues or questions, check:
1. Supabase documentation: https://supabase.com/docs
2. Express.js: https://expressjs.com
3. JWT: https://jwt.io

---

Made with ❤️ for Marvel Driving School
