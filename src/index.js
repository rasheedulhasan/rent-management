const express = require('express');
const cors = require('cors');
const path = require('path'); // ✅ added
require('dotenv').config();

const buildingRoutes = require('./routes/buildingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// ✅ SERVE ANGULAR APP
// =====================
const angularPath = path.join(__dirname, '../admin-dashboard');

// Static files
app.use(
  '/rent-management/admin-dashboard',
  express.static(angularPath)
);

// Angular routing fallback
app.get('/rent-management/admin-dashboard/*', (req, res) => {
  res.sendFile(path.join(angularPath, 'index.csr.html'));
});
// =====================
// Health check endpoint
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
// 404 handler (KEEP LAST)
// =====================
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// =====================
// Error handling
// =====================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Something went wrong'
    });
});

// =====================
// Start server
// =====================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;