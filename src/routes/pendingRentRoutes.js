/**
 * Pending Rent Routes
 * 
 * ISOLATED ROUTES - Does NOT modify existing routes or APIs.
 * All operations are READ-ONLY.
 * 
 * GET /api/rent/pending - Get pending rent collection data (arrears-based)
 */

const express = require('express');
const router = express.Router();
const pendingRentService = require('../services/PendingRentService');

/**
 * GET /api/rent/pending
 * 
 * Get pending rent collection data with arrears aggregation.
 * Fetches ALL unpaid records across all months, groups by tenant,
 * and returns cumulative totals (arrears).
 * 
 * Supports filters: room_id, payment_status, search, page, limit
 * 
 * Examples:
 *   /api/rent/pending
 *   /api/rent/pending?payment_status=overdue
 *   /api/rent/pending?room_id=abc123
 *   /api/rent/pending?search=Ahmed
 *   /api/rent/pending?page=1&limit=10
 */
router.get('/pending', async (req, res) => {
    try {
        const {
            room_id,
            payment_status,
            search,
            page,
            limit
        } = req.query;

        const result = await pendingRentService.getPendingRents({
            room_id,
            payment_status,
            search,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20
        });

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                summary: result.summary,
                total: result.total,
                page: result.page,
                limit: result.limit,
                total_pages: result.total_pages
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in GET /api/rent/pending:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending rent data'
        });
    }
});

/**
 * GET /api/rent/pending/summary
 * 
 * Get only summary statistics for pending rents (arrears).
 */
router.get('/pending/summary', async (req, res) => {
    try {
        const result = await pendingRentService.getPendingRentSummary({});

        if (result.success) {
            res.status(200).json({
                success: true,
                summary: result.summary,
                total: result.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in GET /api/rent/pending/summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending rent summary'
        });
    }
});

/**
 * GET /api/rent/pending/stats
 * 
 * Get occupied rooms and active tenants counts for summary cards.
 */
router.get('/pending/stats', async (req, res) => {
    try {
        const result = await pendingRentService.getStats();

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in GET /api/rent/pending/stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending rent stats'
        });
    }
});

module.exports = router;
