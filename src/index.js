const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const buildingRoutes = require('./routes/buildingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

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