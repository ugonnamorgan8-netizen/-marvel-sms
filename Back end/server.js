/* ===========================
   Marvel Students Management System
   Backend API Server - Supabase Edition
   Node.js + Express + Supabase + JWT
   =========================== */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express
const app = express();

// ===========================
// Supabase Setup
// ===========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env!');
    console.log('Please check your .env file includes:');
    console.log('1. SUPABASE_URL=https://your-project.supabase.co');
    console.log('2. SUPABASE_ANON_KEY=your-anon-key');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// Middleware Setup
// ===========================
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost', '*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===========================
// JWT Configuration
// ===========================
const JWT_SECRET = process.env.JWT_SECRET || 'marvel_secret_key_change_this';
const JWT_EXPIRY = '7d';

function generateToken(user) {
    return jwt.sign({
        userId: user.id,
        username: user.username,
        role: user.role
    }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token', message: 'Token expired or invalid' });
    }
}

// ===========================
// HEALTH CHECK ROUTES
// ===========================

app.get('/hello', (req, res) => {
    res.json({
        message: 'Marvel Students Management System API is running!',
        version: '2.0.0-supabase',
        timestamp: new Date().toISOString()
    });
});

app.get('/db-status', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count(*)', { count: 'exact', head: true });
        
        if (error) throw error;
        
        res.json({
            database: 'Supabase',
            status: 'connected',
            users_count: data?.length || 0,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            database: 'Supabase',
            status: 'disconnected',
            error: err.message
        });
    }
});

// ===========================
// AUTHENTICATION ROUTES
// ===========================

/**
 * POST /api/register
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, pin, schedule } = req.body;
        
        // Validate
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!role || !['student', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be student or admin' });
        }
        if (role === 'student' && (!pin || !/^\d{4,6}$/.test(pin))) {
            return res.status(400).json({ error: 'PIN must be 4-6 digits for students' });
        }
        if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
            return res.status(400).json({ error: 'Schedule is required' });
        }
        
        // Hash password and pin
        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = role === 'student' ? await bcrypt.hash(pin, 10) : null;
        
        // Insert user
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username: username.toLowerCase(),
                password: hashedPassword,
                role,
                pin: hashedPin,
                schedule,
                registration_date: new Date(),
                training_duration_days: role === 'student' ? (schedule.length >= 4 ? 20 : 30) : null,
                required_amount: role === 'student' ? 50000 : null
            }])
            .select();
        
        if (error) {
            if (error.message.includes('duplicate')) {
                return res.status(409).json({ error: 'Username already exists' });
            }
            throw error;
        }
        
        res.status(201).json({
            message: 'User registered successfully',
            username: data[0].username,
            role: data[0].role
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed', message: err.message });
    }
});

/**
 * POST /api/login
 */
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Get user
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username.toLowerCase())
            .single();
        
        if (userError || !users) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, users.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Fetch user details
        const { data: userDetails } = await supabase
            .from('users')
            .select(`
                id,
                username,
                role,
                schedule,
                training_duration_days,
                required_amount,
                course_end_date,
                registration_date,
                activities:activities(id, description, date),
                transactions:transactions(id, amount, type, payment_category, date),
                certificates:certificates(id, name, status, added_date),
                alerts:alerts(id, message, is_read, created_at)
            `)
            .eq('id', users.id)
            .single();
        
        const token = generateToken(users);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: userDetails.id,
                username: userDetails.username,
                role: userDetails.role,
                schedule: userDetails.schedule,
                activities: userDetails.activities || [],
                transactions: userDetails.transactions || [],
                certificates: userDetails.certificates || [],
                alerts: (userDetails.alerts || []).map(a => a.message),
                trainingDurationDays: userDetails.training_duration_days,
                requiredAmount: userDetails.required_amount,
                courseEndDate: userDetails.course_end_date,
                registrationDate: userDetails.registration_date
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', message: err.message });
    }
});

/**
 * GET /api/me
 */
app.get('/api/me', verifyToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                role,
                schedule,
                training_duration_days,
                required_amount,
                course_end_date,
                registration_date,
                activities:activities(id, description, date),
                transactions:transactions(id, amount, type, payment_category, date),
                certificates:certificates(id, name, status, added_date),
                alerts:alerts(id, message, is_read)
            `)
            .eq('id', req.user.userId)
            .single();
        
        if (error) throw error;
        
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            schedule: user.schedule,
            activities: user.activities || [],
            transactions: user.transactions || [],
            certificates: user.certificates || [],
            alerts: (user.alerts || []).map(a => a.message),
            trainingDurationDays: user.training_duration_days,
            requiredAmount: user.required_amount,
            courseEndDate: user.course_end_date,
            registrationDate: user.registration_date
        });
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ error: 'Failed to fetch user', message: err.message });
    }
});

/**
 * GET /api/users (admin only)
 */
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                role,
                schedule,
                training_duration_days,
                required_amount,
                course_end_date,
                registration_date,
                activities:activities(id, description, date),
                transactions:transactions(id, amount, type, payment_category, date),
                certificates:certificates(id, name, status, added_date),
                alerts:alerts(id, message)
            `)
            .order('registration_date', { ascending: false });
        
        if (error) throw error;
        
        res.json({
            count: users.length,
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                role: u.role,
                schedule: u.schedule,
                activities: u.activities || [],
                transactions: u.transactions || [],
                certificates: u.certificates || [],
                alerts: (u.alerts || []).map(a => a.message),
                trainingDurationDays: u.training_duration_days,
                requiredAmount: u.required_amount,
                courseEndDate: u.course_end_date,
                registrationDate: u.registration_date
            }))
        });
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: 'Failed to fetch users', message: err.message });
    }
});

/**
 * POST /api/verify-pin
 */
app.post('/api/verify-pin', verifyToken, async (req, res) => {
    try {
        const { pin } = req.body;
        
        if (!pin) {
            return res.status(400).json({ error: 'PIN is required' });
        }
        
        const { data: user, error } = await supabase
            .from('users')
            .select('pin')
            .eq('id', req.user.userId)
            .single();
        
        if (error || !user?.pin) {
            return res.status(400).json({ error: 'PIN not set for this user' });
        }
        
        const isPinValid = await bcrypt.compare(pin, user.pin);
        
        if (!isPinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }
        
        res.json({ message: 'PIN verified successfully' });
    } catch (err) {
        console.error('PIN verify error:', err);
        res.status(500).json({ error: 'Failed to verify PIN', message: err.message });
    }
});

// ===========================
// ACTIVITY ROUTES
// ===========================

/**
 * POST /api/activities
 */
app.post('/api/activities', verifyToken, async (req, res) => {
    try {
        const { description } = req.body;
        
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        
        const { data, error } = await supabase
            .from('activities')
            .insert([{
                user_id: req.user.userId,
                description,
                date: new Date()
            }])
            .select();
        
        if (error) throw error;
        
        // Get updated activities
        const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('date', { ascending: false });
        
        res.json({ message: 'Activity logged successfully', activities });
    } catch (err) {
        console.error('Activity error:', err);
        res.status(500).json({ error: 'Failed to log activity', message: err.message });
    }
});

// ===========================
// TRANSACTION ROUTES
// ===========================

/**
 * POST /api/transactions
 */
app.post('/api/transactions', async (req, res) => {
    try {
        const { targetUsername, amount, type, paymentCategory, narration } = req.body;
        
        if (!targetUsername || !amount || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get user by username
        const { data: targetUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', targetUsername.toLowerCase())
            .single();
        
        if (userError || !targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // For payments: store paymentCategory, for expenses: store narration in payment_category
        const category = type === 'payment' ? paymentCategory : narration;
        
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                user_id: targetUser.id,
                amount: parseFloat(amount),
                type,
                payment_category: category,
                date: new Date()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ message: 'Transaction recorded successfully', transaction: data[0] });
    } catch (err) {
        console.error('Transaction error:', err);
        res.status(500).json({ error: 'Failed to record transaction', message: err.message });
    }
});

/**
 * GET /api/transactions
 */
app.get('/api/transactions', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', req.user.userId)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        res.json({ transactions: data });
    } catch (err) {
        console.error('Get transactions error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions', message: err.message });
    }
});

// ===========================
// CERTIFICATE ROUTES
// ===========================

/**
 * POST /api/certificates
 */
app.post('/api/certificates', async (req, res) => {
    try {
        const { targetUsername, certName, status } = req.body;
        
        if (!targetUsername || !certName || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get user
        const { data: targetUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', targetUsername.toLowerCase())
            .single();
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if certificate exists
        const { data: existing } = await supabase
            .from('certificates')
            .select('id')
            .eq('user_id', targetUser.id)
            .eq('name', certName)
            .single();
        
        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('certificates')
                .update({ status })
                .eq('id', existing.id)
                .select();
            
            if (error) throw error;
            return res.json({ message: 'Certificate updated', certificate: data[0] });
        } else {
            // Insert
            const { data, error } = await supabase
                .from('certificates')
                .insert([{
                    user_id: targetUser.id,
                    name: certName,
                    status,
                    added_date: new Date()
                }])
                .select();
            
            if (error) throw error;
            res.json({ message: 'Certificate created', certificate: data[0] });
        }
    } catch (err) {
        console.error('Certificate error:', err);
        res.status(500).json({ error: 'Failed to manage certificate', message: err.message });
    }
});

// ===========================
// ALERT ROUTES
// ===========================

/**
 * POST /api/alerts (admin broadcasts)
 */
app.post('/api/alerts', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Get all students
        const { data: students } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'student');
        
        if (!students || students.length === 0) {
            return res.json({ message: 'No students to alert' });
        }
        
        // Insert alerts for all students
        const alerts = students.map(student => ({
            user_id: student.id,
            message,
            is_read: false
        }));
        
        const { error } = await supabase
            .from('alerts')
            .insert(alerts);
        
        if (error) throw error;
        
        res.json({ message: 'Alert sent to all students', count: students.length });
    } catch (err) {
        console.error('Alert error:', err);
        res.status(500).json({ error: 'Failed to send alert', message: err.message });
    }
});

/**
 * DELETE /api/alerts
 */
app.delete('/api/alerts/:id', verifyToken, async (req, res) => {
    try {
        const { error } = await supabase
            .from('alerts')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.userId);
        
        if (error) throw error;
        
        res.json({ message: 'Alert deleted' });
    } catch (err) {
        console.error('Delete alert error:', err);
        res.status(500).json({ error: 'Failed to delete alert', message: err.message });
    }
});

// ===========================
// SPECIALIZED ROUTES
// ===========================

/**
 * POST /api/license-payment
 */
app.post('/api/license-payment', async (req, res) => {
    try {
        const { targetUsername, amount, paidOnline } = req.body;
        
        if (!targetUsername || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('username', targetUsername.toLowerCase())
            .single();
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                user_id: user.id,
                amount: parseFloat(amount),
                type: 'payment',
                payment_category: 'license',
                paid_online: paidOnline || false,
                date: new Date()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ message: 'License payment recorded', transaction: data[0] });
    } catch (err) {
        console.error('License payment error:', err);
        res.status(500).json({ error: 'Failed to record license payment', message: err.message });
    }
});

/**
 * GET /api/skipped-classes
 */
app.get('/api/skipped-classes', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        const { data: students, error } = await supabase
            .from('users')
            .select('id, username, schedule, activities:activities(id)')
            .eq('role', 'student');
        
        if (error) throw error;
        
        const skipped = students
            .map(s => ({
                username: s.username,
                expected: s.schedule?.length || 0,
                actual: s.activities?.length || 0,
                missed: Math.max(0, (s.schedule?.length || 0) - (s.activities?.length || 0))
            }))
            .filter(s => s.missed > 0);
        
        res.json({ count: skipped.length, skipped });
    } catch (err) {
        console.error('Skipped classes error:', err);
        res.status(500).json({ error: 'Failed to check skipped classes', message: err.message });
    }
});

// ===========================
// SERVE FRONTEND
// ===========================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===========================
// ERROR HANDLING
// ===========================

app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// ===========================
// SERVER START
// ===========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n🚀 ================================');
    console.log(`   Marvel Students Management API`);
    console.log('   ================================');
    console.log(`   📡 Server: http://localhost:${PORT}`);
    console.log(`   🎯 Frontend: http://localhost:${PORT}`);
    console.log(`   🗄️  Database: Supabase (PostgreSQL)`);
    console.log(`   📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   📅 Started: ${new Date().toLocaleString()}`);
    console.log('   ================================\n');
});

module.exports = app;
