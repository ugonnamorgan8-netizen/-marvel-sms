/* ===========================
   Marvel Students Management System
   Backend API Server
   Node.js + Express + MongoDB + bcrypt + JWT
   =========================== */

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const cors       = require('cors');

const app = express();

// ===========================
// Middleware
// ===========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===========================
// Database Connection
// ===========================
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'marvel_jwt_secret_2024';

if (!MONGO_URI) {
    console.error('❌ ERROR: MONGO_URI not found in .env file!');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas connected!'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

// ===========================
// Schema Definitions
// ===========================
const userSchema = new mongoose.Schema({
    username: {
        type: String, required: true, unique: true,
        trim: true, minlength: 3, maxlength: 20
    },
    password:  { type: String, required: true },
    role:      { type: String, required: true, enum: ['student', 'admin'], default: 'student' },
    pin:       { type: String, default: null },
    schedule:  { type: [String], default: [] },
    activities: [{
        date:        { type: Date, default: Date.now },
        description: String
    }],
    transactions: [{
        date:            { type: Date, default: Date.now },
        amount:          Number,
        type:            String,
        paymentCategory: String,
        paidOnline:      { type: Boolean, default: false }
    }],
    certificates: [{
        name:      String,
        status:    String,
        addedDate: { type: Date, default: Date.now },
        notified:  { type: Boolean, default: false }
    }],
    alerts:               { type: [String], default: [] },
    courseEndDate:        { type: Date, default: null },
    trainingDurationDays: { type: Number, default: null },
    requiredAmount:       { type: Number, default: 50000 },
    registrationDate:     { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ===========================
// Auth Middleware (JWT)
// ===========================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
    }
    next();
}

// ===========================
// ROUTES
// ===========================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        message: 'Marvel Students Management System API is running!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ----------------------------
// AUTH ROUTES
// ----------------------------

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, pin, schedule } = req.body;

        // Validate
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password and role are required.' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }
        if (role === 'student' && pin && !/^\d{4,6}$/.test(pin)) {
            return res.status(400).json({ error: 'PIN must be 4-6 digits.' });
        }

        // Check duplicate
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(409).json({ error: 'Username already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Hash PIN if student
        let hashedPin = null;
        if (role === 'student' && pin) {
            hashedPin = await bcrypt.hash(pin, salt);
        }

        // Calculate training duration
        const scheduleArr = Array.isArray(schedule) ? schedule : [];
        const trainingDays = role === 'student'
            ? (scheduleArr.length >= 4 ? 20 : 30)
            : null;

        // Create user
        const newUser = new User({
            username,
            password: hashedPassword,
            role,
            pin: hashedPin,
            schedule: scheduleArr,
            trainingDurationDays: trainingDays,
            requiredAmount: role === 'student' ? 50000 : null,
            registrationDate: new Date()
        });

        await newUser.save();
        console.log(`✅ New ${role} registered: ${username}`);

        res.status(201).json({
            message: 'Registered successfully!',
            username: newUser.username,
            role: newUser.role
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        console.log(`✅ User logged in: ${username} (${user.role})`);

        // Return user data (no password/pin)
        res.json({
            message: 'Login successful!',
            token,
            user: {
                id:                  user._id,
                username:            user.username,
                role:                user.role,
                schedule:            user.schedule,
                activities:          user.activities,
                transactions:        user.transactions,
                certificates:        user.certificates,
                alerts:              user.alerts,
                courseEndDate:       user.courseEndDate,
                trainingDurationDays:user.trainingDurationDays,
                requiredAmount:      user.requiredAmount,
                registrationDate:    user.registrationDate
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// POST /api/verify-pin
app.post('/api/verify-pin', authenticateToken, async (req, res) => {
    try {
        const { pin } = req.body;
        const user = await User.findById(req.user.id);

        if (!user || !user.pin) {
            return res.status(400).json({ error: 'No PIN set for this account.' });
        }

        const isValid = await bcrypt.compare(pin, user.pin);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect PIN.' });
        }

        res.json({ message: 'PIN verified successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'PIN verification failed.' });
    }
});

// ----------------------------
// USER ROUTES
// ----------------------------

// GET /api/me — get current user's full profile
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -pin');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

// GET /api/users — admin only: get all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password -pin').sort({ registrationDate: -1 });
        res.json({ count: users.length, users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// ----------------------------
// ACTIVITY ROUTES
// ----------------------------

// POST /api/activities — log an activity (student)
app.post('/api/activities', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: 'Activity description is required.' });
        }

        const user = await User.findById(req.user.id);
        user.activities.push({ description, date: new Date() });
        await user.save();

        res.json({ message: 'Activity logged successfully!', activities: user.activities });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log activity.' });
    }
});

// ----------------------------
// TRANSACTION ROUTES
// ----------------------------

// POST /api/transactions — record a transaction (admin)
app.post('/api/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetUsername, amount, type, paymentCategory, paidOnline } = req.body;

        if (!amount || !type) {
            return res.status(400).json({ error: 'Amount and type are required.' });
        }

        // If payment for a student, attach to their record
        if (targetUsername && type === 'payment') {
            const student = await User.findOne({ username: targetUsername, role: 'student' });
            if (!student) {
                return res.status(404).json({ error: 'Student not found.' });
            }
            student.transactions.push({
                amount: Number(amount),
                type,
                paymentCategory,
                paidOnline: paidOnline || false,
                date: new Date()
            });
            await student.save();
        }

        // Also record on admin's transactions (for expense tracking)
        const admin = await User.findById(req.user.id);
        admin.transactions.push({
            amount: Number(amount),
            type,
            paymentCategory,
            date: new Date()
        });
        await admin.save();

        res.json({ message: 'Transaction recorded successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to record transaction.' });
    }
});

// GET /api/transactions — get all transactions (admin)
app.get('/api/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('username transactions role');
        const allTransactions = [];

        users.forEach(user => {
            user.transactions.forEach(t => {
                allTransactions.push({ ...t.toObject(), username: user.username, role: user.role });
            });
        });

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ count: allTransactions.length, transactions: allTransactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions.' });
    }
});

// ----------------------------
// CERTIFICATE ROUTES
// ----------------------------

// POST /api/certificates — add/update certificate (admin)
app.post('/api/certificates', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetUsername, certName, status } = req.body;

        if (!targetUsername || !certName || !status) {
            return res.status(400).json({ error: 'Username, certificate name and status are required.' });
        }

        const student = await User.findOne({ username: targetUsername, role: 'student' });
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Check if cert already exists — update it
        const existingCert = student.certificates.find(c => c.name === certName);
        if (existingCert) {
            existingCert.status = status;
        } else {
            student.certificates.push({ name: certName, status, addedDate: new Date() });
        }

        await student.save();
        res.json({ message: 'Certificate updated successfully!', certificates: student.certificates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update certificate.' });
    }
});

// ----------------------------
// ALERTS ROUTES
// ----------------------------

// POST /api/alerts — send alert to a student (admin)
app.post('/api/alerts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetUsername, message } = req.body;

        const student = await User.findOne({ username: targetUsername, role: 'student' });
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        student.alerts.push(message);
        await student.save();

        res.json({ message: 'Alert sent successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send alert.' });
    }
});

// DELETE /api/alerts — clear alerts for current user
app.delete('/api/alerts', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.alerts = [];
        await user.save();
        res.json({ message: 'Alerts cleared.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear alerts.' });
    }
});

// ----------------------------
// LICENSE PAYMENT ROUTES
// ----------------------------

// POST /api/license-payment — record license payment (admin)
app.post('/api/license-payment', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetUsername, amount, paidOnline } = req.body;

        const student = await User.findOne({ username: targetUsername, role: 'student' });
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        student.transactions.push({
            amount: Number(amount),
            type: 'payment',
            paymentCategory: 'license',
            paidOnline: paidOnline || false,
            date: new Date()
        });

        await student.save();
        res.json({ message: 'License payment recorded!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to record license payment.' });
    }
});

// ----------------------------
// SKIPPED CLASSES ROUTE
// ----------------------------

// GET /api/skipped-classes — check who skipped (admin)
app.get('/api/skipped-classes', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('username schedule activities registrationDate');
        const today = new Date();
        const skipped = [];

        students.forEach(student => {
            const daysSinceReg = Math.floor((today - new Date(student.registrationDate)) / (1000 * 60 * 60 * 24));
            const expectedSessions = Math.min(daysSinceReg, 30);
            const actualSessions = student.activities.length;

            if (actualSessions < expectedSessions) {
                skipped.push({
                    username: student.username,
                    expected: expectedSessions,
                    actual: actualSessions,
                    missed: expectedSessions - actualSessions
                });
            }
        });

        res.json({ count: skipped.length, skipped });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check skipped classes.' });
    }
});

// ----------------------------
// Serve frontend for all other routes (SPA support)
// ----------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===========================
// Error Handlers
// ===========================
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ===========================
// Start Server
// ===========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n🚀 ================================');
    console.log('   Marvel Students Management API');
    console.log('   ================================');
    console.log(`   📡 Server: http://localhost:${PORT}`);
    console.log(`   📅 Started: ${new Date().toLocaleString()}`);
    console.log('   ================================\n');
});

process.on('SIGTERM', () => {
    mongoose.connection.close(false, () => process.exit(0));
});

module.exports = app;
