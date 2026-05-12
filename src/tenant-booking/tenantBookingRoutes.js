/**
 * ============================================
 * Tenant Booking Routes
 * ============================================
 * 
 * POST /api/tenants/booking
 * 
 * Dedicated booking endpoint with proper
 * MVC structure (controller → service → DTO).
 * ============================================
 */

const express = require('express');
const router = express.Router();
const tenantBookingController = require('./tenantBookingController');

// ── Book a tenant into a room ──
router.post('/booking', tenantBookingController.bookTenant);

module.exports = router;
