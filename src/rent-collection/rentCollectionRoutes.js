/**
 * ============================================
 * Rent Collection Routes
 * ============================================
 * 
 * POST /api/rent/collect
 * 
 * Reusable endpoint for both:
 *   - Mobile App
 *   - Admin Dashboard
 * ============================================
 */

const express = require('express');
const router = express.Router();
const rentCollectionController = require('./rentCollectionController');

// ── Collect Rent ──
router.post('/collect', rentCollectionController.collectRent);

module.exports = router;
