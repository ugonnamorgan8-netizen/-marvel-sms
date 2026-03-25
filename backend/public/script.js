/* ===========================
   Marvel Students Management System
   JavaScript - Connected to Supabase Backend API
   Version 3.0 - Supabase + PostgreSQL + JWT Auth
   =========================== */

// ===========================
// API Configuration
// ===========================
const API_BASE = window.location.origin; // auto-detects localhost or live URL

async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('marvel_token');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        
        // Handle empty responses
        if (res.status === 204 || !res.ok && res.status === 401) {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || data.message || `HTTP ${res.status}`);
            }
            return data;
        }
        
        const text = await res.text();
        let data = {};
        
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse JSON:', e, text);
                throw new Error('Invalid JSON response from server');
            }
        }
        
        if (!res.ok) {
            throw new Error(data.error || data.message || `HTTP ${res.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===========================
// Global State
// ===========================
let currentUser   = null;
let allUsers      = [];
let confirmCallback = null;
let pinCallback     = null;
let inactivityTimer = null;

// ===========================
// Session Management
// ===========================
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert('Session expired due to inactivity. Please login again.');
        handleLogout();
    }, 30 * 60 * 1000);
}

function initActivityTracking() {
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    resetInactivityTimer();
}

function checkAuthentication() {
    const token = localStorage.getItem('marvel_token');
    if (!token && !document.getElementById('authPage').classList.contains('active')) {
        showPage('authPage');
    }
}

// ===========================
// Initialization
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    checkAutoLogin();
    initActivityTracking();
    setInterval(checkAuthentication, 5000);
});

async function checkAutoLogin() {
    const token = localStorage.getItem('marvel_token');
    const savedUser = localStorage.getItem('marvel_user');

    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Refresh user data from server
            const freshData = await apiCall('/api/me');
            currentUser = freshData;
            localStorage.setItem('marvel_user', JSON.stringify(currentUser));
            showDashboard(currentUser.role);
        } catch (err) {
            console.error('Auto-login failed:', err);
            localStorage.removeItem('marvel_token');
            localStorage.removeItem('marvel_user');
            showPage('authPage');
        }
    }
}

// ===========================
// Page Navigation
// ===========================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
}

function showDashboard(role) {
    if (role === 'admin') {
        showPage('adminDashboard');
        loadAdminDashboard();
    } else {
        showPage('studentDashboard');
        loadStudentDashboard();
    }
}

// ===========================
// Auth Forms Toggle
// ===========================
function attachEventListeners() {
    // Toggle between login and register
    document.getElementById('showRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.add('active');
    });

    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerForm').classList.remove('active');
        document.getElementById('loginForm').classList.add('active');
    });

    // Show/hide PIN field based on role
    const regRoleSelect = document.getElementById('regRole');
    if (regRoleSelect) {
        // Initialize on page load
        const pinGroup = document.getElementById('pinFieldGroup');
        if (pinGroup) {
            pinGroup.style.display = regRoleSelect.value === 'student' ? 'block' : 'none';
        }
        // Update on change
        regRoleSelect.addEventListener('change', (e) => {
            if (pinGroup) {
                pinGroup.style.display = e.target.value === 'student' ? 'block' : 'none';
            }
        });
    }

    // Login form
    document.getElementById('loginFormElement')?.addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerFormElement')?.addEventListener('submit', handleRegister);

    // Student logout
    document.getElementById('studentLogout')?.addEventListener('click', handleLogout);

    // Admin logout
    document.getElementById('adminLogout')?.addEventListener('click', handleLogout);

    // Student: log activity form
    document.getElementById('studentActivityForm')?.addEventListener('submit', handleLogActivityForm);

    // Admin: record transaction
    document.getElementById('adminTransactionForm')?.addEventListener('submit', handleRecordTransaction);

    // Admin: add certificate
    document.getElementById('adminCertForm')?.addEventListener('submit', handleAddCertificate);

    // Admin: send alert/broadcast
    document.getElementById('adminAlertForm')?.addEventListener('submit', handleSendAlert);

    // Admin: check skipped classes
    document.getElementById('checkSkippedClasses')?.addEventListener('click', checkSkippedClasses);

    // Admin: download PDF
    document.getElementById('adminDownloadPDF')?.addEventListener('click', () => downloadTransactionsPDF('admin'));

    // Student: download PDF
    document.getElementById('studentDownloadPDF')?.addEventListener('click', () => downloadTransactionsPDF('student'));

    // Transaction type toggle (show category for payment, narration for expense)
    document.getElementById('transactionType')?.addEventListener('change', (e) => {
        const catGroup = document.getElementById('categoryGroup');
        const narGroup = document.getElementById('narrationGroup');
        if (e.target.value === 'payment') {
            if (catGroup) catGroup.style.display = 'block';
            if (narGroup) narGroup.style.display = 'none';
        } else if (e.target.value === 'expense') {
            if (catGroup) catGroup.style.display = 'none';
            if (narGroup) narGroup.style.display = 'block';
        } else {
            if (catGroup) catGroup.style.display = 'none';
            if (narGroup) narGroup.style.display = 'none';
        }
    });

    // PIN modal buttons
    document.getElementById('pinVerify')?.addEventListener('click', handlePinVerify);
    document.getElementById('pinCancel')?.addEventListener('click', () => {
        document.getElementById('pinModal').classList.remove('active');
        pinCallback = null;
    });

    // Confirm modal buttons
    document.getElementById('confirmYes')?.addEventListener('click', () => {
        if (confirmCallback) confirmCallback(true);
        document.getElementById('confirmModal').classList.remove('active');
    });
    document.getElementById('confirmNo')?.addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('active');
        confirmCallback = null;
    });

    // Analysis tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderTransactionAnalysis(e.target.dataset.period);
        });
    });

    // Logo click → go back to login
    document.querySelectorAll('.nav-logo, .auth-logo').forEach(logo => {
        logo.addEventListener('click', () => showPage('authPage'));
    });
}

// ===========================
// LOGIN
// ===========================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        const data = await apiCall('/api/login', 'POST', { username, password });

        // Store token and user
        localStorage.setItem('marvel_token', data.token);
        localStorage.setItem('marvel_user', JSON.stringify(data.user));
        currentUser = data.user;

        showDashboard(currentUser.role);
        document.getElementById('loginFormElement').reset();

    } catch (err) {
        alert(`Login failed: ${err.message}`);
    }
}

// ===========================
// REGISTER
// ===========================
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const role     = document.getElementById('regRole').value;
    const pin      = document.getElementById('regPin')?.value?.trim();

    const schedule = [];
    document.querySelectorAll('.schedule-checkboxes input[type="checkbox"]').forEach(cb => {
        if (cb.checked) schedule.push(cb.value);
    });

    if (schedule.length === 0) {
        return alert('Please select at least one training day.');
    }

    try {
        await apiCall('/api/register', 'POST', { username, password, role, pin, schedule });
        alert('Registration successful! You can now login.');
        document.getElementById('registerFormElement').reset();
        document.getElementById('registerForm').classList.remove('active');
        document.getElementById('loginForm').classList.add('active');
    } catch (err) {
        alert(`Registration failed: ${err.message}`);
    }
}

// ===========================
// LOGOUT
// ===========================
function handleLogout() {
    localStorage.removeItem('marvel_token');
    localStorage.removeItem('marvel_user');
    currentUser = null;
    allUsers    = [];
    clearTimeout(inactivityTimer);
    if (studentDashboardRefreshInterval) clearInterval(studentDashboardRefreshInterval);
    showPage('authPage');
}

// ===========================
// STUDENT DASHBOARD
// ===========================
let studentDashboardRefreshInterval = null;

function loadStudentDashboard() {
    if (!currentUser) return;

    document.getElementById('studentName').textContent = currentUser.username;

    // Schedule
    const scheduleEl = document.getElementById('studentSchedule');
    if (scheduleEl) {
        scheduleEl.textContent = currentUser.schedule?.join(', ').toUpperCase() || 'Not set';
    }

    // Fetch fresh data from server (alerts, activities, transactions, etc)
    refreshStudentData();

    // Refresh alerts every 5 seconds to catch new admin broadcasts
    if (studentDashboardRefreshInterval) clearInterval(studentDashboardRefreshInterval);
    studentDashboardRefreshInterval = setInterval(refreshStudentData, 5000);
}

async function refreshStudentData() {
    try {
        const freshData = await apiCall('/api/me');
        currentUser = freshData;
        localStorage.setItem('marvel_user', JSON.stringify(currentUser));
        // Alerts
        renderStudentAlerts();

        // Activities
        renderStudentActivities();

        // Certificates
        renderStudentCertificates();

        // Transactions
        renderStudentTransactions();

        // Update stats
        updateStudentStats();
    } catch (err) {
        console.error('Failed to refresh student data:', err);
    }
}

function updateStudentStats() {
    const activities = currentUser.activities || [];
    const payments = (currentUser.transactions || []).filter(t => t.type === 'payment') || [];
    const totalPaid = payments.reduce((sum, t) => sum + t.amount, 0);
    const required  = currentUser.requiredAmount || 50000;
    
    document.getElementById('studentActivityCount').textContent = activities.length;
    document.getElementById('studentPaymentTotal').textContent = `₦${totalPaid.toLocaleString()}`;
    document.getElementById('studentCertCount').textContent = (currentUser.certificates || []).length;
    document.getElementById('trainingDaysLeft').textContent = `${activities.length} / ${currentUser.trainingDurationDays || 30}`;
}

function renderStudentAlerts() {
    const alertsEl = document.getElementById('studentAlerts');
    if (!alertsEl) return;
    const alerts = currentUser.alerts || [];
    alertsEl.innerHTML = alerts.length === 0
        ? '<p class="no-data">No new alerts</p>'
        : alerts.map(a => `<div class="alert-item" style="padding: 10px; background: #fef3c7; border-left: 4px solid #f59e0b; margin-bottom: 8px; border-radius: 4px;"><i class="fas fa-bell"></i> ${a.message || a}</div>`).join('');
}

function renderStudentActivities() {
    const el = document.getElementById('studentActivityList');
    if (!el) return;
    const activities = currentUser.activities || [];
    el.innerHTML = activities.length === 0
        ? '<p class="no-data">No activities logged yet</p>'
        : [...activities].reverse().map(a =>
            `<div class="activity-item">
                <span class="activity-date">${formatDate(a.date)}</span>
                <span>${a.description}</span>
            </div>`
        ).join('');
}

function renderStudentCertificates() {
    const el = document.getElementById('studentCertList');
    if (!el) return;
    const certs = currentUser.certificates || [];
    el.innerHTML = certs.length === 0
        ? '<p class="no-data">No certificates yet</p>'
        : certs.map(c =>
            `<div class="cert-item">
                <strong>${c.name}</strong>
                <span class="cert-status status-${c.status}">${c.status}</span>
            </div>`
        ).join('');
}

function renderStudentTransactions() {
    const el = document.getElementById('studentTransactionList');
    if (!el) return;
    const txns = (currentUser.transactions || []).filter(t => t.type === 'payment') || [];
    el.innerHTML = txns.length === 0
        ? '<p class="no-data">No transactions yet</p>'
        : [...txns].reverse().map(t =>
            `<div class="transaction-item">
                <span>${formatDate(t.date)}</span>
                <span>₦${t.amount?.toLocaleString() || 0}</span>
                <span>${t.paymentCategory || '-'}</span>
            </div>`
        ).join('');
}

// ===========================
// LOG ACTIVITY
// ===========================
function handleLogActivityForm(e) {
    e.preventDefault();
    const desc = document.getElementById('activityDescription')?.value?.trim();
    if (!desc) return alert('Please enter an activity description.');
    
    showPinModal((verified) => {
        if (verified) logActivity(desc);
    });
}

async function logActivity(description) {
    try {
        const data = await apiCall('/api/activities', 'POST', { description });
        currentUser.activities = data.activities;
        localStorage.setItem('marvel_user', JSON.stringify(currentUser));
        renderStudentActivities();
        updateStudentStats();

        document.getElementById('activityDescription').value = '';
        alert('Activity logged successfully!');
    } catch (err) {
        alert(`Failed to log activity: ${err.message}`);
    }
}

// ===========================
// PIN MODAL
// ===========================
function showPinModal(callback) {
    pinCallback = callback;
    document.getElementById('pinInput').value = '';
    document.getElementById('pinModal').classList.add('active');
}

async function handlePinVerify() {
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) return alert('Please enter your PIN.');

    try {
        await apiCall('/api/verify-pin', 'POST', { pin });
        document.getElementById('pinModal').classList.remove('active');
        if (pinCallback) pinCallback(true);
        pinCallback = null;
    } catch (err) {
        alert('Incorrect PIN. Please try again.');
    }
}

// ===========================
// ADMIN DASHBOARD
// ===========================
async function loadAdminDashboard() {
    if (!currentUser) return;
    document.getElementById('adminName').textContent = currentUser.username;

    try {
        const data = await apiCall('/api/users');
        allUsers = data.users || [];
        updateAdminStats();
        renderTransactionAnalysis('daily');
    } catch (err) {
        console.error('Failed to load admin dashboard:', err);
    }
}

function updateAdminStats() {
    const students = allUsers.filter(u => u.role === 'student');
    let totalRevenue = 0;
    let totalExpenses = 0;
    let completedCerts = 0;

    students.forEach(s => {
        (s.transactions || []).forEach(t => {
            if (t.type === 'payment') totalRevenue += t.amount;
            if (t.type === 'expense') totalExpenses += t.amount;
        });
        completedCerts += (s.certificates || []).filter(c => c.status === 'delivered').length;
    });

    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalRevenue').textContent = `₦${totalRevenue.toLocaleString()}`;
    document.getElementById('totalExpenses').textContent = `₦${totalExpenses.toLocaleString()}`;
    document.getElementById('completedCerts').textContent = completedCerts;
}

function renderTransactionAnalysis(period = 'daily') {
    const el = document.getElementById('transactionAnalysis');
    if (!el) return;

    const allTxns = [];
    allUsers.forEach(u => {
        (u.transactions || []).forEach(t => {
            allTxns.push({ ...t, username: u.username });
        });
    });

    const now   = new Date();
    let filtered = [];

    if (period === 'daily') {
        filtered = allTxns.filter(t => {
            const d = new Date(t.date);
            return d.toDateString() === now.toDateString();
        });
    } else if (period === 'monthly') {
        filtered = allTxns.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else {
        filtered = allTxns.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
    }

    const payments = filtered.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

    el.innerHTML = `
        <div class="analysis-summary">
            <div class="summary-item">
                <span>Total Payments</span>
                <strong>₦${payments.toLocaleString()}</strong>
            </div>
            <div class="summary-item">
                <span>Total Expenses</span>
                <strong>₦${expenses.toLocaleString()}</strong>
            </div>
            <div class="summary-item">
                <span>Net</span>
                <strong>₦${(payments - expenses).toLocaleString()}</strong>
            </div>
        </div>
        <div class="txn-list">
            ${filtered.length === 0
                ? '<p class="no-data">No transactions for this period</p>'
                : [...filtered].reverse().map(t =>
                    `<div class="transaction-item">
                        <span>${formatDate(t.date)}</span>
                        <span>${t.username || '-'}</span>
                        <span>₦${(t.amount || 0).toLocaleString()}</span>
                        <span class="txn-type ${t.type}">${t.type}</span>
                        <span>${t.paymentCategory || '-'}</span>
                    </div>`
                ).join('')
            }
        </div>
    `;
}

// ===========================
// ADMIN ACTIONS
// ===========================
async function handleRecordTransaction(e) {
    e.preventDefault();
    const targetUsername  = document.getElementById('transactionUsername').value.trim();
    const amount          = document.getElementById('transactionAmount').value;
    const type            = document.getElementById('transactionType').value;
    const paymentCategory = document.getElementById('paymentCategory')?.value;
    const narration        = document.getElementById('transactionNarration')?.value?.trim();

    if (!type) {
        return alert('Please select transaction type (Payment or Expense)');
    }

    if (type === 'payment' && !paymentCategory) {
        return alert('Please select payment category');
    }

    if (type === 'expense' && !narration) {
        return alert('Please provide expense narration/description');
    }

    try {
        await apiCall('/api/transactions', 'POST', { 
            targetUsername, 
            amount, 
            type, 
            paymentCategory: type === 'payment' ? paymentCategory : narration,
            narration: type === 'expense' ? narration : null
        });
        alert('Transaction recorded successfully!');
        document.getElementById('adminTransactionForm').reset();
        document.getElementById('categoryGroup').style.display = 'none';
        document.getElementById('narrationGroup').style.display = 'none';
        await loadAdminDashboard();
    } catch (err) {
        alert(`Failed: ${err.message}`);
    }
}

async function handleAddCertificate(e) {
    e.preventDefault();
    const targetUsername = document.getElementById('certStudentUsername')?.value?.trim();
    const certName       = document.getElementById('certName')?.value?.trim();
    const status         = document.getElementById('certStatus')?.value;

    try {
        await apiCall('/api/certificates', 'POST', { targetUsername, certName, status });
        alert('Certificate updated!');
        document.getElementById('adminCertForm').reset();
        await loadAdminDashboard();
    } catch (err) {
        alert(`Failed: ${err.message}`);
    }
}

async function handleSendAlert(e) {
    e.preventDefault();
    const message = document.getElementById('alertMessage')?.value?.trim();

    if (!message) {
        return alert('Please enter an alert message');
    }

    try {
        const data = await apiCall('/api/alerts', 'POST', { message });
        alert(`✓ Alert sent to ${data.count} students!`);
        document.getElementById('adminAlertForm').reset();
        document.getElementById('alertMessage').value = '';
    } catch (err) {
        alert(`Failed to send alert: ${err.message}`);
    }
}

async function checkSkippedClasses() {
    const el = document.getElementById('skippedClassesList');
    if (!el) return;

    try {
        const data = await apiCall('/api/skipped-classes');
        el.innerHTML = data.count === 0
            ? '<p class="no-data">No skipped classes detected!</p>'
            : data.skipped.map(s =>
                `<div class="skipped-item" style="padding: 10px; background: #fee2e2; border-left: 4px solid #ef4444; margin-bottom: 8px; border-radius: 4px;">
                    <strong>${s.username}</strong><br>
                    Expected: ${s.expected} | Actual: ${s.actual} | <span style="color: #dc2626; font-weight: bold;">Missed: ${s.missed}</span>
                </div>`
            ).join('');
    } catch (err) {
        el.innerHTML = `<p class="error">Failed to check: ${err.message}</p>`;
    }
}

// ===========================
// PDF DOWNLOAD
// ===========================
function downloadTransactionsPDF(userType) {
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let transactions = [];
    let title = '';

    if (userType === 'student') {
        transactions = (currentUser.transactions || []).filter(t => t.type === 'payment');
        title = `Transaction Report - ${currentUser.username}`;
    } else {
        allUsers.forEach(user => {
            (user.transactions || []).forEach(t => {
                transactions.push({ ...t, username: user.username });
            });
        });
        title = 'All Transactions Report';
    }

    if (transactions.length === 0) {
        alert('No transactions to download');
        return;
    }

    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = transactions.map(t => {
        const row = [
            formatDate(t.date),
            `₦${(t.amount || 0).toLocaleString()}`,
            t.type.charAt(0).toUpperCase() + t.type.slice(1),
            t.paymentCategory || '-'
        ];
        if (userType === 'admin') row.push(t.username || 'N/A');
        return row;
    });

    const headers = userType === 'admin'
        ? [['Date', 'Amount', 'Type', 'Category', 'Student']]
        : [['Date', 'Amount', 'Type', 'Category']];

    doc.autoTable({
        startY: 40,
        head: headers,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 10 }
    });

    const totalPayments = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.text(`Total Payments: ₦${totalPayments.toLocaleString()}`, 14, finalY);
    doc.text(`Total Expenses: ₦${totalExpenses.toLocaleString()}`, 14, finalY + 7);
    doc.text(`Net: ₦${(totalPayments - totalExpenses).toLocaleString()}`, 14, finalY + 14);

    const filename = userType === 'student'
        ? `transactions_${currentUser.username}_${Date.now()}.pdf`
        : `all_transactions_${Date.now()}.pdf`;

    doc.save(filename);
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-NG', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function showConfirmModal(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
    confirmCallback = callback;
}
