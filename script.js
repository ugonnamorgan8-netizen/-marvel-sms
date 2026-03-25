/* ===========================
   Marvel Students Management System
   JavaScript - Connected to Real Backend API
   Version 2.0 - MongoDB + JWT Auth
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

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

// ===========================
// Global State
// ===========================
let currentUser   = null;
let allUsers      = [];
let confirmCallback = null;
let pinCallback     = null;
let inactivityTimer = null;
let pendingActivityDescription = null;

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
            // Token expired or invalid — clear and show login
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
    document.getElementById('regRole')?.addEventListener('change', (e) => {
        const pinGroup = document.getElementById('pinFieldGroup');
        if (pinGroup) {
            pinGroup.style.display = e.target.value === 'student' ? 'block' : 'none';
        }
    });

    // Login form
    document.getElementById('loginFormElement')?.addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerFormElement')?.addEventListener('submit', handleRegister);

    // Student logout
    document.getElementById('studentLogout')?.addEventListener('click', handleLogout);

    // Admin logout
    document.getElementById('adminLogout')?.addEventListener('click', handleLogout);

    // Student: log activity button
    document.getElementById('logActivityBtn')?.addEventListener('click', () => {
        const desc = document.getElementById('activityDescription')?.value?.trim();
        if (!desc) return alert('Please enter an activity description.');
        pendingActivityDescription = desc;
        showPinModal((verified) => {
            if (verified) logActivity(desc);
        });
    });

    // Admin: record transaction
    document.getElementById('adminTransactionForm')?.addEventListener('submit', handleRecordTransaction);

    // Admin: add certificate
    document.getElementById('adminCertForm')?.addEventListener('submit', handleAddCertificate);

    // Admin: license payment
    document.getElementById('adminLicensePaymentForm')?.addEventListener('submit', handleLicensePayment);

    // Admin: check skipped classes
    document.getElementById('checkSkippedClasses')?.addEventListener('click', checkSkippedClasses);

    // Admin: download PDF
    document.getElementById('adminDownloadPDF')?.addEventListener('click', () => downloadTransactionsPDF('admin'));

    // Student: download PDF
    document.getElementById('studentDownloadPDF')?.addEventListener('click', () => downloadTransactionsPDF('student'));

    // Transaction type toggle (payment category)
    document.getElementById('transactionType')?.addEventListener('change', (e) => {
        const catGroup = document.getElementById('paymentCategoryGroup');
        if (catGroup) {
            catGroup.style.display = e.target.value === 'payment' ? 'block' : 'none';
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

    // Certificate search (admin)
    document.getElementById('adminCertSearch')?.addEventListener('input', (e) => {
        renderAdminCertList(e.target.value.toLowerCase());
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
    showPage('authPage');
}

// ===========================
// STUDENT DASHBOARD
// ===========================
function loadStudentDashboard() {
    if (!currentUser) return;

    document.getElementById('studentName').textContent = currentUser.username;

    // Schedule
    const scheduleEl = document.getElementById('studentSchedule');
    if (scheduleEl) {
        scheduleEl.textContent = currentUser.schedule?.join(', ').toUpperCase() || 'Not set';
    }

    // Training progress
    const daysEl = document.getElementById('studentDaysRemaining');
    if (daysEl) {
        const done = currentUser.activities?.length || 0;
        const total = currentUser.trainingDurationDays || 30;
        daysEl.textContent = `${done} / ${total} days completed`;
    }

    // Course end date
    const endDateEl = document.getElementById('studentCourseEndDate');
    if (endDateEl && currentUser.courseEndDate) {
        endDateEl.textContent = formatDate(currentUser.courseEndDate);
    }

    // Financial
    const payments = currentUser.transactions?.filter(t => t.type === 'payment') || [];
    const totalPaid = payments.reduce((sum, t) => sum + t.amount, 0);
    const required  = currentUser.requiredAmount || 50000;
    const balance   = required - totalPaid;

    const paidEl    = document.getElementById('studentTotalPaid');
    const balanceEl = document.getElementById('studentBalance');
    const reqEl     = document.getElementById('studentRequiredAmount');

    if (paidEl)    paidEl.textContent    = `₦${totalPaid.toLocaleString()}`;
    if (balanceEl) balanceEl.textContent = `₦${Math.max(0, balance).toLocaleString()}`;
    if (reqEl)     reqEl.textContent     = `₦${required.toLocaleString()}`;

    // Alerts
    renderStudentAlerts();

    // Activities
    renderStudentActivities();

    // Certificates
    renderStudentCertificates();

    // Transactions
    renderStudentTransactions();
}

function renderStudentAlerts() {
    const alertsEl = document.getElementById('studentAlerts');
    if (!alertsEl) return;
    const alerts = currentUser.alerts || [];
    alertsEl.innerHTML = alerts.length === 0
        ? '<p class="no-data">No new alerts</p>'
        : alerts.map(a => `<div class="alert-item"><i class="fas fa-bell"></i> ${a}</div>`).join('');
}

function renderStudentActivities() {
    const el = document.getElementById('studentActivitiesList');
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
    const txns = currentUser.transactions?.filter(t => t.type === 'payment') || [];
    el.innerHTML = txns.length === 0
        ? '<p class="no-data">No transactions yet</p>'
        : [...txns].reverse().map(t =>
            `<div class="transaction-item">
                <span>${formatDate(t.date)}</span>
                <span>₦${t.amount.toLocaleString()}</span>
                <span>${t.paymentCategory || '-'}</span>
            </div>`
        ).join('');
}

// ===========================
// LOG ACTIVITY
// ===========================
async function logActivity(description) {
    try {
        const data = await apiCall('/api/activities', 'POST', { description });
        currentUser.activities = data.activities;
        localStorage.setItem('marvel_user', JSON.stringify(currentUser));
        renderStudentActivities();

        // Update days progress
        const daysEl = document.getElementById('studentDaysRemaining');
        if (daysEl) {
            const done  = currentUser.activities.length;
            const total = currentUser.trainingDurationDays || 30;
            daysEl.textContent = `${done} / ${total} days completed`;
        }

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
        allUsers = data.users;
        renderAdminStudentList();
        renderAdminCertList('');
        renderTransactionAnalysis('daily');
        updateLicensePaymentStats();
    } catch (err) {
        console.error('Failed to load admin dashboard:', err);
    }
}

function renderAdminStudentList() {
    const el = document.getElementById('adminStudentList');
    if (!el) return;

    const students = allUsers.filter(u => u.role === 'student');
    el.innerHTML = students.length === 0
        ? '<p class="no-data">No students registered yet</p>'
        : students.map(s => {
            const totalPaid = (s.transactions || [])
                .filter(t => t.type === 'payment')
                .reduce((sum, t) => sum + t.amount, 0);
            const balance = (s.requiredAmount || 50000) - totalPaid;
            const days = s.activities?.length || 0;

            return `<div class="student-item">
                <div class="student-info">
                    <strong>${s.username}</strong>
                    <span>Schedule: ${s.schedule?.join(', ').toUpperCase() || 'N/A'}</span>
                    <span>Days: ${days} / ${s.trainingDurationDays || 30}</span>
                    <span>Balance: ₦${Math.max(0, balance).toLocaleString()}</span>
                </div>
                <div class="student-certs">
                    ${(s.certificates || []).map(c =>
                        `<span class="cert-badge status-${c.status}">${c.name}: ${c.status}</span>`
                    ).join('')}
                </div>
            </div>`;
        }).join('');
}

function renderAdminCertList(search = '') {
    const el = document.getElementById('adminCertList');
    if (!el) return;

    const students = allUsers.filter(u => u.role === 'student');
    const items = [];

    students.forEach(s => {
        (s.certificates || []).forEach(c => {
            if (!search || c.name.toLowerCase().includes(search) || s.username.toLowerCase().includes(search)) {
                items.push({ student: s.username, cert: c });
            }
        });
    });

    el.innerHTML = items.length === 0
        ? '<p class="no-data">No certificates found</p>'
        : items.map(item =>
            `<div class="cert-item">
                <strong>${item.cert.name}</strong>
                <span>${item.student}</span>
                <span class="cert-status status-${item.cert.status}">${item.cert.status}</span>
                <span>${formatDate(item.cert.addedDate)}</span>
            </div>`
        ).join('');
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

    const payments = filtered.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

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
                        <span>₦${t.amount.toLocaleString()}</span>
                        <span class="txn-type ${t.type}">${t.type}</span>
                        <span>${t.paymentCategory || '-'}</span>
                    </div>`
                ).join('')
            }
        </div>
    `;
}

function updateLicensePaymentStats() {
    const students = allUsers.filter(u => u.role === 'student');
    let pendingCount  = 0;
    let pendingAmount = 0;

    students.forEach(s => {
        (s.transactions || []).forEach(t => {
            if (t.paymentCategory === 'license' && t.paidOnline === false) {
                pendingCount++;
                pendingAmount += t.amount;
            }
        });
    });

    const countEl  = document.getElementById('pendingOnlineCount');
    const amountEl = document.getElementById('pendingOnlineAmount');
    if (countEl)  countEl.textContent  = pendingCount;
    if (amountEl) amountEl.textContent = pendingAmount.toLocaleString();
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

    try {
        await apiCall('/api/transactions', 'POST', { targetUsername, amount, type, paymentCategory });
        alert('Transaction recorded successfully!');
        document.getElementById('adminTransactionForm').reset();
        await loadAdminDashboard(); // refresh
    } catch (err) {
        alert(`Failed: ${err.message}`);
    }
}

async function handleAddCertificate(e) {
    e.preventDefault();
    const targetUsername = document.getElementById('certUsername')?.value?.trim();
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

async function handleLicensePayment(e) {
    e.preventDefault();
    const targetUsername = document.getElementById('licenseUsername').value.trim();
    const amount         = document.getElementById('licenseAmount').value;
    const paidOnline     = document.getElementById('paidOnline').checked;

    try {
        await apiCall('/api/license-payment', 'POST', { targetUsername, amount, paidOnline });
        alert('License payment recorded!');
        document.getElementById('adminLicensePaymentForm').reset();
        await loadAdminDashboard();
    } catch (err) {
        alert(`Failed: ${err.message}`);
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
                `<div class="skipped-item">
                    <strong>${s.username}</strong>
                    Expected: ${s.expected} | Actual: ${s.actual} |
                    <span class="missed">Missed: ${s.missed}</span>
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
            `₦${t.amount.toLocaleString()}`,
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

    const totalPayments = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
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
