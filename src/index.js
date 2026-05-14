const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const buildingRoutes = require('./routes/buildingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const tenantBookingRoutes = require('./tenant-booking/tenantBookingRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const rentCollectionRoutes = require('./rent-collection/rentCollectionRoutes');
const rentLedgerRoutes = require('./rent-ledger/rentLedgerRoutes');
const rentLedgerCycleRoutes = require('./routes/rentLedgerCycleRoutes');
const pendingRentRoutes = require('./routes/pendingRentRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// =====================
// Feature Flags
// =====================
const ENABLE_PENDING_RENT_MODULE = process.env.ENABLE_PENDING_RENT_MODULE === 'true';

// =====================
// Middleware
// =====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// Angular Path
// =====================
const angularPath = path.join(__dirname, '../admin-dashboard');

// =====================
// Serve Angular (IMPORTANT)
// =====================
app.use('/admin-dashboard', express.static(angularPath));

// Angular fallback (ONLY ONE, clean version)
app.get('/admin-dashboard/*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(angularPath, 'index.csr.html'));
});

// Optional root redirect
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(angularPath, 'index.csr.html'));
});

// =====================
// Health check
// =====================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Rent Collection System API'
  });
});

// =====================
// API Routes
// =====================
app.use('/api/buildings', buildingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tenants', tenantBookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// =====================
// Rent Collection API (Reusable — Mobile + Dashboard)
// POST /api/rent/collect
// =====================
app.use('/api/rent', rentCollectionRoutes);

// =====================
// Rent Ledger API (Simplified Payment Recording)
// POST /api/rent-ledger/record
// =====================
app.use('/api/rent-ledger', rentLedgerRoutes);

// =====================
// Rent Ledger Cycle API (Monthly Cycle Job)
// POST /api/rent-ledger/cycle/run
// GET  /api/rent-ledger/cycle/status
// =====================
app.use('/api/rent-ledger', rentLedgerCycleRoutes);

// =====================
// Pending Rent API (Read-only)
// GET /api/rent/pending
// GET /api/rent/pending/summary
// GET /api/rent/pending/stats
// =====================
app.use('/api/rent', pendingRentRoutes);

// =====================
// Pending Rent Module (Isolated Add-on)
// Uses move-in-date based due day calculation.
// =====================
if (ENABLE_PENDING_RENT_MODULE) {
  const moveInDateRentRoutes = require('./routes/moveInDateRentRoutes');
  app.use('/api/rent', moveInDateRentRoutes);
  console.log('✓ Pending Rent Module enabled (move-in-date based due day calculation)');
} else {
  console.log('○ Pending Rent Module disabled (ENABLE_PENDING_RENT_MODULE not set or false)');
}

// =====================
// Invoices API
// GET /api/invoices
// GET /api/invoices/:id
// =====================
app.use('/api/invoices', invoiceRoutes);

// =====================
// Reports API
// GET /api/reports/summary
// GET /api/reports/monthly
// =====================
app.use('/api/reports', reportRoutes);

// =====================
// 404 handler (LAST)
// =====================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// =====================
// Error handler
// =====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong'
  });
});

// =====================
// Start server
// =====================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`Dashboard: http://localhost:${PORT}/admin-dashboard`);
});

module.exports = app;